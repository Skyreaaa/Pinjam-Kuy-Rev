// File: src/components/DashboardAdmin/ReturnProcessModal.tsx (BARU - FULL CODE SIAP PAKAI)

import React, { useState, useEffect } from 'react';
import { adminApi } from '../../services/api';
import { FaTimes, FaUndo, FaMoneyBillWave, FaClock, FaCalendarAlt, FaInfoCircle, FaCheckCircle } from 'react-icons/fa';
import { format } from 'date-fns';
import './AdminDashboard.css'; 

// --- KONSTANTA & HELPER --
// API base & token sudah dihandle oleh adminApi interceptor

// Helper untuk format Rupiah
const formatRupiah = (amount: number) => {
    const num = Number(amount);
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
    }).format(num);
};

// --- INTERFACES (Diambil dari AdminDashboard) ---
interface Loan {
    id: number;
    expectedReturnDate: string;
    status: 'Menunggu Persetujuan' | 'Sedang Dipinjam' | 'Terlambat' | 'Siap Dikembalikan' | 'Dikembalikan' | 'Ditolak';
    title: string;
    kodeBuku: string;
    username: string;
    npm: string;
    calculatedPenalty?: number;
    calculatedPenaltyRupiah?: string;
    userDenda: number;
}

interface ReturnProcessModalProps {
    isOpen: boolean;
    onClose: () => void;
    loanData: Loan | null;
    onProcess: () => void; // Fungsi untuk refresh data di parent
    showStatus: (msg: string | null, err: string | null) => void;
}

const ReturnProcessModal: React.FC<ReturnProcessModalProps> = ({ isOpen, onClose, loanData, onProcess, showStatus }) => {
    const [manualFineAmount, setManualFineAmount] = useState<number>(0);
    const [totalFine, setTotalFine] = useState<number>(0);
    const [isLoading, setIsLoading] = useState(false);
    // Hilangkan notifikasi toast admin sesuai permintaan

    useEffect(() => {
        if (loanData) {
            // Denda Otomatis dari server (sudah dihitung di loanController.getReturnsForReview)
            const autoFine = loanData.calculatedPenalty || 0; 
            setTotalFine(autoFine + manualFineAmount);
        }
    }, [loanData, manualFineAmount]);

    if (!isOpen || !loanData) return null;

    const handleManualFineChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value === '' ? 0 : Number(e.target.value);
        setManualFineAmount(value >= 0 ? value : 0);
    };

    const handleProcessSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            const response = await adminApi.processReturn(loanData.id, manualFineAmount);
            showStatus(response.message || 'Pengembalian diproses', null);
            onProcess(); // Refresh data di parent
            onClose();

        } catch (err) {
            const errMsg = (err as any)?.response?.data?.message || 'Gagal memproses pengembalian.';
            showStatus(null, errMsg);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content large">
                <div className="modal-header">
                    <h2><FaUndo /> Proses Pengembalian</h2>
                    <button className="close-button" onClick={onClose} disabled={isLoading} title="Tutup"><FaTimes /></button>
                </div>
                
                <form onSubmit={handleProcessSubmit}>
                    <div className="modal-body">
                        
                        <div className="loan-info-box">
                            <p><strong><FaInfoCircle /> Detail Pinjaman</strong></p>
                            <p>Buku: <strong>{loanData.title}</strong> (Kode: {loanData.kodeBuku})</p>
                            <p>Peminjam: <strong>{loanData.username}</strong> ({loanData.npm})</p>
                            <p>Tgl. Kembali (Estimasi): <strong>{format(new Date(loanData.expectedReturnDate), 'dd MMM yyyy')}</strong></p>
                            <p>Status Pinjaman: 
                                <span className={`status-badge ${loanData.status === 'Terlambat' ? 'danger' : loanData.status === 'Siap Dikembalikan' ? 'warning' : 'info'}`}>
                                    {loanData.status}
                                </span>
                            </p>
                            <p>Denda Akun User Saat Ini: <strong>{formatRupiah(loanData.userDenda)}</strong></p>
                        </div>

                        <div className="form-group mt-3">
                            <label><FaClock /> Denda Keterlambatan (Otomatis):</label>
                            <p className="auto-fine-display">
                                {loanData.calculatedPenalty && loanData.calculatedPenalty > 0 ? (
                                    <span style={{ color: '#dc3545', fontWeight: 'bold' }}>{loanData.calculatedPenaltyRupiah}</span>
                                ) : (
                                    <span style={{ color: '#28a745', fontWeight: 'bold' }}>{formatRupiah(0)} (Tepat Waktu)</span>
                                )}
                            </p>
                        </div>
                        
                        <div className="form-group mt-3">
                            <label htmlFor="manualFineAmount"><FaMoneyBillWave /> Denda Manual (Kerusakan/Lainnya):</label>
                            <input 
                                type="number" 
                                id="manualFineAmount" 
                                name="manualFineAmount" 
                                value={manualFineAmount} 
                                onChange={handleManualFineChange} 
                                min="0" 
                                disabled={isLoading}
                                placeholder="Masukkan jumlah denda manual (opsional)"
                            />
                        </div>

                        <div className="total-fine-summary mt-4">
                            <h3>Total Denda yang Akan Ditambahkan ke Akun User</h3>
                            <p>Denda Otomatis + Denda Manual = <strong>{formatRupiah(totalFine)}</strong></p>
                            {totalFine > 0 && (
                                <p className="warning-text"><FaInfoCircle /> Total denda ini akan **ditambahkan** ke saldo denda user. Status pinjaman akan berubah menjadi 'Dikembalikan'.</p>
                            )}
                        </div>
                        
                    </div>
                    
                    <button type="submit" className="btn btn-primary btn-save" disabled={isLoading}>
                        {isLoading ? 'Memproses...' : <><FaCheckCircle /> Konfirmasi Pengembalian & Proses Denda</>}
                    </button>
                </form>
            </div>
            {/* Toast admin dihilangkan */}
        </div>
    );
};

export default ReturnProcessModal;