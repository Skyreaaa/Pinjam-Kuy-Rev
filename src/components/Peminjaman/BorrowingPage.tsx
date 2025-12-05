    // File: src/components/Peminjaman/BorrowingPage.tsx (KODE LENGKAP V5 - REDESIGNED UI + API INTEGRATION - FIXED v4: MAPPING KOLOM JUDUL/PENULIS)

    import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
    // Hapus pemakaian axios langsung; pakai service layer
    import { bookApi, loanApi, normalizeBook, profileApi } from '../../services/api';
    import { BrowserRouter, Routes, Route, Link, useNavigate, useParams, useLocation } from 'react-router-dom';
    import { format, addDays, isBefore, differenceInCalendarDays, startOfDay } from 'date-fns';
    import { id } from 'date-fns/locale';
    import { FaArrowLeft, FaBook, FaSearch, FaCheckCircle, FaTimesCircle, FaClock, FaList, FaExclamationCircle, FaCalendarAlt, FaUser, FaInfoCircle, FaBarcode, FaCalendarCheck, FaUndo, FaMoneyBillWave, FaMapMarkerAlt } from 'react-icons/fa';
    import QRCode from 'react-qr-code';
    import { IoIosArrowBack } from 'react-icons/io'; 
    import './BorrowingPage.css'; 
    import PayFineModal from './PayFineModal';
    import FinePaymentProofModal from './FinePaymentProofModal';
    import ReactCrop, { Crop } from 'react-image-crop';
    import LazyImage from '../common/LazyImage';
    import NotificationToast from '../common/NotificationToast';
    import 'react-image-crop/dist/ReactCrop.css';

    // PASTIKAN PATH KE FILE CERIA.PNG SUDAH BENAR
    import ceriaIcon from '../../assets/ceria.png';
    import logoIcon from '../../assets/Logo.png'; 

    // --- KONSTANTA & HELPER ---
    const getToken = () => localStorage.getItem('token');
    const PENALTY_PER_DAY = 2000;
    // Konfigurasi batas hari maksimum peminjaman (ubah dari 14 menjadi 21 hari)
    // Tidak ada batas maksimal hari peminjaman dari sisi UI
    const LOAN_MAX_DAYS = 3650; // dibiarkan besar (10 tahun) agar praktis tanpa batas

    const formatDate = (date: Date | string | null, formatStr: string = 'dd MMM yyyy') => {
        if (!date) return '-';
        try {
            return format(typeof date === 'string' ? new Date(date) : date, formatStr, { locale: id });
        } catch (e) {
            return String(date);
        }
    };

    interface UserData { id: number; username: string; npm: string; }

    export interface Book {
        id: number;
        judul: string;
        penulis: string;
        year: string;
        totalStock: number;
        availableStock: number;
        description: string;
        kodeBuku: string;
        imageUrl: string;
        location: 'Rak A' | 'Rak B' | 'Rak C' | string;
        borrowCount?: number;
    }

    export interface Loan {
        id: number;
        kodePinjam: string;
        bookTitle: string;
        kodeBuku: string;
        loanDate: string;
        returnDate: string;
        status: 'Menunggu Persetujuan' | 'Disetujui' | 'Diambil' | 'Sedang Dipinjam' | 'Ditolak' | 'Selesai' | 'Terlambat' | 'Siap Dikembalikan' | 'Dikembalikan';
        penaltyAmount: number;
        actualReturnDate: string | null;
        location: string;
        finePaid?: number; // legacy 0/1
        finePaymentStatus?: 'unpaid' | 'awaiting_proof' | 'pending_verification' | 'paid';
        finePaymentMethod?: 'bank' | 'qris' | 'cash';
        finePaymentProof?: string | null;
    }

    const formatCurrency = (amount: number) => `Rp ${amount.toLocaleString('id-ID')}`;

    const calculatePenalty = (returnDate: string, actualReturnDate: string | null = null): number => {
        const today = startOfDay(new Date());
        const dueDate = startOfDay(new Date(returnDate));
        const effective = startOfDay(actualReturnDate ? new Date(actualReturnDate) : today);
        const daysLate = Math.max(0, differenceInCalendarDays(effective, dueDate));
        return daysLate * PENALTY_PER_DAY;
    };
    interface BorrowingPageProps { 
        userData: UserData; 
        onBack: () => void; 
        loans?: Loan[]; // opsional: daftar pinjaman yang sudah dimiliki (dummy / preloaded)
        onLoanAdded?: (loan: Loan) => void; // callback setelah berhasil menambah pinjaman
    }

    // --- SUB-KOMPONEN NAVIGASI/HEADER V5 ---
    interface HeaderV5Props {
        onBack: () => void;
        currentPath: string;
        searchTerm: string;
        setSearchTerm: (term: string) => void;
        title: string;
    }
    const HeaderV5: React.FC<HeaderV5Props> = ({ onBack, currentPath, searchTerm, setSearchTerm, title }) => {
        const navigate = useNavigate();
        // Tampilkan kotak pencarian di halaman daftar buku (bukan di /loans)
        const isSearchVisible = currentPath !== '/loans';

        return (
            <div className="borrowing-header-v5">
                <div className="header-top-v5">
                    <button
                        onClick={() => {
                            try {
                                if (window.history.length > 1) {
                                    navigate(-1);
                                } else {
                                    // Fallback ke halaman daftar buku
                                    navigate('/');
                                }
                            } catch {
                                navigate('/');
                            }
                        }}
                        className="back-button-v5"
                        title="Kembali"
                    >
                        <IoIosArrowBack />
                    </button>
                    <div className="nav-links-v5">
                        <Link 
                            to="/loans" 
                            className={`nav-link-v5 ${currentPath === '/loans' ? 'active' : ''}`}
                            title="Pinjaman Saya"
                        >
                            <FaList />
                        </Link>
                    </div>
                </div>
                
                <div className={`header-content-v5 ${isSearchVisible ? 'with-search' : ''}`}>
                    <div className="header-title-box-v5">
                        <img src={ceriaIcon} alt="Ceria Icon" className="ceria-icon-v5" />
                        <h2>{title}</h2>
                    </div>

                    {isSearchVisible && (
                        <div className="search-box-v5">
                            <input
                                type="text"
                                placeholder="Cari buku (judul/penulis/kode)..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="search-input-v5"
                            />
                            <button className="search-button-v5" aria-label="Cari" title="Cari">
                                <FaSearch />
                            </button>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    // --- SUB-KOMPONEN 1: BOOK CARD & LIST (V5) ---
    interface BookListProps {
        books: Book[];
        isLoading: boolean;
        error: string | null;
        currentPath: string;
        onBack: () => void;
        fetchBooks: (overrideFilter?: string) => void;
        // optional lifted filter state
        activeFilterExternal?: string;
        setActiveFilterExternal?: (f: string) => void;
    }

    const BookCardV5: React.FC<{ book: Book, onClick: () => void }> = ({ book, onClick }) => {
        // FIX V4: Menggunakan book.judul dan book.penulis
        const bookTitle = book.judul || 'Judul Tidak Tersedia';
        const bookAuthor = book.penulis || 'Penulis Tidak Tersedia';

        return (
            <div className="book-card-v5" onClick={onClick}>
                <div className="book-cover-v5">
                    <LazyImage
                        src={book.imageUrl || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="150" height="200"%3E%3Crect fill="%23ddd" width="150" height="200"/%3E%3Ctext fill="%23999" x="50%25" y="50%25" text-anchor="middle" dy=".3em" font-size="14"%3ETidak Ada Gambar%3C/text%3E%3C/svg%3E'}
                        alt={`Sampul buku ${bookTitle}`}
                        className=""
                        onError={(e) => { (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="150" height="200"%3E%3Crect fill="%23ddd" width="150" height="200"/%3E%3Ctext fill="%23999" x="50%25" y="50%25" text-anchor="middle" dy=".3em" font-size="14"%3ETidak Ada Gambar%3C/text%3E%3C/svg%3E'; }}
                    />
                </div>
                <div className="book-info-v5">
                    <p className="book-kode-v5">#{book.kodeBuku || 'N/A'}</p>
                    <h4 title={bookTitle}>{bookTitle}</h4> 
                    <p className="book-author-v5">{bookAuthor}</p> 
                    {book.description && (
                        <p className="book-desc-v5" title={book.description}>{book.description}</p>
                    )}
                    <div className="book-stock-v5">
                        <span className={book.availableStock > 0 ? 'available' : 'unavailable'}>
                            <FaBook /> Stok: {book.availableStock} dari {book.totalStock}
                        </span>
                    </div>
                </div>
            </div>
        );
    };

    // Filter Categories (Fitur Populer/Tahun)
    const CategoryFilterV5: React.FC<{ activeFilter: string, setActiveFilter: (filter: string) => void }> = ({ activeFilter, setActiveFilter }) => {
        const filters = ['Semua', 'Populer', 'Tahun Terbaru'];
        return (
            <div className="category-filter-v5">
                {filters.map(filter => (
                    <button
                        key={filter}
                        className={`filter-button-v5 ${activeFilter === filter ? 'active' : ''}`}
                        onClick={() => setActiveFilter(filter)}
                    >
                        {filter}
                    </button>
                ))}
            </div>
        );
    };

    const BookList: React.FC<BookListProps> = ({ books, isLoading, error, currentPath, onBack, fetchBooks, activeFilterExternal, setActiveFilterExternal }) => {
        const navigate = useNavigate();
        const [searchTerm, setSearchTerm] = useState('');
        const [activeFilter, setActiveFilterLocal] = useState('Semua');
        // if external state provided, sync
        useEffect(()=>{
            if (activeFilterExternal && activeFilterExternal !== activeFilter) {
                setActiveFilterLocal(activeFilterExternal);
            }
        }, [activeFilterExternal]);
        const setActiveFilter = (val: string) => {
            setActiveFilterLocal(val);
            if (setActiveFilterExternal) setActiveFilterExternal(val);
        };

        const filteredAndSortedBooks = useMemo(() => {
            let result = [...books];
            if (searchTerm) {
                result = result.filter(book =>
                    (book.judul || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                    (book.penulis || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                    book.kodeBuku.toLowerCase().includes(searchTerm.toLowerCase())
                );
            }
            if (activeFilter === 'Tahun Terbaru') {
                result.sort((a,b)=> parseInt(b.year||'0') - parseInt(a.year||'0'));
            } else if (activeFilter === 'Populer') {
                result.sort((a,b)=> (b.borrowCount||0) - (a.borrowCount||0));
            }
            return result;
        }, [books, searchTerm, activeFilter]);

        const Header = () => ( 
            <HeaderV5 
                onBack={onBack} 
                currentPath={currentPath} 
                searchTerm={searchTerm} 
                setSearchTerm={setSearchTerm} 
                title="Cari Buku" 
            /> 
        );

        if (isLoading && books.length === 0) return (
            <>
                <Header /> 
                <div className="book-list-container-v5">
                    <p className="loading-bar">Memuat daftar buku...</p>
                </div>
            </>
        );
        
        return (
            <>
                <Header /> 
                <div className="book-list-container-v5">
                    <div className="main-content-area-v5">
                    {/* Filter Category */}
                    <CategoryFilterV5 activeFilter={activeFilter} setActiveFilter={setActiveFilter} />

                    {error && <p className="status-message error"><FaExclamationCircle /> {error}</p>}

                    {/* Tombol Refresh */}
                    <button onClick={()=>fetchBooks()} className="refresh-button-v5" title="Refresh Data">
                        <FaUndo /> Refresh Data
                    </button>

                    {filteredAndSortedBooks.length === 0 && !isLoading ? (
                        <p className="no-data"><FaExclamationCircle /> Tidak ada buku yang cocok dengan pencarian Anda.</p>
                    ) : (
                        <div className="book-cards-v5">
                            {filteredAndSortedBooks.map(book => (
                                <Link key={book.id} to={`/book/${book.id}`} className="book-card-link">
                                    <BookCardV5 book={book} onClick={() => navigate(`/book/${book.id}`)} />
                                </Link>
                            ))}
                            {isLoading && books.length > 0 && <p className="loading-bar">Memperbarui data...</p>}
                        </div>
                    )}
                    </div>
                </div>
            </>
        );
    };
    // ------------------------------------------

    // --- SUB-KOMPONEN 2: BOOK DETAIL & FORM (V5) ---
    interface BookDetailProps { userData: UserData; allBooks: Book[]; }

    const BookDetail: React.FC<BookDetailProps> = ({ userData, allBooks }) => {
        const { bookId } = useParams<{ bookId: string }>();
        const navigate = useNavigate();
        const [book, setBook] = useState<Book | null>(null);
        const [isLoading, setIsLoading] = useState(true);
        const [error, setError] = useState<string | null>(null);
        const [isFormOpen, setIsFormOpen] = useState(false);
        const [message, setMessage] = useState<string | null>(null);

    const [loanPurpose, setLoanPurpose] = useState('');
    const loanPurposeRef = useRef<HTMLTextAreaElement | null>(null);
        // Pastikan textarea tetap fokus selama form terbuka (mengatasi masalah harus klik setiap huruf)
        useEffect(() => {
            if (isFormOpen && loanPurposeRef.current) {
                loanPurposeRef.current.focus();
                // Letakkan kursor di akhir teks
                const el = loanPurposeRef.current;
                const len = el.value.length;
                try { el.setSelectionRange(len, len); } catch {}
            }
        }, [isFormOpen, loanPurpose]);
    const [returnDateEstimate, setReturnDateEstimate] = useState<Date | null>(addDays(new Date(), 7)); // default 7 hari, user masih bisa pilih hingga 21 hari
        const [isSubmitting, setIsSubmitting] = useState(false);
        
        const fetchBookDetail = useCallback(async () => {
            setIsLoading(true);
            setError(null);
            try {
                const raw = await bookApi.detail(bookId!);
                setBook(normalizeBook(raw as any));
                setReturnDateEstimate(addDays(new Date(), 7)); 
            } catch (err) {
                console.error('Error fetching book detail:', err);
                setError('Gagal memuat detail buku. Buku mungkin tidak ditemukan.');
            } finally {
                setIsLoading(false);
            }
        }, [bookId]);

        useEffect(() => {
            fetchBookDetail();
        }, [fetchBookDetail]);

        const handleSubmitLoan = async (e: React.FormEvent) => {
            e.preventDefault();
            if (!book || isSubmitting || !returnDateEstimate) return;
            
            if (book.availableStock <= 0) {
                setMessage('Stok buku tidak tersedia.');
                return;
            }

            setIsSubmitting(true);
            setMessage(null);

            try {
                const loanData = {
                    bookId: book.id,
                    loanDate: format(new Date(), 'yyyy-MM-dd'),
                    returnDate: format(returnDateEstimate, 'yyyy-MM-dd'),
                    purpose: loanPurpose,
                };

                const response = await loanApi.request({
                    bookId: book.id,
                    loanDate: loanData.loanDate,
                    returnDate: loanData.returnDate,
                    purpose: loanPurpose
                });
                setMessage('Permintaan pinjaman berhasil diajukan! Menunggu persetujuan Admin.');
                // Jika backend mengembalikan loan dengan kodePinjam, langsung tampilkan QR
                if (response?.loan) {
                    // Tutup form dan arahkan ke halaman loans dengan popup QR
                    setIsFormOpen(false);
                    // Navigasi ke /loans dulu agar komponen PendingLoans aktif
                    navigate('/loans');
                    // Sedikit delay agar state PendingLoans mount sebelum memicu modal
                    setTimeout(() => {
                        try {
                            // Simpan info loan baru ke localStorage atau event global sederhana
                            localStorage.setItem('recentLoan', JSON.stringify(response.loan));
                            const event = new CustomEvent('recent-loan-created');
                            window.dispatchEvent(event);
                        } catch {}
                    }, 250);
                } else {
                    setIsFormOpen(false);
                    fetchBookDetail();
                    setTimeout(() => navigate('/loans'), 1500);
                }

            } catch (err: any) {
                console.error('Error submitting loan:', err);
                const apiMsg = err?.response?.data?.message || 'Terjadi kesalahan jaringan.';
                setMessage(`Gagal mengajukan pinjaman: ${apiMsg}`);
            } finally {
                setIsSubmitting(false);
            }
        };
        
        // Komponen pop-up form (Formulir Peminjaman Detail)
        const BorrowingForm: React.FC = () => (
            <div className="modal-overlay-v5">
                <div className="form-modal-v5">
                    <div className="form-header-v5">
                        <h3>Formulir Peminjaman</h3>
                        <button className="close-button-v5" onClick={() => setIsFormOpen(false)} aria-label="Tutup" title="Tutup"><FaTimesCircle /></button>
                    </div>
                    <form onSubmit={handleSubmitLoan}>
                        <div className="form-group-v5">
                            <label>Judul Buku</label>
                            {/* FIX V4: Menggunakan book?.judul */}
                            <p className="form-value-v5">{book?.judul || 'N/A'}</p>
                        </div>
                        <div className="form-group-v5">
                            <label>Peminjam</label>
                            <p className="form-value-v5">{userData.username} ({userData.npm})</p>
                        </div>
                        
                        <div className="form-group-v5">
                            <label htmlFor="loanPurpose">Tujuan Peminjaman <span className='required'>*</span></label>
                            <textarea
                                id="loanPurpose"
                                value={loanPurpose}
                                onChange={(e) => setLoanPurpose(e.target.value)}
                                placeholder="Contoh: Untuk referensi Tugas Akhir"
                                required
                                maxLength={300} // memungkinkan kalimat panjang; batasi agar tidak berlebihan
                                ref={loanPurposeRef}
                                autoFocus
                            />
                        </div>
                        
                        <div className="form-group-v5">
                            <label htmlFor="returnDateEstimate">Perkiraan Tanggal Kembali <span className='required'>*</span></label>
                            <input
                                type="date"
                                id="returnDateEstimate"
                                value={returnDateEstimate ? format(returnDateEstimate, 'yyyy-MM-dd') : ''}
                                onChange={(e) => setReturnDateEstimate(new Date(e.target.value))}
                                min={format(addDays(new Date(), 1), 'yyyy-MM-dd')}
                                // max dihilangkan agar user bebas memilih tanggal kembali
                                required
                            />
                            {/* Catatan batas hari dihilangkan karena tidak ada batas maksimum */}
                        </div>

                        <div className="form-group-v5">
                            <p className='note-v5 important'>Dengan menekan "Ajukan Pinjaman", Anda menyetujui meminjam buku ini. Pengambilan buku akan dikoordinasikan setelah disetujui Admin.</p>
                        </div>

                        <button type="submit" className="submit-button-v5" disabled={isSubmitting || loanPurpose.length < 5}>
                            {isSubmitting ? 'Mengajukan...' : <><FaCalendarCheck /> Ajukan Pinjaman</>}
                        </button>
                        {message && <p className={`status-message-form ${message.includes('Gagal') ? 'error' : 'success'}`}>{message}</p>}
                    </form>
                </div>
            </div>
        );

        if (isLoading) return (
            <div className="book-detail-container-v5">
                <HeaderV5 onBack={() => navigate(-1)} currentPath={`/book/${bookId}`} searchTerm="" setSearchTerm={() => {}} title="Detail Buku" />
                <p className="loading-bar">Memuat detail buku...</p>
            </div>
        );
        
        if (error || !book) return (
            <div className="book-detail-container-v5">
                <HeaderV5 onBack={() => navigate(-1)} currentPath={`/book/${bookId}`} searchTerm="" setSearchTerm={() => {}} title="Detail Buku" />
                <div className="main-content-area-v5">
                    <p className="status-message error"><FaExclamationCircle /> {error || 'Buku tidak ditemukan.'}</p>
                </div>
            </div>
        );

        // FIX V4: Menggunakan book.judul dan book.penulis
        const detailTitle = book.judul || 'Judul Tidak Tersedia';
        const detailAuthor = book.penulis || 'Penulis Tidak Tersedia';
        
        // UI Detail Buku
        return (
            <div className="book-detail-container-v5">
                <HeaderV5 onBack={() => navigate(-1)} currentPath={`/book/${bookId}`} searchTerm="" setSearchTerm={() => {}} title="Detail Buku" />
                
                <div className="main-content-area-v5 detail-view">
                    {message && <p className={`status-message ${message.includes('Gagal') ? 'error' : 'success'}`}>{message}</p>}

                    <div className="book-card-detail-v5">
                        <div className="detail-cover-v5">
                            <LazyImage 
                                src={book.imageUrl || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="150" height="200"%3E%3Crect fill="%23ddd" width="150" height="200"/%3E%3Ctext fill="%23999" x="50%25" y="50%25" text-anchor="middle" dy=".3em" font-size="14"%3ETidak Ada Gambar%3C/text%3E%3C/svg%3E'} 
                                alt={`Sampul buku ${detailTitle}`}
                                onError={(e) => { (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="150" height="200"%3E%3Crect fill="%23ddd" width="150" height="200"/%3E%3Ctext fill="%23999" x="50%25" y="50%25" text-anchor="middle" dy=".3em" font-size="14"%3ETidak Ada Gambar%3C/text%3E%3C/svg%3E'; }} 
                            />
                        </div>
                        <div className="detail-info-v5">
                            <h1 title={detailTitle}>{detailTitle}</h1>
                            {/* FIX V4: Menggunakan detailAuthor */}
                            <p className="author-detail-v5"><FaUser /> {detailAuthor}</p>
                            <p className="year-detail-v5"><FaCalendarAlt /> Tahun: {book.year}</p>
                            <p className="kode-detail-v5"><FaBarcode /> Kode Buku: #{book.kodeBuku || 'N/A'}</p>
                            <div className="stock-detail-v5">
                                <FaBook /> Stok Tersedia: 
                                <span className={book.availableStock > 0 ? 'available' : 'unavailable'}> 
                                    {book.availableStock} dari {book.totalStock}
                                </span>
                            </div>
                            <div className="location-detail-v5">
                                <FaMapMarkerAlt /> Lokasi Rak: 
                                <span className='location-tag-v5'> 
                                    {book.location || 'Tidak Diketahui'}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="description-box-v5">
                        <h3>Deskripsi</h3>
                        <p>{book.description || "Deskripsi tidak tersedia."}</p>
                    </div>

                    <button 
                        className={`borrow-button-v5 ${book.availableStock <= 0 ? 'disabled' : ''}`}
                        onClick={() => setIsFormOpen(true)}
                        disabled={book.availableStock <= 0}
                    >
                    <FaBook /> {book.availableStock <= 0 ? 'Stok Habis' : 'Pinjam Sekarang'}
                    </button>
                </div>

                {isFormOpen && <BorrowingForm />}
            </div>
        );
    };
    // ------------------------------------------

    // --- SUB-KOMPONEN 3: LOANS PAGE (V5) ---
    interface PendingLoansProps { userData: UserData; onBack: () => void; }

    const PendingLoans: React.FC<PendingLoansProps> = ({ userData }) => {
        const [loans, setLoans] = useState<Loan[]>([]);
        const [isLoading, setIsLoading] = useState(true);
        const [error, setError] = useState<string | null>(null);
        const [activeTab, setActiveTab] = useState<'pending' | 'active' | 'history'>(() => {
            const stored = localStorage.getItem('initialBorrowTab');
            if (stored === 'active' || stored === 'history' || stored === 'pending') return stored;
            return 'pending';
        });
        // Filter riwayat: all | withFine | noFine
        const [historyFineFilter, setHistoryFineFilter] = useState<'all' | 'withFine' | 'noFine'>('all');
    const [paying, setPaying] = useState(false);
    const [payMessage, setPayMessage] = useState<string | null>(null);
    // Fine payment proof flow state
    const [showFineProofModal, setShowFineProofModal] = useState(false);
    const [fineProofLoanIds, setFineProofLoanIds] = useState<number[]>([]);
    const [showPayModal, setShowPayModal] = useState(false);
    const [payMode, setPayMode] = useState<'single'|'bulk'>('single');
    const [modalLoans, setModalLoans] = useState<Loan[]>([]);
    const [payError, setPayError] = useState<string | null>(null);
    const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null); 
    const [showQrCode, setShowQrCode] = useState(false); 
    const [showProofSuccess, setShowProofSuccess] = useState(false);
    const [showApprovedModal, setShowApprovedModal] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
    const approvedLoanRef = useRef<Loan | null>(null);
    const [uploadingLoanId, setUploadingLoanId] = useState<number | null>(null);
    const [uploadProgress, setUploadProgress] = useState<number>(0);
    const fileInputsRef = useRef<Record<number, HTMLInputElement | null>>({});
    // Return proof editing modal state
    const [returnProofLoan, setReturnProofLoan] = useState<Loan | null>(null);
    const [returnProofFile, setReturnProofFile] = useState<File | null>(null);
    const [returnProofPreview, setReturnProofPreview] = useState<string | null>(null);
    const [returnProofError, setReturnProofError] = useState<string | null>(null);
    const [returnProofProcessing, setReturnProofProcessing] = useState(false);
    // Return proof choice modal
    const [showReturnProofChoice, setShowReturnProofChoice] = useState(false);
    const [returnProofChoiceLoan, setReturnProofChoiceLoan] = useState<Loan | null>(null);
    const cameraReturnInputRef = useRef<HTMLInputElement | null>(null);
    const fileReturnInputRef = useRef<HTMLInputElement | null>(null);
    // Webcam for return proof
    const [showReturnCamera, setShowReturnCamera] = useState(false);
    const [returnStream, setReturnStream] = useState<MediaStream | null>(null);
    const [returnFacingMode, setReturnFacingMode] = useState<'user' | 'environment'>('environment');
    const returnVideoRef = useRef<HTMLVideoElement | null>(null);
    const returnCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const [returnProofRot, setReturnProofRot] = useState(0);
    const returnPreviewImgRef = useRef<HTMLImageElement | null>(null);
    const [rejectedReturnLoan, setRejectedReturnLoan] = useState<Loan | null>(null);
    const [returnCropMode, setReturnCropMode] = useState(false);
    const [returnCrop, setReturnCrop] = useState<Crop | undefined>(undefined);
    const [returnCompletedCrop, setReturnCompletedCrop] = useState<Crop | null>(null);
    // History detail modal
    const [historyDetailLoan, setHistoryDetailLoan] = useState<Loan | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    // Fine payment proof rejection prompt
    const [rejectedFineLoanIds, setRejectedFineLoanIds] = useState<number[]>([]);
            // Dengarkan event loan baru: sekarang TIDAK otomatis buka QR (karena QR hanya setelah disetujui)
            useEffect(() => {
                const handler = () => {
                    const raw = localStorage.getItem('recentLoan');
                    if (raw) {
                        try {
                            const loanObj = JSON.parse(raw);
                            // Tambahkan ke list sementara jika belum ada
                            setLoans(prev => {
                                if (prev.some(l => l.id === loanObj.id)) return prev;
                                return [{
                                    id: loanObj.id,
                                    kodePinjam: loanObj.kodePinjam,
                                    bookTitle: loanObj.bookTitle,
                                    kodeBuku: loanObj.kodeBuku || '-',
                                    loanDate: loanObj.loanDate,
                                    returnDate: loanObj.expectedReturnDate,
                                    status: loanObj.status,
                                    penaltyAmount: 0,
                                    actualReturnDate: null,
                                    location: loanObj.location || '',
                                } as any, ...prev];
                            });
                            localStorage.removeItem('recentLoan');
                        } catch {}
                    }
                };
                window.addEventListener('recent-loan-created', handler);
                return () => window.removeEventListener('recent-loan-created', handler);
            }, []);

        const fetchLoans = useCallback(async () => {
            setIsLoading(true);
            setError(null);
            try {
                const res = await loanApi.userLoans();
                const processedLoans = res.map((loan: any) => {
                    // Jika sudah dikembalikan, gunakan fineAmount dari server sebagai penaltyAmount
                    const isReturned = loan.status === 'Dikembalikan';
                    const computed = calculatePenalty(loan.returnDate || loan.expectedReturnDate, loan.actualReturnDate);
                    return {
                        ...loan,
                        penaltyAmount: isReturned ? (loan.fineAmount || 0) : computed,
                        finePaid: loan.finePaid ?? 0,
                    };
                });
                setLoans(processedLoans as any);
            } catch (err) {
                console.error('Error fetching loans:', err);
                setError('Gagal memuat data pinjaman. Cek koneksi API.');
            } finally {
                setIsLoading(false);
            }
        }, [userData.id]);

        useEffect(() => {
            fetchLoans();
            // Hanya sekali: hapus initialBorrowTab setelah dipakai
            const stored = localStorage.getItem('initialBorrowTab');
            if (stored) {
                localStorage.removeItem('initialBorrowTab');
            }
        }, [fetchLoans]);

        // Ambil notifikasi approval pinjaman hanya sekali setelah login (tampilkan di semua halaman)
        useEffect(() => {
            // Cegah tampil ulang jika sudah pernah di session ini
            if (sessionStorage.getItem('approvalNotifShown') === '1') return;
            (async () => {
                try {
                    const data = await loanApi.notifications();
                    if (data.success && data.notifications.length) {
                        const first = data.notifications[0];
                        approvedLoanRef.current = {
                            id: first.id,
                            kodePinjam: first.kodePinjam || '',
                            bookTitle: 'Pinjaman Disetujui',
                            kodeBuku: '-',
                            loanDate: new Date().toISOString(),
                            returnDate: new Date().toISOString(),
                            status: first.status as any,
                            penaltyAmount: 0,
                            actualReturnDate: null,
                            location: '',
                        } as any;
                        setToast({
                            message: 'Pinjaman disetujui. Kode pinjam tersedia.',
                            type: 'success'
                        });
                        sessionStorage.setItem('approvalNotifShown','1');
                        // Ack semua notifikasi supaya tidak muncul lagi login berikutnya
                        try { await loanApi.ackNotifications(data.notifications.map(n=>n.id)); } catch {}
                    }
                } catch {}
            })();
        }, []);

        // Polling setiap 3s mendeteksi approval & notifikasi pengembalian secara realtime
        useEffect(() => {
            const interval = setInterval(async () => {
                try {
                    const res = await loanApi.userLoans();
                    // Cari loan yang berubah dari Menunggu Persetujuan menjadi Sedang Dipinjam (atau Disetujui/Diambil) yang sebelumnya belum pernah ditandai
                    const newlyApproved = res.find((l:any) => ['Disetujui','Diambil','Sedang Dipinjam'].includes(l.status) && !loans.some(old => old.id === l.id && ['Disetujui','Diambil','Sedang Dipinjam'].includes(old.status)));
                    if (newlyApproved) {
                        approvedLoanRef.current = newlyApproved as any;
                        // Jika belum pernah show di session (misal user tidak di homepage saat login), tetap tampilkan sekali
                        if (!sessionStorage.getItem('approvalNotifShown')) {
                            setToast({
                                message: `Pinjaman untuk "${newlyApproved.bookTitle}" disetujui.`,
                                type: 'success'
                            });
                            sessionStorage.setItem('approvalNotifShown','1');
                        }
                    }
                    // Cek juga notifikasi pengembalian yang baru disetujui/ditolak
                    try {
                        const ret = await loanApi.returnNotifications();
                        if (ret.success && ret.notifications.length) {
                            const first = ret.notifications[0];
                            const msg = first.returnDecision === 'approved'
                                ? `Pengembalian buku "${first.bookTitle}" telah disetujui Admin. Terima kasih telah mengembalikan buku.`
                                : `Bukti pengembalian untuk buku "${first.bookTitle}" ditolak. Silakan unggah ulang foto bukti yang lebih jelas.`;
                            setToast({
                                message: msg,
                                type: first.returnDecision === 'approved' ? 'success' : 'error',
                            });
                            try { await loanApi.ackReturnNotifications(ret.notifications.map(n=>n.id)); } catch {}
                        }
                    } catch {}
                    // Notifikasi penolakan pinjaman
                    try {
                        const rej = await loanApi.rejectionNotifications();
                        if (rej.success && rej.notifications.length) {
                            const first = rej.notifications[0];
                            setToast({
                                message: `Pengajuan pinjaman untuk "${first.bookTitle}" ditolak.`,
                                type: 'error',
                            });
                            try { await loanApi.ackRejectionNotifications(rej.notifications.map(n=>n.id)); } catch {}
                        }
                    } catch {}
                    const processed = res.map((loan: any) => {
                        const isReturned = ['Dikembalikan','Selesai'].includes(loan.status);
                        return {
                            ...loan,
                            penaltyAmount: isReturned ? (loan.fineAmount || 0) : calculatePenalty(loan.returnDate || loan.expectedReturnDate, loan.actualReturnDate),
                        };
                    });
                    const reverted = processed.find((l:any)=>{
                        const prev = loans.find(pl=> pl.id === l.id);
                        return prev && prev.status === 'Siap Dikembalikan' && (l.status === 'Sedang Dipinjam' || l.status === 'Terlambat');
                    });
                    if (reverted && !sessionStorage.getItem(`returnRejectedShown:${reverted.id}`)){
                        setToast({
                            message: `Bukti pengembalian untuk "${reverted.bookTitle}" ditolak. Silakan unggah ulang foto bukti yang lebih jelas.`,
                            type: 'error'
                        });
                        sessionStorage.setItem(`returnRejectedShown:${reverted.id}`,'1');
                    }
                    // Detect fine payment proof rejection: pending_verification -> awaiting_proof
                    const fineRejectedIds: number[] = processed
                        .filter((l:any) => {
                            const prev = loans.find(pl => pl.id === l.id);
                            return prev && prev.finePaymentStatus === 'pending_verification' && l.finePaymentStatus === 'awaiting_proof';
                        })
                        .map((l:any) => l.id);
                    const unseen = fineRejectedIds.filter(id => !sessionStorage.getItem(`fineRejectedShown:${id}`));
                    if (unseen.length) {
                        unseen.forEach(id => sessionStorage.setItem(`fineRejectedShown:${id}`,'1'));
                        setToast({
                            message: unseen.length > 1 ? `${unseen.length} bukti pembayaran denda ditolak.` : 'Bukti pembayaran denda ditolak. Silakan unggah ulang bukti yang lebih jelas.',
                            type: 'error'
                        });
                    }
                    setLoans(processed as any);
                } catch {}
            }, 3000);
            return () => clearInterval(interval);
        }, [loans]);
        
        const filteredLoans = useMemo(() => {
            let base: Loan[] = [];
            if (activeTab === 'pending') {
                base = loans.filter(loan => loan.status === 'Menunggu Persetujuan');
            } else if (activeTab === 'active') {
                base = loans.filter(loan => ['Disetujui','Diambil','Sedang Dipinjam','Terlambat','Siap Dikembalikan'].includes(loan.status));
            } else if (activeTab === 'history') {
                base = loans.filter(loan => ['Ditolak','Selesai','Dikembalikan'].includes(loan.status));
                if (historyFineFilter === 'withFine') {
                    base = base.filter(l => (l.penaltyAmount || 0) > 0);
                } else if (historyFineFilter === 'noFine') {
                    base = base.filter(l => (l.penaltyAmount || 0) === 0);
                }
            }
            return base;
        }, [loans, activeTab, historyFineFilter]);

        const handleMarkReady = async (loan: Loan, file?: File) => {
            if (uploadingLoanId) return;
            try {
                setUploadingLoanId(loan.id);
                setUploadProgress(0);
                
                // Simulate progress for better UX
                const progressInterval = setInterval(() => {
                    setUploadProgress(prev => {
                        if (prev >= 90) return prev;
                        return prev + 10;
                    });
                }, 150);
                
                // Get metadata if available from camera capture
                const metadata = (window as any).lastReturnProofMetadata || null;
                if (!metadata && file) {
                    // File upload case - create basic metadata
                    const fileMetadata: any = {
                        timestamp: new Date().toISOString(),
                        device: 'File Upload'
                    };
                    
                    // Try to get location for file uploads too
                    if (navigator.geolocation) {
                        try {
                            const position = await new Promise<GeolocationPosition>((resolve, reject) => {
                                navigator.geolocation.getCurrentPosition(resolve, reject, {
                                    enableHighAccuracy: true,
                                    timeout: 5000,
                                    maximumAge: 0
                                });
                            });
                            
                            fileMetadata.coordinates = {
                                latitude: position.coords.latitude,
                                longitude: position.coords.longitude,
                                accuracy: position.coords.accuracy
                            };

                            // Get address
                            try {
                                const response = await fetch(
                                    `https://nominatim.openstreetmap.org/reverse?format=json&lat=${position.coords.latitude}&lon=${position.coords.longitude}`
                                );
                                const data = await response.json();
                                fileMetadata.address = data.display_name || 'Alamat tidak ditemukan';
                            } catch (e) {
                                fileMetadata.address = `${position.coords.latitude.toFixed(6)}, ${position.coords.longitude.toFixed(6)}`;
                            }
                        } catch (err) {
                            console.warn('Failed to get location for file upload:', err);
                        }
                    }
                    
                    await loanApi.markReadyToReturn(loan.id, file, fileMetadata);
                } else {
                    await loanApi.markReadyToReturn(loan.id, file, metadata);
                }
                
                // Clear metadata after use
                (window as any).lastReturnProofMetadata = null;
                
                clearInterval(progressInterval);
                setUploadProgress(100);
                
                // Small delay to show 100%
                await new Promise(resolve => setTimeout(resolve, 300));
                
                await fetchLoans();
                setShowProofSuccess(true);
            } catch (e: any) {
                alert(e?.response?.data?.message || 'Gagal menandai siap dikembalikan');
            } finally {
                setUploadingLoanId(null);
                setUploadProgress(0);
            }
        };

        const onFileSelect = (loan: Loan) => {
            const input = fileInputsRef.current[loan.id];
            if (input) input.click();
        };
        
        // Webcam functions for return proof
        const startReturnCamera = async (mode?: 'user' | 'environment') => {
            try {
                const targetMode = mode || returnFacingMode;
                const mediaStream = await navigator.mediaDevices.getUserMedia({ 
                    video: { facingMode: targetMode }, 
                    audio: false 
                });
                setReturnStream(mediaStream);
                setShowReturnCamera(true);
                setReturnFacingMode(targetMode);
            } catch (err) {
                alert('Tidak dapat mengakses kamera. Pastikan izin kamera diberikan.');
                console.error('Camera error:', err);
            }
        };

        const switchReturnCamera = async () => {
            stopReturnCamera();
            const newMode = returnFacingMode === 'environment' ? 'user' : 'environment';
            await startReturnCamera(newMode);
        };

        const stopReturnCamera = () => {
            if (returnStream) {
                returnStream.getTracks().forEach(track => track.stop());
                setReturnStream(null);
            }
            setShowReturnCamera(false);
        };

        const takeReturnPicture = async () => {
            if (!returnVideoRef.current || !returnCanvasRef.current || !returnProofChoiceLoan) return;
            
            const video = returnVideoRef.current;
            const canvas = returnCanvasRef.current;
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            
            const ctx = canvas.getContext('2d');
            if (!ctx) return;
            
            // Draw video frame
            ctx.drawImage(video, 0, 0);
            
            // Get geolocation metadata
            const metadata: any = {
                timestamp: new Date().toISOString(),
                device: 'Camera'
            };

            let overlayText: string[] = [];
            const now = new Date();
            overlayText.push(format(now, 'dd MMM yyyy HH:mm:ss', { locale: id }));

            if (navigator.geolocation) {
                try {
                    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
                        navigator.geolocation.getCurrentPosition(resolve, reject, {
                            enableHighAccuracy: true,
                            timeout: 5000,
                            maximumAge: 0
                        });
                    });
                    
                    metadata.coordinates = {
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude,
                        accuracy: position.coords.accuracy
                    };

                    overlayText.push(`GPS: ${position.coords.latitude.toFixed(6)}, ${position.coords.longitude.toFixed(6)}`);
                    overlayText.push(`Akurasi: ±${position.coords.accuracy.toFixed(0)}m`);

                    // Try to get address from coordinates using reverse geocoding
                    try {
                        const response = await fetch(
                            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${position.coords.latitude}&lon=${position.coords.longitude}`
                        );
                        const data = await response.json();
                        metadata.address = data.display_name || 'Alamat tidak ditemukan';
                        
                        // Shorten address for overlay (max 50 chars)
                        const shortAddress = metadata.address.length > 50 
                            ? metadata.address.substring(0, 47) + '...' 
                            : metadata.address;
                        overlayText.push(shortAddress);
                    } catch (e) {
                        console.warn('Failed to get address:', e);
                        metadata.address = `${position.coords.latitude.toFixed(6)}, ${position.coords.longitude.toFixed(6)}`;
                    }
                } catch (err) {
                    console.warn('Failed to get location:', err);
                    overlayText.push('GPS: Tidak tersedia');
                }
            } else {
                overlayText.push('GPS: Tidak tersedia');
            }

            // Draw overlay text on canvas (bottom-right corner)
            ctx.save();
            ctx.font = 'bold 14px Arial';
            ctx.textAlign = 'right';
            
            const padding = 15;
            const lineHeight = 20;
            const boxPadding = 10;
            const textX = canvas.width - padding;
            let textY = canvas.height - padding;
            
            // Calculate background box dimensions
            const maxWidth = Math.max(...overlayText.map(text => ctx.measureText(text).width));
            const boxWidth = maxWidth + (boxPadding * 2);
            const boxHeight = (overlayText.length * lineHeight) + (boxPadding * 2);
            const boxX = canvas.width - boxWidth - padding + boxPadding;
            const boxY = canvas.height - boxHeight - padding + boxPadding;
            
            // Draw semi-transparent background
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.fillRect(boxX, boxY, boxWidth, boxHeight);
            
            // Draw border
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.lineWidth = 2;
            ctx.strokeRect(boxX, boxY, boxWidth, boxHeight);
            
            // Draw text lines
            ctx.fillStyle = '#FFFFFF';
            ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
            ctx.shadowBlur = 4;
            
            for (let i = overlayText.length - 1; i >= 0; i--) {
                ctx.fillText(overlayText[i], textX, textY);
                textY -= lineHeight;
            }
            
            ctx.restore();

            // Store metadata temporarily
            (window as any).lastReturnProofMetadata = metadata;
            
            canvas.toBlob(async (blob) => {
                if (!blob) return;
                const file = new File([blob], `return-photo-${Date.now()}.jpg`, { type: 'image/jpeg' });
                stopReturnCamera();
                setShowReturnProofChoice(false);
                
                // Process the file
                setReturnProofLoan(returnProofChoiceLoan);
                setReturnProofError(null);
                setReturnProofRot(0);
                try {
                    setReturnProofProcessing(true);
                    const mod = await import('../../utils/imageProcessing');
                    const processed = await mod.adaptiveCompress(file, {
                        maxWidth: 1600,
                        maxHeight: 1600,
                        outputType: 'image/jpeg',
                        preserveTransparency: false,
                        maxBytes: 1024 * 1024,
                        qualitySteps: [0.85,0.75,0.65,0.55,0.45]
                    });
                    setReturnProofFile(processed);
                    setReturnProofPreview(URL.createObjectURL(processed));
                } catch (err) {
                    console.warn('Gagal memproses gambar:', err);
                    setReturnProofFile(file);
                    setReturnProofPreview(URL.createObjectURL(file));
                } finally {
                    setReturnProofProcessing(false);
                }
            }, 'image/jpeg', 0.9);
        };

        // Connect stream to video element
        React.useEffect(() => {
            if (returnStream && returnVideoRef.current) {
                returnVideoRef.current.srcObject = returnStream;
            }
        }, [returnStream]);

        // Cleanup camera on unmount
        React.useEffect(() => {
            return () => {
                if (returnStream) {
                    returnStream.getTracks().forEach(track => track.stop());
                }
            };
        }, [returnStream]);
        
        const onFileChange = async (loan: Loan, ev: React.ChangeEvent<HTMLInputElement>) => {
            const file = ev.target.files?.[0];
            if (!file) return;
            if (!file.type.startsWith('image/')) { alert('File harus gambar'); return; }
            
            // Close camera modal
            setShowReturnProofChoice(false);
            stopReturnCamera();
            
            // open edit modal instead of immediate upload
            setReturnProofLoan(loan);
            setReturnProofError(null);
            setReturnProofRot(0);
            try {
                setReturnProofProcessing(true);
                // lazy import imageProcessing utilities
                const mod = await import('../../utils/imageProcessing');
                const processed = await mod.adaptiveCompress(file, {
                    maxWidth: 1600,
                    maxHeight: 1600,
                    outputType: file.type === 'image/png' ? 'image/png' : 'image/jpeg',
                    preserveTransparency: file.type === 'image/png',
                    maxBytes: 1024 * 1024,
                    qualitySteps: [0.85,0.75,0.65,0.55,0.45]
                });
                setReturnProofFile(processed);
                setReturnProofPreview(URL.createObjectURL(processed));
            } catch (err) {
                console.warn('Gagal memproses gambar bukti pengembalian:', err);
                setReturnProofFile(file);
                setReturnProofPreview(URL.createObjectURL(file));
            } finally {
                setReturnProofProcessing(false);
            }
        };

        const rotateReturnProof = async () => {
            if (!returnProofFile) return;
            try {
                setReturnProofProcessing(true);
                const mod = await import('../../utils/imageProcessing');
                const rotated = await mod.processImage(returnProofFile, {
                    maxWidth: 1600,
                    maxHeight: 1600,
                    outputType: returnProofFile.type === 'image/png' ? 'image/png' : 'image/jpeg',
                    preserveTransparency: returnProofFile.type === 'image/png',
                    quality: 0.8,
                    rotateDeg: 90
                });
                if (returnProofPreview) URL.revokeObjectURL(returnProofPreview);
                setReturnProofFile(rotated);
                setReturnProofPreview(URL.createObjectURL(rotated));
                setReturnProofRot(r => (r + 90) % 360);
            } catch (err) {
                console.warn('Gagal rotate return proof:', err);
                setReturnProofError('Gagal memutar gambar');
            } finally {
                setReturnProofProcessing(false);
            }
        };

        const toggleReturnCropMode = () => {
            if (!returnProofPreview) return;
            if (!returnCropMode) {
                setReturnCrop(undefined);
                setReturnCompletedCrop(null);
            }
            setReturnCropMode(m => !m);
        };

        const applyReturnCrop = async () => {
            if (!returnProofFile || !returnCompletedCrop || !returnPreviewImgRef.current || !returnCompletedCrop.width || !returnCompletedCrop.height) { setReturnCropMode(false); return; }
            try {
                setReturnProofProcessing(true);
                const imgEl = returnPreviewImgRef.current;
                const naturalW = imgEl.naturalWidth;
                const naturalH = imgEl.naturalHeight;
                const displayW = imgEl.width;
                const displayH = imgEl.height;
                const scaleX = naturalW / displayW;
                const scaleY = naturalH / displayH;
                const cropRect = {
                    x: returnCompletedCrop.x * scaleX,
                    y: returnCompletedCrop.y * scaleY,
                    width: returnCompletedCrop.width * scaleX,
                    height: returnCompletedCrop.height * scaleY
                };
                const mod = await import('../../utils/imageProcessing');
                const cropped = await mod.cropImage(returnProofFile, cropRect, {
                    outputType: returnProofFile.type === 'image/png' ? 'image/png' : 'image/jpeg',
                    preserveTransparency: returnProofFile.type === 'image/png',
                    quality: 0.9,
                    rotateDeg: 0,
                    targetMaxWidth: 1600,
                    targetMaxHeight: 1600
                });
                const finalFile = await mod.adaptiveCompress(cropped, {
                    maxWidth: 1600,
                    maxHeight: 1600,
                    outputType: (['image/jpeg','image/png','image/webp'].includes(cropped.type) ? cropped.type : 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/webp',
                    preserveTransparency: cropped.type === 'image/png',
                    maxBytes: 1024 * 1024,
                    qualitySteps: [0.85,0.75,0.65,0.55,0.45]
                });
                setReturnProofFile(finalFile);
                if (returnProofPreview) URL.revokeObjectURL(returnProofPreview);
                setReturnProofPreview(URL.createObjectURL(finalFile));
            } catch (err) {
                console.warn('Crop return gagal:', err);
                setReturnProofError('Gagal memotong gambar');
            } finally {
                setReturnCropMode(false);
                setReturnProofProcessing(false);
            }
        };

        const cancelReturnProofModal = () => {
            if (returnProofPreview) URL.revokeObjectURL(returnProofPreview);
            setReturnProofLoan(null);
            setReturnProofFile(null);
            setReturnProofPreview(null);
            setReturnProofError(null);
        };

        const submitReturnProof = async () => {
            if (!returnProofLoan || !returnProofFile) { setReturnProofError('Belum ada file'); return; }
            await handleMarkReady(returnProofLoan, returnProofFile);
            cancelReturnProofModal();
        };

        const LoanCard: React.FC<{ loan: Loan, onClick: () => void }> = ({ loan, onClick }) => {
            const isLate = loan.status === 'Terlambat';
            const isCompleted = loan.status === 'Selesai';
            const canMarkReady = ['Sedang Dipinjam','Terlambat'].includes(loan.status);
            const alreadyReady = loan.status === 'Siap Dikembalikan';

            const getStatusClass = (status: Loan['status']) => {
                if (status === 'Menunggu Persetujuan') return 'status-pending';
                if (status === 'Disetujui' || status === 'Sedang Dipinjam') return 'status-approved';
                if (status === 'Terlambat') return 'status-late';
                if (status === 'Selesai') return 'status-completed';
                if (status === 'Ditolak') return 'status-rejected';
                if (status === 'Siap Dikembalikan') return 'status-ready';
                if (status === 'Dikembalikan') return 'status-completed';
                return '';
            };

            return (
                <div className="loan-card-v5" onClick={onClick}>
                    <div className="loan-header-v5">
                        <p className="loan-kode-v5">Kode Pinjam: {(['Disetujui','Diambil','Sedang Dipinjam','Siap Dikembalikan','Dikembalikan'].includes(loan.status) && loan.kodePinjam) ? loan.kodePinjam : '-'} </p>
                        <span className={`loan-status-tag ${getStatusClass(loan.status)}`}>
                            {loan.status}
                        </span>
                    </div>
                    <div className="loan-body-v5">
                        <h4>{loan.bookTitle}</h4>
                        <p className="loan-date-info"><FaCalendarAlt /> Pinjam: {formatDate(loan.loanDate)}</p>
                        <p className={`loan-date-info ${isLate && !isCompleted ? 'late-text' : ''}`}><FaClock /> Harus Kembali: {formatDate(loan.returnDate)}</p>
                    </div>
                    
                    <div className='loan-footer-v5'>
                        {(loan.status === 'Disetujui' || loan.status === 'Diambil' || loan.status === 'Sedang Dipinjam') && (
                            <p className='location-guide'>
                                <FaMapMarkerAlt /> Lokasi Buku: **{loan.location || 'Hubungi Admin'}**
                            </p>
                        )}
                        {loan.penaltyAmount > 0 && (
                            <p className={`penalty-info ${ (loan.finePaymentStatus==='paid' || loan.finePaid===1) ? 'paid' : '' }`}>
                                <FaMoneyBillWave /> <span className="amount">{formatCurrency(loan.penaltyAmount)}</span>
                                {(loan.finePaymentStatus==='paid' || loan.finePaid===1) && <span className="paid-badge">LUNAS</span>}
                            </p>
                        )}
                    </div>

                    {(loan.status === 'Disetujui' || loan.status === 'Diambil' || loan.status === 'Sedang Dipinjam') && (
                        <button className="qr-button-v5" onClick={(e) => { e.stopPropagation(); setSelectedLoan(loan); setShowQrCode(true); }}>
                            <FaBarcode /> Tunjukkan Kode Pinjam
                        </button>
                    )}
                    {canMarkReady && (
                        <div className="ready-return-wrapper" onClick={(e)=>e.stopPropagation()}>
                            <button 
                                className="ready-return-button" 
                                onClick={() => { 
                                    setReturnProofChoiceLoan(loan); 
                                    setShowReturnProofChoice(true);
                                    // Auto-start camera when modal opens
                                    setTimeout(() => startReturnCamera(), 100);
                                }}
                                disabled={uploadingLoanId === loan.id}
                            >
                                {uploadingLoanId===loan.id ? 'Memproses...' : 'Pilih Bukti Pengembalian'}
                            </button>
                        </div>
                    )}
                    {alreadyReady && (
                        <p className="status-ready-info">Menunggu verifikasi Admin</p>
                    )}
                    {loan.status === 'Dikembalikan' && (loan.penaltyAmount||0) > 0 && (
                        <div className="fine-actions-stack" onClick={(e)=>e.stopPropagation()}>
                            {(!loan.finePaymentStatus || loan.finePaymentStatus === 'unpaid') && (
                                <button className="qr-button-v5 pay-fine-btn" onClick={()=>{ 
                                    setPayMode('single');
                                    setModalLoans([loan]);
                                    setShowPayModal(true);
                                }}>
                                    Bayar Denda
                                </button>
                            )}
                            {loan.finePaymentStatus === 'awaiting_proof' && (
                                <button className="qr-button-v5 pay-fine-btn" onClick={()=>{ setPayMode('single'); setModalLoans([loan]); setShowPayModal(true); }}>
                                    Upload Bukti Pembayaran
                                </button>
                            )}
                            {loan.finePaymentStatus === 'pending_verification' && (
                                <p className="status-ready-info pending-verif">Menunggu Verifikasi</p>
                            )}
                        </div>
                    )}
                </div>
            );
        };

        const HistoryDetailModal: React.FC<{loan: Loan, onClose:()=>void}> = ({loan,onClose}) => {
            return (
                <div className="modal-overlay-v5">
                    <div className="qr-modal-v5 history-detail-modal">
                        <button className="close-button-v5" onClick={onClose} aria-label="Tutup" title="Tutup"><FaTimesCircle /></button>
                        <h3>Detail Pinjaman</h3>
                        <div className="qr-content-box history-detail-box">
                            <p><strong>Kode:</strong> {loan.kodePinjam}</p>
                            <p><strong>Judul:</strong> {loan.bookTitle}</p>
                            <p><strong>Status Akhir:</strong> {loan.status}</p>
                            <p><strong>Tgl Pinjam:</strong> {formatDate(loan.loanDate)}</p>
                            <p><strong>Harus Kembali:</strong> {formatDate(loan.returnDate)}</p>
                            {loan.actualReturnDate && <p><strong>Dikembalikan:</strong> {formatDate(loan.actualReturnDate)}</p>}
                            {loan.penaltyAmount>0 && (
                                <p><strong>Denda:</strong> {formatCurrency(loan.penaltyAmount)} {(loan.finePaymentStatus==='paid'||loan.finePaid===1)?' (Lunas)':''}</p>
                            )}
                            {loan.finePaymentStatus && <p><strong>Status Pembayaran:</strong> {loan.finePaymentStatus}</p>}
                            {loan.finePaymentMethod && <p><strong>Metode:</strong> {loan.finePaymentMethod}</p>}
                            {loan.finePaymentProof && (
                                <p><a href={loan.finePaymentProof} target="_blank" rel="noreferrer">Lihat Bukti Pembayaran</a></p>
                            )}
                        </div>
                        <button className="qr-button-v5" onClick={onClose}>Tutup</button>
                    </div>
                </div>
            );
        };

        const ReturnProofEditModal: React.FC = () => {
            if (!returnProofLoan) return null;
            return (
                <div className="modal-backdrop fine-proof-modal-backdrop" role="dialog" aria-modal="true">
                    <div className="modal fine-proof-modal">
                        <h3>Edit Bukti Pengembalian</h3>
                        <p className="fine-proof-subtitle">{returnProofLoan.bookTitle}</p>
                        {!returnProofPreview && returnProofProcessing && (
                            <div className="fine-upload-choice">
                                <p className="fine-choice-text">Memproses gambar...</p>
                            </div>
                        )}
                        {returnProofPreview && (
                            <div className="fine-drop-zone has-file">
                                <div className="fine-preview-wrapper">
                                    <div className={`fine-preview-stage ${returnCropMode ? 'crop-mode': ''}`}>
                                        {returnCropMode ? (
                                            <ReactCrop
                                                crop={returnCrop}
                                                onChange={(_, percentCrop) => setReturnCrop(percentCrop as any)}
                                                onComplete={(c)=> setReturnCompletedCrop(c)}
                                                keepSelection
                                            >
                                                <img
                                                    ref={returnPreviewImgRef}
                                                    src={returnProofPreview}
                                                    alt="Preview Pengembalian"
                                                    className="fine-preview-image"
                                                    onLoad={(e)=>{
                                                        if(!returnCrop){
                                                            const t = e.currentTarget as HTMLImageElement;
                                                            setReturnCrop({unit:'px', x:10, y:10, width: Math.min(t.naturalWidth-20, t.naturalWidth*0.8), height: Math.min(t.naturalHeight-20, t.naturalHeight*0.8)});
                                                        }
                                                    }}
                                                />
                                            </ReactCrop>
                                        ) : (
                                            <img ref={returnPreviewImgRef} src={returnProofPreview} alt="Preview Bukti" className="fine-preview-image" />
                                        )}
                                    </div>
                                    <div className="fine-file-meta">
                                        <strong>{returnProofFile?.name}</strong>
                                    </div>
                                    <div className="fine-proof-actions-inline">
                                        <button type="button" className="fine-btn-secondary small" disabled={returnProofProcessing} onClick={rotateReturnProof}>Putar 90°</button>
                                        <button type="button" className="fine-btn-secondary small" onClick={(e)=>{ e.stopPropagation(); toggleReturnCropMode(); }}>{returnCropMode ? 'Batal Crop' : 'Crop'}</button>
                                        {returnCropMode && <button type="button" className="fine-btn-secondary small" onClick={(e)=>{ e.stopPropagation(); applyReturnCrop(); }} disabled={!returnCompletedCrop}>Terapkan</button>}
                                        <button 
                                            type="button" 
                                            className="fine-btn-secondary small" 
                                            disabled={returnProofProcessing} 
                                            onClick={()=>{ 
                                                setReturnProofLoan(null);
                                                setReturnProofFile(null);
                                                setReturnProofPreview(null);
                                                setReturnProofChoiceLoan(returnProofLoan); 
                                                setShowReturnProofChoice(true);
                                                setTimeout(() => startReturnCamera(), 100);
                                            }}
                                        >
                                            Ganti Foto
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                        {returnProofError && <p className="status-message error" role="alert">{returnProofError}</p>}
                        
                        {/* Upload Progress Bar */}
                        {uploadingLoanId === returnProofLoan.id && uploadProgress > 0 && (
                            <div className="upload-progress-container">
                                <div className="upload-progress-header">
                                    <span>Mengunggah...</span>
                                    <span>{uploadProgress}%</span>
                                </div>
                                <div className="upload-progress-bar">
                                    {(() => {
                                        const pct = Math.min(100, Math.max(0, Math.round(uploadProgress)));
                                        const state = uploadProgress === 100 ? 'success' : 'ongoing';
                                        return (
                                            <div className={`upload-progress-fill w-${pct} ${state}`}></div>
                                        );
                                    })()}
                                </div>
                            </div>
                        )}
                        
                        <div className="modal-actions">
                            <button onClick={cancelReturnProofModal} disabled={uploadingLoanId!==null}>Batal</button>
                            <button onClick={submitReturnProof} disabled={!returnProofFile || uploadingLoanId!==null}>
                                {uploadingLoanId === returnProofLoan.id ? (
                                    <span className="upload-progress-status">
                                        <span className="spinner-small"></span>
                                        Mengunggah... {uploadProgress}%
                                    </span>
                                ) : 'Kirim & Tandai Siap'}
                            </button>
                        </div>
                    </div>
                </div>
            );
        };

        const QrCodePopup: React.FC = () => {
            const qrRef = useRef<HTMLDivElement>(null);
            const canvasRef = useRef<HTMLCanvasElement>(null);

            useEffect(() => {
                if (!selectedLoan?.kodePinjam || !canvasRef.current || !qrRef.current) return;

                const generateQRWithLogo = async () => {
                    const canvas = canvasRef.current;
                    if (!canvas) return;

                    const ctx = canvas.getContext('2d');
                    if (!ctx) return;

                    // Wait for QR SVG to render
                    await new Promise(resolve => setTimeout(resolve, 100));

                    const svg = qrRef.current?.querySelector('svg');
                    if (!svg) return;

                    // Convert SVG to image
                    const serializer = new XMLSerializer();
                    const svgStr = serializer.serializeToString(svg);
                    const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
                    const url = URL.createObjectURL(blob);

                    const qrImg = new Image();
                    qrImg.onload = () => {
                        // Set canvas size
                        const size = 220;
                        canvas.width = size;
                        canvas.height = size;

                        // Draw QR code
                        ctx.drawImage(qrImg, 0, 0, size, size);

                        // Load and draw logo
                        const logo = new Image();
                        logo.onload = () => {
                            const logoSize = 60; // Increased from 50 to 60
                            const logoX = (size - logoSize) / 2;
                            const logoY = (size - logoSize) / 2;

                            // Use better image smoothing
                            ctx.imageSmoothingEnabled = true;
                            ctx.imageSmoothingQuality = 'high';

                            // Draw logo directly (no background)
                            ctx.drawImage(logo, logoX, logoY, logoSize, logoSize);
                        };
                        logo.src = logoIcon;

                        URL.revokeObjectURL(url);
                    };
                    qrImg.src = url;
                };

                generateQRWithLogo();
            }, [selectedLoan]);

            if (!selectedLoan) return null;

            return (
                <div className="modal-overlay-v5">
                    <div className="qr-modal-v5">
                        <button className="close-button-v5" onClick={() => { setSelectedLoan(null); setShowQrCode(false); }} aria-label="Tutup" title="Tutup"><FaTimesCircle /></button>
                        <h3>Kode Peminjaman Anda</h3>
                        
                        <div className='qr-content-box'>
                            <p className='loan-code-display'>{selectedLoan.kodePinjam || 'Kode belum tersedia'}</p>
                            {selectedLoan.kodePinjam ? (
                                <div className="qr-wrapper">
                                    {/* Hidden QR for generation */}
                                    <div ref={qrRef} className="hidden-element">
                                        <QRCode 
                                            value={selectedLoan.kodePinjam}
                                            size={220}
                                            level='H'
                                            bgColor='#ffffff'
                                            fgColor='#000000'
                                        />
                                    </div>
                                    {/* Canvas with logo */}
                                    <canvas ref={canvasRef} className="qr-canvas" />
                                    <div className='qr-actions'>
                                        <button onClick={() => { navigator.clipboard.writeText(selectedLoan.kodePinjam); }} className='btn-copy-qr'>Salin Kode</button>
                                        <button onClick={async () => {
                                            try {
                                                if (!selectedLoan?.kodePinjam || !qrRef.current) return;

                                                // Create high resolution QR for download
                                                const svg = qrRef.current.querySelector('svg');
                                                if (!svg) return;

                                                const serializer = new XMLSerializer();
                                                const svgStr = serializer.serializeToString(svg);
                                                const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
                                                const url = URL.createObjectURL(blob);

                                                const qrImg = new Image();
                                                qrImg.onload = () => {
                                                    // High resolution canvas (1200x1200 for QR)
                                                    const qrSize = 1200;
                                                    const padding = 150;
                                                    const downloadCanvas = document.createElement('canvas');
                                                    downloadCanvas.width = qrSize + (padding * 2);
                                                    downloadCanvas.height = qrSize + (padding * 2);
                                                    const ctx = downloadCanvas.getContext('2d');
                                                    
                                                    if (ctx) {
                                                        // Enable high quality rendering
                                                        ctx.imageSmoothingEnabled = true;
                                                        ctx.imageSmoothingQuality = 'high';

                                                        // White background
                                                        ctx.fillStyle = '#ffffff';
                                                        ctx.fillRect(0, 0, downloadCanvas.width, downloadCanvas.height);
                                                        
                                                        // Draw QR in high resolution
                                                        ctx.drawImage(qrImg, padding, padding, qrSize, qrSize);

                                                        // Draw high-res logo
                                                        const logo = new Image();
                                                        logo.onload = () => {
                                                            const logoSize = 300; // Much larger logo for HD
                                                            const logoX = padding + (qrSize - logoSize) / 2;
                                                            const logoY = padding + (qrSize - logoSize) / 2;

                                                            ctx.imageSmoothingEnabled = true;
                                                            ctx.imageSmoothingQuality = 'high';
                                                            ctx.drawImage(logo, logoX, logoY, logoSize, logoSize);

                                                            // Download
                                                            const png = downloadCanvas.toDataURL('image/png', 1.0);
                                                            const a = document.createElement('a');
                                                            a.href = png;
                                                            a.download = `QR-${selectedLoan.kodePinjam}-HD.png`;
                                                            a.click();
                                                        };
                                                        logo.src = logoIcon;
                                                    }
                                                    URL.revokeObjectURL(url);
                                                };
                                                qrImg.src = url;
                                            } catch (e) {
                                                console.error('Download failed:', e);
                                            }
                                        }} className='btn-download-qr'>Download QR</button>
                                    </div>
                                    <p className='scan-instruction'>Scan kode ini di lokasi peminjaman <strong>{selectedLoan.location || 'Hubungi Admin'}</strong> untuk mengambil buku.</p>
                                </div>
                            ) : (
                                <div className='qr-missing'>
                                    <p>Kode belum dihasilkan. Coba tutup dan buka kembali atau hubungi admin.</p>
                                </div>
                            )}
                        </div>
                    
                        <p className='note-v5'>Tunjukkan kode ini kepada Admin saat mengambil buku.</p>
                    </div>
                </div>
            );
        };

        const ProofSuccessPopup: React.FC = () => (
            <div className="modal-overlay-v5">
                <div className="proof-success-modal">
                    <div className="proof-success-check">
                        <FaCheckCircle />
                    </div>
                    <h3>Bukti Terkirim</h3>
                    <p>Foto bukti pengembalian berhasil diunggah. Menunggu verifikasi Admin.</p>
                    <button className="close-success-btn" onClick={()=>setShowProofSuccess(false)}>Tutup</button>
                </div>
            </div>
        );

        const ReturnRejectedPopup: React.FC = () => {
            if (!rejectedReturnLoan) return null;
            return (
                <div className="modal-overlay-v5">
                    <div className="proof-success-modal">
                        <div className="proof-success-check danger">
                            <FaTimesCircle />
                        </div>
                        <h3>Bukti Ditolak</h3>
                        <p>Bukti pengembalian untuk "{rejectedReturnLoan.bookTitle}" ditolak. Silakan unggah ulang foto bukti yang lebih jelas.</p>
                        <div className="approval-actions">
                            <button className="close-success-btn btn-secondary-gray" onClick={()=>setRejectedReturnLoan(null)}>Nanti</button>
                            <button className="close-success-btn" onClick={()=>{ onFileSelect(rejectedReturnLoan); setRejectedReturnLoan(null); }}>Upload Ulang Sekarang</button>
                        </div>
                    </div>
                </div>
            );
        };

        const ApprovalNotification: React.FC = () => {
            if (!showApprovedModal || !approvedLoanRef.current) return null;
            const loan = approvedLoanRef.current;
            return (
                <div className="modal-overlay-v5">
                    <div className="proof-success-modal">
                        <div className="proof-success-check approval-check">
                            <FaCheckCircle />
                        </div>
                        <h3>Pinjaman Disetujui</h3>
                        <p>Buku "{loan.bookTitle}" telah disetujui. Anda dapat melihat kode pinjam sekarang.</p>
                        <div className="approval-actions">
                            <button className="close-success-btn btn-secondary-gray" onClick={()=>setShowApprovedModal(false)}>Nanti</button>
                            <button className="close-success-btn" onClick={()=>{ setSelectedLoan(loan as any); setShowQrCode(true); setShowApprovedModal(false); }}>Lihat QR</button>
                        </div>
                    </div>
                </div>
            );
        };

        const FineRejectedPopup: React.FC = () => {
            if (!rejectedFineLoanIds || rejectedFineLoanIds.length === 0) return null;
            const count = rejectedFineLoanIds.length;
            return (
                <div className="modal-overlay-v5">
                    <div className="proof-success-modal">
                        <div className="proof-success-check danger">
                            <FaTimesCircle />
                        </div>
                        <h3>Bukti Pembayaran Ditolak</h3>
                        <p>{count > 1 ? `${count} bukti pembayaran denda ditolak.` : 'Bukti pembayaran denda ditolak.'} Silakan unggah ulang bukti yang lebih jelas.</p>
                        <div className="approval-actions">
                            <button className="close-success-btn btn-secondary-gray" onClick={()=>setRejectedFineLoanIds([])}>Nanti</button>
                            <button className="close-success-btn" onClick={()=>{ setFineProofLoanIds(rejectedFineLoanIds); setShowFineProofModal(true); setRejectedFineLoanIds([]); }}>Upload Ulang Sekarang</button>
                        </div>
                    </div>
                </div>
            );
        };

        return (
            <>
                <HeaderV5 
                    onBack={() => {}} 
                    currentPath="/loans" 
                    searchTerm={searchTerm} 
                    setSearchTerm={setSearchTerm} 
                    title="Pinjaman Saya" 
                />
                <div className="pending-loans-container-v5">
                    <div className="main-content-area-v5">
                    
                    <div className="loan-tabs-v5">
                        <button 
                            className={activeTab === 'pending' ? 'active' : ''} 
                            onClick={() => setActiveTab('pending')}
                        >
                            <FaClock /> Menunggu ({loans.filter(l => l.status === 'Menunggu Persetujuan').length})
                        </button>
                        <button 
                            className={activeTab === 'active' ? 'active' : ''} 
                            onClick={() => setActiveTab('active')}
                        >
                            <FaCheckCircle /> Aktif ({loans.filter(l => ['Disetujui','Diambil','Sedang Dipinjam','Terlambat','Siap Dikembalikan'].includes(l.status)).length})
                        </button>
                        <button 
                            className={activeTab === 'history' ? 'active' : ''} 
                            onClick={() => setActiveTab('history')}
                        >
                            <FaList /> Riwayat ({loans.filter(l => ['Ditolak','Selesai','Dikembalikan'].includes(l.status)).length})
                        </button>
                    </div>

                    {activeTab === 'history' && (
                        <div className="history-filter-bar">
                            <span>Filter Denda:</span>
                            <button 
                                className={`history-filter-btn ${historyFineFilter==='all' ? 'active' : ''}`}
                                onClick={()=>setHistoryFineFilter('all')}
                            >Semua</button>
                            <button 
                                className={`history-filter-btn ${historyFineFilter==='withFine' ? 'active' : ''}`}
                                onClick={()=>setHistoryFineFilter('withFine')}
                            >Ada Denda</button>
                            <button 
                                className={`history-filter-btn ${historyFineFilter==='noFine' ? 'active' : ''}`}
                                onClick={()=>setHistoryFineFilter('noFine')}
                            >Tanpa Denda</button>
                            {/* Tombol Bayar Semua jika ada unpaid */}
                            {loans.some(l => l.status === 'Dikembalikan' && (l.penaltyAmount||0) > 0 && !l.finePaid) && (
                                <button 
                                    className="history-filter-btn" 
                                    disabled={paying}
                                    onClick={()=>{
                                        setPayMode('bulk');
                                        setModalLoans(loans.filter(l => l.status==='Dikembalikan' && (l.penaltyAmount||0)>0 && !l.finePaid));
                                        setShowPayModal(true);
                                    }}
                                >Bayar Semua</button>
                            )}
                        </div>
                    )}
                    
                    <button onClick={fetchLoans} className="refresh-button-v5" title="Refresh Data">
                        <FaUndo /> Refresh Data
                    </button>

                    {error && <p className="status-message error"><FaExclamationCircle /> {error}</p>}
                    
                    {isLoading && <p className="loading-bar">Memuat data pinjaman...</p>}

                    {!isLoading && filteredLoans.length === 0 && (
                        <p className="no-data"><FaExclamationCircle /> Tidak ada pinjaman di tab ini.</p>
                    )}
                    
                    <div className="loan-list-v5">
                        {filteredLoans.map(loan => (
                            <LoanCard 
                                key={loan.id} 
                                loan={loan} 
                                onClick={() => {
                                    if (activeTab==='history') setHistoryDetailLoan(loan); else setSelectedLoan(loan);
                                }} 
                            />
                        ))}
                    </div>
                    {payMessage && <p className={`status-message ${payMessage.includes('Gagal')?'error':'success'}`}>{payMessage}</p>}
                    
                    {showQrCode && <QrCodePopup />}
                    {showProofSuccess && <ProofSuccessPopup />}
                    <FineRejectedPopup />
                    <ReturnRejectedPopup />
                    <ApprovalNotification />
                    {historyDetailLoan && <HistoryDetailModal loan={historyDetailLoan} onClose={()=>setHistoryDetailLoan(null)} />}
                    {showPayModal && (
                        <PayFineModal 
                        items={modalLoans.map(m=>({ id: m.id, bookTitle: m.bookTitle, penaltyAmount: m.penaltyAmount, finePaid: m.finePaid }))}
                        mode={payMode}
                        loading={paying}
                        successMessage={payMessage?.startsWith('Berhasil') ? payMessage : null}
                        errorMessage={payError}
                        onRefresh={fetchLoans}
                        autoCloseOnSuccess
                        onClose={()=>{ if(!paying){ setShowPayModal(false); setModalLoans([]); setPayMessage(null); setPayError(null);} }}
                        onConfirm={async (ids, method, requiresProof)=>{
                            if (paying) return;
                            setPaying(true); setPayError(null); setPayMessage(null);
                            try {
                                const resp = await profileApi.initiateFines(ids, method as any);
                                if (resp.success){
                                    // Refresh loans & active fine asynchronously (don't block UX)
                                    fetchLoans();
                                    profileApi.activeFine().catch(()=>{});
                                    if (requiresProof){
                                        // Close payment modal and open proof modal
                                        setShowPayModal(false);
                                        setModalLoans([]);
                                        setFineProofLoanIds(ids);
                                        setShowFineProofModal(true);
                                        setPayMessage('Silakan unggah bukti pembayaran.');
                                    } else {
                                        // Cash path -> pending_verification
                                        setPayMessage('Pembayaran tunai dicatat. Menunggu verifikasi petugas.');
                                        setShowPayModal(false);
                                        setModalLoans([]);
                                    }
                                } else {
                                    setPayError('Gagal menginisiasi pembayaran');
                                }
                            } catch(e:any){
                                setPayError(e?.response?.data?.message || 'Gagal menginisiasi pembayaran.');
                            } finally {
                                setPaying(false);
                            }
                        }}
                    />
                )}
                {showFineProofModal && (
                    <FinePaymentProofModal
                        loanIds={fineProofLoanIds}
                        onClose={()=>{ setShowFineProofModal(false); setFineProofLoanIds([]); }}
                        onSuccess={()=>{ 
                            setPayMessage('Bukti pembayaran terkirim. Menunggu verifikasi admin.'); 
                            fetchLoans();
                            profileApi.activeFine().catch(()=>{});
                        }}
                    />
                )}
                <ReturnProofEditModal />
                
                {/* Return Proof Choice Modal */}
                {showReturnProofChoice && returnProofChoiceLoan && (
                    <div className="modal-backdrop fine-proof-modal-backdrop" onClick={() => { setShowReturnProofChoice(false); stopReturnCamera(); }}>
                        <div className="modal fine-proof-modal" onClick={(e) => e.stopPropagation()}>
                            <h3>Bukti Pengembalian Buku</h3>
                            <p className="fine-proof-subtitle">Upload bukti untuk: <strong>{returnProofChoiceLoan.bookTitle}</strong></p>
                            
                            {showReturnCamera ? (
                                <div className="fine-camera-container">
                                    <div className="camera-header">
                                        <button type="button" className="camera-switch-btn" onClick={switchReturnCamera}>
                                            🔄 {returnFacingMode === 'environment' ? 'Depan' : 'Belakang'}
                                        </button>
                                    </div>
                                    <video ref={returnVideoRef} autoPlay playsInline className="fine-camera-video" />
                                    <canvas ref={returnCanvasRef} className="hidden-canvas" />
                                    <div className="fine-camera-controls">
                                        <button type="button" className="fine-btn-capture" onClick={takeReturnPicture}>
                                            📸 Take Picture
                                        </button>
                                        <button type="button" className="fine-btn-file" onClick={() => { stopReturnCamera(); fileReturnInputRef.current?.click(); }}>
                                            📁 Upload File
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="fine-upload-choice">
                                    <p className="fine-choice-text">Memuat kamera...</p>
                                </div>
                            )}
                            
                            <div className="modal-actions mt-16">
                                <button onClick={() => { setShowReturnProofChoice(false); stopReturnCamera(); }}>Tutup</button>
                            </div>
                        </div>
                    </div>
                )}
                
                {/* Hidden file inputs for return proof */}
                <input 
                    ref={cameraReturnInputRef} 
                    type="file" 
                    accept="image/*" 
                    onChange={(e) => { if(returnProofChoiceLoan) onFileChange(returnProofChoiceLoan, e); }} 
                    className="visually-hidden-file" 
                    aria-label="Ambil foto dari kamera"
                    title="Ambil foto"
                />
                <input 
                    ref={fileReturnInputRef} 
                    type="file" 
                    accept="image/*" 
                    onChange={(e) => { if(returnProofChoiceLoan) onFileChange(returnProofChoiceLoan, e); }} 
                    className="visually-hidden-file" 
                    aria-label="Pilih file gambar"
                    title="Pilih file"
                />
                    </div>
                </div>
            </>
        );
    };

    // ==========================================================
    // INTERNAL ROUTER (Integrasi Fetch Data)
    // ==========================================================
    const InternalBorrowingRouter: React.FC<BorrowingPageProps> = ({ userData, onBack }) => {
        const location = useLocation();
        const navigate = useNavigate();
        
    const [books, setBooks] = useState<Book[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    // Global filter state (lifted up from BookList to allow backend re-fetch when changed)
    const [activeFilter, setActiveFilter] = useState<string>('Semua');

        const fetchBooks = useCallback(async (overrideFilter?: string) => {
            const filter = (overrideFilter || activeFilter);
            setIsLoading(true);
            setError(null);
            try {
                let sortOpt: { sort?: 'popular'|'newest' } = {};
                if (filter === 'Populer') sortOpt.sort = 'popular';
                else if (filter === 'Tahun Terbaru') sortOpt.sort = 'newest';
                const raw = await bookApi.list(undefined, sortOpt);
                setBooks(raw.map(normalizeBook) as any);
            } catch (err) {
                console.error('Error fetching books:', err);
                setError('Gagal memuat daftar buku. Cek koneksi API.');
            } finally {
                setIsLoading(false);
            }
        }, [activeFilter]);

        useEffect(() => {
            fetchBooks();
        }, [fetchBooks]);

        // Re-fetch when user changes filter to Populer / Tahun Terbaru for backend-sorted data
        useEffect(()=>{
            if (['Populer','Tahun Terbaru'].includes(activeFilter)) {
                fetchBooks(activeFilter);
            } else if (activeFilter === 'Semua') {
                // optional refresh to default ordering only if we previously were on a sorted filter
                fetchBooks('Semua');
            }
        }, [activeFilter, fetchBooks]);

        // Jika datang dari dashboard dengan niat melihat pinjaman, langsung arahkan ke /loans
        useEffect(() => {
            const flag = localStorage.getItem('openLoansView');
            if (flag) {
                localStorage.removeItem('openLoansView');
                navigate('/loans', { replace: true });
            }
        }, [navigate]);

        const currentPath = location.pathname.startsWith('/book/') ? '/' : location.pathname;

        return (
            <div className="borrowing-page-wrapper-v5">
                <div className="borrowing-page-container-v5">
                    <Routes>
                        <Route 
                            path="/" 
                            element={<BookList 
                                        books={books} 
                                        isLoading={isLoading} 
                                        error={error} 
                                        currentPath={currentPath} 
                                        onBack={onBack} 
                                        fetchBooks={fetchBooks} 
                                        // pass through filter state so BookList can control it
                                        activeFilterExternal={activeFilter}
                                        setActiveFilterExternal={setActiveFilter}
                                    />} 
                        />
                        <Route 
                            path="/book/:bookId" 
                            element={<BookDetail 
                                        userData={userData} 
                                        allBooks={books} 
                                    />} 
                        />
                        <Route 
                            path="/loans" 
                            element={<PendingLoans 
                                        userData={userData} 
                                        onBack={onBack}
                                    />} 
                        />
                    </Routes>
                </div>
            </div>
        );
    };


    // ==========================================================
    // KOMPONEN UTAMA
    // ==========================================================
    const BorrowingPage: React.FC<BorrowingPageProps> = (props) => {
        return (
            <BrowserRouter>
                <InternalBorrowingRouter {...props} />
            </BrowserRouter>
        );
    };

    export default BorrowingPage;