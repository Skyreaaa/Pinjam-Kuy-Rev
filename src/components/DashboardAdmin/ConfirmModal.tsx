import React from 'react';
import { FaExclamationTriangle, FaCheckCircle, FaTimes, FaInfoCircle } from 'react-icons/fa';

// --- INTERFACE ---
interface ConfirmModalProps {
    /** Status untuk menampilkan atau menyembunyikan modal. */
    isOpen: boolean;
    /** Fungsi yang dipanggil saat tombol Batal/Tutup diklik. */
    onClose: () => void;
    /** Fungsi yang dipanggil saat tombol Konfirmasi/Lanjutkan diklik. */
    onConfirm: () => void;
    /** Judul Modal (misalnya: "Konfirmasi Peminjaman"). */
    title: string;
    /** Pesan yang akan ditampilkan (misalnya: "Apakah Anda yakin...?"). */
    message: string | React.ReactNode;
    /** Teks untuk tombol konfirmasi (Default: 'Ya, Lanjutkan'). */
    confirmText?: string;
    /** Teks untuk tombol batal (Default: 'Batal'). */
    cancelText?: string;
    /** Tipe modal untuk menentukan warna dan ikon (warning, danger, info). Default: 'warning'. */
    type?: 'warning' | 'danger' | 'info';
    /** Status loading pada tombol konfirmasi. */
    isLoading?: boolean;
}

// --- KOMPONEN UTAMA ---
const ConfirmModal: React.FC<ConfirmModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmText = 'Ya, Lanjutkan',
    cancelText = 'Batal',
    type = 'warning',
    isLoading = false
}) => {
    if (!isOpen) return null;

    const getIcon = () => {
        switch (type) {
            case 'danger':
                return <FaExclamationTriangle className="modal-icon danger" />;
            case 'info':
                return <FaInfoCircle className="modal-icon info" />;
            case 'warning':
            default:
                return <FaExclamationTriangle className="modal-icon warning" />;
        }
    };

    const getButtonClass = () => {
        switch (type) {
            case 'danger':
                return 'btn-danger';
            case 'info':
                return 'btn-primary';
            case 'warning':
            default:
                return 'btn-warning';
        }
    };

    return (
        <div className="modal-overlay-v5">
            <div className={`modal-content-v5 confirm-modal ${type}`}>
                <button className="modal-close-v5" onClick={onClose} disabled={isLoading}>
                    <FaTimes />
                </button>
                <div className="modal-header-v5">
                    {getIcon()}
                    <h3>{title}</h3>
                </div>
                <div className="modal-body-v5">
                    <p>{message}</p>
                </div>
                <div className="modal-footer-v5">
                    <button
                        className="btn btn-secondary"
                        onClick={onClose}
                        disabled={isLoading}
                    >
                        {cancelText}
                    </button>
                    <button
                        className={`btn ${getButtonClass()}`}
                        onClick={onConfirm}
                        disabled={isLoading}
                    >
                        {isLoading ? 'Memproses...' : confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmModal;