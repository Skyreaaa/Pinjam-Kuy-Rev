import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../../config/api';

type Props = { children: React.ReactNode };

export default function RequireAuth({ children }: Props) {
  const navigate = useNavigate();
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login', { replace: true });
      return;
    }
    const controller = new AbortController();
    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/health`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        if (res.status === 401) navigate('/login', { replace: true });
      } catch {
        // ignore network errors to avoid false logouts
      }
    })();
    return () => controller.abort();
  }, [navigate]);
  return <>{children}</>;
}
