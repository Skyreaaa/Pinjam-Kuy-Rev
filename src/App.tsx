// File: App.tsx (SUDAH DIPERBAIKI)
import React, { useState, useEffect, useCallback } from 'react';
import GlobalNotificationListener from './components/common/GlobalNotificationListener';
import { profileApi } from './services/api';
import SplashScreen from './components/SplashScreen';
import Login from './components/Login/Login';
import Home from './components/Home/Home';
import Profile from './components/Profile/Profile';
// Asumsi komponen-komponen ini ada:
import AdminDashboard from './components/DashboardAdmin/AdminDashboard'; 
import BorrowingPage, { Loan } from './components/Peminjaman/BorrowingPage'; 
import NotificationHistory from './components/Peminjaman/NotificationHistory';

import defaultAvatar from './assets/Avatar.jpg'; 
import { API_BASE_URL } from './config/api';

// Data pinjaman masih dummy/simulasi untuk bagian selain Profile
const INITIAL_DUMMY_LOANS: Loan[] = [
  { id: 0, bookTitle: 'Homo Deus', kodeBuku: 'SCI-2015-C', loanDate: '2025-10-01', returnDate: '2025-10-08', status: 'Menunggu Persetujuan', kodePinjam: 'KUY-1A2B3C', penaltyAmount: 0, actualReturnDate: null, location: 'Rak A' },
];

