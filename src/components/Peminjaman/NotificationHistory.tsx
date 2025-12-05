import React, { useEffect, useState } from 'react';
import { loanApi } from '../../services/api';
import { FaArrowLeft, FaCheckCircle, FaTimesCircle, FaBell, FaMoneyBillWave, FaFilter, FaMapMarkerAlt, FaImage, FaTimes } from 'react-icons/fa';
import { format, startOfDay, endOfDay, startOfMonth, endOfMonth, isWithinInterval, subMonths } from 'date-fns';
import { id } from 'date-fns/locale';
import { API_BASE_URL } from '../../config/api';
import './BorrowingPage.css';

interface NotificationHistoryProps {
  onBack: () => void;
}

type NotificationItem = {
  id: number;
  bookTitle: string;
  status: string;
  approvedAt?: string;
  actualReturnDate?: string;
  returnDecision?: 'approved' | 'rejected';
  rejectionDate?: string;
  kind?: 'loan_approved'|'loan_rejected'|'return_approved'|'return_rejected'|'fine_imposed'|'fine_paid'|'fine_rejected';
  amount?: number;
  timestamp?: Date;
  returnProofUrl?: string;
  returnProofMetadata?: {
    timestamp?: string;
    coordinates?: {
      latitude: number;
      longitude: number;
      accuracy: number;
    };
    address?: string;
    device?: string;
  };
};

type FilterType = 'all' | 'today' | 'thisMonth' | 'lastMonth' | 'custom';

const formatDate = (value?: string | Date) => {
  if (!value) return '-';
  try {
    const date = typeof value === 'string' ? new Date(value) : value;
    return format(date, 'dd MMM yyyy HH:mm', { locale: id });
  } catch {
    return String(value);
  }
};

const formatDateShort = (value?: string | Date) => {
  if (!value) return '-';
  try {
    const date = typeof value === 'string' ? new Date(value) : value;
    return format(date, 'dd MMM yyyy', { locale: id });
  } catch {
    return String(value);
  }
};

