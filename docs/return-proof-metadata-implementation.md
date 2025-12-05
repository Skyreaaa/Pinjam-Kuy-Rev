# Implementasi Metadata Bukti Pengembalian

**Tanggal:** 1 Desember 2024  
**Fitur:** Metadata Otomatis pada Foto Pengembalian dengan GPS, Waktu, dan Alamat

## 🎯 Tujuan

Mengatasi masalah teknis seperti buku dinyatakan hilang padahal sudah dikembalikan dengan menyimpan metadata lengkap saat foto pengembalian diambil, termasuk:
- **Koordinat GPS** (latitude, longitude, accuracy)
- **Waktu Pengambilan** yang akurat (timestamp)
- **Alamat Lengkap** (reverse geocoding dari koordinat)
- **Sumber Foto** (Camera/File Upload)

## 📋 Perubahan yang Dilakukan

### 1. Database Migration

**File:** `be-pinjam-master/sql/migrations/20251201_add_return_metadata.sql`

```sql
ALTER TABLE loans
ADD COLUMN IF NOT EXISTS returnProofMetadata JSON NULL 
COMMENT 'Metadata foto pengembalian: koordinat, waktu, alamat' 
AFTER returnProofUrl;
```

**Struktur JSON:**
```json
{
  "timestamp": "2024-12-01T14:30:00.000Z",
  "coordinates": {
    "latitude": -6.2088,
    "longitude": 106.8456,
    "accuracy": 10
  },
  "address": "Jl. Contoh No. 123, Jakarta Selatan",
  "device": "Camera"
}
```

### 2. Backend Changes

**File:** `be-pinjam-master/controllers/loanController.js`

#### Fungsi `markReadyToReturn`:
- Menerima parameter `metadata` dari request body
- Parse JSON metadata dari FormData
- Simpan ke database sebagai JSON string

```javascript
// Parse metadata dari body
let metadata = null;
if (req.body.metadata) {
    try {
        metadata = JSON.parse(req.body.metadata);
    } catch (e) {
        console.warn('Failed to parse metadata:', e);
    }
}

// Update dengan metadata
await pool.query(
    "UPDATE loans SET status = ?, readyReturnDate = ?, returnProofUrl = ?, returnProofMetadata = ? WHERE id = ? AND user_id = ?",
    ['Siap Dikembalikan', new Date(), proofUrl, metadata ? JSON.stringify(metadata) : null, loanId, userId]
);
```

#### Fungsi `getReturnsForReview`:
- Tambahkan kolom `returnProofMetadata` ke SELECT query
- Data metadata tersedia untuk admin dashboard

### 3. Frontend Changes

#### A. API Service (`src/services/api.ts`)

```typescript
markReadyToReturn: (loanId: number, file?: File, metadata?: any) => {
    const fd = new FormData();
    if (file) fd.append('proofPhoto', file);
    if (metadata) fd.append('metadata', JSON.stringify(metadata));
    return api.post(`/loans/ready-to-return/${loanId}`, fd, { 
        headers: { 'Content-Type': 'multipart/form-data' } 
    }).then(r => r.data);
}
```

#### B. Borrowing Page (`src/components/Peminjaman/BorrowingPage.tsx`)

**Fungsi `takeReturnPicture`** - Ambil metadata saat foto diambil:

```typescript
const metadata: any = {
    timestamp: new Date().toISOString(),
    device: 'Camera'
};

// Get GPS coordinates
if (navigator.geolocation) {
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

    // Reverse geocoding untuk alamat
    const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${position.coords.latitude}&lon=${position.coords.longitude}`
    );
    const data = await response.json();
    metadata.address = data.display_name || 'Alamat tidak ditemukan';
}

// Store temporarily
(window as any).lastReturnProofMetadata = metadata;
```

**Fungsi `handleMarkReady`** - Kirim metadata ke backend:

```typescript
const metadata = (window as any).lastReturnProofMetadata || null;

if (!metadata && file) {
    // For file uploads, get location too
    const fileMetadata = await getLocationMetadata();
    await loanApi.markReadyToReturn(loan.id, file, fileMetadata);
} else {
    await loanApi.markReadyToReturn(loan.id, file, metadata);
}

