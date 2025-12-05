// File: src/components/DashboardAdmin/UserModal.tsx (REVISI - FIX POST/PUT LOGIC)

import React, { useState, useEffect } from 'react';
import { FaTimes, FaSave, FaUserEdit, FaUserPlus, FaInfoCircle } from 'react-icons/fa';
import './AdminDashboard.css'; 

// --- INTERFACES ---
interface UserData {
    id?: number; // Opsional untuk mode Add
    username: string;
    npm: string;
    role: 'user' | 'admin';
    fakultas: string;
    prodi: string;
    angkatan: number;
    denda?: number;
}

interface UserModalProps {
    isOpen: boolean;
    onClose: () => void;
    userToEdit: UserData | null;
    onSave: (userId: number | undefined, userData: Partial<UserData> & { password?: string }) => Promise<void>;
    error: string | null;
    isLoading: boolean;
}

const UserModal: React.FC<UserModalProps> = ({ isOpen, onClose, userToEdit, onSave, error, isLoading }) => {
    // State untuk data form. Gunakan Partial agar field password bisa ditambahkan.
    const [formData, setFormData] = useState<Partial<UserData & { password?: string }>>({});
    const [localError, setLocalError] = useState<string | null>(null);

    const isEditMode = !!userToEdit;

    useEffect(() => {
        // Isi form data saat userToEdit berubah
        if (userToEdit) {
            setFormData({
                id: userToEdit.id,
                username: userToEdit.username,
                npm: userToEdit.npm,
                role: userToEdit.role,
                fakultas: userToEdit.fakultas,
                prodi: userToEdit.prodi,
                angkatan: userToEdit.angkatan,
                password: '', // Kosongkan password saat edit, diisi jika ingin diubah
            });
        } else {
            // Reset form untuk mode Tambah
            setFormData({
                username: '',
                npm: '',
                role: 'user', // Default role
                fakultas: '',
                prodi: '',
                angkatan: undefined,
                password: '',
            });
        }
        setLocalError(null);
    }, [userToEdit, isOpen]); 

    // Jika modal tidak terbuka, jangan render apa-apa
    if (!isOpen) {
        return null;
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: name === 'angkatan' || name === 'denda' ? Number(value) : value
        }));
        setLocalError(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLocalError(null);

        // Validasi wajib isi
        if (!formData.username || !formData.npm || !formData.fakultas || !formData.prodi || !formData.angkatan || (!isEditMode && !formData.password)) {
            setLocalError('Semua field wajib diisi (kecuali Password saat Edit).');
            return;
        }

        try {
            // userId adalah undefined untuk POST (Add), atau ID untuk PUT (Edit)
            await onSave(userToEdit?.id, formData);
        } catch (e: any) {
            // Tangkap error dari handleSaveUser di AdminDashboard.tsx
            setLocalError(e.message || 'Gagal menyimpan data.'); 
        }
    };

    return (
        // Modal Overlay Class 'modal-overlay' harus ada di AdminDashboard.css
        <div className={`modal-overlay ${isOpen ? 'open' : ''}`}> 
            <div className="modal-content-lg">
                <button className="modal-close-btn" onClick={onClose} disabled={isLoading}>
                    <FaTimes />
                </button>
                <h2 className="modal-title">
                    {isEditMode ? <><FaUserEdit /> Edit Pengguna: {userToEdit?.username}</> : <><FaUserPlus /> Tambah Pengguna Baru</>}
                </h2>

                {(localError || error) && (
                    <p className="status-message error modal-error-v2"><FaInfoCircle /> {localError || error}</p>
                )}

                <form onSubmit={handleSubmit} className="user-form">
                    {/* NPM (Tidak bisa diubah saat edit) */}
                    <div className="form-group">
                        <label htmlFor="npm">NPM:</label>
                        <input 
                            type="text" 
                            id="npm" 
                            name="npm" 
                            value={formData.npm || ''} 
                            onChange={handleChange} 
                            required 
                            disabled={isEditMode} // NPM tidak boleh diubah saat Edit
                            placeholder="Contoh: 1402018001"
                        />
                         {isEditMode && <p className="input-info">NPM tidak dapat diubah saat mengedit.</p>}
                    </div>

                    <div className="form-group">
                        <label htmlFor="username">Username/Nama:</label>
                        <input type="text" id="username" name="username" value={formData.username || ''} onChange={handleChange} required />
                    </div>

                    {/* Password hanya diwajibkan saat Add, opsional saat Edit */}
                    <div className="form-group">
                        <label htmlFor="password">Password: {isEditMode && <span className="input-info">(Kosongkan jika tidak ingin diubah)</span>}</label>
                        <input 
                            type="password" 
                            id="password" 
                            name="password" 
                            value={formData.password || ''} 
                            onChange={handleChange} 
                            required={!isEditMode}
                            placeholder={isEditMode ? '••••••••' : 'Wajib diisi'}
                        />
                    </div>
                    
                    <div className="form-group">
                        <label htmlFor="role">Role:</label>
                        <select id="role" name="role" value={formData.role || 'user'} onChange={handleChange} required>
                            <option value="user">User</option>
                            <option value="admin">Admin</option>
                        </select>
                    </div>
                    
                    <div className="form-group">
                        <label htmlFor="fakultas">Fakultas:</label>
                        <input type="text" id="fakultas" name="fakultas" value={formData.fakultas || ''} onChange={handleChange} required />
                    </div>
                    <div className="form-group">
                        <label htmlFor="prodi">Prodi:</label>
                        <input type="text" id="prodi" name="prodi" value={formData.prodi || ''} onChange={handleChange} required />
                    </div>
                    <div className="form-group">
                        <label htmlFor="angkatan">Angkatan:</label>
                        <input 
                            type="number" 
                            id="angkatan" 
                            name="angkatan" 
                            value={formData.angkatan || ''} 
                            onChange={handleChange} 
                            min="1990" 
                            max={new Date().getFullYear()} 
                            required 
                        />
                    </div>
                    
                    <button type="submit" className="btn btn-primary btn-save" disabled={isLoading}>
                        {isLoading ? 'Menyimpan...' : <><FaSave /> Simpan Perubahan</>}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default UserModal;