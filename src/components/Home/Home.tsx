// File: frontend/src/components/Home/Home.tsx (TIDAK ADA PERUBAHAN)

import React, { useState, useEffect } from 'react';
import { profileApi, loanApi } from '../../services/api';
import { API_BASE_URL } from '../../config/api';
import './Home.css';
import characterImage from '../../assets/menyapa.png';
import { FaBars, FaTimes } from 'react-icons/fa';
import NotificationToast from '../common/NotificationToast';

interface HomeProps {
  userData: {
    username?: string;
    prodi?: string;
    role?: string;
    npm?: string; 
    // TAMBAHKAN TYPE UNTUK DATA BARU:
    active_loans_count?: number; 
    denda?: number; 
    [key: string]: any;
  };
  profilePhoto: string | null;
  onMenuClick: (page: string) => void;
  onLogout: () => void;
}

const formatRupiah = (amount: number) => {
    const num = Number(amount);
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
    }).format(num);
};

const Home: React.FC<HomeProps> = ({
  userData = {} as any,
  profilePhoto,
  onMenuClick,
  onLogout
}) => {
  // Ambil kedua data langsung dari userData
  const { 
    username = 'Pengguna', 
    prodi = 'Prodi', 
    active_loans_count = 0, 
    denda = 0 
  } = userData;
  // activeFine = denda berjalan (overdue saat ini) + denda belum dibayar (returned belum dilunasi)
  // Total denda aktif diturunkan dari runningFine + unpaidFine
  const [runningFine, setRunningFine] = useState<number>(0); // overdue in-flight
  const [unpaidFine, setUnpaidFine] = useState<number>(0);   // returned but not paid
  const [historicalTotal, setHistoricalTotal] = useState<number>(denda || 0); // total akumulasi sepanjang waktu (server authoritative)
  
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeLoansCount, setActiveLoansCount] = useState<number>(active_loans_count);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  
  // Ambil denda aktif (kombinasi denda berjalan + belum dibayar) saat mount / saat denda berubah
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const resp: any = await profileApi.activeFine();
        if (resp?.success && isMounted) {
          const rFine = resp.runningFine || 0;
          const uFine = resp.unpaidReturnedFine || 0;
          setRunningFine(rFine);
          setUnpaidFine(uFine);
          // total diturunkan di render (runningFine + unpaidFine)
          if (typeof resp.historicalTotal === 'number') {
            setHistoricalTotal(resp.historicalTotal);
          }
        } else if (isMounted) {
          console.warn('[HOME] Gagal memuat activeFine (response unexpected):', resp);
        }
      } catch (e) {
        if (isMounted) console.error('[HOME] Error fetch activeFine:', e);
      }
    })();
    return () => { isMounted = false; };
  }, [denda]);

  // Ambil jumlah pinjaman aktif realtime (tidak hanya rely pada data login awal)
  useEffect(()=>{
    let cancelled=false;
    (async()=>{
      try {
        const resp:any = await fetch(`${API_BASE_URL}/profile/active-loans-count`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }}).then(r=>r.json());
        if(!cancelled && resp?.success){ setActiveLoansCount(resp.activeLoans); }
      } catch(e){ /* ignore */ }
    })();
    const interval = setInterval(async()=>{
      try {
        const resp:any = await fetch(`${API_BASE_URL}/profile/active-loans-count`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }}).then(r=>r.json());
        if(resp?.success) setActiveLoansCount(resp.activeLoans);
      } catch {}
    }, 20000); // refresh setiap 20s
    return ()=>{ cancelled=true; clearInterval(interval); };
  }, []);

  // Polling ringan untuk notifikasi persetujuan pinjaman dan keputusan pengembalian (3s)
  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const appr = await loanApi.notifications();
        if (!cancelled && appr?.success && appr.notifications?.length) {
          setToast({ message: 'Pinjaman Anda telah disetujui.', type: 'success' });
          try { await loanApi.ackNotifications(appr.notifications.map((n: any) => n.id)); } catch {}
        }
      } catch {}
      try {
        const ret = await loanApi.returnNotifications();
        if (!cancelled && ret?.success && ret.notifications?.length) {
          const first = ret.notifications[0];
          const msg = first.returnDecision === 'approved'
            ? `Pengembalian buku "${first.bookTitle}" disetujui.`
            : `Bukti pengembalian buku "${first.bookTitle}" ditolak. Mohon unggah ulang.`;
          setToast({ message: msg, type: first.returnDecision === 'approved' ? 'success' : 'error' });
          try { await loanApi.ackReturnNotifications(ret.notifications.map((n: any) => n.id)); } catch {}
        }
      } catch {}
      try {
        const rej = await loanApi.rejectionNotifications();
        if (!cancelled && rej?.success && rej.notifications?.length) {
          const first = rej.notifications[0];
          setToast({ message: `Pengajuan pinjaman untuk "${first.bookTitle}" ditolak.`, type: 'error' });
          try { await loanApi.ackRejectionNotifications(rej.notifications.map((n: any) => n.id)); } catch {}
        }
      } catch {}
    };
    const interval = setInterval(tick, 3000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  return (
    <div className="home-container">
      <header className="home-header">
        <div className="logo-container">
          <img src="/Logo.png" alt="Logo" className="logo" />
          <span className="app-name">PinjamKuy</span>
        </div>
        <button
          className="menu-toggle-button"
          onClick={() => setMenuOpen(prev => !prev)}
        >
          {menuOpen ? <FaTimes /> : <FaBars />}
        </button>
      </header>

      {menuOpen && (
        <nav className="dropdown-menu open">
          <button className="dropdown-item" onClick={() => {
            onMenuClick('profile');
            setMenuOpen(false);
          }}>Profile</button>
          <button className="dropdown-item" onClick={() => {
            onMenuClick('borrowing-page');
            setMenuOpen(false);
          }}>Perpustakaan</button>
          {/* Riwayat dihapus dari navbar sesuai permintaan */}
          <button className="dropdown-item" onClick={() => {
            onMenuClick('notification-history');
            setMenuOpen(false);
          }}>Notifikasi</button>
          {userData.role === 'admin' && (
            <button className="dropdown-item" onClick={() => {
              onMenuClick('admin-dashboard');
              setMenuOpen(false);
            }}>Admin Dashboard</button>
          )}
          <button className="dropdown-item logout" onClick={onLogout}>Logout</button>
        </nav>
      )}

      <main className="dashboard-grid">
        <div className="card welcome-card">
          <div className="character-greeting">
            <img
              src={characterImage}
              alt="Menyapa"
              className="character-img"
            />
          </div>
          <h1 className="welcome-title">Selamat Datang!</h1>
          <p className="user-info">{username}</p>
          <p className="school-info">{prodi}</p>
        </div>
        
        {/* Card: Buku Dipinjam (klik untuk ke halaman pinjaman tab aktif) */} 
  <div className="info-card card borrowed clickable" onClick={() => { localStorage.setItem('initialBorrowTab','active'); localStorage.setItem('openLoansView','1'); onMenuClick('borrowing-page'); }}> 
          <div className="info-icon">📚</div>
          <p className="info-label">Buku Dipinjam</p>
          <h2 className="info-value">
            {activeLoansCount}
          </h2> 
        </div>

        {/* Card: Total Denda (klik untuk ke halaman pinjaman juga - bisa fokus tab aktif/historis) */} 
  <div className="info-card card late-fee clickable" onClick={() => { localStorage.setItem('initialBorrowTab','history'); localStorage.setItem('openLoansView','1'); onMenuClick('borrowing-page'); }}> 
          <div className="info-icon">💸</div>
          <p className="info-label">Denda Aktif</p>
          <h2 className="info-value" title={`Denda Aktif yang dapat dibayar sekarang = Belum Dibayar (${formatRupiah(unpaidFine)})`}>
            {formatRupiah(unpaidFine)}
          </h2>
          <div className="fine-breakdown">
            <div className="hidden"><span className="bd-label bd-running">Berjalan:</span> <span className="bd-val bd-running-val">{formatRupiah(runningFine)}</span></div>
            <div><span className="bd-label bd-unpaid">Belum Dibayar:</span> <span className="bd-val bd-unpaid-val">{formatRupiah(unpaidFine)}</span></div>
            <div className="bd-total-hist"><span className="bd-label bd-historical">Total Historis:</span> <span className="bd-val bd-historical-val">{formatRupiah(historicalTotal)}</span></div>
            {(historicalTotal > 0 && unpaidFine === 0) && (
              <div className="bd-note">Semua denda sudah dilunasi.</div>
            )}
          </div>
        </div>
      </main>

      {toast && (
        <NotificationToast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
};

export default Home;