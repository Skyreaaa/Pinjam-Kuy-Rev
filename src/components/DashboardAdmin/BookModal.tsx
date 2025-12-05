// File: src/components/DashboardAdmin/BookModal.tsx (BARU - FULL CODE SIAP PAKAI)

import React, { useState, useEffect, useRef } from 'react';
import { FaTimes, FaSave, FaBook, FaInfoCircle, FaImage, FaBarcode, FaMapMarkerAlt } from 'react-icons/fa';
import './AdminDashboard.css'; 
import { adaptiveCompress, formatBytes } from '../../utils/imageProcessing';

// --- INTERFACES ---
interface BookData {
    id: number;
    title: string;
    author: string;
    kodeBuku: string;
    publisher?: string; // dibuat opsional agar cocok dengan tipe Book di AdminDashboard
    publicationYear?: number;
    totalStock: number;
    availableStock: number;
    category: string;
    image_url?: string;
    location: string;
    description?: string;
}

interface BookModalProps {
    isOpen: boolean;
    onClose: () => void;
    bookToEdit: BookData | null;
    onSave: (id: number, formData: FormData) => Promise<void>;
    error: string | null;
    isLoading: boolean;
}

// Konfigurasi Kategori Buku
const BOOK_CATEGORIES = ['Fiksi', 'Non-Fiksi', 'Sains', 'Sejarah', 'Komputer', 'Jurnal', 'Lainnya'];

