import axios from 'axios';
import { API_BASE_URL } from '../config/api';

// Basic axios instance
export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: false,
});

// Attach token automatically if exists
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    // Pastikan headers adalah objek yang dapat dimodifikasi
    const headers: Record<string, any> = (config.headers as any) || {};
    headers['Authorization'] = `Bearer ${token}`;
    config.headers = headers as any;
  }
  return config;
});

// Global 401 handler: bila token invalid/expired, bersihkan dan arahkan ke login
api.interceptors.response.use(
  (resp) => resp,
  (error) => {
    const status = error?.response?.status;
    if (status === 401) {
      try {
        localStorage.removeItem('token');
        localStorage.removeItem('userData');
      } catch {}
      const current = window.location.pathname;
      if (current !== '/login') {
        const next = `/login?redirect=${encodeURIComponent(current)}`;
        window.location.assign(next);
      }
    }
    return Promise.reject(error);
  }
);

// ---- TYPES ----
export interface LoginResponse {
  success: boolean;
  message: string;
  token: string;
  userData: any; // You can refine later
}

export interface BookDto {
  id: number;
  title?: string; // admin list version
  judul?: string; // user borrowing version naming mismatch
  author?: string;
  penulis?: string;
  kodeBuku: string;
  publisher?: string;
  publicationYear?: number | string;
  totalStock: number;
  availableStock: number;
  category?: string;
  image_url?: string;
  imageUrl?: string; // front component uses imageUrl
  location?: string;
  year?: string;
  description?: string;
}

export interface LoanDto {
  id: number;
  kodePinjam?: string;
  bookTitle?: string;
  kodeBuku: string;
  loanDate: string;
  expectedReturnDate?: string;
  returnDate?: string;
  status: string;
  fineAmount?: number;
  finePaid?: number;
  finePaymentStatus?: string;
  finePaymentMethod?: string;
  finePaymentProof?: string;
  actualReturnDate?: string | null;
  penaltyAmount?: number;
  location?: string;
  returnProofUrl?: string | null;
  readyReturnDate?: string | null;
}

// ---- AUTH ----
export const authApi = {
  login: (npm: string, password: string) => api.post<LoginResponse>('/auth/login', { npm, password }).then(r => r.data),
};

// ---- PROFILE ----
export const profileApi = {
  updateBiodata: (data: any) => api.put('/profile/update-biodata', data).then(r => r.data),
  uploadPhoto: (file: File | null) => {
    const fd = new FormData();
    if (file) fd.append('profile_photo', file);
    return api.post('/profile/upload-photo', fd).then(r => r.data);
  },
  deletePhoto: () => api.delete('/profile/delete-photo').then(r => r.data),
  me: () => api.get('/profile/me').then(r => r.data),
  activeFine: () => api.get('/profile/active-fine').then(r => r.data as { success:boolean; activeFine:number; runningFine:number; unpaidReturnedFine:number }),
  payFines: (loanIds?: number[]) => api.post('/profile/pay-fines', loanIds && loanIds.length ? { loanIds } : {}).then(r => r.data as { success:boolean; paidCount:number; paidTotal:number; remainingUnpaid:number; message?:string }),
  initiateFines: (loanIds: number[], method: 'bank'|'qris'|'cash') => api.post('/profile/initiate-fines', { loanIds, method }).then(r => r.data as { success:boolean; updatedIds:number[]; status:string; method:string }),
  uploadFineProof: (loanIds: number[], file: File) => {
    const fd = new FormData();
    fd.append('loanIds', JSON.stringify(loanIds));
    fd.append('proof', file);
    return api.post('/profile/upload-fine-proof', fd, { headers:{ 'Content-Type':'multipart/form-data' }}).then(r=> r.data as { success:boolean; proofUrl:string; updatedIds:number[]; status:string });
  },
};

