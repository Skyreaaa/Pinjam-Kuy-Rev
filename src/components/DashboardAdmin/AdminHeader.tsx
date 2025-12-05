import React, { useEffect, useState } from 'react';

const THEME_KEY = 'admin-theme-mode';

interface AdminHeaderProps {
  username?: string | null;
}

const AdminHeader: React.FC<AdminHeaderProps> = ({ username }) => {
  const [mode, setMode] = useState<'light' | 'dark'>(() => (localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light'));

  useEffect(() => {
    const body = document.body;
    if (mode === 'dark') {
      body.classList.add('theme-dark');
    } else {
      body.classList.remove('theme-dark');
    }
    localStorage.setItem(THEME_KEY, mode);
  }, [mode]);

  const toggleMode = () => setMode(m => (m === 'dark' ? 'light' : 'dark'));

  return (
    <header className="admin-header" role="banner">
      <h1>Dashboard Admin</h1>
      <div className="admin-header-right">
        <button
          type="button"
          onClick={toggleMode}
          className="theme-toggle-btn"
          aria-label={mode === 'dark' ? 'Aktifkan mode terang' : 'Aktifkan mode gelap'}
          title={mode === 'dark' ? 'Mode Terang' : 'Mode Gelap'}
        >
          {mode === 'dark' ? '🌞' : '🌙'}
        </button>
        <p className="admin-header-user">Selamat datang, {username || 'Admin'}</p>
      </div>
    </header>
  );
};

export default AdminHeader;