const BookModal: React.FC<BookModalProps> = ({ isOpen, onClose, bookToEdit, onSave, error, isLoading }) => {
    const [formData, setFormData] = useState<Partial<BookData>>({});
    const [coverImage, setCoverImage] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [processing, setProcessing] = useState(false);
    const [imageInfo, setImageInfo] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (bookToEdit) {
            setFormData({
                title: bookToEdit.title,
                author: bookToEdit.author,
                kodeBuku: bookToEdit.kodeBuku,
                publisher: bookToEdit.publisher || '',
                publicationYear: bookToEdit.publicationYear || new Date().getFullYear(),
                totalStock: bookToEdit.totalStock,
                availableStock: bookToEdit.availableStock, // Available stock hanya dihitung saat update
                category: bookToEdit.category,
                location: bookToEdit.location,
                description: bookToEdit.description || '',
            });
            setImagePreview(bookToEdit.image_url || null);
            setCoverImage(null);
        } else {
            setFormData({ 
                title: '', author: '', kodeBuku: '', publisher: '', category: 'Fiksi', location: '',
                totalStock: 1, publicationYear: new Date().getFullYear(), availableStock: 1, description: ''
            });
            setImagePreview(null);
            setCoverImage(null);
        }
    }, [bookToEdit]);

    if (!isOpen) return null;

    const isEditMode = bookToEdit !== null && bookToEdit.id !== undefined && bookToEdit.id !== 0;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'number' ? (value === '' ? '' : Number(value)) : value
        }));
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0] || null;
        setImageInfo(null);
        if (!file) {
            setCoverImage(null);
            setImagePreview(isEditMode ? bookToEdit?.image_url || null : null);
            return;
        }
        // Basic upfront checks
        if (!file.type.startsWith('image/')) {
            alert('File harus berupa gambar.');
            return;
        }
        // Start processing (max 800x800, adaptive compress to <= 400KB preferred)
        setProcessing(true);
        try {
            const processed = await adaptiveCompress(file, {
                maxWidth: 800,
                maxHeight: 800,
                outputType: file.type === 'image/png' ? 'image/png' : 'image/jpeg',
                preserveTransparency: file.type === 'image/png',
                maxBytes: 400 * 1024
            });
            setCoverImage(processed);
            const url = URL.createObjectURL(processed);
            setImagePreview(url);
            setImageInfo(`Ukuran setelah kompresi: ${formatBytes(processed.size)} (asal ${formatBytes(file.size)})`);
        } catch (err) {
            console.warn('Gagal memproses gambar, gunakan original:', err);
            setCoverImage(file);
            setImagePreview(URL.createObjectURL(file));
            setImageInfo(`Ukuran asli: ${formatBytes(file.size)}`);
        } finally {
            setProcessing(false);
        }
    };

    const handleRemoveImage = () => {
        setCoverImage(null);
        setImagePreview(null);
        setImageInfo(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Basic validation
        if (!formData.title || !formData.author || !formData.kodeBuku || !formData.totalStock || !formData.category || !formData.location) {
            return alert('Harap isi semua kolom wajib (*)!');
        }

        const dataToSend = new FormData();
        dataToSend.append('title', formData.title || '');
        dataToSend.append('author', formData.author || '');
        dataToSend.append('kodeBuku', formData.kodeBuku || '');
        dataToSend.append('publisher', formData.publisher || '');
        dataToSend.append('publicationYear', String(formData.publicationYear || new Date().getFullYear()));
        dataToSend.append('totalStock', String(formData.totalStock || 1));
        dataToSend.append('category', formData.category || 'Lainnya');
        dataToSend.append('location', formData.location || '');
        if (typeof formData.description === 'string') {
            dataToSend.append('description', formData.description);
        }
        
        // Hanya tambahkan file jika ada perubahan/file baru
        if (coverImage) {
            dataToSend.append('coverImage', coverImage);
        } 
        
        // Untuk mode edit, kirim nama file lama jika tidak ada upload baru
        if (isEditMode && bookToEdit?.image_url) {
            const fileName = bookToEdit.image_url.split('/').pop();
             dataToSend.append('currentImageFileName', fileName || '');
        }

        try {
            await onSave(isEditMode ? bookToEdit!.id : 0, dataToSend);
        } catch (err) {
            // Error sudah ditangani di parent (AdminDashboard)
        }
    };

    return (
        // Tambahkan class 'open' agar sesuai dengan CSS yang mensyaratkan .modal-overlay.open untuk visible
        <div className="modal-overlay open">
            <div className="modal-content large">
                <div className="modal-header">
                    <h2><FaBook /> {isEditMode ? 'Edit Data Buku' : 'Tambah Buku Baru'}</h2>
                    <button className="close-button" onClick={onClose} aria-label="Tutup Modal"><FaTimes /></button>
                </div>
                {error && <p className="error-message"><FaInfoCircle /> {error}</p>}
                
                <form onSubmit={handleSubmit}>
                    <div className="modal-body-grid">
                        
                        {/* Kolom Kiri: Info Dasar */}
                        <div className="form-column">
                            <div className="form-group">
                                <label htmlFor="title">Judul Buku <span className="required">*</span></label>
                                <input type="text" id="title" name="title" value={formData.title || ''} onChange={handleChange} required />
                            </div>
                            <div className="form-group">
                                <label htmlFor="author">Penulis <span className="required">*</span></label>
                                <input type="text" id="author" name="author" value={formData.author || ''} onChange={handleChange} required />
                            </div>
                            <div className="form-group">
                                <label htmlFor="kodeBuku"><FaBarcode /> Kode Buku <span className="required">*</span></label>
                                <input type="text" id="kodeBuku" name="kodeBuku" value={formData.kodeBuku || ''} onChange={handleChange} required />
                            </div>
                            <div className="form-group">
                                <label htmlFor="location"><FaMapMarkerAlt /> Lokasi Rak/Penyimpanan <span className="required">*</span></label>
                                <input type="text" id="location" name="location" value={formData.location || ''} onChange={handleChange} required />
                            </div>
                            <div className="form-group half-group">
                                <div className="half-item">
                                    <label htmlFor="totalStock">Total Stok <span className="required">*</span></label>
                                    <input type="number" id="totalStock" name="totalStock" value={formData.totalStock || 1} onChange={handleChange} min="1" required />
                                </div>
                                <div className="half-item">
                                    <label htmlFor="category">Kategori <span className="required">*</span></label>
                                    <select id="category" name="category" value={formData.category || 'Fiksi'} onChange={handleChange} required>
                                        {BOOK_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="form-group half-group">
                                <div className="half-item">
                                    <label htmlFor="publisher">Penerbit</label>
                                    <input type="text" id="publisher" name="publisher" value={formData.publisher || ''} onChange={handleChange} />
                                </div>
                                <div className="half-item">
                                    <label htmlFor="publicationYear">Tahun Terbit</label>
                                    <input type="number" id="publicationYear" name="publicationYear" value={formData.publicationYear || new Date().getFullYear()} onChange={handleChange} min="1900" max={new Date().getFullYear()} />
                                </div>
                            </div>
                            {isEditMode && (
                                <div className="form-group">
                                    <p className="info-available">Stok Tersedia Saat Ini: <strong>{bookToEdit?.availableStock}</strong></p>
                                    <p className="info-note">Perubahan Total Stok akan menyesuaikan Stok Tersedia (Stok Tersedia = Stok Tersedia Lama + (Total Stok Baru - Total Stok Lama)).</p>
                                </div>
                            )}
                            <div className="form-group">
                                <label htmlFor="description">Deskripsi</label>
                                <textarea id="description" name="description" value={formData.description || ''} onChange={handleChange} rows={5} placeholder="Deskripsi buku, ringkasan, atau catatan." />
                            </div>
                        </div>
                        
                        {/* Kolom Kanan: Upload Gambar */}
                        <div className="form-column">
                            <div className="form-group">
                                <label htmlFor="coverImage">Cover Buku (≤ 5MB sebelum kompresi, otomatis dikompresi)</label>
                                <input 
                                    type="file" 
                                    id="coverImage" 
                                    name="coverImage" 
                                    accept="image/*" 
                                    onChange={handleFileChange} 
                                    ref={fileInputRef}
                                />
                                {processing && <p className="info-note">Memproses gambar...</p>}
                                {imageInfo && <p className="info-note small">{imageInfo}</p>}
                            </div>
                            <div className="image-preview-container">
                                {imagePreview ? (
                                    <>
                                        <img src={imagePreview} alt="Cover Preview" className="cover-preview" />
                                        <button type="button" className="btn btn-danger btn-remove-image" onClick={handleRemoveImage}>
                                            <FaTimes /> Hapus Gambar
                                        </button>
                                    </>
                                ) : (
                                    <div className="cover-placeholder">
                                        <FaImage size={50} />
                                        <p>Pratinjau Cover</p>
                                    </div>
                                )}
                            </div>
                            <p className="info-note">Hanya upload jika ingin menambah/mengganti cover.</p>
                        </div>
                        
                    </div>
                    
                    <button type="submit" className="btn btn-primary btn-save" disabled={isLoading}>
                        {isLoading ? 'Menyimpan...' : <><FaSave /> Simpan Buku</>}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default BookModal;