// ---- BOOKS ----
export const bookApi = {
  list: (search?: string, opts?: { sort?: 'popular'|'newest' }) => {
    const params: string[] = [];
    if (search) params.push(`search=${encodeURIComponent(search)}`);
    if (opts?.sort) params.push(`sort=${opts.sort === 'popular' ? 'popular' : opts.sort === 'newest' ? 'newest' : ''}`);
    const qs = params.length ? `?${params.join('&')}` : '';
    return api.get<BookDto[]>(`/books${qs}`).then(r => r.data);
  },
  detail: (id: number | string) => api.get<BookDto>(`/books/${id}`).then(r => r.data),
  create: (formData: FormData) => api.post('/books', formData, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data),
  update: (id: number, formData: FormData) => api.put(`/books/${id}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data),
  remove: (id: number) => api.delete(`/books/${id}`).then(r => r.data),
};

// ---- LOANS (User) ----
export const loanApi = {
  request: (data: { bookId: number; loanDate: string; returnDate: string; purpose?: string; }) => api.post('/loans/request', data).then(r => r.data as { success: boolean; message: string; loan?: { id: number; kodePinjam: string; bookTitle: string; loanDate: string; expectedReturnDate: string; status: string; purpose?: string|null; }; }),
  userLoans: () => api.get<LoanDto[]>(`/loans/user`).then(r => r.data),
  markReadyToReturn: (loanId: number, file?: File, metadata?: any) => {
    const fd = new FormData();
    if (file) fd.append('proofPhoto', file);
    if (metadata) fd.append('metadata', JSON.stringify(metadata));
    return api.post(`/loans/ready-to-return/${loanId}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data as { success: boolean; message: string; proofUrl?: string });
  },
  notifications: () => api.get(`/loans/notifications`).then(r => r.data as { success:boolean; notifications: Array<{id:number; kodePinjam?:string; approvedAt:string; status:string}> }),
  ackNotifications: (ids: number[]) => api.post(`/loans/notifications/ack`, { ids }).then(r => r.data as { success:boolean }),
  // Return notifications (approved / rejected)
  returnNotifications: () => api.get(`/loans/return-notifications`).then(r => r.data as { success:boolean; notifications: Array<{id:number; status:string; returnDecision:'approved'|'rejected'; actualReturnDate:string; bookTitle:string; fineAmount?: number}> }),
  ackReturnNotifications: (ids: number[]) => api.post(`/loans/return-notifications/ack`, { ids }).then(r => r.data as { success:boolean }),
  // Rejection notifications (loan request rejected)
  rejectionNotifications: () => api.get(`/loans/rejection-notifications`).then(r => r.data as { success:boolean; notifications: Array<{id:number; status:string; rejectionDate:string; bookTitle:string}> }),
  ackRejectionNotifications: (ids: number[]) => api.post(`/loans/rejection-notifications/ack`, { ids }).then(r => r.data as { success:boolean }),
  notificationHistory: () => api.get(`/loans/notifications/history`).then(r => r.data as { success:boolean; items: Array<{ id:number; bookTitle:string; status:string; approvedAt?:string; actualReturnDate?:string; returnDecision?:'approved'|'rejected'; rejectionDate?:string; returnProofUrl?:string; returnProofMetadata?:string|any }> }),
};

// ---- ADMIN ----
export const adminApi = {
  users: () => api.get('/admin/users').then(r => r.data),
  createUser: (data: any) => api.post('/admin/users', data).then(r => r.data),
  updateUser: (id: number, data: any) => api.put(`/admin/users/${id}`, data).then(r => r.data),
  deleteUser: (id: number) => api.delete(`/admin/users/${id}`).then(r => r.data),
  resetPenalty: (id: number) => api.post(`/admin/penalty/reset/${id}`, {}).then(r => r.data),

  pendingLoans: () => api.get('/admin/loans/pending').then(r => r.data),
  approveLoan: (loanId: number) => api.post('/admin/loans/approve', { loanId }).then(r => r.data),
  rejectLoan: (loanId: number) => api.post('/admin/loans/reject', { loanId }).then(r => r.data),

  returnsReview: () => api.get('/admin/returns/review').then(r => r.data),
  processReturn: (loanId: number, manualFineAmount: number) => api.post('/admin/returns/process', { loanId, manualFineAmount }).then(r => r.data),
  rejectReturn: (loanId: number) => api.post('/admin/returns/reject', { loanId }).then(r => r.data),

  // History (Dikembalikan & Ditolak)
  history: () => api.get('/admin/history').then(r => r.data),

  // Fines verification
  pendingFinePayments: () => api.get('/admin/fines/pending').then(r => r.data as { success:boolean; items:any[] }),
  verifyFinePayment: (notificationId:number, action:'approve'|'reject') => api.post('/admin/fines/verify', { notificationId, action }).then(r => r.data as { success:boolean; updated:number; action:string }),

  // QR Scan & Start Loan
  scanLoan: (kodePinjam: string) => api.post('/admin/loans/scan', { kodePinjam }).then(r => r.data as { success:boolean; message:string; loanId?:number }),
  startLoan: (loanId: number) => api.post('/admin/loans/start', { loanId }).then(r => r.data as { success:boolean; message:string; expectedReturnDate?:string }),
};

// Utility mapper for inconsistent naming between endpoints and UI components
export const normalizeBook = (b: BookDto) => ({
  id: b.id,
  judul: b.judul || b.title || 'Judul Tidak Tersedia',
  penulis: b.penulis || b.author || 'Penulis Tidak Tersedia',
  kodeBuku: b.kodeBuku,
  totalStock: b.totalStock,
  availableStock: b.availableStock,
  year: (b.publicationYear || b.year || '').toString(),
  imageUrl: (() => {
    const raw = b.imageUrl || b.image_url || '';
    if (!raw) return '';
    // If already absolute (http/https/data blob), return as is
    if (/^(?:https?:|data:|blob:)/i.test(raw)) return raw;
    // Normalize double leading slashes
    const cleaned = raw.startsWith('//') ? raw.replace(/^\/+/, '') : raw;
    // If starts with /uploads or uploads, prefix with backend host portion of API_BASE_URL
    const hostBase = API_BASE_URL.replace(/\/api\/?$/,'');
    if (/^uploads\//i.test(cleaned)) return `${hostBase}/${cleaned}`;
    if (/^\/uploads\//i.test(cleaned)) return `${hostBase}${cleaned}`;
    // Fallback: just join
    return `${hostBase}/${cleaned.replace(/^\//,'')}`;
  })(),
  description: b.description || '',
  location: b.location || 'Tidak Diketahui',
  category: b.category || '-',
});