const NotificationHistory: React.FC<NotificationHistoryProps> = ({ onBack }) => {
  const [allItems, setAllItems] = useState<NotificationItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [selectedProof, setSelectedProof] = useState<NotificationItem | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [res, loans] = await Promise.all([
          loanApi.notificationHistory(),
          loanApi.userLoans(),
        ]);
        if (!res.success) {
          setError((res as any as string) || 'Gagal mengambil riwayat notifikasi.');
        }
        const baseItems: NotificationItem[] = (res.items || []).map(it => {
          let kind: NotificationItem['kind'] = 'loan_approved';
          let timestamp = new Date();
          
          if (it.returnDecision === 'approved') {
            kind = 'return_approved';
            timestamp = it.actualReturnDate ? new Date(it.actualReturnDate) : new Date();
          } else if (it.returnDecision === 'rejected') {
            kind = 'return_rejected';
            timestamp = it.rejectionDate ? new Date(it.rejectionDate) : new Date();
          } else if (it.rejectionDate) {
            kind = 'loan_rejected';
            timestamp = new Date(it.rejectionDate);
          } else {
            kind = 'loan_approved';
            timestamp = it.approvedAt ? new Date(it.approvedAt) : new Date();
          }
          
          // Parse metadata if exists
          let metadata = null;
          if (it.returnProofMetadata) {
            try {
              metadata = typeof it.returnProofMetadata === 'string' 
                ? JSON.parse(it.returnProofMetadata) 
                : it.returnProofMetadata;
            } catch (e) {
              console.warn('Failed to parse metadata:', e);
            }
          }
          
          return { 
            ...it, 
            kind, 
            timestamp,
            returnProofUrl: it.returnProofUrl,
            returnProofMetadata: metadata
          } as NotificationItem;
        });

        // Derive fine-related entries from current loans snapshot
        const fineItems: NotificationItem[] = (loans || []).flatMap((l: any) => {
          const arr: NotificationItem[] = [];
          const amount = (l.penaltyAmount ?? l.fineAmount ?? 0) as number;
          if (l.finePaymentStatus === 'awaiting_proof' && amount > 0) {
            arr.push({ 
              id: l.id, 
              bookTitle: l.bookTitle, 
              status: l.status, 
              kind: 'fine_imposed', 
              amount,
              timestamp: l.actualReturnDate ? new Date(l.actualReturnDate) : new Date()
            });
          }
          if (l.finePaymentStatus === 'paid') {
            arr.push({ 
              id: l.id, 
              bookTitle: l.bookTitle, 
              status: l.status, 
              kind: 'fine_paid', 
              amount,
              timestamp: new Date()
            });
          }
          if (l.finePaymentStatus === 'awaiting_proof' && l.returnProofRejected) {
            arr.push({ 
              id: l.id, 
              bookTitle: l.bookTitle, 
              status: l.status, 
              kind: 'fine_rejected',
              timestamp: new Date()
            });
          }
          return arr;
        });

        // Merge and de-duplicate by id+kind
        const key = (x: NotificationItem) => `${x.id}_${x.kind || 'unknown'}`;
        const mergedMap = new Map<string, NotificationItem>();
        [...baseItems, ...fineItems].forEach(item => {
          mergedMap.set(key(item), item);
        });
        
        const items = Array.from(mergedMap.values()).sort((a, b) => {
          return (b.timestamp?.getTime() || 0) - (a.timestamp?.getTime() || 0);
        });
        
        console.log('📋 Notification items:', items);
        console.log('🖼️ Items with proof:', items.filter(i => i.returnProofUrl));
        
        setAllItems(items);
        setFilteredItems(items);
      } catch (e: any) {
        setError(e?.response?.data?.message || 'Gagal mengambil riwayat notifikasi.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Apply filter whenever filterType or dates change
  const applyFilter = React.useCallback(() => {
    let filtered = [...allItems];
    const now = new Date();

    switch (filterType) {
      case 'today':
        filtered = filtered.filter(item => {
          if (!item.timestamp) return false;
          return isWithinInterval(item.timestamp, {
            start: startOfDay(now),
            end: endOfDay(now)
          });
        });
        break;
      
      case 'thisMonth':
        filtered = filtered.filter(item => {
          if (!item.timestamp) return false;
          return isWithinInterval(item.timestamp, {
            start: startOfMonth(now),
            end: endOfMonth(now)
          });
        });
        break;
      
      case 'lastMonth':
        const lastMonth = subMonths(now, 1);
        filtered = filtered.filter(item => {
          if (!item.timestamp) return false;
          return isWithinInterval(item.timestamp, {
            start: startOfMonth(lastMonth),
            end: endOfMonth(lastMonth)
          });
        });
        break;
      
      case 'custom':
        if (customStartDate && customEndDate) {
          const start = startOfDay(new Date(customStartDate));
          const end = endOfDay(new Date(customEndDate));
          filtered = filtered.filter(item => {
            if (!item.timestamp) return false;
            return isWithinInterval(item.timestamp, { start, end });
          });
        }
        break;
      
      case 'all':
      default:
        // No filter
        break;
    }

    setFilteredItems(filtered);
  }, [allItems, filterType, customStartDate, customEndDate]);

  useEffect(() => {
    applyFilter();
  }, [applyFilter]);

  const getFilterLabel = () => {
    switch (filterType) {
      case 'today': return 'Hari Ini';
      case 'thisMonth': return 'Bulan Ini';
      case 'lastMonth': return 'Bulan Lalu';
      case 'custom': return customStartDate && customEndDate 
        ? `${formatDateShort(customStartDate)} - ${formatDateShort(customEndDate)}`
        : 'Pilih Tanggal';
      case 'all':
      default:
        return 'Semua';
    }
  };

  const renderIcon = (item: NotificationItem) => {
    const kind = item.kind;
    if (kind === 'return_approved' || kind === 'fine_paid') return <FaCheckCircle className="notif-icon success" />;
    if (kind === 'return_rejected' || kind === 'loan_rejected' || kind === 'fine_rejected') return <FaTimesCircle className="notif-icon error" />;
    if (kind === 'fine_imposed') return <FaMoneyBillWave className="notif-icon warning" />;
    // default loan approved
    return <FaBell className="notif-icon info" />;
  };

  const renderLabel = (item: NotificationItem) => {
    switch (item.kind) {
      case 'return_approved': return 'Pengembalian Disetujui';
      case 'return_rejected': return 'Bukti Pengembalian Ditolak';
      case 'loan_rejected': return 'Pinjaman Ditolak';
      case 'fine_imposed': return 'Denda Ditetapkan';
      case 'fine_paid': return 'Pembayaran Denda Disetujui';
      case 'fine_rejected': return 'Pembayaran Denda Ditolak';
      case 'loan_approved':
      default:
        return 'Pinjaman Disetujui';
    }
  };

  const renderDate = (item: NotificationItem) => {
    return formatDate(item.actualReturnDate || item.approvedAt || item.rejectionDate);
  };

  const formatIDR = (n?: number) => typeof n === 'number'
    ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n)
    : '';

  return (
    <div className="book-detail-container-v5">
      <div className="header-v5">
        <button className="back-button-v5" onClick={onBack} aria-label="Kembali">
          <FaArrowLeft />
        </button>
        <h1 className="header-title-v5">Riwayat Notifikasi</h1>
      </div>

      {/* Filter Section */}
      <div className="notif-filter-section">
        <button 
          className="notif-filter-btn"
          onClick={() => setShowFilterMenu(!showFilterMenu)}
        >
          <FaFilter /> {getFilterLabel()} <span className="filter-count">({filteredItems.length})</span>
        </button>

        {showFilterMenu && (
          <div className="notif-filter-menu">
            <div className="filter-options">
              <button 
                className={`filter-option ${filterType === 'all' ? 'active' : ''}`}
                onClick={() => { setFilterType('all'); setShowFilterMenu(false); }}
              >
                Semua Notifikasi
              </button>
              <button 
                className={`filter-option ${filterType === 'today' ? 'active' : ''}`}
                onClick={() => { setFilterType('today'); setShowFilterMenu(false); }}
              >
                Hari Ini
              </button>
              <button 
                className={`filter-option ${filterType === 'thisMonth' ? 'active' : ''}`}
                onClick={() => { setFilterType('thisMonth'); setShowFilterMenu(false); }}
              >
                Bulan Ini
              </button>
              <button 
                className={`filter-option ${filterType === 'lastMonth' ? 'active' : ''}`}
                onClick={() => { setFilterType('lastMonth'); setShowFilterMenu(false); }}
              >
                Bulan Lalu
              </button>
              <div className="filter-divider"></div>
              <div className="filter-custom">
                <label className="filter-custom-label">Pilih Rentang Tanggal:</label>
                <input 
                  type="date" 
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="filter-date-input"
                  title="Tanggal mulai"
                  aria-label="Tanggal mulai"
                />
                <span className="filter-date-separator">s/d</span>
                <input 
                  type="date" 
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="filter-date-input"
                  title="Tanggal selesai"
                  aria-label="Tanggal selesai"
                />
                <button 
                  className="filter-apply-btn"
                  disabled={!customStartDate || !customEndDate}
                  onClick={() => { setFilterType('custom'); setShowFilterMenu(false); }}
                >
                  Terapkan
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="main-content-area-v5 detail-view">
        {loading && <p className="loading-bar">Memuat riwayat notifikasi...</p>}
        {error && !loading && <p className="status-message error">{error}</p>}
        {!loading && !error && filteredItems.length === 0 && (
          <div className="notif-empty-state">
            <FaBell className="notif-empty-icon" />
            <p className="status-message">
              {allItems.length === 0 ? 'Belum ada notifikasi.' : 'Tidak ada notifikasi untuk periode yang dipilih.'}
            </p>
          </div>
        )}

        {!loading && !error && filteredItems.length > 0 && (
          <ul className="notification-history-list">
            {filteredItems.map((item, idx) => (
              <li key={`${item.id}_${item.kind}_${idx}`} className="notification-history-item">
                <div className="notif-icon-wrapper">{renderIcon(item)}</div>
                <div className="notif-content">
                  <div className="notif-text">
                    <p className="notif-label">{renderLabel(item)}</p>
                    <p className="notif-book">{item.bookTitle}</p>
                    {item.kind?.startsWith('fine') && item.amount && (
                      <p className="notif-amount">{formatIDR(item.amount)}</p>
                    )}
                    {item.returnProofUrl && (
                      <button 
                        className="notif-view-proof-btn"
                        onClick={() => setSelectedProof(item)}
                      >
                        <FaImage /> Lihat Bukti Pengembalian
                      </button>
                    )}
                  </div>
                  <div className="notif-date">
                    <p className="notif-time">{item.timestamp ? format(item.timestamp, 'HH:mm', {locale: id}) : '-'}</p>
                    <p className="notif-day">{item.timestamp ? format(item.timestamp, 'dd MMM', {locale: id}) : '-'}</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Proof Modal */}
      {selectedProof && (() => {
        let imageUrl = '';
        if (selectedProof.returnProofUrl) {
          if (selectedProof.returnProofUrl.startsWith('http')) {
            imageUrl = selectedProof.returnProofUrl;
          } else if (selectedProof.returnProofUrl.startsWith('/')) {
            // Absolute path like /uploads/xxx
            imageUrl = `${API_BASE_URL}${selectedProof.returnProofUrl}`;
          } else {
            // Relative path like uploads/xxx or filename
            imageUrl = `${API_BASE_URL}/${selectedProof.returnProofUrl}`;
          }
        }
        console.log('🖼️ Proof Image URL:', imageUrl);
        console.log('🖼️ Original returnProofUrl:', selectedProof.returnProofUrl);
        
        return (
          <div className="proof-modal-overlay" onClick={() => setSelectedProof(null)}>
            <div className="proof-modal-content" onClick={(e) => e.stopPropagation()}>
              <button className="proof-modal-close" onClick={() => setSelectedProof(null)} aria-label="Tutup" title="Tutup">
                <FaTimes />
              </button>
              <h2 className="proof-modal-title">Bukti Pengembalian</h2>
              <p className="proof-modal-book">{selectedProof.bookTitle}</p>
              
              {imageUrl ? (
                <div className="proof-modal-image proof-modal-image-fullsize">
                  <img 
                    src={imageUrl}
                    alt="Bukti Pengembalian"
                    onClick={() => window.open(imageUrl, '_blank')}
                    className="cursor-pointer"
                    title="Klik untuk buka di tab baru"
                    onError={(e) => {
                      console.error('❌ Failed to load image:', imageUrl);
                      (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Crect fill="%23ddd" width="200" height="200"/%3E%3Ctext fill="%23999" x="50%25" y="50%25" text-anchor="middle" dy=".3em"%3EGambar tidak tersedia%3C/text%3E%3C/svg%3E';
                    }}
                  />
                </div>
              ) : (
                <div className="proof-modal-image proof-modal-image-fullsize">
                  <p className="proof-empty-text">
                    Tidak ada bukti pengembalian
                  </p>
                </div>
              )}

            {selectedProof.returnProofMetadata && (
              <div className="proof-modal-metadata">
                <h3 className="proof-metadata-title">
                  <FaMapMarkerAlt /> Informasi Lokasi & Waktu
                </h3>
                
                {selectedProof.returnProofMetadata.timestamp && (
                  <div className="proof-metadata-item">
                    <strong>Waktu Pengambilan:</strong>
                    <span>{format(new Date(selectedProof.returnProofMetadata.timestamp), 'dd MMMM yyyy, HH:mm:ss', {locale: id})}</span>
                  </div>
                )}
                
                {selectedProof.returnProofMetadata.coordinates && (
                  <div className="proof-metadata-item">
                    <strong>Koordinat GPS:</strong>
                    <span>
                      {selectedProof.returnProofMetadata.coordinates.latitude.toFixed(6)}, {selectedProof.returnProofMetadata.coordinates.longitude.toFixed(6)}
                      <br />
                      <small>(Akurasi: ±{selectedProof.returnProofMetadata.coordinates.accuracy.toFixed(0)}m)</small>
                    </span>
                  </div>
                )}
                
                {selectedProof.returnProofMetadata.address && (
                  <div className="proof-metadata-item">
                    <strong>Alamat:</strong>
                    <span>{selectedProof.returnProofMetadata.address}</span>
                  </div>
                )}
                
                {selectedProof.returnProofMetadata.device && (
                  <div className="proof-metadata-item">
                    <strong>Sumber:</strong>
                    <span>{selectedProof.returnProofMetadata.device}</span>
                  </div>
                )}

                {selectedProof.returnProofMetadata.coordinates && (
                  <a 
                    href={`https://www.google.com/maps?q=${selectedProof.returnProofMetadata.coordinates.latitude},${selectedProof.returnProofMetadata.coordinates.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="proof-view-map-btn"
                  >
                    <FaMapMarkerAlt /> Buka di Google Maps
                  </a>
                )}
              </div>
            )}
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default NotificationHistory;
