import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../../config/api';

type Props = { children: React.ReactNode };

export default function RequireAuth({ children }: Props) {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login', { replace: true });
      return;
    }
    const controller = new AbortController();
    (async () => {
      try {
        // Gunakan endpoint yang MEMBUTUHKAN auth agar validasi token akurat
        const res = await fetch(`${API_BASE_URL}/profile/me`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        if (res.status === 401) {
          navigate('/login', { replace: true });
          return;
        }
      } catch {
        // ignore network errors to avoid false logouts
      } finally {
        setReady(true);
      }
    })();
    return () => controller.abort();
  }, [navigate]);
  if (!ready) return null;
  return <>{children}</>;
}
