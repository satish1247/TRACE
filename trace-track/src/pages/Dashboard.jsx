import React, { useState, useEffect, useRef, useCallback } from 'react';
import { subscribeIncidents, subscribeHops, updateIncident, db } from '../lib/firebase';
import { computeHop } from '../lib/taint';

// Color map for node kinds
const KIND_COLORS = {
  scammer: '#ef4444',
  mule: '#f59e0b',
  merchant: '#14b8a6',
  individual: '#8892b0',
  cashout: '#6b7280',
  victim: '#4f8fff',
};

function formatINR(val) {
  if (val == null) return '₹0';
  return '₹' + Math.round(val).toLocaleString('en-IN');
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ============================================================
// SVG Animated Map Component
// ============================================================
// ============================================================
// SVG Animated Map Component (Redesigned - Zero Overlap)
// ============================================================
function HopMap({ hops, incident, onRecoveryComplete }) {
  const [animatedNodes, setAnimatedNodes] = useState(new Set());
  const [recoveryPhase, setRecoveryPhase] = useState(false);
  const [selectedNode, setSelectedNode] = useState(null);

  const VIEW_WIDTH = 1380;
  const VIEW_HEIGHT = 840;

  // Stagger node appearance layer by layer
  useEffect(() => {
    if (hops.length === 0) return;

    const layers = {};
    hops.forEach(h => {
      if (!layers[h.hop]) layers[h.hop] = [];
      layers[h.hop].push(h.id);
    });

    let delay = 0;
    const timers = [];
    Object.keys(layers).sort((a, b) => Number(a) - Number(b)).forEach(layer => {
      layers[layer].forEach((id, i) => {
        timers.push(setTimeout(() => {
          setAnimatedNodes(prev => new Set([...prev, id]));
        }, delay + i * 80));
      });
      delay += layers[layer].length * 80 + 200;
    });

    return () => timers.forEach(clearTimeout);
  }, [hops.length]);

  // Build perfectly spaced layout
  const buildLayout = useCallback(() => {
    if (hops.length === 0) return { nodes: [], edges: [], recoveryPaths: [] };

    const victimNode = {
      id: 'victim',
      x: 70,
      y: 420,
      r: 24,
      label: 'Victim (Priya Sharma)',
      vpa: 'priya@upi',
      kind: 'victim',
      amount: incident?.amount || 0,
      held: 0,
      taint: 0,
      isVictim: true,
    };

    const nodes = [victimNode];
    const edges = [];
    const nodePositions = { victim: { x: victimNode.x, y: victimNode.y } };

    // Group hops by level
    const layer0 = hops.filter(h => h.hop === 0);
    const layer1 = hops.filter(h => h.hop === 1);
    const layer2 = hops.filter(h => h.hop === 2);
    const layer3 = hops.filter(h => h.hop === 3);

    // Hop 0: Scammer
    layer0.forEach(hop => {
      const node = {
        id: hop.id,
        x: 230,
        y: 420,
        r: 26,
        label: hop.label || 'Scammer Account',
        vpa: hop.toVpa,
        kind: 'scammer',
        amount: hop.amount,
        held: hop.held || hop.amount,
        taint: hop.taint || hop.amount,
        hopData: hop,
      };
      nodes.push(node);
      nodePositions[hop.id] = { x: node.x, y: node.y };

      edges.push({
        from: nodePositions['victim'],
        to: { x: node.x, y: node.y },
        hopId: hop.id,
        amount: hop.amount,
        kind: 'scammer',
      });
    });

    // Hop 1: 10 Mules (x = 470, vertically spaced by 76px from y = 55 to y = 740)
    layer1.forEach((hop, i) => {
      const y = 55 + i * 76;
      const node = {
        id: hop.id,
        x: 470,
        y,
        r: 18,
        label: hop.label,
        vpa: hop.toVpa,
        kind: 'mule',
        index: i + 1,
        amount: hop.amount,
        held: hop.held,
        taint: hop.taint,
        hopData: hop,
      };
      nodes.push(node);
      nodePositions[hop.id] = { x: node.x, y: node.y };

      const parentPos = (hop.parentHopId && nodePositions[hop.parentHopId]) || (layer0[0] && nodePositions[layer0[0].id]) || nodePositions['victim'];
      edges.push({
        from: parentPos,
        to: { x: node.x, y: node.y },
        hopId: hop.id,
        amount: hop.amount,
        kind: 'mule',
      });
    });

    // Hop 2: Layer 3 - Merchants & Cashouts (x = 830, spaced by 125px from y = 90 to y = 715)
    layer2.forEach((hop, i) => {
      const y = 90 + i * 125;
      const node = {
        id: hop.id,
        x: 830,
        y,
        r: 20,
        label: hop.label,
        vpa: hop.toVpa,
        kind: hop.kind,
        amount: hop.amount,
        held: hop.held,
        taint: hop.taint,
        balanceBefore: hop.balanceBefore,
        forwarded: hop.forwarded,
        hopData: hop,
      };
      nodes.push(node);
      nodePositions[hop.id] = { x: node.x, y: node.y };

      let parentPos = hop.parentHopId ? nodePositions[hop.parentHopId] : null;
      if (!parentPos && layer1[0]) parentPos = nodePositions[layer1[0].id];
      if (parentPos) {
        edges.push({
          from: parentPos,
          to: { x: node.x, y: node.y },
          hopId: hop.id,
          amount: hop.amount,
          kind: hop.kind,
        });
      }
    });

    // Hop 3: Layer 4 - Tea Customer (x = 1180, aligned with Chai Corner at y = 90)
    layer3.forEach((hop) => {
      const y = 90;
      const node = {
        id: hop.id,
        x: 1180,
        y,
        r: 18,
        label: hop.label,
        vpa: hop.toVpa,
        kind: hop.kind || 'individual',
        amount: hop.amount,
        held: hop.held || 0,
        taint: hop.taint || 0,
        balanceBefore: hop.balanceBefore,
        hopData: hop,
      };
      nodes.push(node);
      nodePositions[hop.id] = { x: node.x, y: node.y };

      let parentPos = hop.parentHopId ? nodePositions[hop.parentHopId] : null;
      if (!parentPos && layer2[0]) parentPos = nodePositions[layer2[0].id];
      if (parentPos) {
        edges.push({
          from: parentPos,
          to: { x: node.x, y: node.y },
          hopId: hop.id,
          amount: hop.amount,
          kind: 'individual',
        });
      }
    });

    // Build recovery paths from all held nodes back to Victim
    const heldNodes = nodes.filter(n => !n.isVictim && n.held > 0);
    const recoveryPaths = heldNodes.map(n => ({
      from: { x: n.x, y: n.y },
      to: { x: victimNode.x, y: victimNode.y },
      amount: n.held,
      id: n.id,
    }));

    return { nodes, edges, recoveryPaths };
  }, [hops, incident]);

  const { nodes, edges, recoveryPaths } = buildLayout();

  // Trigger proportional freeze & recovery
  const triggerRecovery = useCallback(async () => {
    if (recoveryPhase || !incident) return;
    setRecoveryPhase(true);

    const totalHeld = hops.reduce((s, h) => s + (h.held || 0), 0);

    await updateIncident(incident.id, {
      status: 'recovered',
      recovered: totalHeld,
    });

    if (onRecoveryComplete) onRecoveryComplete(totalHeld);
  }, [recoveryPhase, incident, hops, onRecoveryComplete]);

  // Compute smooth horizontal S-curve Bézier path
  const makeBezierPath = (from, to) => {
    const dx = to.x - from.x;
    const cx1 = from.x + dx * 0.45;
    const cy1 = from.y;
    const cx2 = from.x + dx * 0.55;
    const cy2 = to.y;
    return `M ${from.x} ${from.y} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${to.x} ${to.y}`;
  };

  const isRecovered = incident?.status === 'recovered' || recoveryPhase;

  return (
    <div className="hopmap-wrapper">
      {/* High-tech Map Legend */}
      <div className="map-legend-bar">
        <div className="legend-item"><span className="legend-dot scammer" /> Scammer (Red)</div>
        <div className="legend-item"><span className="legend-dot mule" /> 10 Mule Accounts (Amber)</div>
        <div className="legend-item"><span className="legend-dot merchant" /> Innocent Shop (Teal)</div>
        <div className="legend-item"><span className="legend-dot cashout" /> ATM Cash-out (Grey)</div>
        <div className="legend-item"><span className="legend-dot" style={{ background: '#ef4444' }} /> Proportional Freeze</div>
        <div className="legend-item"><span className="legend-dot" style={{ background: '#10b981' }} /> Recovery Stream</div>
      </div>

      <svg
        className="map-svg"
        viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          {/* Arrowhead marker */}
          <marker id="arrowhead" markerWidth="7" markerHeight="5" refX="7" refY="2.5" orient="auto">
            <polygon points="0 0, 7 2.5, 0 5" fill="rgba(255,255,255,0.4)" />
          </marker>

          {/* Glow filter */}
          <filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="4" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Hold Pulse Glow filter */}
          <filter id="holdGlow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="6" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Column Grouping Guides (Subtle) */}
        <g opacity="0.12">
          <text x="70" y="24" textAnchor="middle" fill="#8892b0" fontSize="11" fontWeight="700" letterSpacing="1">VICTIM</text>
          <text x="230" y="24" textAnchor="middle" fill="#ef4444" fontSize="11" fontWeight="700" letterSpacing="1">L0 · SCAMMER</text>
          <text x="560" y="24" textAnchor="middle" fill="#f59e0b" fontSize="11" fontWeight="700" letterSpacing="1">L1 · 10 MULE ACCOUNTS</text>
          <text x="920" y="24" textAnchor="middle" fill="#14b8a6" fontSize="11" fontWeight="700" letterSpacing="1">L2 · MERCHANTS & CASHOUTS</text>
          <text x="1220" y="24" textAnchor="middle" fill="#a855f7" fontSize="11" fontWeight="700" letterSpacing="1">L3 · CUSTOMER</text>
        </g>

        {/* Edges */}
        {edges.map((edge, i) => {
          const isVisible = animatedNodes.has(edge.hopId);
          if (!isVisible) return null;

          const path = makeBezierPath(edge.from, edge.to);
          const color = KIND_COLORS[edge.kind] || '#555';

          return (
            <g key={`edge-${i}`}>
              {/* Background solid line */}
              <path
                d={path}
                className="edge-path"
                stroke={color}
                strokeWidth="2"
                opacity="0.35"
                markerEnd="url(#arrowhead)"
              />
              {/* Flowing animated dash */}
              <path
                d={path}
                className="edge-flow"
                stroke={color}
                strokeWidth="2.5"
                opacity="0.8"
              />
            </g>
          );
        })}

        {/* Recovery Stream Paths & Particles */}
        {isRecovered && recoveryPaths.map((rp, i) => {
          const path = makeBezierPath(rp.from, rp.to);
          return (
            <g key={`recovery-${i}`}>
              <path
                d={path}
                fill="none"
                stroke="#10b981"
                strokeWidth="2.5"
                strokeDasharray="8 6"
                opacity="0.6"
              />
              <path id={`recovery-curve-${i}`} d={path} fill="none" stroke="none" />
              <circle r="6" fill="#10b981" filter="url(#glow)">
                <animateMotion dur="2.2s" repeatCount="indefinite" begin={`${i * 0.15}s`}>
                  <mpath href={`#recovery-curve-${i}`} />
                </animateMotion>
              </circle>
            </g>
          );
        })}

        {/* Nodes & Labels */}
        {nodes.map((node) => {
          const isVisible = node.isVictim || animatedNodes.has(node.id);
          if (!isVisible) return null;

          const color = KIND_COLORS[node.kind] || '#555';
          const hasHold = node.held > 0;
          const isSelected = selectedNode?.id === node.id;

          // Compute free balance if merchant
          let freeBalance = null;
          if (node.hopData && node.hopData.balanceBefore != null) {
            const cb = node.hopData.balanceBefore + node.hopData.amount - (node.hopData.forwarded || 0);
            freeBalance = cb - (node.held || 0);
          }

          return (
            <g
              key={node.id}
              onClick={() => setSelectedNode(node)}
              style={{ cursor: 'pointer' }}
            >
              {/* Red hold pulse ring */}
              {hasHold && (
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={node.r + 6}
                  fill="none"
                  stroke="#ef4444"
                  strokeWidth="2"
                  opacity="0.6"
                  className="node-held-pulse"
                />
              )}

              {/* Main Node Circle */}
              <circle
                cx={node.x}
                cy={node.y}
                r={node.r}
                fill={color}
                opacity={isSelected ? 1 : 0.9}
                filter={hasHold ? 'url(#holdGlow)' : undefined}
                stroke={isSelected ? '#ffffff' : 'rgba(255,255,255,0.2)'}
                strokeWidth={isSelected ? 3 : 1}
                className="node-circle"
              />

              {/* Inside Icon / Index */}
              <text
                x={node.x}
                y={node.y + 1}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="#ffffff"
                fontFamily="'JetBrains Mono', monospace"
                fontSize={node.isVictim ? '13' : '10'}
                fontWeight="700"
                pointerEvents="none"
              >
                {node.isVictim ? '👤' : node.kind === 'mule' ? `M${node.index}` : node.kind === 'cashout' ? 'ATM' : `₹${Math.round(node.amount)}`}
              </text>

              {/* VICTIM NODE LABELS */}
              {node.isVictim && (
                <g pointerEvents="none">
                  <text x={node.x} y={node.y - 34} textAnchor="middle" fill="#4f8fff" fontSize="12" fontWeight="700">
                    Victim Account
                  </text>
                  <text x={node.x} y={node.y + 36} textAnchor="middle" fill="#f0f4ff" fontSize="12" fontWeight="700">
                    {formatINR(node.amount)} Stolen
                  </text>
                  {isRecovered && (
                    <text x={node.x} y={node.y + 52} textAnchor="middle" fill="#10b981" fontSize="11" fontWeight="700">
                      +{formatINR(incident?.recovered || node.amount)} Recovered!
                    </text>
                  )}
                </g>
              )}

              {/* SCAMMER NODE LABELS */}
              {node.kind === 'scammer' && (
                <g pointerEvents="none">
                  <text x={node.x} y={node.y - 36} textAnchor="middle" fill="#ef4444" fontSize="12" fontWeight="700">
                    Scammer (L0)
                  </text>
                  <text x={node.x} y={node.y + 36} textAnchor="middle" fill="#f0f4ff" fontSize="12" fontWeight="700">
                    {formatINR(node.amount)}
                  </text>
                  <text x={node.x} y={node.y + 50} textAnchor="middle" fill="#ef4444" fontSize="10" fontWeight="600">
                    🔒 100% Flagged
                  </text>
                </g>
              )}

              {/* MULE NODES LABELS (Horizontally to the right — Zero Overlap) */}
              {node.kind === 'mule' && (
                <g pointerEvents="none">
                  <text x={node.x + 26} y={node.y - 3} fill="#f0f4ff" fontSize="12" fontWeight="600">
                    {node.label}
                  </text>
                  <text x={node.x + 26} y={node.y + 12} fill="#ef4444" fontFamily="'JetBrains Mono', monospace" fontSize="11" fontWeight="600">
                    {formatINR(node.amount)} • 🔒 Held {formatINR(node.held)}
                  </text>
                </g>
              )}

              {/* LAYER 2: MERCHANTS & CASHOUTS LABELS (Horizontally to the right) */}
              {node.kind === 'merchant' && (
                <g pointerEvents="none">
                  <text x={node.x + 28} y={node.y - 5} fill="#14b8a6" fontSize="12" fontWeight="700">
                    {node.label} (Innocent)
                  </text>
                  <text x={node.x + 28} y={node.y + 11} fill="#10b981" fontFamily="'JetBrains Mono', monospace" fontSize="11" fontWeight="600">
                    Rec'd {formatINR(node.amount)} • 🔒 Held: {formatINR(node.held)} | <tspan fill="#34d399" fontWeight="700">Free: {formatINR(freeBalance || 199990)}</tspan>
                  </text>
                </g>
              )}

              {node.kind === 'cashout' && (
                <g pointerEvents="none">
                  <text x={node.x + 28} y={node.y - 5} fill="#9ca3af" fontSize="12" fontWeight="700">
                    {node.label}
                  </text>
                  <text x={node.x + 28} y={node.y + 11} fill="#f87171" fontFamily="'JetBrains Mono', monospace" fontSize="11" fontWeight="600">
                    Rec'd {formatINR(node.amount)} • 💨 Escaped via ATM (Unrecoverable)
                  </text>
                </g>
              )}

              {node.kind === 'individual' && node.id.includes('recharge') && (
                <g pointerEvents="none">
                  <text x={node.x + 28} y={node.y - 5} fill="#818cf8" fontSize="12" fontWeight="700">
                    {node.label}
                  </text>
                  <text x={node.x + 28} y={node.y + 11} fill="#cbd5e1" fontFamily="'JetBrains Mono', monospace" fontSize="11" fontWeight="600">
                    Rec'd {formatINR(node.amount)} • 🔒 Held: {formatINR(node.held)}
                  </text>
                </g>
              )}

              {/* LAYER 3: TEA CUSTOMER */}
              {node.kind === 'individual' && !node.id.includes('recharge') && (
                <g pointerEvents="none">
                  <text x={node.x} y={node.y - 28} textAnchor="middle" fill="#cbd5e1" fontSize="12" fontWeight="700">
                    {node.label}
                  </text>
                  <text x={node.x} y={node.y + 30} textAnchor="middle" fill="#10b981" fontFamily="'JetBrains Mono', monospace" fontSize="11" fontWeight="700">
                    Rec'd {formatINR(node.amount)}
                  </text>
                  <text x={node.x} y={node.y + 45} textAnchor="middle" fill="#34d399" fontFamily="'JetBrains Mono', monospace" fontSize="10">
                    ✅ Held ₹0 (Below ₹15 floor)
                  </text>
                </g>
              )}
            </g>
          );
        })}
      </svg>

      {/* Interactive Node Details Box if clicked */}
      {selectedNode && (
        <div className="node-inspector-card">
          <div className="inspector-header">
            <strong>{selectedNode.label}</strong>
            <button className="inspector-close" onClick={() => setSelectedNode(null)}>✕</button>
          </div>
          <div className="inspector-body">
            <div><strong>VPA:</strong> {selectedNode.vpa || 'N/A'}</div>
            <div><strong>Kind:</strong> <span className={`kind-badge ${selectedNode.kind}`}>{selectedNode.kind}</span></div>
            <div><strong>Amount Received:</strong> {formatINR(selectedNode.amount)}</div>
            <div><strong>Taint Computed:</strong> {formatINR(selectedNode.taint)}</div>
            <div><strong>Held by TRACE:</strong> <span className="held-amount">{formatINR(selectedNode.held)}</span></div>
            {selectedNode.balanceBefore != null && (
              <div><strong>Protected Free Balance:</strong> <span className="free-amount">{formatINR((selectedNode.balanceBefore + selectedNode.amount - (selectedNode.forwarded || 0)) - selectedNode.held)}</span></div>
            )}
          </div>
        </div>
      )}

      {/* Floating Action Button: Freeze & Recover */}
      {hops.length > 0 && incident?.status === 'tracing' && !recoveryPhase && (
        <div className="map-action-overlay">
          <button
            className="pay-btn success map-freeze-action-btn"
            onClick={triggerRecovery}
            id="freeze-recover-btn"
          >
            Execute Proportional Freeze & Asset Recovery
          </button>
        </div>
      )}

      {/* Recovery Completed Badge */}
      {isRecovered && (
        <div className="map-action-overlay">
          <div className="recovery-success-pill">
            <strong>Proportional Freeze Complete: {formatINR(incident?.recovered || 0)} Recovered Back to Victim</strong>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Dashboard Component
// ============================================================
export default function Dashboard() {
  const [incidents, setIncidents] = useState([]);
  const [activeIncident, setActiveIncident] = useState(null);
  const [hops, setHops] = useState([]);
  const [clockSeconds, setClockSeconds] = useState(null);
  const [recoveredTotal, setRecoveredTotal] = useState(0);

  // Subscribe to incidents
  useEffect(() => {
    const unsub = subscribeIncidents((incs) => {
      setIncidents(incs);
      // Auto-select latest incident
      if (incs.length > 0 && !activeIncident) {
        setActiveIncident(incs[0]);
      } else if (activeIncident) {
        const updated = incs.find(i => i.id === activeIncident.id);
        if (updated) setActiveIncident(updated);
      }
    });
    return unsub;
  }, []);

  // Subscribe to hops when we have an incident
  useEffect(() => {
    if (!activeIncident) return;
    const unsub = subscribeHops(activeIncident.id, (h) => {
      setHops(h);
    });
    return unsub;
  }, [activeIncident?.id]);

  // Golden hour clock
  useEffect(() => {
    if (!activeIncident?.goldenHourEndsAt) return;

    const tick = () => {
      const remaining = Math.max(0, Math.floor((activeIncident.goldenHourEndsAt - Date.now()) / 1000));
      setClockSeconds(remaining);
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [activeIncident?.goldenHourEndsAt]);

  // Compute totals
  const totalStolen = activeIncident?.amount || 0;
  const totalTraced = hops.reduce((s, h) => s + h.amount, 0);
  const totalFrozen = hops.reduce((s, h) => s + (h.held || 0), 0);

  const handleRecoveryComplete = (amount) => {
    setRecoveredTotal(amount);
  };

  return (
    <div className="dashboard">
      {/* Header */}
      <div className="dashboard-header">
        <div>
          <h1>
            Tracking Dashboard
          </h1>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
            Real-Time Proportional Freeze & Asset Recovery Engine
          </div>
        </div>

        {incidents.length > 0 && (
          <div className="incident-selector-wrapper">
            <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-muted)' }}>
              Active Incident:
            </span>
            <select
              className="incident-select-dropdown"
              value={activeIncident?.id || ''}
              onChange={(e) => {
                const found = incidents.find(i => i.id === e.target.value);
                if (found) setActiveIncident(found);
              }}
            >
              {incidents.map(inc => (
                <option key={inc.id} value={inc.id}>
                  {inc.id.slice(0, 8)}… • ₹{inc.amount.toLocaleString('en-IN')} • [{inc.status.toUpperCase()}]
                </option>
              ))}
            </select>
          </div>
        )}

        {activeIncident && clockSeconds !== null && (
          <div className={`golden-clock ${clockSeconds < 600 ? 'urgent' : ''}`}>
            <div>
              <div className="clock-time">{formatTime(clockSeconds)}</div>
              <div className="clock-label">Golden Hour Remaining</div>
            </div>
          </div>
        )}

        {activeIncident && (
          <div className={`status-indicator ${activeIncident.status}`}>
            <span className="status-dot" />
            {activeIncident.status}
          </div>
        )}
      </div>

      {/* Stats */}
      {activeIncident && (
        <div className="stats-row">
          <div className="stat-card stolen">
            <div className="stat-label">Amount Stolen</div>
            <div className="stat-value">{formatINR(totalStolen)}</div>
          </div>
          <div className="stat-card traced">
            <div className="stat-label">Total Traced</div>
            <div className="stat-value">{formatINR(totalTraced)}</div>
          </div>
          <div className="stat-card frozen">
            <div className="stat-label">Amount Frozen</div>
            <div className="stat-value">{formatINR(totalFrozen)}</div>
          </div>
          <div className="stat-card recovered">
            <div className="stat-label">Recovered</div>
            <div className="stat-value">{formatINR(activeIncident.recovered || recoveredTotal)}</div>
          </div>
        </div>
      )}

      {!activeIncident && (
        <div className="empty-state" style={{ minHeight: 400 }}>
          <div className="icon">📡</div>
          <div className="title">Waiting for Incident</div>
          <div className="subtitle">
            Report fraud from the Victim panel to begin real-time tracking.
            This dashboard updates automatically via Firestore onSnapshot.
          </div>
          <button
            className="pay-btn"
            onClick={() => window.open('/pay/victim', '_blank')}
            style={{ maxWidth: 280, marginTop: 20 }}
          >
            📱 Open Victim UPI Panel
          </button>
        </div>
      )}

      {/* Main Grid */}
      {activeIncident && (
        <div className="dashboard-grid">
          {/* SVG Map */}
          <div className="map-container">
            <h2>🗺️ Money Trail Map</h2>
            {hops.length === 0 ? (
              <div className="empty-state" style={{ padding: 40 }}>
                <div className="icon">🔍</div>
                <div className="title">Tracing in Progress</div>
                <div className="subtitle">
                  Execute splits from the Scammer panel to see the money trail.
                </div>
                <div className="spinner" style={{ marginTop: 16 }} />
              </div>
            ) : (
              <HopMap
                hops={hops}
                incident={activeIncident}
                onRecoveryComplete={handleRecoveryComplete}
              />
            )}
          </div>

          {/* Ledger */}
          <div className="ledger-panel">
            <h2>📒 Transaction Ledger</h2>
            {hops.length === 0 ? (
              <div className="empty-state" style={{ padding: 30 }}>
                <div className="subtitle">No hops traced yet</div>
              </div>
            ) : (
              <table className="ledger-table">
                <thead>
                  <tr>
                    <th>Hop</th>
                    <th>Account</th>
                    <th>Kind</th>
                    <th>Received</th>
                    <th>Taint</th>
                    <th>Held</th>
                    <th>Free</th>
                  </tr>
                </thead>
                <tbody>
                  {hops.map((hop) => {
                    const cb = hop.balanceBefore + hop.amount - (hop.forwarded || 0);
                    const free = cb - (hop.held || 0);

                    return (
                      <tr key={hop.id} style={{ animation: 'fadeIn 0.3s ease-out' }}>
                        <td style={{ fontWeight: 600 }}>L{hop.hop}</td>
                        <td>
                          <div style={{ fontWeight: 600, fontFamily: 'var(--font-sans)', fontSize: 11 }}>
                            {hop.label?.length > 18 ? hop.label.slice(0, 16) + '…' : hop.label}
                          </div>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{hop.toVpa}</div>
                        </td>
                        <td>
                          <span className={`kind-badge ${hop.kind}`}>{hop.kind}</span>
                        </td>
                        <td>{formatINR(hop.amount)}</td>
                        <td style={{ color: 'var(--accent-amber)' }}>{formatINR(hop.taint)}</td>
                        <td className={hop.held > 0 ? 'held-amount' : ''}>
                          {hop.held > 0 ? `🔒 ${formatINR(hop.held)}` : '—'}
                        </td>
                        <td className="free-amount">
                          {formatINR(free)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Recovery Banner */}
      {(activeIncident?.recovered > 0 || recoveredTotal > 0) && (
        <div className="recovered-banner">
          <div className="label">Total Recovered</div>
          <div className="amount">{formatINR(activeIncident?.recovered || recoveredTotal)}</div>
          <div style={{ color: 'var(--text-secondary)', fontSize: 14, marginTop: 8 }}>
            Proportional freeze held the amount, not the person.
          </div>
        </div>
      )}
    </div>
  );
}