function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userData, setUserData] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState('home');
  const [profilePhoto, setProfilePhoto] = useState<string | null>(defaultAvatar);
  const [loans, setLoans] = useState<Loan[]>(INITIAL_DUMMY_LOANS); 

  // Untuk akses file statis (uploads) derive dari API_BASE_URL terpusat
  const API_URL = API_BASE_URL.replace(/\/api\/?$/,'');
  const resolveMediaUrl = (raw?: string | null) => {
    if (!raw) return null;
    if (/^(https?:|data:|blob:)/i.test(raw)) return raw; // sudah absolut (Cloudinary/dll)
    return `${API_URL}${raw}`; // relatif dari backend
  };
  const getUserDataFromStorage = () => {
    const userDataStr = localStorage.getItem('userData');
    return userDataStr ? JSON.parse(userDataStr) : null;
  };
  
  const handleLoanAdded = useCallback((newLoan: Loan) => {
    setLoans((prevLoans: Loan[]) => [...prevLoans, newLoan]);
  }, []);

  const handleLogout = useCallback(() => { 
    localStorage.removeItem('token');
    localStorage.removeItem('userData');
    setIsLoggedIn(false);
    setUserData(null);
    setCurrentPage('home');
    setProfilePhoto(defaultAvatar); 
  }, []); 
  
  // ✅ LOGIC PERBAIKAN: Menerima redirectPath dan menggunakannya untuk setCurrentPage
  const handleLogin = (data: { token: string; userData: any; redirectPath: string }) => {
    if (data.token && data.userData) {
      localStorage.setItem('token', data.token);
      localStorage.setItem('userData', JSON.stringify(data.userData));
      setUserData(data.userData);
      setIsLoggedIn(true);
      
      // Menggunakan URL penuh dari backend jika ada
      const photoUrl = resolveMediaUrl(data.userData.profile_photo_url) || defaultAvatar;
      setProfilePhoto(photoUrl);
      
      // Mengalihkan ke halaman yang ditentukan oleh Login.tsx
      setCurrentPage(data.redirectPath);
    }
  };

  // ✅ HANDLER #1: Simpan Biodata (PUT /api/profile/update-biodata)
  const handleProfileSave = useCallback(async (updatedData: any): Promise<{ success: boolean; message: string }> => {
    try {
      const resp = await profileApi.updateBiodata(updatedData);
      if (resp.success) {
        const serverUser = resp.user || {};
        const merged = { ...(getUserDataFromStorage() || {}), ...serverUser };
        setUserData(merged);
        localStorage.setItem('userData', JSON.stringify(merged));
        return { success: true, message: resp.message || 'Biodata berhasil diperbarui!' };
      }
      return { success: false, message: resp.message || 'Gagal memperbarui biodata.' };
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || 'Terjadi kesalahan jaringan.';
      return { success: false, message: msg };
    }
  }, []);


  // ✅ HANDLER #2: Upload Foto (POST /api/profile/upload-photo)
  const handlePhotoUpdate = useCallback(async (photo: File | null, npm: string, onComplete: (success: boolean, message: string) => void) => {
    try {
      const resp = await profileApi.uploadPhoto(photo);
      if (resp.success && resp.profile_photo_url) {
        const newPhotoUrl = resolveMediaUrl(resp.profile_photo_url) || defaultAvatar;
        setProfilePhoto(newPhotoUrl);
        const currentData = getUserDataFromStorage() || {};
        currentData.profile_photo_url = resp.profile_photo_url;
        localStorage.setItem('userData', JSON.stringify(currentData));
        onComplete(true, resp.message || 'Foto berhasil diunggah!');
      } else {
        onComplete(false, resp.message || 'Gagal mengunggah foto.');
      }
    } catch (e: any) {
      onComplete(false, e?.response?.data?.message || 'Terjadi kesalahan jaringan.');
    }
  }, [setProfilePhoto, resolveMediaUrl]);
  
  
  // ✅ HANDLER #3: Hapus Foto (DELETE /api/profile/delete-photo)
  const handleDeletePhoto = useCallback(async (npm: string, onComplete: (success: boolean, message: string) => void) => {
    try {
      const resp = await profileApi.deletePhoto();
      if (resp.success) {
        setProfilePhoto(defaultAvatar);
        const currentData = getUserDataFromStorage() || {};
        currentData.profile_photo_url = null;
        localStorage.setItem('userData', JSON.stringify(currentData));
        onComplete(true, resp.message || 'Foto berhasil dihapus.');
      } else {
        onComplete(false, resp.message || 'Gagal menghapus foto.');
      }
    } catch (e: any) {
      onComplete(false, e?.response?.data?.message || 'Terjadi kesalahan jaringan.');
    }
  }, [setProfilePhoto]);
  

  const initialize = useCallback(() => {
    const pathToPage = (path: string): string => {
      if (path.startsWith('/loans')) return 'borrowing-page';
      if (path.startsWith('/book/')) return 'borrowing-page';
      if (path.startsWith('/profile')) return 'profile';
      if (path.startsWith('/notifications')) return 'notification-history';
      if (path.startsWith('/admin')) return 'admin-dashboard';
      return 'home';
    };

    const token = localStorage.getItem('token');
    const userDataStr = localStorage.getItem('userData');

    if (token && userDataStr) {
      try {
        const data = JSON.parse(userDataStr);
        setUserData(data);
        setIsLoggedIn(true);

        const photoUrl = resolveMediaUrl(data.profile_photo_url) || defaultAvatar;
        setProfilePhoto(photoUrl);

        // Sinkronkan URL ke halaman saat refresh / direct link
        const initialPath = window.location.pathname;
        const initialPage = pathToPage(initialPath);
        // Jika admin dan masuk ke /admin atau halaman lain, hormati URL
        if (data.role === 'admin' && initialPage === 'home') {
          setCurrentPage('admin-dashboard');
        } else {
          setCurrentPage(initialPage);
        }

      } catch (e) {
        console.error("Error parsing userData from localStorage:", e);
        handleLogout();
      }
    } else {
      setProfilePhoto(defaultAvatar);
      // Jika tidak login, tetap tampilkan login terlepas dari URL
      setCurrentPage('home');
    }
    setTimeout(() => setShowSplash(false), 2000);
  }, [handleLogout, resolveMediaUrl]); 

  useEffect(() => {
    initialize();
  }, [initialize]);

  // Push URL when currentPage changes and handle back/forward
  useEffect(() => {
    const pageToPath = (page: string): string => {
      switch (page) {
        case 'borrowing-page': return '/loans';
        case 'profile': return '/profile';
        case 'notification-history': return '/notifications';
        case 'admin-dashboard': return '/admin';
        case 'home':
        default:
          return '/';
      }
    };

    const path = pageToPath(currentPage);
    if (window.location.pathname !== path) {
      window.history.pushState(null, '', path);
    }

    const onPopState = () => {
      const path = window.location.pathname;
      const pathToPage = (p: string): string => {
        if (p.startsWith('/loans')) return 'borrowing-page';
        if (p.startsWith('/book/')) return 'borrowing-page';
        if (p.startsWith('/profile')) return 'profile';
        if (p.startsWith('/notifications')) return 'notification-history';
        if (p.startsWith('/admin')) return 'admin-dashboard';
        return 'home';
      };
      setCurrentPage(pathToPage(path));
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [currentPage]);

  // Validate token against backend on app load and page changes
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      handleLogout();
      return;
    }
    const controller = new AbortController();
    const check = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/health`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        if (res.status === 401) {
          handleLogout();
        }
      } catch (e) {
        // Network or other error: do NOT force logout to avoid false positives
        // Optionally, could show a transient offline indicator here
      }
    };
    check();
    return () => controller.abort();
  }, [currentPage, handleLogout]);



  if (showSplash) {
    return <SplashScreen />; 
  }

  if (!isLoggedIn) {
    return <Login onLogin={handleLogin} />;
  }

  // --- RENDERING ROUTE ---
  let page: JSX.Element;
  switch (currentPage) {
    case 'home':
      page = (<Home
        userData={userData}
        profilePhoto={profilePhoto}
        onMenuClick={setCurrentPage}
        onLogout={handleLogout}
      />);
      break;
    case 'borrowing-page': 
      page = (<BorrowingPage
        userData={userData}
        onBack={() => setCurrentPage('home')}
        loans={loans} 
        onLoanAdded={handleLoanAdded} 
      />);
      break;
    case 'profile':
      page = (<Profile 
        userData={userData}
        profilePhoto={profilePhoto}
        onPhotoUpdate={handlePhotoUpdate} 
        onProfileSave={handleProfileSave} 
        onBack={() => setCurrentPage('home')}
        onDeletePhoto={handleDeletePhoto} 
      />);
      break;
    case 'notification-history':
      page = (<NotificationHistory onBack={() => setCurrentPage('home')} />);
      break;
    case 'admin-dashboard':
      page = (<AdminDashboard />);
      break;
    default:
      page = (<Home
        userData={userData}
        profilePhoto={profilePhoto}
        onMenuClick={setCurrentPage}
        onLogout={handleLogout}
      />);
      break;
  }

  return (
    <>
      {page}
      <GlobalNotificationListener />
    </>
  );
}

export default App;