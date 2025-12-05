// File: src/components/DashboardAdmin/AdminDashboard.tsx (FULL CODE SIAP PAKAI)

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
// Ganti axios langsung dengan service terpusat
import { adminApi, bookApi } from '../../services/api';
import { API_BASE_URL } from '../../config/api';
import './AdminDashboard.css'; 
import { FaBook, FaList, FaUndo, FaEdit, FaTrash, FaCheckCircle, FaTimesCircle, FaPlus, FaUsers, FaTimes, FaCalendarCheck, FaUserPlus, FaInfoCircle, FaSortAlphaDown, FaBarcode, FaMapMarkerAlt, FaSearch, FaMoneyBillWave, FaSync, FaHistory } from 'react-icons/fa';
import { format } from 'date-fns'; 
import UserModal from './UserModal'; 
import BookModal from './BookModal'; // ✅ BARU: Import Modal Buku
import ConfirmModal from './ConfirmModal'; // ✅ BARU: Import Modal Konfirmasi
import ReturnProcessModal from './ReturnProcessModal'; // ✅ BARU: Import Modal Proses Pengembalian
import AdminSidebar from './AdminSidebar';
import AdminHeader from './AdminHeader';
import { useZxing } from 'react-zxing';

// --- KONSTANTA & HELPER --
// BASE_URL bisa diambil dari window.location.origin jika butuh untuk file statis

// Helper untuk format Rupiah
const formatRupiah = (amount: number) => {
    const num = Number(amount);
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
    }).format(num);
};

// --- INTERFACES ---
interface Book {
    id: number;
    title: string;
    author: string;
    kodeBuku: string; // ✅ BARU
    publisher?: string; // dibuat opsional
    publicationYear?: number;
    totalStock: number;
    availableStock: number;
    category: string;
    image_url?: string;
    location: string; // ✅ BARU
}

interface User {
    id: number;
    username: string;
    npm: string;
    role: 'user' | 'admin';
    fakultas: string;
    prodi: string;
    angkatan: number;
    denda: number;
    dendaRupiah: string;
    active_unpaid_fine?: number;
    activeUnpaidFineRupiah?: string;
    active_loans_count: number;
}

interface Loan {
    id: number;
    loanDate: string;
    expectedReturnDate: string;
    actualReturnDate: string | null;
    status: 'Menunggu Persetujuan' | 'Sedang Dipinjam' | 'Terlambat' | 'Siap Dikembalikan' | 'Dikembalikan' | 'Ditolak';
    fineAmount: number;
    finePaid: number;
    returnProofUrl?: string | null;
    readyReturnDate?: string | null;
    approvedAt?: string | null;
    returnDecision?: string | null;
    rejectionReason?: string | null;
    createdAt?: string | null;
    // User & Book Info (JOIN)
    title: string;
    kodeBuku: string;
    author: string;
    username: string;
    npm: string;
    fakultas: string;
    prodi: string;
    userDenda: number;
    calculatedPenalty?: number; // Hanya ada di returns/review
    calculatedPenaltyRupiah?: string; // Hanya ada di returns/review
}


// --- KOMPONEN VIEW ---
type AdminView = 'users' | 'books' | 'pending_loans' | 'returns_review' | 'fine_payments' | 'history';

