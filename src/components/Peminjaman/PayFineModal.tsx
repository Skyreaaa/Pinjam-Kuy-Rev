import React, { useMemo, useState, useEffect } from 'react';
import { FaTimesCircle, FaMoneyBillWave, FaCheckCircle, FaQrcode, FaUniversity, FaCashRegister } from 'react-icons/fa';

export interface PayFineItem {
  id: number;
  bookTitle: string;
  penaltyAmount: number;
  finePaid?: number;
}

interface PayFineModalProps {
  items: PayFineItem[];
  onClose: () => void;
  onConfirm: (ids: number[], method: 'bank'|'qris'|'cash', requiresProof: boolean) => Promise<void> | void;
  loading: boolean;
  mode: 'single' | 'bulk';
  successMessage?: string | null;
  errorMessage?: string | null;
  onRefresh?: () => void;
  autoCloseOnSuccess?: boolean;
}

const formatCurrency = (amount: number) => `Rp ${amount.toLocaleString('id-ID')}`;

const PayFineModal: React.FC<PayFineModalProps> = ({ items, onClose, onConfirm, loading, mode, successMessage, errorMessage, onRefresh, autoCloseOnSuccess }) => {
  const unpaidAll = items.filter(i => !i.finePaid && i.penaltyAmount > 0);
  const [selectedIds, setSelectedIds] = useState<number[]>(() => unpaidAll.map(u=>u.id));
  useEffect(()=>{ setSelectedIds(unpaidAll.map(u=>u.id)); }, [items]);
  const toggleSelect = (id:number) => setSelectedIds(prev => prev.includes(id) ? prev.filter(p=>p!==id) : [...prev, id]);
  const allSelected = selectedIds.length === unpaidAll.length && unpaidAll.length>0;
  const toggleAll = () => setSelectedIds(allSelected ? [] : unpaidAll.map(u=>u.id));
  const unpaid = unpaidAll.filter(u => selectedIds.includes(u.id));
  const total = unpaid.reduce((s,i)=> s + i.penaltyAmount, 0);
  const title = mode === 'single' ? 'Bayar Denda' : 'Bayar Denda';

  const methodOptions = [
    { key: 'bank', label: 'Transfer Bank', icon: <FaUniversity /> },
    { key: 'qris', label: 'QRIS', icon: <FaQrcode /> },
    { key: 'cash', label: 'Cash', icon: <FaCashRegister /> }
  ] as const;
  type MethodKey = typeof methodOptions[number]['key'];
  const [method, setMethod] = useState<MethodKey>('bank');
  const bankInfo = useMemo(()=>{
    const banks = ['BCA','BNI','BRI','Mandiri','CIMB'];
    const bank = banks[Math.floor(Math.random()*banks.length)];
    const norek = Array.from({length:10},()=> Math.floor(Math.random()*10)).join('');
    const name = 'Perpustakaan Kampus';
    return { bank, norek, name };
  },[]);
  const qrisCode = useMemo(()=> 'QR-' + Math.random().toString(36).substring(2,10).toUpperCase(), []);
  const requiresProof = method !== 'cash';

  useEffect(()=>{
    if (successMessage && autoCloseOnSuccess) {
      const t = setTimeout(()=> onClose(), 1800);
      return ()=> clearTimeout(t);
    }
  },[successMessage, autoCloseOnSuccess, onClose]);

  return (
    <div className="modal-overlay-v5 pay-fine-modal-overlay">
      <div className="pay-fine-modal">
        <button className="close-button-v5" onClick={onClose} aria-label="Tutup" title="Tutup"><FaTimesCircle /></button>
        <h3>{title}</h3>
        {unpaidAll.length === 0 && <p className="status-message info">Tidak ada denda yang perlu dibayar.</p>}
        {unpaidAll.length > 0 && (
          <div className="fine-items-list">
            {mode==='bulk' && unpaidAll.length>1 && (
              <div className="fine-item-row fine-select-all">
                <label className="fine-select-label">
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} disabled={loading} /> Pilih Semua ({unpaidAll.length})
                </label>
              </div>
            )}
            {unpaidAll.map(item => (
              <div key={item.id} className={`fine-item-row ${!selectedIds.includes(item.id)?'dimmed':''}`}>
                {mode==='bulk' && unpaidAll.length>1 && (
                  <div className="fine-checkbox-wrapper">
                    <label className="sr-only" htmlFor={`fine-select-${item.id}`}>Pilih denda untuk buku {item.bookTitle}</label>
                    <input id={`fine-select-${item.id}`} aria-label={`Pilih denda ${item.bookTitle}`} type="checkbox" checked={selectedIds.includes(item.id)} onChange={()=>toggleSelect(item.id)} disabled={loading} />
                  </div>
                )}
                <div className="fine-item-info">
                  <p className="fine-book-title" title={item.bookTitle}>{item.bookTitle}</p>
                  <p className="fine-amount"><FaMoneyBillWave /> {formatCurrency(item.penaltyAmount)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
        {mode==='bulk' && unpaidAll.length>1 && (
          <div className="selection-hint">Pilih sebagian denda yang ingin dibayar sekarang.</div>
        )}
        {/* Payment Method Section */}
        <div className="payment-method-box">
          <p className="pm-label">Metode Pembayaran</p>
            <div className="pm-options">
              {methodOptions.map(m => (
                <button key={m.key} className={`pm-option ${method===m.key?'active':''}`} type="button" onClick={()=> setMethod(m.key)} disabled={loading}>
                  <span className="pm-icon">{m.icon}</span>{m.label}
                </button>
              ))}
            </div>
            <div className="pm-detail">
              {method==='bank' && (
                <div className="pm-bank-info">
                  <p><strong>Bank:</strong> {bankInfo.bank}</p>
                  <p><strong>No. Rekening:</strong> {bankInfo.norek}</p>
                  <p><strong>Nama:</strong> {bankInfo.name}</p>
                  <p className="pm-hint">Transfer tepat sejumlah total. Upload bukti setelah konfirmasi.</p>
                </div>
              )}
              {method==='qris' && (
                <div className="pm-qris-box">
                  <div className="pm-qris-placeholder">
                    <FaQrcode className="qris-icon" />
                    <span>{qrisCode}</span>
                  </div>
                  <p className="pm-hint">Scan kode QR contoh ini. Setelah bayar, upload bukti.</p>
                </div>
              )}
              {method==='cash' && (
                <div className="pm-cash-box">
                  <p>Bayar langsung di loket perpustakaan.</p>
                  <p className="pm-hint">Tidak perlu upload bukti untuk cash.</p>
                </div>
              )}
            </div>
        </div>
        <div className="fine-total-box">
          <span>Total Dibayar</span>
          <strong>{formatCurrency(total)}</strong>
        </div>
        <div className="proof-note">
          {requiresProof ? <p><strong>Catatan:</strong> Setelah konfirmasi akan diminta upload bukti pembayaran.</p> : <p><strong>Catatan:</strong> Cash dicatat petugas, tidak perlu bukti.</p>}
        </div>
        {successMessage && <p className="status-message success modal-msg"><FaCheckCircle /> {successMessage}</p>}
        {errorMessage && <p className="status-message error modal-msg">{errorMessage}</p>}
        <div className="pay-fine-actions">
          {onRefresh && <button className="btn-secondary-gray" type="button" disabled={loading} onClick={()=> onRefresh()}>Refresh</button>}
          <button className="btn-secondary-gray" onClick={onClose} disabled={loading}>Batal</button>
          <button className="btn-primary-pay" disabled={loading || unpaid.length===0} onClick={()=> onConfirm(unpaid.map(u=>u.id), method, requiresProof)}>
            {loading ? 'Memproses...' : (requiresProof ? (mode==='bulk' && unpaid.length>1 ? 'Bayar & Upload Bukti' : 'Konfirmasi & Upload Bukti') : (mode==='bulk' && unpaid.length>1 ? 'Bayar Terpilih' : 'Konfirmasi Bayar'))}
          </button>
        </div>
        <p className="fine-hint">Pembayaran ini akan menandai denda yang dipilih sebagai lunas.</p>
      </div>
    </div>
  );
};

export default PayFineModal;