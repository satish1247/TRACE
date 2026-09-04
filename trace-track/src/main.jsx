import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/AuthContext';
import LoginPage from './pages/LoginPage';
import VictimPanel from './pages/VictimPanel';
import ScammerPanel from './pages/ScammerPanel';
import Dashboard from './pages/Dashboard';
import Navbar from './components/Navbar';
import './index.css';

function AppLayout({ children }) {
  return (
    <div className="app-shell">
      <Navbar />
      <main className="app-content-wrapper">
        {children}
      </main>
    </div>
  );
}

function ProtectedRoute({ children }) {
  const { user } = useAuth();
  if (!user) return <LoginPage />;
  return <AppLayout>{children}</AppLayout>;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/pay/victim" element={<ProtectedRoute><VictimPanel /></ProtectedRoute>} />
          <Route path="/pay/scammer" element={<ProtectedRoute><ScammerPanel /></ProtectedRoute>} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="*" element={<ProtectedRoute><Navigate to="/pay/victim" replace /></ProtectedRoute>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
