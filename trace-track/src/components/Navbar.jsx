import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { auth, signOut } from '../lib/firebase';

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const openAllPanels = () => {
    window.open('/pay/victim', '_blank', 'width=460,height=860,left=50,top=50');
    window.open('/pay/scammer', '_blank', 'width=460,height=860,left=530,top=50');
    window.open('/dashboard', '_blank', 'width=1000,height=860,left=1010,top=50');
  };

  const navItems = [
    { path: '/pay/victim', label: 'Victim' },
    { path: '/pay/scammer', label: 'Scammer' },
    { path: '/dashboard', label: 'Dashboard' },
  ];

  return (
    <header className="global-navbar">
      <div className="nav-brand" onClick={() => navigate('/pay/victim')}>
        <span className="brand-title-clean">TRACE</span>
      </div>

      <nav className="nav-links">
        {navItems.map((item) => (
          <button
            key={item.path}
            className={`nav-tab ${location.pathname === item.path ? 'active' : ''}`}
            onClick={() => navigate(item.path)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <div className="nav-actions">
        <button
          className="multi-window-btn"
          onClick={openAllPanels}
          title="Open Victim, Scammer, and Dashboard side-by-side"
        >
          Multi-Window View
        </button>

        {user && (
          <div className="nav-user-info">
            <span className="user-email-tag" title={user.email}>
              {user.email ? user.email.split('@')[0] : 'User'}
            </span>
            <button
              className="logout-btn"
              onClick={() => signOut(auth)}
              title="Sign Out"
            >
              Log out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
