// File: components/Login/Login.tsx (SUDAH DIPERBAIKI)
import React, { useState } from 'react';
// Gunakan service terpusat
import { authApi } from '../../services/api';
import './Login.css'; // Asumsi file CSS ada
import { FaEye, FaEyeSlash } from 'react-icons/fa';

// Definisikan interface untuk data pengguna yang diharapkan dari backend
interface UserData {
  id: string;
  npm: string;
  role: 'admin' | 'user'; // Asumsi role bisa 'admin' atau 'user'
  [key: string]: any;
}

interface LoginSuccessData {
  token: string;
  userData: UserData;
  redirectPath: string; // Tambahkan properti ini
}

interface LoginProps {
  onLogin: (data: LoginSuccessData) => void; // Perbarui tipe data
}

// Tidak perlu hardcode API_URL lagi karena sudah dihandle oleh service layer

const Login: React.FC<LoginProps> = ({ onLogin }: LoginProps) => {
  const [npm, setNpm] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // ✅ API CALL SESUNGGUHNYA ke /api/auth/login
      const { token, userData } = await authApi.login(npm, password);
      
      // --- LOGIC PERBAIKAN: Tentukan Jalur Redirect ---
      let redirectPath: string;
      if (userData && userData.role === 'admin') {
        redirectPath = 'admin-dashboard'; // Arahkan admin ke 'admin-dashboard'
      } else {
        redirectPath = 'home'; // Arahkan user biasa ke 'home'
      }
      // ------------------------------------------------
      
      // Meneruskan token, data pengguna, dan jalur redirect ke App.tsx
      onLogin({ token, userData, redirectPath }); 
      
    } catch (err: any) {
      // Menangani error 401 atau 500 dari backend
      const message = err.response?.data?.message || 'Gagal masuk. Periksa NPM dan kata sandi Anda atau koneksi server.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <img src="/Logo.png" alt="PinjamKuy Logo" className="logo" /> 
          <div className="greeting">
            <h1>Halo, Selamat Datang!</h1>
            <p>Silakan masuk untuk melanjutkan</p>
          </div>
        </div>
        <form className="login-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <input type="text" id="npm" placeholder="NPM" value={npm} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNpm(e.target.value)} required />
          </div>
          <div className="form-group">
            <div className="password-input-wrapper">
              <input 
                type={showPassword ? 'text' : 'password'} 
                id="password" 
                placeholder="Kata Sandi" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                required 
              />
              <span className="password-toggle" onClick={togglePasswordVisibility}>
                {showPassword ? <FaEyeSlash /> : <FaEye />}
              </span>
            </div>
          </div>
          <div className="form-options">
            <div className="remember-me">
              <input type="checkbox" id="rememberMe" />
              <label htmlFor="rememberMe">Ingat Saya</label>
            </div>
          </div>
          <button type="submit" className="login-button" disabled={loading}>
            {loading ? 'Memproses...' : 'MASUK'}
          </button>
          {error && <p className="error-message">{error}</p>}
        </form>
      </div>
    </div>
  );
};

export default Login;