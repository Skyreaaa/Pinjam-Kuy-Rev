import React, { useState, useEffect } from 'react';
import '../PopUp/PopUp.css';

interface PopupProps {
  isVisible: boolean;
  message: string;
  onConfirm?: () => void;
  onCancel?: () => void;
  confirmText?: string;
  cancelText?: string;
  qrCodeUrl?: string;
  title?: string;
}

const Popup: React.FC<PopupProps> = ({ isVisible, message, onConfirm, onCancel, confirmText, cancelText, qrCodeUrl, title }) => {
  if (!isVisible) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        {title && <h3>{title}</h3>}
        {/* Menggunakan ikon SVG sederhana */}
        <svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="#2196F3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="modal-icon">
          <circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><path d="M12 17h.01"></path>
        </svg>
        <p className="modal-text">{message}</p>
        {qrCodeUrl && (
          <div className="qr-code-container">
            <img src={qrCodeUrl} alt="QR Code" style={{ width: 200, height: 200 }} />
            <p>PMJ-(kode buku)</p>
          </div>
        )}
        <div className="modal-buttons">
          {cancelText && <button onClick={onCancel}>{cancelText}</button>}
          {confirmText && <button onClick={onConfirm}>{confirmText}</button>}
        </div>
      </div>
    </div>
  );
};

export default Popup;