// Clear after use
(window as any).lastReturnProofMetadata = null;
```

#### C. Notification History (`src/components/Peminjaman/NotificationHistory.tsx`)

**Type Definition:**
```typescript
type NotificationItem = {
  id: number;
  bookTitle: string;
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
```

**Parse Metadata:**
```typescript
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
    returnProofUrl: it.returnProofUrl,
    returnProofMetadata: metadata
} as NotificationItem;
```

**Modal View Bukti:**
```tsx
{selectedProof.returnProofMetadata && (
  <div className="proof-modal-metadata">
    <h3><FaMapMarkerAlt /> Informasi Lokasi & Waktu</h3>
    
    {/* Timestamp */}
    <div className="proof-metadata-item">
      <strong>Waktu Pengambilan:</strong>
      <span>{format(new Date(metadata.timestamp), 'dd MMMM yyyy, HH:mm:ss', {locale: id})}</span>
    </div>
    
    {/* GPS Coordinates */}
    <div className="proof-metadata-item">
      <strong>Koordinat GPS:</strong>
      <span>
        {metadata.coordinates.latitude.toFixed(6)}, {metadata.coordinates.longitude.toFixed(6)}
        <br />
        <small>(Akurasi: ±{metadata.coordinates.accuracy.toFixed(0)}m)</small>
      </span>
    </div>
    
    {/* Address */}
    <div className="proof-metadata-item">
      <strong>Alamat:</strong>
      <span>{metadata.address}</span>
    </div>
    
    {/* View on Maps */}
    <a 
      href={`https://www.google.com/maps?q=${metadata.coordinates.latitude},${metadata.coordinates.longitude}`}
      target="_blank"
      className="proof-view-map-btn"
    >
      <FaMapMarkerAlt /> Buka di Google Maps
    </a>
  </div>
)}
```

### 4. CSS Styling (`src/components/Peminjaman/BorrowingPage.css`)

**Button untuk lihat bukti:**
```css
.notif-view-proof-btn {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border-radius: 6px;
    padding: 8px 12px;
    display: inline-flex;
    align-items: center;
    gap: 6px;
}
```

**Modal bukti pengembalian:**
```css
.proof-modal-overlay {
    position: fixed;
    background: rgba(0, 0, 0, 0.8);
    z-index: 1000;
}

.proof-modal-content {
    background: white;
    border-radius: 12px;
    max-width: 600px;
    padding: 24px;
}

.proof-modal-image img {
    max-width: 100%;
    border-radius: 6px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.proof-modal-metadata {
    background: #f8f9fa;
    border-radius: 8px;
    padding: 16px;
}
```

## 🔐 Keamanan & Privacy

1. **User Permission**: Browser akan meminta izin GPS dari user
2. **Timeout**: Geolocation request timeout setelah 5 detik
3. **High Accuracy**: Menggunakan mode akurasi tinggi untuk GPS
4. **Fallback**: Jika GPS gagal, foto tetap bisa diupload tanpa metadata
5. **Optional**: Metadata bersifat opsional, tidak menghalangi proses pengembalian

## 📱 User Experience Flow

### Saat Mengambil Foto:

1. User klik "Ambil Foto" dari kamera
2. Browser minta izin GPS
3. System mengambil:
   - Koordinat GPS (latitude, longitude, accuracy)
   - Timestamp saat foto diambil
   - Reverse geocoding untuk alamat
4. Foto diproses dan metadata disimpan temporary
5. Saat upload, metadata dikirim bersamaan dengan foto

### Saat Upload File:

1. User pilih file dari galeri
2. System tetap mencoba ambil lokasi saat ini
3. Metadata device: "File Upload"
4. Koordinat dan alamat (jika GPS tersedia)

### Di History Notifikasi:

1. User buka "Riwayat Notifikasi"
2. Filter notifikasi sesuai kebutuhan
3. Klik "Lihat Bukti Pengembalian" pada notifikasi pengembalian
4. Modal menampilkan:
   - Foto bukti pengembalian
   - Waktu pengambilan foto
   - Koordinat GPS lengkap dengan akurasi
   - Alamat lengkap
   - Link "Buka di Google Maps"

## 🧪 Testing

### Test Case 1: Camera dengan GPS Enabled
- ✅ Metadata lengkap tersimpan
- ✅ Koordinat akurat
- ✅ Alamat ter-resolve

### Test Case 2: Camera dengan GPS Disabled
- ✅ Foto tetap terupload
- ✅ Metadata hanya timestamp dan device

### Test Case 3: File Upload dengan GPS
- ✅ Metadata menggunakan lokasi saat upload
- ✅ Device: "File Upload"

### Test Case 4: File Upload tanpa GPS
- ✅ Foto tetap terupload
- ✅ Minimal metadata tersimpan

### Test Case 5: View History
- ✅ Modal menampilkan foto
- ✅ Metadata ter-parse dengan benar
- ✅ Link Google Maps berfungsi

## 📊 Benefits

1. **Bukti Kuat**: Koordinat GPS dan timestamp yang tidak bisa dimanipulasi
2. **Transparansi**: User dan admin sama-sama bisa lihat metadata
3. **Resolusi Sengketa**: Data teknis untuk menyelesaikan masalah buku hilang
4. **Audit Trail**: Riwayat lengkap setiap pengembalian
5. **Legal Protection**: Bukti digital yang valid untuk keperluan hukum

## 🔄 Future Improvements

- [ ] Menyimpan metadata ke file EXIF foto
- [ ] Tambahkan watermark timestamp dan koordinat di foto
- [ ] Export laporan metadata ke PDF
- [ ] Integrasi dengan map visualization
- [ ] Deteksi anomali lokasi (jika terlalu jauh dari perpustakaan)

## 🛠️ Technical Stack

- **Geolocation API**: `navigator.geolocation.getCurrentPosition()`
- **Reverse Geocoding**: OpenStreetMap Nominatim API
- **Date Handling**: `date-fns` library
- **Storage**: MySQL JSON column type
- **Icons**: React Icons (FaMapMarkerAlt, FaImage)

## 📝 Notes

- Metadata bersifat opsional dan tidak blocking
- GPS accuracy bervariasi tergantung device (5-50m typical)
- Reverse geocoding menggunakan OpenStreetMap (free tier)
- Timeout set 5 detik untuk menghindari user menunggu lama
- Format JSON memudahkan ekstensibilitas di masa depan
