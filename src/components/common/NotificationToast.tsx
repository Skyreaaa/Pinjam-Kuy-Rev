import React, { useEffect } from 'react';
import { FaCheckCircle, FaInfoCircle, FaExclamationTriangle } from 'react-icons/fa';
import './NotificationToast.css';

export type ToastType = 'success' | 'error' | 'info';

interface NotificationToastProps {
  message: string;
  type?: ToastType;
  duration?: number; // ms
  onClose: () => void;
}

const NotificationToast: React.FC<NotificationToastProps> = ({ message, type = 'info', duration = 7000, onClose }) => {
  useEffect(() => {
    if (!duration) return;
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  return (
    <div className={`toast-container toast-${type}`} role="status" aria-live="polite">
      <div className="toast-card" onClick={onClose}>
        <div className="toast-icon" aria-hidden>
          {type === 'success' && <FaCheckCircle />}
          {type === 'error' && <FaExclamationTriangle />}
          {type === 'info' && <FaInfoCircle />}
        </div>
        <div className="toast-body">
          <span className="toast-message">{message}</span>
        </div>
        <button className="toast-close" onClick={(e)=>{ e.stopPropagation(); onClose(); }} aria-label="Tutup notifikasi">×</button>
      </div>
    </div>
  );
};

export default NotificationToast;