const AdminDashboard: React.FC = () => {
    const [view, setView] = useState<AdminView>('users');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);

    // Data State
    const [users, setUsers] = useState<User[]>([]);
    const [books, setBooks] = useState<Book[]>([]);
    const [pendingLoans, setPendingLoans] = useState<Loan[]>([]); // Pinjaman Tertunda
    const [returnsReview, setReturnsReview] = useState<Loan[]>([]); // Pengembalian/Pinjaman Aktif
    const [history, setHistory] = useState<Loan[]>([]); // Riwayat Dikembalikan & Ditolak
    const [pendingFinePayments, setPendingFinePayments] = useState<any[]>([]); // Pembayaran denda menunggu verifikasi
    const [fineLoading, setFineLoading] = useState(false);
    // Proof preview modal
    const [showProofModal, setShowProofModal] = useState(false);
    const [proofContext, setProofContext] = useState<{ type:'return'|'fine'; imageUrl:string; user?:string; npm?:string; method?:string; amount?:number; loanIds?:number[]; createdAt?:string; notificationId?:number; readyReturnDate?:string|null; loanId?:number; status?:string; }|null>(null);

    // Modal State
    const [isUserModalOpen, setIsUserModalOpen] = useState(false);
    const [userToEdit, setUserToEdit] = useState<User | null>(null);
    const [isBookModalOpen, setIsBookModalOpen] = useState(false); // ✅ BARU
    const [bookToEdit, setBookToEdit] = useState<Book | null>(null); // ✅ BARU
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false); // ✅ BARU
    const [confirmAction, setConfirmAction] = useState<{ type: 'delete_user' | 'delete_book' | 'reset_penalty' | 'reject_loan' | 'reject_return' | 'mark_returned'; id: number | null; name?: string; bookId?: number; npm?: string; } | null>(null);
    const [isReturnModalOpen, setIsReturnModalOpen] = useState(false); // ✅ BARU
    const [loanToProcess, setLoanToProcess] = useState<Loan | null>(null); // ✅ BARU
    const [filterText, setFilterText] = useState(''); // Filter/Search

    // QR Scan Modal State
    const [isScanModalOpen, setIsScanModalOpen] = useState(false);
    const [scanError, setScanError] = useState<string | null>(null);
    const [decodedText, setDecodedText] = useState<string | null>(null);
    const [scannedLoanId, setScannedLoanId] = useState<number | null>(null);
    const [isScanning, setIsScanning] = useState(false);
    const [isStarting, setIsStarting] = useState(false);
    const [manualCode, setManualCode] = useState('');
    const [useManualInput, setUseManualInput] = useState(false);
    const [showScanSuccess, setShowScanSuccess] = useState(false);
    const [scanSuccessMessage, setScanSuccessMessage] = useState('');
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const hasHandledRef = useRef(false);
    const [facingMode, setFacingMode] = useState<'environment'|'user'>('environment');
    const [cameraDevices, setCameraDevices] = useState<MediaDeviceInfo[]>([]);
    const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
    const [isMirrored, setIsMirrored] = useState(false);
    const [videoKey, setVideoKey] = useState(0); // Key to force video re-render

    const { ref: zxingRef } = useZxing({
        onDecodeResult: (result) => {
            // Ignore decode events when scanning is paused
            if (!isScanning) return;
            const text = (result?.getText?.() || '').trim();
            if (!text) return;
            if (hasHandledRef.current) return;
            hasHandledRef.current = true;
            setDecodedText(text);
            handleScan(text);
        },
        timeBetweenDecodingAttempts: 200,
        constraints: selectedDeviceId
            ? { video: { deviceId: { exact: selectedDeviceId } as any } }
            : { video: { facingMode } }
    });

    // --- HELPER UNTUK PESAN ---
    const showStatus = (msg: string | null, err: string | null = null) => {
        setIsLoading(false);
        setError(err);
        setMessage(msg);
        setTimeout(() => { setError(null); setMessage(null); }, 5000);
    };

    // --- FETCH DATA ---
    const fetchUsers = useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await adminApi.users();
            setUsers(data);
            showStatus(null, null);
        } catch (err) {
            setError('Gagal mengambil data pengguna.');
        } finally { setIsLoading(false); }
    }, []);

    const fetchBooks = useCallback(async () => {
        setIsLoading(true);
        try {
            const raw = await bookApi.list(filterText || undefined);
            // admin table expect title/author fields; keep as-is
            setBooks(raw.map((b: any) => ({ ...b, title: b.title || b.judul, author: b.author || b.penulis })));
            showStatus(null, null);
        } catch (err) {
            setError('Gagal mengambil data buku.');
        } finally { setIsLoading(false); }
    }, [filterText]);

    const fetchPendingLoans = useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await adminApi.pendingLoans();
            setPendingLoans(data);
            showStatus(null, null);
        } catch (err) { setError('Gagal mengambil data pinjaman tertunda.'); }
        finally { setIsLoading(false); }
    }, []);

    const fetchReturnsReview = useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await adminApi.returnsReview();
            setReturnsReview(data);
            showStatus(null, null);
        } catch (err) { setError('Gagal mengambil data pengembalian.'); }
        finally { setIsLoading(false); }
    }, []);

    const fetchHistory = useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await adminApi.history();
            setHistory(data);
            showStatus(null, null);
        } catch (err) { setError('Gagal mengambil riwayat.'); }
        finally { setIsLoading(false); }
    }, []);

    // --- INITIAL LOAD & RELOAD ---
    const fetchPendingFinePayments = useCallback(async ()=>{
        setFineLoading(true);
        try {
            const resp = await adminApi.pendingFinePayments();
            if(resp.success) setPendingFinePayments(resp.items);
        } catch(e){ /* silent */ }
        finally { setFineLoading(false); }
    },[]);

    const fetchData = useCallback(() => {
        if (view === 'users') fetchUsers();
        if (view === 'books') fetchBooks();
        if (view === 'pending_loans') fetchPendingLoans();
        if (view === 'returns_review') fetchReturnsReview();
        if (view === 'fine_payments') fetchPendingFinePayments();
        if (view === 'history') fetchHistory();
    }, [view, fetchUsers, fetchBooks, fetchPendingLoans, fetchReturnsReview, fetchPendingFinePayments, fetchHistory]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Lock body scroll when proof modal open
    useEffect(()=>{
        if(showProofModal){
            const prev = document.body.style.overflow;
            document.body.style.overflow='hidden';
            return () => { document.body.style.overflow = prev; };
        }
    },[showProofModal]);

    // Cleanup video stream when scan modal closes
    useEffect(() => {
        if (!isScanModalOpen && videoRef.current && videoRef.current.srcObject) {
            const stream = videoRef.current.srcObject as MediaStream;
            if (stream && stream.getVideoTracks) {
                stream.getVideoTracks().forEach(track => track.stop());
            }
            videoRef.current.srcObject = null;
        }
    }, [isScanModalOpen]);

    // Force restart video stream when videoKey changes and scanning is active
    useEffect(() => {
        if (isScanModalOpen && isScanning && videoRef.current && !useManualInput) {
            // Small delay to ensure video element is mounted
            const timer = setTimeout(async () => {
                try {
                    // Stop existing stream first
                    if (videoRef.current && videoRef.current.srcObject) {
                        const oldStream = videoRef.current.srcObject as MediaStream;
                        if (oldStream && oldStream.getVideoTracks) {
                            oldStream.getVideoTracks().forEach(track => track.stop());
                        }
                    }

                    // Get new stream
                    const constraints = selectedDeviceId
                        ? { video: { deviceId: { exact: selectedDeviceId } } }
                        : { video: { facingMode } };
                    
                    const stream = await navigator.mediaDevices.getUserMedia(constraints as any);
                    
                    if (videoRef.current) {
                        videoRef.current.srcObject = stream;
                        videoRef.current.play().catch(() => {});
                    }
                } catch (err) {
                    console.error('Failed to start video stream:', err);
                    setScanError('Gagal mengakses kamera. Pastikan izin kamera diaktifkan.');
                }
            }, 100);

            return () => clearTimeout(timer);
        }
    }, [videoKey, isScanModalOpen, isScanning, useManualInput, selectedDeviceId, facingMode]);

    // Open/Close Scan Modal helpers
    const openScanModal = async () => {
        setIsScanModalOpen(true);
        setScanError(null);
        setDecodedText(null);
        setScannedLoanId(null);
        setIsScanning(true);
        setUseManualInput(false);
        setManualCode('');
        setShowScanSuccess(false);
        setVideoKey(prev => prev + 1); // Force video re-render
        hasHandledRef.current = false;
        hasHandledRef.current = false;
        try {
            if (navigator?.mediaDevices?.enumerateDevices) {
                const list = await navigator.mediaDevices.enumerateDevices();
                const cams = list.filter(d => d.kind === 'videoinput');
                setCameraDevices(cams);
                if (!selectedDeviceId && cams.length) setSelectedDeviceId(cams[0].deviceId);
            }
        } catch {}
    };
    const closeScanModal = () => {
        // Stop video stream before closing
        if (videoRef.current && videoRef.current.srcObject) {
            const stream = videoRef.current.srcObject as MediaStream;
            if (stream && stream.getVideoTracks) {
                stream.getVideoTracks().forEach(track => track.stop());
            }
            videoRef.current.srcObject = null;
        }
        
        setIsScanModalOpen(false);
        setIsScanning(false);
        setScanError(null);
        setDecodedText(null);
        setScannedLoanId(null);
        setManualCode('');
        setUseManualInput(false);
        setIsMirrored(false);
        setFacingMode('environment');
        hasHandledRef.current = false;
    };

    // Handle a decoded kodePinjam
    const handleScan = async (kode: string) => {
        try {
            setScanError(null);
            const resp = await adminApi.scanLoan(kode);
            if (resp?.success) {
                setScannedLoanId(resp.loanId || null);
                setScanSuccessMessage(resp.message || 'Kode berhasil diproses!');
                setShowScanSuccess(true);
                // Refresh lists to reflect status change (Disetujui -> Diambil)
                fetchPendingLoans();
                fetchReturnsReview();
                // Pause scanning until admin decides next action
                setIsScanning(false);
            } else {
                setScanError(resp?.message || 'Scan gagal.');
                // Allow immediate next scan attempt
                hasHandledRef.current = false;
            }
        } catch (e:any) {
            setScanError(e?.response?.data?.message || 'Gagal memproses scan.');
            // Allow immediate next scan attempt
            hasHandledRef.current = false;
        }
    };

    const handleStartLoan = async () => {
        if (!scannedLoanId) return;
        try {
            setIsStarting(true);
            const resp = await adminApi.startLoan(scannedLoanId);
            if (resp?.success) {
                showStatus(resp.message || 'Peminjaman dimulai.', null);
                // Refresh views for active loans
                fetchReturnsReview();
                setShowScanSuccess(false);
                closeScanModal();
            } else {
                showStatus(null, resp?.message || 'Gagal memulai peminjaman.');
            }
        } catch (e:any) {
            showStatus(null, e?.response?.data?.message || 'Gagal memulai peminjaman.');
        } finally {
            setIsStarting(false);
        }
    };

    // Handle manual code input
    // Removed unused handler to satisfy ESLint
    /* const handleManualCodeSubmit = async () => {
        if (!manualCode.trim()) {
            setScanError('Kode peminjaman tidak boleh kosong.');
            return;
        }
        try {
            setScanError(null);
            setIsScanning(false);
            const resp = await adminApi.scanLoan(manualCode.trim());
            if (resp?.success) {
                setScannedLoanId(resp.loanId || null);
                setDecodedText(manualCode.trim());
                showStatus(resp.message || 'Kode peminjaman berhasil diproses.', null);
                fetchPendingLoans();
                fetchReturnsReview();
                setManualCode('');
            } else {
                setScanError(resp?.message || 'Kode peminjaman tidak valid.');
            }
        } catch (e:any) {
            setScanError(e?.response?.data?.message || 'Gagal memproses kode peminjaman.');
        }
    }; */


    // --- CRUD USER & DENDA ---
    const handleSaveUser = async (id: number | undefined, userData: any) => {
        setIsLoading(true);
        setError(null);
        setMessage(null);
        try {
            const isCreate = !id || id === 0; // undefined/null/0 dianggap create
            const payload: any = {
                username: userData.username,
                npm: userData.npm,
                role: userData.role || 'user',
                fakultas: userData.fakultas,
                prodi: userData.prodi,
                angkatan: userData.angkatan,
            };
            if (isCreate) {
                // Password wajib saat create
                payload.password = userData.password;
            } else if (userData.password) {
                // Hanya kirim password jika diubah saat edit
                payload.password = userData.password;
            }

            const resp = isCreate
                ? await adminApi.createUser(payload)
                : await adminApi.updateUser(id as number, payload);

            showStatus(resp.message || (isCreate ? 'Pengguna baru ditambahkan.' : 'Pengguna diperbarui.'), null);
            setIsUserModalOpen(false);
            setUserToEdit(null);
            fetchUsers();
        } catch (err) {
            const errMsg = (err as any)?.response?.data?.message || 'Gagal menyimpan pengguna.';
            showStatus(null, errMsg);
            throw new Error(errMsg);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteUser = async (id: number, name: string) => {
        setConfirmAction({ type: 'delete_user', id, name });
        setIsConfirmModalOpen(true);
    };

    const handleResetPenalty = async (id: number, name: string) => {
        setConfirmAction({ type: 'reset_penalty', id, name });
        setIsConfirmModalOpen(true);
    };


    // --- CRUD BUKU ---
    const handleSaveBook = async (bookId: number, formData: FormData) => {
        setIsLoading(true);
        setError(null);
        setMessage(null);
        try {
            const resp = bookId === 0 ? await bookApi.create(formData) : await bookApi.update(bookId, formData);
            showStatus(resp.message || 'Berhasil menyimpan buku', null);
            setIsBookModalOpen(false);
            setBookToEdit(null);
            fetchBooks();
        } catch (err) {
            const errMsg = (err as any)?.response?.data?.message || 'Gagal menyimpan buku.';
            showStatus(null, errMsg);
            throw new Error(errMsg);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteBook = async (id: number, name: string) => {
        setConfirmAction({ type: 'delete_book', id, name });
        setIsConfirmModalOpen(true);
    };


    // --- KELOLA PINJAMAN & PENGEMBALIAN (ADMIN ACTION) ---
    const handleApproveLoan = async (loanId: number) => {
        setIsLoading(true);
        setError(null);
        setMessage(null);
        try {
            const resp = await adminApi.approveLoan(loanId);
            showStatus(resp.message || 'Pinjaman disetujui', null);
            fetchPendingLoans();
        } catch (err) {
            const errMsg = (err as any)?.response?.data?.message || 'Gagal menyetujui pinjaman.';
            showStatus(null, errMsg);
        } finally {
            setIsLoading(false);
        }
    };

    const handleRejectLoan = (loanId: number, bookName: string, npm: string) => {
        setConfirmAction({ type: 'reject_loan', id: loanId, name: bookName, npm: npm });
        setIsConfirmModalOpen(true);
    };

    const handleProcessReturn = (loan: Loan) => {
        setLoanToProcess(loan);
        setIsReturnModalOpen(true);
    };
    const handleRejectReturn = (loanId: number, userName?: string, npm?: string) => {
        setConfirmAction({ type: 'reject_return', id: loanId, name: userName, npm });
        setIsConfirmModalOpen(true);
    };
    
    // Konfirmasi final dari modal konfirmasi
    const handleConfirmAction = async () => {
        if (!confirmAction || !confirmAction.id) return;
        setIsConfirmModalOpen(false);
        setIsLoading(true);
        setError(null);
        setMessage(null);

        try {
            let response;
            if (confirmAction.type === 'delete_user') {
                response = await adminApi.deleteUser(confirmAction.id);
                fetchUsers();
            } else if (confirmAction.type === 'delete_book') {
                response = await bookApi.remove(confirmAction.id);
                fetchBooks();
            } else if (confirmAction.type === 'reset_penalty') {
                 response = await adminApi.resetPenalty(confirmAction.id);
                fetchUsers();
            } else if (confirmAction.type === 'reject_loan') {
                response = await adminApi.rejectLoan(confirmAction.id);
                fetchPendingLoans();
            } else if (confirmAction.type === 'reject_return') {
                response = await adminApi.rejectReturn(confirmAction.id);
                fetchReturnsReview();
            }
            showStatus(response?.message || 'Aksi berhasil dilakukan.', null);
        } catch (err) {
            const errMsg = (err as any)?.response?.data?.message || 'Gagal melakukan aksi.';
            showStatus(null, errMsg);
        } finally {
            setIsLoading(false);
            setConfirmAction(null);
        }
    };

    // --- RENDER VIEWS ---

    const renderBookManagement = () => (
        <div className="admin-sub-view">
            <h2><FaBook /> Kelola Buku</h2>
            <div className="admin-toolbar">
                <button className="btn btn-success" aria-label="Tambah buku baru" onClick={() => { setBookToEdit(null); setIsBookModalOpen(true); }}>
                    <FaPlus /> Tambah Buku Baru
                </button>
                <div className="search-group">
                    <FaSearch className="search-icon" />
                    <input
                        type="text"
                        placeholder="Cari Judul, Penulis, atau Kode Buku..."
                        value={filterText}
                        onChange={(e) => setFilterText(e.target.value)}
                        className="admin-search-input"
                    />
                    <button className="btn btn-secondary" onClick={fetchBooks} aria-label="Urutkan daftar buku" title="Urutkan"><FaSortAlphaDown/></button>
                </div>
            </div>
            {books.length === 0 && !isLoading ? <p>Tidak ada data buku.</p> : (
                <div className="table-responsive">
                <table className="admin-list-table">
                    <thead>
                        <tr>
                            <th>Cover</th>
                            <th>Judul & Penulis</th>
                            <th>Kode & Lokasi</th>
                            <th>Stok Total/Tersedia</th>
                            <th>Aksi</th>
                        </tr>
                    </thead>
                    <tbody>
                        {books.map(book => (
                            <tr key={book.id}>
                                <td className="col-cover-center">
                                    {book.image_url ? (
                                        <img src={book.image_url} alt={book.title} className="book-cover-thumb" />
                                    ) : (
                                        <div className="book-cover-thumb placeholder">Cover</div>
                                    )}
                                </td>
                                <td>
                                    <strong>{book.title}</strong>
                                    <p className="sub-text">{book.author}</p>
                                    <p className="sub-text">({book.category})</p>
                                </td>
                                <td>
                                    <p><FaBarcode /> {book.kodeBuku}</p>
                                    <p className="sub-text"><FaMapMarkerAlt /> {book.location}</p>
                                </td>
                                <td>
                                    <span className="badge-stock total">{book.totalStock} Total</span>
                                    <span className={`badge-stock available ${book.availableStock > 0 ? 'success' : 'danger'}`}>
                                        {book.availableStock} Tersedia
                                    </span>
                                </td>
                                <td>
                                    <button className="btn btn-action-small btn-edit" aria-label={`Edit buku ${book.title}`} onClick={() => { setBookToEdit(book); setIsBookModalOpen(true); }} title="Edit"><FaEdit /></button>
                                    <button className="btn btn-action-small btn-delete" aria-label={`Hapus buku ${book.title}`} onClick={() => handleDeleteBook(book.id, book.title)} title="Hapus"><FaTrash /></button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                </div>
            )}
        </div>
    );

    const renderPendingLoans = () => (
        <div className="admin-sub-view">
            <h2><FaList /> Pinjaman Tertunda ({pendingLoans.length})</h2>
            <p className="info-text">Daftar permintaan pinjaman yang menunggu persetujuan Admin.</p>
            {pendingLoans.length === 0 && !isLoading ? <p>Tidak ada pinjaman tertunda.</p> : (
                <div className="table-responsive">
                <table className="admin-list-table">
                    <thead>
                        <tr>
                            <th>Tgl. Request</th>
                            <th>Info Peminjam</th>
                            <th>Buku</th>
                            <th>Aksi</th>
                        </tr>
                    </thead>
                    <tbody>
                        {pendingLoans.map(loan => (
                            <tr key={loan.id}>
                                <td>{format(new Date(loan.loanDate), 'dd MMM yyyy')}</td>
                                <td>
                                    <strong>{loan.username} ({loan.npm})</strong>
                                    <p className="sub-text">{loan.fakultas} / {loan.prodi}</p>
                                </td>
                                <td>
                                    <strong>{loan.title}</strong>
                                    <p className="sub-text">Kode: {loan.kodeBuku}</p>
                                </td>
                                <td>
                                    <button className="btn btn-action-small btn-success" aria-label={`Setujui pinjaman ${loan.title} milik ${loan.username}`} onClick={() => handleApproveLoan(loan.id)} title="Setujui"><FaCheckCircle /> Setujui</button>
                                    <button className="btn btn-action-small btn-danger" aria-label={`Tolak pinjaman ${loan.title} milik ${loan.username}`} onClick={() => handleRejectLoan(loan.id, loan.title, loan.npm)} title="Tolak"><FaTimesCircle /> Tolak</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                </div>
            )}
        </div>
    );

    const openReturnProof = (loan:Loan) => {
        if(!loan.returnProofUrl) return;
        setProofContext({ type:'return', imageUrl:loan.returnProofUrl, user:loan.username, npm:loan.npm, createdAt:loan.readyReturnDate || loan.loanDate, readyReturnDate:loan.readyReturnDate, loanId:loan.id, status:loan.status });
        setShowProofModal(true);
    };
    const openFineProof = (item:any) => {
        if(!item.proof_url) return;
        let loanIds:number[] = []; try { loanIds = JSON.parse(item.loan_ids||'[]'); } catch {}
        setProofContext({ type:'fine', imageUrl:item.proof_url, user:item.username, npm:item.npm, method:item.method, amount:item.amount_total, loanIds, createdAt:item.created_at, notificationId:item.id });
        setShowProofModal(true);
    };
    const closeProofModal = ()=> { setShowProofModal(false); setProofContext(null); };

    const renderReturnsReview = () => (
        <div className="admin-sub-view">
            <h2><FaUndo /> Pengembalian & Pinjaman Aktif ({returnsReview.length})</h2>
            <p className="info-text">Daftar buku yang sedang dipinjam atau siap dikembalikan. Cek denda keterlambatan (otomatis) di sini sebelum memproses pengembalian.</p>
            {returnsReview.length === 0 && !isLoading ? <p>Tidak ada buku yang sedang dipinjam/siap dikembalikan.</p> : (
                <div className="table-responsive">
                <table className="admin-list-table">
                    <thead>
                        <tr>
                            <th>Info Peminjam</th>
                            <th>Buku</th>
                            <th>Tgl. Kembali (Estimasi)</th>
                            <th>Status & Denda (Otomatis)</th>
                            <th>Bukti Pengembalian</th>
                            <th>Aksi</th>
                        </tr>
                    </thead>
                    <tbody>
                        {returnsReview.map(loan => (
                            <tr key={loan.id} className={loan.status === 'Terlambat' ? 'row-late' : loan.status === 'Siap Dikembalikan' ? 'row-ready' : ''}>
                                <td>
                                    <strong>{loan.username} ({loan.npm})</strong>
                                    <p className="sub-text">Denda User: {formatRupiah(loan.userDenda)}</p>
                                </td>
                                <td>
                                    <strong>{loan.title}</strong>
                                    <p className="sub-text">Kode: {loan.kodeBuku}</p>
                                </td>
                                <td>
                                    <span className={`badge-date ${loan.status === 'Terlambat' ? 'danger' : 'success'}`}>
                                        <FaCalendarCheck /> {loan.expectedReturnDate ? format(new Date(loan.expectedReturnDate), 'dd MMM yyyy') : '-'}
                                    </span>
                                </td>
                                <td>
                                    <span className={`status-badge ${
                                        loan.status === 'Terlambat' ? 'status-terlambat' :
                                        loan.status === 'Siap Dikembalikan' ? 'status-siap' :
                                        loan.status === 'Sedang Dipinjam' ? 'status-dipinjam' :
                                        loan.status === 'Menunggu Persetujuan' ? 'status-menunggu' :
                                        loan.status === 'Dikembalikan' ? 'status-selesai' :
                                        loan.status === 'Ditolak' ? 'status-ditolak' : ''
                                    }`}>
                                        {loan.status}
                                    </span>
                                    {loan.calculatedPenalty && loan.calculatedPenalty > 0 && (
                                        <p className="sub-text penalty-amount">Denda: {loan.calculatedPenaltyRupiah}</p>
                                    )}
                                </td>
                                <td>
                                    {loan.returnProofUrl ? (
                                        <div className="proof-thumb-wrapper">
                                            <button className="btn btn-outline btn-compact" aria-label={`Lihat bukti pengembalian untuk ${loan.title}`} onClick={()=>openReturnProof(loan)}>Lihat Bukti</button>
                                        </div>
                                    ) : <span className="sub-text">-</span>}
                                </td>
                                <td>
                                    <button 
                                        className="btn btn-action-small btn-primary" 
                                        onClick={() => handleProcessReturn(loan)} 
                                        title="Proses Pengembalian"
                                        disabled={loan.status === 'Sedang Dipinjam' && loan.calculatedPenalty === 0}
                                    >
                                        <FaUndo /> Proses
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                </div>
            )}
        </div>
    );

    const renderUserManagement = () => (
        <div className="admin-sub-view">
            <h2><FaUsers /> Kelola Pengguna</h2>
            <div className="admin-toolbar">
                <button className="btn btn-success" onClick={() => { setUserToEdit(null); setIsUserModalOpen(true); }}>
                    <FaUserPlus /> Tambah Pengguna Baru
                </button>
            </div>
            {users.length === 0 && !isLoading ? <p>Tidak ada data pengguna.</p> : (
                <div className="table-responsive">
                <table className="admin-list-table">
                    <thead>
                        <tr>
                            <th>Nama & NPM</th>
                            <th>Fakultas / Prodi</th>
                            <th>Role & Denda</th>
                            <th>Pinjaman Aktif</th>
                            <th>Aksi</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map(user => (
                            <tr key={user.id}>
                                <td>
                                    <strong>{user.username}</strong>
                                    <p className="sub-text">{user.npm}</p>
                                </td>
                                <td>
                                    <p>{user.fakultas}</p>
                                    <p className="sub-text">Angkatan: {user.angkatan}</p>
                                </td>
                                <td>
                                    <span className={`status-badge ${user.role === 'admin' ? 'role-admin' : 'role-user'}`}>{user.role.toUpperCase()}</span>
                                    <p className={`sub-text ${user.denda > 0 ? 'text-danger' : 'text-success'}`}>Total Denda: {user.dendaRupiah}</p>
                                    <p className={`sub-text ${ (user.active_unpaid_fine||0) > 0 ? 'text-danger' : 'text-success'}`}>Aktif: {user.activeUnpaidFineRupiah || '-'}</p>
                                </td>
                                <td>
                                    <span className={`badge-stock ${user.active_loans_count > 0 ? 'danger' : 'success'}`}>{user.active_loans_count}</span>
                                </td>
                                <td>
                                    <button className="btn btn-action-small btn-edit" aria-label={`Edit pengguna ${user.username}`} onClick={() => { setUserToEdit(user); setIsUserModalOpen(true); }} title="Edit"><FaEdit /></button>
                                    <button className="btn btn-action-small btn-secondary" aria-label={`Reset denda ${user.username}`} onClick={() => handleResetPenalty(user.id, user.username)} disabled={user.denda === 0} title="Reset Denda"><FaCheckCircle /></button>
                                    <button className="btn btn-action-small btn-delete" aria-label={`Hapus pengguna ${user.username}`} onClick={() => handleDeleteUser(user.id, user.username)} title="Hapus"><FaTrash /></button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                </div>
            )}
        </div>
    );

    const handleVerifyFine = async (notificationId:number, action:'approve'|'reject') => {
        try {
            setIsLoading(true);
            const resp = await adminApi.verifyFinePayment(notificationId, action);
            showStatus(resp?.action === 'approve' ? 'Pembayaran denda disetujui.' : 'Pembayaran denda ditolak.', null);
            fetchPendingFinePayments();
        } catch(e:any){
            showStatus(null, e?.response?.data?.message || 'Gagal memverifikasi pembayaran denda');
        } finally { setIsLoading(false); }
    };

    const renderFinePayments = () => (
        <div className="admin-sub-view">
            <h2><FaMoneyBillWave /> Verifikasi Pembayaran Denda ({pendingFinePayments.length})</h2>
            <p className="info-text">Daftar pembayaran denda yang menunggu verifikasi admin. Periksa bukti sebelum menyetujui.</p>
            <div className="admin-toolbar">
                <button className="btn btn-secondary" onClick={fetchPendingFinePayments} disabled={fineLoading}>{fineLoading ? 'Memuat...' : 'Refresh'}</button>
            </div>
            {pendingFinePayments.length === 0 && !fineLoading ? <p>Tidak ada pembayaran menunggu verifikasi.</p> : (
                <div className="table-responsive">
                <table className="admin-list-table">
                    <thead>
                        <tr>
                            <th>Waktu</th>
                            <th>User</th>
                            <th>Jumlah Denda</th>
                            <th>Metode</th>
                            <th>Loan IDs</th>
                            <th>Bukti</th>
                            <th>Aksi</th>
                        </tr>
                    </thead>
                    <tbody>
                        {pendingFinePayments.map(item => (
                            <tr key={item.id}>
                                <td>{format(new Date(item.created_at), 'dd MMM yyyy HH:mm')}</td>
                                <td><strong>{item.username}</strong><p className="sub-text">{item.npm}</p></td>
                                <td>{formatRupiah(item.amount_total)}</td>
                                <td>{item.method || '-'}</td>
                                <td>{(() => { try { const arr = JSON.parse(item.loan_ids || '[]'); return Array.isArray(arr) ? arr.join(', ') : item.loan_ids; } catch { return item.loan_ids; } })()}</td>
                                <td>{item.proof_url ? (
                                    <div className="proof-thumb-wrapper">
                                        <button className="btn btn-outline btn-compact" aria-label={`Lihat bukti pembayaran denda milik ${item.username}`} onClick={()=>openFineProof(item)}>Lihat Bukti</button>
                                    </div>
                                ) : '-'}</td>
                                <td>
                                    <button className="btn btn-action-small btn-success" aria-label={`Setujui pembayaran denda milik ${item.username}`} onClick={()=>handleVerifyFine(item.id,'approve')} title="Setujui"><FaCheckCircle/></button>
                                    <button className="btn btn-action-small btn-danger" aria-label={`Tolak pembayaran denda milik ${item.username}`} onClick={()=>handleVerifyFine(item.id,'reject')} title="Tolak"><FaTimesCircle/></button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                </div>
            )}
        </div>
    );

    const renderHistory = () => (
        <div className="admin-sub-view">
            <h2><FaHistory /> Riwayat Pengembalian & Persetujuan ({history.length})</h2>
            <p className="info-text">Riwayat lengkap pinjaman yang sudah dikembalikan atau ditolak.</p>
            <div className="admin-toolbar">
                <button className="btn btn-secondary" onClick={fetchHistory} disabled={isLoading}>{isLoading ? 'Memuat...' : 'Refresh'}</button>
            </div>
            {history.length === 0 && !isLoading ? <p>Belum ada riwayat.</p> : (
                <div className="table-responsive">
                <table className="admin-list-table">
                    <thead>
                        <tr>
                            <th>Status</th>
                            <th>Buku</th>
                            <th>User</th>
                            <th>Tanggal Pinjam</th>
                            <th>Tanggal Kembali</th>
                            <th>Denda</th>
                            <th>Bukti</th>
                        </tr>
                    </thead>
                    <tbody>
                        {history.map(loan => (
                            <tr key={loan.id}>
                                <td>
                                    <span className={`status-badge status-${loan.status === 'Dikembalikan' ? 'returned' : 'rejected'}`}>
                                        {loan.status}
                                    </span>
                                </td>
                                <td>
                                    <strong>{loan.title}</strong>
                                    <p className="sub-text">{loan.kodeBuku}</p>
                                </td>
                                <td>
                                    <strong>{loan.username}</strong>
                                    <p className="sub-text">{loan.npm} - {loan.fakultas}</p>
                                </td>
                                <td>{loan.loanDate ? format(new Date(loan.loanDate), 'dd MMM yyyy') : '-'}</td>
                                <td>{loan.actualReturnDate ? format(new Date(loan.actualReturnDate), 'dd MMM yyyy HH:mm') : (loan.approvedAt ? format(new Date(loan.approvedAt), 'dd MMM yyyy HH:mm') : '-')}</td>
                                <td>
                                    {loan.fineAmount > 0 ? (
                                        <div>
                                            <strong>{formatRupiah(loan.fineAmount)}</strong>
                                            <p className="sub-text">Dibayar: {formatRupiah(loan.finePaid || 0)}</p>
                                        </div>
                                    ) : '-'}
                                </td>
                                <td>
                                    {loan.returnProofUrl ? (
                                        <button className="btn btn-outline btn-compact" onClick={() => {
                                            const imageUrl = loan.returnProofUrl!.startsWith('http') ? loan.returnProofUrl! : API_BASE_URL + loan.returnProofUrl!;
                                            setProofContext({
                                                type: 'return',
                                                imageUrl,
                                                user: loan.username,
                                                npm: loan.npm,
                                                readyReturnDate: loan.readyReturnDate,
                                                loanId: loan.id,
                                                status: loan.status
                                            });
                                            setShowProofModal(true);
                                        }}>
                                            Lihat Bukti
                                        </button>
                                    ) : <span className="text-muted">-</span>}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                </div>
            )}
        </div>
    );

    const renderView = () => {
        switch (view) {
            case 'books': return renderBookManagement();
            case 'pending_loans': return renderPendingLoans();
            case 'returns_review': return renderReturnsReview();
            case 'fine_payments': return renderFinePayments();
            case 'history': return renderHistory();
            case 'users':
            default: return renderUserManagement();
        }
    };

    return (
        <div className="admin-dashboard-container">
            <AdminHeader username={localStorage.getItem('username')} />
            <div className="admin-main-content">
                <AdminSidebar active={view} onChange={setView} />
                <div className="admin-content-area">
                    {/* Menampilkan pesan/error */}
                    {(error || message) && (
                        <div className={`status-container ${error ? 'error' : message ? 'success' : ''}`}>
                             {error ? 
                                 <p className="status-message error"><FaInfoCircle /> {error}</p> : 
                                 <p className="status-message success"><FaCheckCircle /> {message}</p>
                             }
                             <button className="clear-status" aria-label="Tutup pesan" onClick={() => { setError(null); setMessage(null); }}><FaTimes/></button>
                        </div>
                    )}
                    
                    {isLoading && <p className="loading-bar">Memproses...</p>}

                    {/* Global Admin Toolbar */}
                    <div className="admin-toolbar">
                        <button className="btn btn-primary" onClick={openScanModal} title="Scan QR Peminjaman"><FaBarcode/> Scan QR Peminjaman</button>
                    </div>

                    <div className="admin-content-wrapper">
                        {renderView()}
                    </div>
                </div>
            </div>
            
            {/* Modal Components */}
            <UserModal 
                isOpen={isUserModalOpen}
                onClose={() => { setIsUserModalOpen(false); setUserToEdit(null); setError(null); setMessage(null); }}
                userToEdit={userToEdit}
                onSave={handleSaveUser}
                error={error}
                isLoading={isLoading}
            />
             <BookModal // ✅ BARU
                isOpen={isBookModalOpen}
                onClose={() => { setIsBookModalOpen(false); setBookToEdit(null); setError(null); setMessage(null); }}
                bookToEdit={bookToEdit}
                onSave={handleSaveBook}
                error={error}
                isLoading={isLoading}
            />
            <ConfirmModal // ✅ BARU
                isOpen={isConfirmModalOpen}
                onClose={() => { setIsConfirmModalOpen(false); setConfirmAction(null); setError(null); setMessage(null); }}
                onConfirm={handleConfirmAction}
                title={confirmAction?.type === 'delete_user' ? `Hapus Pengguna: ${confirmAction.name}` : 
                       confirmAction?.type === 'delete_book' ? `Hapus Buku: ${confirmAction.name}` :
                       confirmAction?.type === 'reset_penalty' ? `Reset Denda: ${confirmAction.name}` : 
                       confirmAction?.type === 'reject_loan' ? `Tolak Pinjaman: ${confirmAction.name}` : ''}
                message={confirmAction?.type === 'delete_user' ? `Apakah Anda yakin ingin menghapus pengguna ${confirmAction.name}? Aksi ini TIDAK dapat dibatalkan.` : 
                         confirmAction?.type === 'delete_book' ? `Apakah Anda yakin ingin menghapus buku ${confirmAction.name}? Pastikan tidak ada pinjaman aktif terkait buku ini.` :
                         confirmAction?.type === 'reset_penalty' ? `Apakah Anda yakin ingin mereset denda ${confirmAction.name} menjadi Rp 0 (Lunas)?` : 
                         confirmAction?.type === 'reject_loan' ? `Apakah Anda yakin ingin menolak permintaan pinjaman buku ${confirmAction.name} oleh NPM ${confirmAction.npm}? Stok buku akan dikembalikan.` : ''}
                confirmText={confirmAction?.type === 'delete_user' || confirmAction?.type === 'delete_book' ? 'Ya, Hapus Permanen' : 'Ya, Proses'}
                isLoading={isLoading}
            />
            <ReturnProcessModal // ✅ BARU
                isOpen={isReturnModalOpen}
                onClose={() => { setIsReturnModalOpen(false); setLoanToProcess(null); setError(null); setMessage(null); }}
                loanData={loanToProcess}
                onProcess={fetchReturnsReview} // Reload daftar pengembalian setelah proses
                showStatus={showStatus}
            />

            {/* Scan QR Modal */}
            {isScanModalOpen && createPortal(
                <div className="modal-overlay" role="dialog" aria-modal="true" onClick={(e)=>{ if(e.target===e.currentTarget) closeScanModal(); }}>
                    <div className="modal-content-lg" role="document">
                        <button className="modal-close-btn" aria-label="Tutup" onClick={closeScanModal}><FaTimes/></button>
                        <div className="modal-header">
                            <h2><FaBarcode/> Scan QR Peminjaman</h2>
                        </div>
                        <div>
                            {/* Toggle between scan and manual input */}
                            <div className="form-group">
                                <button 
                                    className={`btn ${!useManualInput ? 'btn-primary' : 'btn-outline'}`}
                                    onClick={() => { 
                                        setUseManualInput(false); 
                                        setManualCode(''); 
                                        setScanError(null); 
                                        setDecodedText(null); 
                                        setScannedLoanId(null); 
                                        hasHandledRef.current = false;
                                        setIsScanning(true);
                                        setVideoKey(prev => prev + 1);
                                    }}
                                    title="Mode Scan QR"
                                    aria-label="Mode Scan QR"
                                    
                                >
                                    <FaBarcode /> Scan QR
                                </button>
                                <button 
                                    className={`btn ${useManualInput ? 'btn-primary' : 'btn-outline'}`}
                                    onClick={() => { 
                                        // Stop video stream when switching to manual input
                                        if (videoRef.current && videoRef.current.srcObject) {
                                            const stream = videoRef.current.srcObject as MediaStream;
                                            if (stream && stream.getVideoTracks) {
                                                stream.getVideoTracks().forEach(track => track.stop());
                                            }
                                            videoRef.current.srcObject = null;
                                        }
                                        setUseManualInput(true); 
                                        setIsScanning(false); 
                                        setScanError(null); 
                                        setDecodedText(null); 
                                        setScannedLoanId(null);
                                        hasHandledRef.current = false;
                                    }}
                                >
                                    Input Manual
                                </button>
                            </div>

                            {useManualInput ? (
                                /* Manual Input Mode */
                                <div>
                                    <div className="form-group">
                                        <label htmlFor="manual-code-input">Masukkan Kode Peminjaman</label>
                                        <input 
                                            type="text" 
                                            id="manual-code-input"
                                            className="form-control"
                                            placeholder="Ketik kode peminjaman..."
                                            value={manualCode}
                                            onChange={(e) => setManualCode(e.target.value.trim())}
                                            onKeyPress={(e) => {
                                                if (e.key === 'Enter' && manualCode) {
                                                    handleScan(manualCode);
                                                }
                                            }}
                                        />
                                    </div>
                                    {scanError && <p className="text-danger-small">{scanError}</p>}
                                    <div className="modal-footer modal-footer-left">
                                        <button 
                                            className="btn btn-success" 
                                            onClick={() => handleScan(manualCode)}
                                            disabled={!manualCode || isStarting}
                                        >
                                            <FaCheckCircle /> Proses Kode
                                        </button>
                                        <button className="btn btn-secondary" onClick={closeScanModal}>Batal</button>
                                    </div>
                                </div>
                            ) : (
                                /* QR Scan Mode */
                                <>
                            {!decodedText && (
                                <>
                                    <p className="text-info-small">Arahkan kamera ke QR kodePinjam. Pastikan pencahayaan cukup.</p>

                                    <div className="form-group">
                                        <label htmlFor="scan-camera-select">Pilih Kamera (Desktop)</label>
                                        <select id="scan-camera-select" value={selectedDeviceId}
                                            onChange={(e)=>{ 
                                                setSelectedDeviceId(e.target.value); 
                                                hasHandledRef.current=false; 
                                                setDecodedText(null); 
                                                setScannedLoanId(null); 
                                                setScanError(null); 
                                                setIsScanning(true); 
                                                setVideoKey(prev => prev + 1);
                                            }}>
                                            {cameraDevices.length === 0 && <option value="">Otomatis</option>}
                                            {cameraDevices.map((dev, idx) => (
                                                <option key={dev.deviceId || idx} value={dev.deviceId}>
                                                    {dev.label || `Kamera ${idx+1}`}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="scan-video-container">
                                        {/* Attach zxing only when scanning */}
                                        {isScanning ? (
                                            <video 
                                                key={videoKey}
                                                ref={(el)=>{ videoRef.current = el; (zxingRef as any).current = el; }} 
                                                className={`scan-video${isMirrored ? ' mirrored' : ''}`} 
                                            />
                                        ) : (
                                            <div className="scan-paused">Pemindaian dijeda</div>
                                        )}
                                    </div>
                                    {scanError && <p className="text-danger-small mt-10">{scanError}</p>}
                                    <div className="modal-footer modal-footer-left">
                                        <button className="btn btn-primary" onClick={()=>{ setIsScanning(true); hasHandledRef.current=false; setScanError(null); setDecodedText(null); setScannedLoanId(null); setVideoKey(prev => prev + 1); }} disabled={isScanning}>Mulai Scan</button>
                                        <button className="btn btn-warning" onClick={()=>{ setIsScanning(false); }} disabled={!isScanning}>Jeda</button>
                                        <button className="btn btn-outline" onClick={()=>{ 
                                            setFacingMode(prev => prev === 'environment' ? 'user' : 'environment'); 
                                            hasHandledRef.current=false; 
                                            setDecodedText(null); 
                                            setScannedLoanId(null); 
                                            setScanError(null); 
                                            setIsScanning(true); 
                                            setVideoKey(prev => prev + 1);
                                        }} title={`Ganti Kamera (${facingMode === 'environment' ? 'Belakang' : 'Depan'})`}><FaSync/> Kamera: {facingMode === 'environment' ? 'Belakang' : 'Depan'}</button>
                                        <button className="btn btn-secondary" onClick={()=>{ setIsMirrored(prev => !prev); }} title={isMirrored ? 'Nonaktifkan Mirror' : 'Aktifkan Mirror'}>{isMirrored ? '🔄 Mirror: ON' : '🔄 Mirror: OFF'}</button>
                                        <button className="btn btn-info" onClick={()=>{ 
                                            // Stop current stream
                                            if (videoRef.current && videoRef.current.srcObject) {
                                                const stream = videoRef.current.srcObject as MediaStream;
                                                if (stream && stream.getVideoTracks) {
                                                    stream.getVideoTracks().forEach(track => track.stop());
                                                }
                                                videoRef.current.srcObject = null;
                                            }
                                            // Reset all states and restart
                                            hasHandledRef.current = false;
                                            setScanError(null);
                                            setDecodedText(null);
                                            setScannedLoanId(null);
                                            setIsScanning(true);
                                            setVideoKey(prev => prev + 1);
                                        }} title="Reset Webcam"><FaSync/> Reset</button>
                                    </div>
                                </>
                            )}

                            {decodedText && (
                                <div>
                                    <p><strong>Kode Terdeteksi:</strong> {decodedText}</p>
                                    {scannedLoanId ? (
                                        <>
                                            <p className="text-success-small">Scan berhasil. Loan ID: {scannedLoanId}</p>
                                            <div className="modal-footer">
                                                <button className="btn btn-success" onClick={handleStartLoan} disabled={isStarting}><FaCheckCircle/> Mulai Peminjaman</button>
                                                <button className="btn btn-outline" onClick={()=>{ setDecodedText(null); setScannedLoanId(null); setScanError(null); setIsScanning(true); hasHandledRef.current=false; }}>Scan Lagi</button>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            {scanError ? <p className="text-danger-small">{scanError}</p> : <p className="text-info-small">Memproses scan...</p>}
                                            <div className="modal-footer">
                                                <button className="btn btn-outline" onClick={()=>{ setDecodedText(null); setScannedLoanId(null); setScanError(null); setIsScanning(true); hasHandledRef.current=false; }}>Coba Lagi</button>
                                                <button className="btn btn-outline" onClick={()=>{ setFacingMode(prev => prev === 'environment' ? 'user' : 'environment'); hasHandledRef.current=false; setIsScanning(true); setScanError(null); setDecodedText(null); setScannedLoanId(null); }}><FaSync/> Ganti Kamera</button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}
                            </>
                            )}
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Success Modal */}
            {showScanSuccess && createPortal(
                <div className="modal-overlay" role="dialog" aria-modal="true">
                    <div className="modal-content modal-content-narrow" role="document">
                        <div className="modal-header">
                            <h2 className="success-title">
                                <FaCheckCircle /> Berhasil!
                            </h2>
                        </div>
                        <div className="modal-body">
                            <p className="text-center font-lg mb-16">
                                {scanSuccessMessage}
                            </p>
                            {scannedLoanId && (
                                <p className="text-center text-muted">
                                    Loan ID: <strong>{scannedLoanId}</strong>
                                </p>
                            )}
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-success" onClick={handleStartLoan} disabled={isStarting}>
                                <FaCheckCircle /> Mulai Peminjaman
                            </button>
                            <button className="btn btn-outline" onClick={() => {
                                setShowScanSuccess(false);
                                setDecodedText(null);
                                setScannedLoanId(null);
                                setScanError(null);
                                setIsScanning(true);
                                setUseManualInput(false);
                                setManualCode('');
                                hasHandledRef.current = false;
                            }}>
                                Scan/Input Lagi
                            </button>
                            <button className="btn btn-secondary" onClick={() => {
                                setShowScanSuccess(false);
                                closeScanModal();
                            }}>
                                Tutup
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

                                                {showProofModal && proofContext && createPortal(
                                                    <div className="proof-modal-overlay" role="dialog" aria-modal="true" onClick={(e)=>{ if(e.target===e.currentTarget) closeProofModal(); }}>
                                                        <div className="proof-card proof-card-fullsize" role="document">
                                                            <button className="close-proof" aria-label="Tutup" onClick={closeProofModal}><FaTimes/></button>
                                                            <div className="proof-card-header">
                                                                <h3 className="proof-card-title">{proofContext.type === 'return' ? 'Bukti Pengembalian' : 'Bukti Pembayaran Denda'}</h3>
                                                                <p className="proof-card-desc">
                                                                    {proofContext.type === 'return' ? 'Konfirmasi bahwa barang sudah benar dikembalikan.' : 'Periksa bukti pembayaran sebelum verifikasi.'}
                                                                </p>
                                                            </div>
                                                            <div className="proof-card-image-fullsize">
                                                                <img src={proofContext.imageUrl} alt="Bukti" onClick={()=> window.open(proofContext.imageUrl,'_blank')} className="cursor-pointer" title="Klik untuk buka di tab baru" />
                                                            </div>
                                                            <div className="proof-card-meta">
                                                                <p><strong>User:</strong> {proofContext.user} ({proofContext.npm})</p>
                                                                {proofContext.type==='fine' && (<>
                                                                    <p><strong>Jumlah:</strong> {formatRupiah(proofContext.amount||0)}</p>
                                                                    <p><strong>Metode:</strong> {proofContext.method}</p>
                                                                    <p><strong>Loan IDs:</strong> {proofContext.loanIds?.join(', ') || '-'}</p>
                                                                </>)}
                                                                {proofContext.type==='return' && (<>
                                                                    <p><strong>Ready Return:</strong> {proofContext.readyReturnDate ? format(new Date(proofContext.readyReturnDate), 'dd MMM yyyy HH:mm') : '-'}</p>
                                                                </>)}
                                                                <p><strong>Created:</strong> {proofContext.createdAt ? format(new Date(proofContext.createdAt), 'dd MMM yyyy HH:mm') : '-'}</p>
                                                            </div>
                                                            <div className="proof-card-actions">
                                                                {proofContext.type==='fine' && proofContext.notificationId && (<>
                                                                    <button className="btn btn-success" onClick={()=>{ handleVerifyFine(proofContext.notificationId!,'approve'); closeProofModal(); }}>Verifikasi</button>
                                                                    <button className="btn btn-danger" onClick={()=>{ handleVerifyFine(proofContext.notificationId!,'reject'); closeProofModal(); }}>Tolak</button>
                                                                </>)}
                                                                {proofContext.type==='return' && proofContext.loanId && (
                                                                    <>
                                                                        {proofContext.status === 'Siap Dikembalikan' && (
                                                                            <button className="btn btn-success" onClick={()=>{ handleProcessReturn({ ...returnsReview.find(l=>l.id===proofContext.loanId)! }); closeProofModal(); }}>Verifikasi</button>
                                                                        )}
                                                                        {proofContext.status === 'Siap Dikembalikan' && (
                                                                            <button className="btn btn-danger" onClick={()=>{ handleRejectReturn(proofContext.loanId!, proofContext.user||'', proofContext.npm); closeProofModal(); }}>Tolak</button>
                                                                        )}
                                                                    </>
                                                                )}
                                                                <button className="btn btn-neutral" onClick={closeProofModal}>Tutup</button>
                                                                <button className="btn btn-outline-small" onClick={()=> window.open(proofContext.imageUrl,'_blank')}>Buka di Tab Baru</button>
                                                            </div>
                                                        </div>
                                                    </div>, document.body)}
        </div>
    );
};

export default AdminDashboard;