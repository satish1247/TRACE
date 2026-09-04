import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, onAuthStateChanged } from '../lib/firebase';

const AuthContext = createContext(null);

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });
    return unsub;
  }, []);

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-primary)',
        flexDirection: 'column',
        gap: 16,
      }}>
        <div className="spinner" style={{ width: 40, height: 40 }} />
        <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>Loading TRACE...</div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user }}>
      {children}
    </AuthContext.Provider>
  );
}
