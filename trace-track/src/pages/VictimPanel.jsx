import React, { useState, useEffect, useCallback } from 'react';
import { VICTIM, SCAMMER } from '../lib/demoData';
import { createIncident, isAccountFlagged, db, doc, onSnapshot } from '../lib/firebase';
import { subscribeActiveShieldCall, SHIELD_WARN_THRESHOLD } from '../lib/shieldCallWatcher';

const PAYEES = [
  { name: 'Aarav Mehta', vpa: 'aarav.m@upi', color: '#4f8fff' },
  { name: 'Sneha Reddy', vpa: 'sneha.r@upi', color: '#a855f7' },
  { name: SCAMMER.name, vpa: SCAMMER.vpa, color: '#ef4444' },
  { name: 'Vikram Iyer', vpa: 'vikram.i@upi', color: '#10b981' },
  { name: 'Pooja Nair', vpa: 'pooja.n@upi', color: '#f59e0b' },
];

export default function VictimPanel() {
  const [balance, setBalance] = useState(VICTIM.balance);
  const [selectedPayee, setSelectedPayee] = useState(null);
  const [amount, setAmount] = useState('');
  const [pin, setPin] = useState('');
  const [step, setStep] = useState('select'); // select | amount | pin | success | reported
  const [status, setStatus] = useState(null);
  const [txnHistory, setTxnHistory] = useState([]);
  const [blocked, setBlocked] = useState(false);
  const [incidentId, setIncidentId] = useState(null);
  const [incidentStatus, setIncidentStatus] = useState(null);
  const [recoveredAmount, setRecoveredAmount] = useState(0);
  const [activeShieldCall, setActiveShieldCall] = useState(null);

  // Live link to SHIELD: watch for a call it has flagged so "Report Fraud"
  // below can point the incident at the real call instead of guessing.
  useEffect(() => {
    const unsub = subscribeActiveShieldCall(setActiveShieldCall);
    return unsub;
  }, []);

  const shieldFlagged = activeShieldCall && activeShieldCall.risk >= SHIELD_WARN_THRESHOLD;

  // Subscribe to incident updates for recovery animation
  useEffect(() => {
    if (!incidentId) return;
    const unsub = onSnapshot(doc(db, 'incidents', incidentId), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setIncidentStatus(data.status);
        if (data.recovered > 0) {
          setRecoveredAmount(data.recovered);
          setBalance(VICTIM.balance - Number(amount) + data.recovered);
        }
      }
    });
    return unsub;
  }, [incidentId, amount]);

  const handlePayeeSelect = async (payee) => {
    try {
      // T9: Network immunity — check if VPA is flagged
      const flagged = await isAccountFlagged(payee.vpa);
      if (flagged) {
        setBlocked(true);
        setSelectedPayee(payee);
        return;
      }
    } catch (err) {
      console.warn('Flagged check failed, proceeding:', err);
    }
    setBlocked(false);
    setSelectedPayee(payee);
    setStep('amount');
    setAmount('');
  };

  const handleNumPress = (num) => {
    if (step === 'amount') {
      if (amount.length < 7) setAmount(prev => prev + num);
    } else if (step === 'pin') {
      if (pin.length < 4) setPin(prev => prev + num);
    }
  };

  const handleDelete = () => {
    if (step === 'amount') {
      setAmount(prev => prev.slice(0, -1));
    } else if (step === 'pin') {
      setPin(prev => prev.slice(0, -1));
    }
  };

  const handleProceedToPin = () => {
    if (Number(amount) > 0 && Number(amount) <= balance) {
      setStep('pin');
      setPin('');
    }
  };

  const handlePay = useCallback(async () => {
    if (pin.length !== 4) return;

    const amt = Number(amount);
    setBalance(prev => prev - amt);
    setStep('success');
    setStatus({ type: 'success', text: `₹${amt.toLocaleString('en-IN')} sent to ${selectedPayee.name}` });
    setTxnHistory(prev => [{
      to: selectedPayee.name,
      vpa: selectedPayee.vpa,
      amount: amt,
      time: new Date(),
      type: 'sent',
    }, ...prev]);
  }, [pin, amount, selectedPayee]);

  // Auto-trigger pay when 4 digits entered
  useEffect(() => {
    if (step === 'pin' && pin.length === 4) {
      const t = setTimeout(handlePay, 400);
      return () => clearTimeout(t);
    }
  }, [pin, step, handlePay]);

  const handleReportFraud = async () => {
    if (!selectedPayee || !amount) return;
    setStep('reported');

    const amt = Number(amount);
    try {
      const id = await createIncident({
        victimUid: VICTIM.uid,
        amount: amt,
        scammerVpa: selectedPayee.vpa,
        scamType: shieldFlagged ? (activeShieldCall.scamType || 'digital_arrest') : 'digital_arrest',
        callId: shieldFlagged ? activeShieldCall.id : null,
        status: 'reported',
        recovered: 0,
        goldenHourEndsAt: Date.now() + 60 * 60 * 1000, // 60 min
      });

      setIncidentId(id);
      setStatus({ type: 'warning', text: '🚨 Fraud reported! Other control panels can now track the money.' });

      // Try opening both panels in new tabs
      try {
        window.open('/pay/scammer', '_blank');
        window.open('/dashboard', '_blank');
      } catch (popupErr) {
        console.warn('Popup blocked, interactive buttons are available on screen', popupErr);
      }
    } catch (err) {
      console.error('Failed to create incident:', err);
      setStatus({ type: 'error', text: `Firestore error: ${err.message}. Check Firebase rules.` });
    }
  };

  const formatAmount = (val) => {
    if (!val) return '₹0';
    return '₹' + Number(val).toLocaleString('en-IN');
  };

  return (
    <div className="phone-frame">
      {/* Header */}
      <div className="upi-header">
        <div className="app-name">UPI Pay</div>
      </div>

      {/* Balance Card */}
      <div className="balance-card">
        <div className="label">Available Balance</div>
        <div className="amount">{formatAmount(balance)}</div>
        <div className="name">{VICTIM.name}</div>
        <div className="vpa">{VICTIM.vpa}</div>
      </div>

      {/* Live link to SHIELD: a call is actively being flagged right now */}
      {shieldFlagged && (
        <div className="immunity-banner" style={{ borderColor: 'var(--accent-amber, #f59e0b)' }}>
          <span className="shield-icon">📞</span>
          <div className="immunity-text">
            <strong>SHIELD flagged an active call</strong> (risk {activeShieldCall.risk}/100)
            {activeShieldCall.scamType ? ` — ${activeShieldCall.scamType.replace(/_/g, ' ')}` : ''}.
            Reporting fraud now will link this incident to that call.
          </div>
        </div>
      )}

      {/* Network Immunity Block */}
      {blocked && selectedPayee && (
        <div className="immunity-banner">
          <span className="shield-icon">🛡️</span>
          <div className="immunity-text">
            <strong>Payment Blocked</strong><br />
            {selectedPayee.vpa} has been flagged for involvement in a fraud incident.
            This VPA is frozen under TRACE Network Immunity.
          </div>
        </div>
      )}

      {/* Recovery notification */}
      {incidentStatus === 'recovered' && recoveredAmount > 0 && (
        <div className="status-msg success" style={{ animation: 'slideUp 0.5s var(--ease-spring)' }}>
          ✅ ₹{recoveredAmount.toLocaleString('en-IN')} recovered and returned to your account!
        </div>
      )}

      {/* Select Payee */}
      {step === 'select' && (
        <>
          <div className="section-title">Send Money To</div>
          <div className="payee-list">
            {PAYEES.map((p, i) => (
              <div
                key={i}
                className={`payee-item ${selectedPayee?.vpa === p.vpa ? 'selected' : ''}`}
                onClick={() => handlePayeeSelect(p)}
                id={`payee-${i}`}
              >
                <div className="payee-avatar" style={{ background: p.color }}>
                  {p.name.charAt(0)}
                </div>
                <div className="payee-info">
                  <div className="payee-name">{p.name}</div>
                  <div className="payee-vpa">{p.vpa}</div>
                </div>
                <span style={{ color: 'var(--text-muted)', fontSize: 18 }}>›</span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Amount Entry */}
      {step === 'amount' && (
        <>
          <div className="amount-section">
            <div className="section-title" style={{ padding: 0 }}>Paying {selectedPayee?.name}</div>
            <div className={`amount-display ${!amount ? 'empty' : ''}`}>
              {formatAmount(amount || '0')}
            </div>
            {Number(amount) > balance && (
              <div style={{ color: 'var(--accent-red)', fontSize: 13, marginTop: 4 }}>
                Insufficient balance
              </div>
            )}
          </div>

          <div className="pin-pad">
            {[1,2,3,4,5,6,7,8,9].map(n => (
              <button key={n} className="pin-key" onClick={() => handleNumPress(String(n))}>{n}</button>
            ))}
            <button className="pin-key delete" onClick={handleDelete}>⌫</button>
            <button className="pin-key" onClick={() => handleNumPress('0')}>0</button>
            <button
              className="pin-key action"
              onClick={handleProceedToPin}
              disabled={!amount || Number(amount) <= 0 || Number(amount) > balance}
            >
              PAY
            </button>
          </div>

          <button
            className="pay-btn"
            onClick={() => { setStep('select'); setSelectedPayee(null); }}
            style={{ background: 'var(--bg-card)', color: 'var(--text-secondary)' }}
          >
            ← Back
          </button>
        </>
      )}

      {/* PIN Entry */}
      {step === 'pin' && (
        <>
          <div className="amount-section">
            <div className="section-title" style={{ padding: 0 }}>Enter UPI PIN</div>
            <div className="amount-display" style={{ fontSize: 24 }}>
              Paying {formatAmount(amount)} to {selectedPayee?.name}
            </div>
          </div>

          <div className="pin-dots">
            {[0,1,2,3].map(i => (
              <div key={i} className={`pin-dot ${i < pin.length ? 'filled' : ''}`} />
            ))}
          </div>

          <div className="pin-pad">
            {[1,2,3,4,5,6,7,8,9].map(n => (
              <button key={n} className="pin-key" onClick={() => handleNumPress(String(n))}>{n}</button>
            ))}
            <button className="pin-key delete" onClick={handleDelete}>⌫</button>
            <button className="pin-key" onClick={() => handleNumPress('0')}>0</button>
            <button className="pin-key" style={{ visibility: 'hidden' }} />
          </div>
        </>
      )}

      {/* Success */}
      {step === 'success' && (
        <>
          {status && (
            <div className={`status-msg ${status.type}`}>
              {status.type === 'success' ? '✓' : '⚠'} {status.text}
            </div>
          )}

          <button
            className="report-fraud-btn"
            onClick={handleReportFraud}
            id="report-fraud-btn"
          >
            Report Fraud
          </button>

          <button
            className="pay-btn"
            onClick={() => { setStep('select'); setSelectedPayee(null); setStatus(null); setAmount(''); setPin(''); }}
            style={{ background: 'var(--bg-card)', color: 'var(--text-secondary)' }}
          >
            Make Another Payment
          </button>
        </>
      )}

      {/* Reported */}
      {step === 'reported' && (
        <>
          {status && (
            <div className={`status-msg ${status.type}`}>
              {status.text}
            </div>
          )}
          <div className="empty-state" style={{ padding: '30px 20px' }}>
            <div className="title">Fraud Report Filed</div>
            <div className="subtitle">
              TRACE is tracking the stolen ₹{Number(amount).toLocaleString('en-IN')} in real-time.
            </div>
            {incidentId && (
              <div style={{ marginTop: 8, marginBottom: 16, fontSize: 12, color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)' }}>
                Incident ID: {incidentId}
              </div>
            )}

            <div className="control-panel-launchers">
              <div className="launcher-heading">OPEN OTHER CONTROL PANELS:</div>

              <button
                type="button"
                className="launcher-card scammer-card"
                onClick={() => window.open('/pay/scammer', '_blank')}
              >
                <div className="launcher-info">
                  <div className="launcher-title">Open Scammer Panel &rarr;</div>
                  <div className="launcher-sub">Split money to 10 mules & layer across accounts</div>
                </div>
              </button>

              <button
                type="button"
                className="launcher-card dashboard-card"
                onClick={() => window.open('/dashboard', '_blank')}
              >
                <div className="launcher-info">
                  <div className="launcher-title">Open Live Dashboard &rarr;</div>
                  <div className="launcher-sub">Real-time SVG tree, golden-hour clock & recovery</div>
                </div>
              </button>
            </div>
          </div>
        </>
      )}

      {/* Transaction History */}
      {txnHistory.length > 0 && (step === 'select' || step === 'success' || step === 'reported') && (
        <>
          <div className="section-title">Recent Transactions</div>
          {txnHistory.map((txn, i) => (
            <div key={i} className="txn-item">
              <div className={`txn-icon ${txn.type}`}>
                {txn.type === 'sent' ? '↑' : '↓'}
              </div>
              <div className="txn-details">
                <div className="txn-to">{txn.to}</div>
                <div className="txn-time">{txn.time.toLocaleTimeString()}</div>
              </div>
              <div className={`txn-amount ${txn.type}`}>
                {txn.type === 'sent' ? '- ' : '+ '}₹{txn.amount.toLocaleString('en-IN')}
              </div>
            </div>
          ))}
        </>
      )}

      <div style={{ height: 40 }} />
    </div>
  );
}
