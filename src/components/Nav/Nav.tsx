import React from 'react';
import '../Nav/Nav.css';

interface NavProps {
  currentView: string;
  onNavigate: (view: 'home' | 'history') => void;
}

const Nav: React.FC<NavProps> = ({ currentView, onNavigate }) => {
  return (
    <nav className="nav-bar">
      <button className={`nav-button ${currentView === 'home' ? 'active' : ''}`} onClick={() => onNavigate('home')}>
        Daftar Buku
      </button>
      <button className={`nav-button ${currentView === 'history' ? 'active' : ''}`} onClick={() => onNavigate('history')}>
        Riwayat Peminjaman
      </button>
    </nav>
  );
};

export default Nav;