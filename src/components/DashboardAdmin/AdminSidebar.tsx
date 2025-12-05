import React from 'react';
import { FaUsers, FaBook, FaClock, FaUndo, FaAngleLeft, FaMoneyBillWave, FaHistory } from 'react-icons/fa';

export type AdminView = 'users' | 'books' | 'pending_loans' | 'returns_review' | 'fine_payments' | 'history';

interface SidebarProps {
  active: AdminView;
  onChange: (view: AdminView) => void;
}

const AdminSidebar: React.FC<SidebarProps> = ({ active, onChange }) => {
  return (
    <nav className="admin-sidebar" aria-label="Navigasi Dashboard Admin">
      <button className={`nav-item ${active === 'users' ? 'active' : ''}`} onClick={() => onChange('users')}>
        <FaUsers /> <span>Kelola Pengguna</span>
      </button>
      <button className={`nav-item ${active === 'books' ? 'active' : ''}`} onClick={() => onChange('books')}>
        <FaBook /> <span>Kelola Buku</span>
      </button>
      <div className="nav-divider" role="separator" />
      <p className="nav-title">Peminjaman</p>
      <button className={`nav-item ${active === 'pending_loans' ? 'active' : ''}`} onClick={() => onChange('pending_loans')}>
        <FaClock /> <span>Pinjaman Tertunda</span>
      </button>
      <button className={`nav-item ${active === 'returns_review' ? 'active' : ''}`} onClick={() => onChange('returns_review')}>
        <FaUndo /> <span>Proses Pengembalian</span>
      </button>
      <button className={`nav-item ${active === 'fine_payments' ? 'active' : ''}`} onClick={() => onChange('fine_payments')}>
        <FaMoneyBillWave /> <span>Pembayaran Denda</span>
      </button>
      <button className={`nav-item ${active === 'history' ? 'active' : ''}`} onClick={() => onChange('history')}>
        <FaHistory /> <span>Riwayat</span>
      </button>
      <button className="nav-item nav-logout" onClick={() => { localStorage.clear(); window.location.href = '/login'; }}>
        <FaAngleLeft /> <span>Keluar</span>
      </button>
    </nav>
  );
};

export default AdminSidebar;