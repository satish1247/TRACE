import React, { useState, useEffect } from 'react';
import { SCAMMER, MULES, LAYER3, LAYER4, DEFAULT_SPLITS } from '../lib/demoData';
import { computeHop } from '../lib/taint';
import { db, subscribeIncidents, addHop, updateIncident, flagAccount, onSnapshot, collection, query, orderBy } from '../lib/firebase';

function balanceSplits(amount) {
  const safeAmt = Math.max(10, Math.round(Number(amount) || 50000));
  const base = Math.floor(safeAmt / 10);
  const remainder = safeAmt - (base * 10);
  const newSplits = Array(10).fill(base);
  newSplits[0] += remainder;
  return newSplits.map(String);
}

export default function ScammerPanel() {
  const [incidents, setIncidents] = useState([]);
  const [activeIncident, setActiveIncident] = useState(null);
  const [splits, setSplits] = useState(DEFAULT_SPLITS.map(a => String(a)));
  const [step, setStep] = useState('waiting'); // waiting | received | splitting | split-done | l3-done
  const [status, setStatus] = useState(null);
  const [receivedAmount, setReceivedAmount] = useState(0);
  const [isSplitting, setIsSplitting] = useState(false);
  const [splitProgress, setSplitProgress] = useState(0);

  // Subscribe to incidents (real-time)
  useEffect(() => {
    const unsub = subscribeIncidents((incs) => {
      setIncidents(incs);
      if (incs.length > 0) {
        if (!activeIncident) {
          const target = incs.find(i => i.status === 'reported') || incs[0];
          selectIncident(target);
        } else {
          // Keep current incident updated
          const updated = incs.find(i => i.id === activeIncident.id);
          if (updated) {
            setActiveIncident(updated);
            if (updated.status === 'tracing' || updated.status === 'frozen' || updated.status === 'recovered') {
              setStep('l3-done');
            }
          }
        }
      }
    });
    return unsub;
  }, [activeIncident?.id]);

  const selectIncident = (inc) => {
    setActiveIncident(inc);
    setReceivedAmount(inc.amount);
    setSplits(balanceSplits(inc.amount));
    if (inc.status === 'reported') {
      setStep('received');
    } else {
      setStep('l3-done');
    }
  };

  const autoBalance = () => {
    setSplits(balanceSplits(receivedAmount));
  };

  const totalSplit = splits.reduce((s, v) => s + (Number(v) || 0), 0);
  const isValidSplit = totalSplit === receivedAmount;

  const handleSplitChange = (index, value) => {
    const next = [...splits];
    next[index] = value;
    setSplits(next);
  };

  const executeSplits = async () => {
    if (!activeIncident || !isValidSplit || isSplitting) return;
    setIsSplitting(true);
    setStep('splitting');

    const incidentId = activeIncident.id;
    const amt = activeIncident.amount;

    // Update incident to tracing
    await updateIncident(incidentId, { status: 'tracing' });

    // Flag scammer account
    await flagAccount(SCAMMER.vpa, incidentId);

    // Hop 0: Victim → Scammer
    const hop0Id = await addHop(incidentId, {
      hop: 0,
      parentHopId: null,
      fromVpa: activeIncident.scammerVpa ? 'victim' : 'victim',
      toVpa: SCAMMER.vpa,
      label: SCAMMER.name,
      kind: 'scammer',
      amount: amt,
      balanceBefore: 0,
      forwarded: amt,
      taint: amt,
      held: 0,
      at: Date.now(),
    });

    setSplitProgress(1);

    // Layer 2: Scammer → 10 Mules
    const muleHopIds = [];
    for (let i = 0; i < 10; i++) {
      const splitAmt = Number(splits[i]);
      const mule = MULES[i];

      // Calculate forwarded amount (some mules will forward to L3)
      let forwarded = 0;
      const l3FromThisMule = LAYER3.filter(l => l.fromMuleIndex === i);
      if (l3FromThisMule.length > 0) {
        forwarded = l3FromThisMule.reduce((s, l) => s + l.amount, 0);
      }

      const hopResult = computeHop({
        amount: splitAmt,
        balanceBefore: mule.balance,
        forwarded,
        parentTaint: amt,
        parentBalanceBefore: 0,
        parentAmount: amt,
      });

      const hopId = await addHop(incidentId, {
        hop: 1,
        parentHopId: hop0Id,
        fromVpa: SCAMMER.vpa,
        toVpa: mule.vpa,
        label: mule.name,
        kind: 'mule',
        amount: splitAmt,
        balanceBefore: mule.balance,
        forwarded,
        taint: hopResult.taint,
        held: hopResult.held,
        at: Date.now(),
      });

      muleHopIds.push(hopId);
      await flagAccount(mule.vpa, incidentId);
      setSplitProgress(2 + i);

      // Small delay for visual effect
      await new Promise(r => setTimeout(r, 200));
    }

    setSplitProgress(12);
    setStep('split-done');

    // Layer 3: Some mules split further
    const l3HopIds = {};
    for (const l3 of LAYER3) {
      const parentMuleIndex = l3.fromMuleIndex;
      const parentMule = MULES[parentMuleIndex];
      const parentSplitAmt = Number(splits[parentMuleIndex]);

      const parentHopResult = computeHop({
        amount: parentSplitAmt,
        balanceBefore: parentMule.balance,
        forwarded: LAYER3.filter(x => x.fromMuleIndex === parentMuleIndex).reduce((s, x) => s + x.amount, 0),
        parentTaint: amt,
        parentBalanceBefore: 0,
        parentAmount: amt,
      });

      // L3 forwarded: check if L4 entries exist
      let l3Forwarded = 0;
      if (l3.vpa === 'ramesh.chai@upi') {
        l3Forwarded = LAYER4.reduce((s, l) => s + l.amount, 0);
      }

      const l3Result = computeHop({
        amount: l3.amount,
        balanceBefore: l3.balance,
        forwarded: l3Forwarded,
        parentTaint: parentHopResult.taint,
        parentBalanceBefore: parentMule.balance,
        parentAmount: parentSplitAmt,
      });

      const hopId = await addHop(incidentId, {
        hop: 2,
        parentHopId: muleHopIds[parentMuleIndex],
        fromVpa: parentMule.vpa,
        toVpa: l3.vpa,
        label: l3.name,
        kind: l3.kind,
        amount: l3.amount,
        balanceBefore: l3.balance,
        forwarded: l3Forwarded,
        taint: l3Result.taint,
        held: l3.kind === 'cashout' ? 0 : l3Result.held,
        at: Date.now(),
      });

      l3HopIds[l3.uid] = hopId;

      if (l3.kind !== 'cashout') {
        await flagAccount(l3.vpa, incidentId);
      }

      await new Promise(r => setTimeout(r, 300));
    }

    // Layer 4: Tea stall customer
    for (const l4 of LAYER4) {
      const parentL3 = LAYER3[l4.fromL3Index];
      const parentL3HopId = l3HopIds[parentL3.uid];

      // Parent L3 taint
      const parentMuleIndex = parentL3.fromMuleIndex;
      const parentMule = MULES[parentMuleIndex];
      const parentSplitAmt = Number(splits[parentMuleIndex]);

      const parentMuleResult = computeHop({
        amount: parentSplitAmt,
        balanceBefore: parentMule.balance,
        forwarded: LAYER3.filter(x => x.fromMuleIndex === parentMuleIndex).reduce((s, x) => s + x.amount, 0),
        parentTaint: amt,
        parentBalanceBefore: 0,
        parentAmount: amt,
      });

      const l3Forwarded = LAYER4.reduce((s, l) => s + l.amount, 0);

      const parentL3Result = computeHop({
        amount: parentL3.amount,
        balanceBefore: parentL3.balance,
        forwarded: l3Forwarded,
        parentTaint: parentMuleResult.taint,
        parentBalanceBefore: parentMule.balance,
        parentAmount: parentSplitAmt,
      });

      const l4Result = computeHop({
        amount: l4.amount,
        balanceBefore: l4.balance,
        forwarded: 0,
        parentTaint: parentL3Result.taint,
        parentBalanceBefore: parentL3.balance,
        parentAmount: parentL3.amount,
      });

      await addHop(incidentId, {
        hop: 3,
        parentHopId: parentL3HopId,
        fromVpa: parentL3.vpa,
        toVpa: l4.vpa,
        label: l4.name,
        kind: l4.kind,
        amount: l4.amount,
        balanceBefore: l4.balance,
        forwarded: 0,
        taint: l4Result.taint,
        held: l4Result.held,
        at: Date.now(),
      });

      await new Promise(r => setTimeout(r, 300));
    }

    setStep('l3-done');
    setIsSplitting(false);
    setStatus({ type: 'success', text: 'All splits executed. Money trail complete.' });

    // Update incident status
    await updateIncident(incidentId, { status: 'tracing' });
  };

  return (
    <div className="phone-frame">
      {/* Header */}
      <div className="upi-header">
        <div className="app-name" style={{ color: 'var(--accent-red)' }}>Scammer Panel</div>
      </div>

      {/* Incident Selector if multiple exist */}
      {incidents.length > 0 && (
        <div style={{ padding: '12px 20px 0' }}>
          <label style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
            Tracking Incident ({incidents.length} active):
          </label>
          <select
            className="incident-select-dropdown"
            value={activeIncident?.id || ''}
            onChange={(e) => {
              const selected = incidents.find(i => i.id === e.target.value);
              if (selected) selectIncident(selected);
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

      {/* Balance / Identity */}
      <div className="balance-card" style={{ borderColor: 'rgba(239, 68, 68, 0.2)' }}>
        <div className="label">Scammer Account</div>
        <div className="amount" style={{ color: 'var(--accent-red)' }}>
          ₹{receivedAmount.toLocaleString('en-IN')}
        </div>
        <div className="name">{SCAMMER.name}</div>
        <div className="vpa">{SCAMMER.vpa}</div>
      </div>

      {/* Waiting for payment */}
      {step === 'waiting' && (
        <div className="empty-state">
          <div className="title">Waiting for Fraud Report</div>
          <div className="subtitle" style={{ marginBottom: 16 }}>
            Report fraud from the Victim panel to route the stolen money here.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: 300 }}>
            <button
              className="pay-btn"
              onClick={() => window.open('/pay/victim', '_blank')}
            >
              Open Victim UPI Panel
            </button>
            <button
              className="pay-btn"
              style={{ background: 'var(--bg-card)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-secondary)' }}
              onClick={async () => {
                const id = await addHop('demo', {});
                selectIncident({ id: 'demo-' + Date.now(), amount: 50000, scammerVpa: SCAMMER.vpa, status: 'reported' });
              }}
            >
              Load ₹50,000 Demo Payment
            </button>
          </div>
        </div>
      )}

      {/* Payment received */}
      {(step === 'received' || step === 'splitting' || step === 'split-done' || step === 'l3-done') && (
        <>
          <div className="incoming-payment">
            <div className="from">Payment Received</div>
            <div className="amount">₹{receivedAmount.toLocaleString('en-IN')}</div>
            <div className="from">from victim ({activeIncident?.victimUid})</div>
          </div>

          {/* Split Table */}
          <div className="section-title">Split to Mule Accounts</div>
          <div className="split-table">
            {MULES.map((mule, i) => (
              <div key={i} className="split-row">
                <div className="idx">{i + 1}</div>
                <div style={{ flex: 1 }}>
                  <div className="mule-name">{mule.name}</div>
                  <div className="mule-vpa">{mule.vpa}</div>
                </div>
                <input
                  className="split-input"
                  type="number"
                  value={splits[i]}
                  onChange={(e) => handleSplitChange(i, e.target.value)}
                  disabled={step !== 'received'}
                />
              </div>
            ))}
          </div>

          <div className="split-total-row">
            <div className={`split-total ${isValidSplit ? 'valid' : 'invalid'}`}>
              Total: ₹{totalSplit.toLocaleString('en-IN')} / ₹{receivedAmount.toLocaleString('en-IN')}
              {isValidSplit ? ' ✓' : ' ✗'}
            </div>
            {!isValidSplit && step === 'received' && (
              <button
                type="button"
                className="auto-balance-action-btn"
                onClick={autoBalance}
              >
                Auto-Balance
              </button>
            )}
          </div>

          {step === 'received' && (
            <button
              className="pay-btn danger"
              onClick={executeSplits}
              disabled={!isValidSplit || isSplitting}
              id="execute-splits-btn"
            >
              {isSplitting ? 'Splitting...' : 'Execute Splits & Layering'}
            </button>
          )}

          {step === 'splitting' && (
            <div className="status-msg info">
              <div className="spinner" /> Processing split {splitProgress} / 18...
            </div>
          )}

          {/* L3 splits info */}
          {(step === 'split-done' || step === 'l3-done') && (
            <>
              <div className="l3-section">
                <h3>Second-Layer Splits Executed</h3>
                {LAYER3.map((l3, i) => (
                  <div key={i} className="l3-row">
                    <span style={{ color: 'var(--text-secondary)' }}>
                      {MULES[l3.fromMuleIndex].name} → {l3.name}
                    </span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                      ₹{l3.amount.toLocaleString('en-IN')}
                    </span>
                  </div>
                ))}
                {LAYER4.map((l4, i) => (
                  <div key={`l4-${i}`} className="l3-row">
                    <span style={{ color: 'var(--text-secondary)' }}>
                      {LAYER3[l4.fromL3Index].name} → {l4.name}
                    </span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                      ₹{l4.amount.toLocaleString('en-IN')}
                    </span>
                  </div>
                ))}
              </div>

              <button
                className="pay-btn success"
                onClick={() => window.open('/dashboard', '_blank')}
                style={{ marginTop: 16 }}
              >
                Open Live Dashboard &rarr;
              </button>
            </>
          )}

          {status && (
            <div className={`status-msg ${status.type}`}>
              {status.type === 'success' ? '✓' : '⚠'} {status.text}
            </div>
          )}
        </>
      )}

      <div style={{ height: 40 }} />
    </div>
  );
}
