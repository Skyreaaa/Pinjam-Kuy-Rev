# Alur Pembayaran Denda (Fine Payment Flow)

Dokumen ini menjelaskan skema database terkait denda, alur status pinjaman & pembayaran denda, endpoint yang digunakan (User & Admin), serta ringkasan UI/UX baru.

## 1. Kolom / Tabel Baru

### Tabel `loans` (tambahan)
- fineAmount (INT) – total denda yang ditetapkan ketika pengembalian diproses.
- finePaid (TINYINT 0/1, legacy) – penanda lama (masih dibaca untuk kompatibilitas). Gunakan `finePaymentStatus` sekarang.
- finePaymentStatus ENUM('unpaid','awaiting_proof','pending_verification','paid') – status workflow pembayaran.
- finePaymentMethod ENUM('bank','qris','cash') – metode pembayaran yang dipilih user.
- finePaymentProof VARCHAR(255) NULL – path bukti pembayaran (jika bank / qris).
- finePaymentAt DATETIME NULL – waktu pembayaran dikonfirmasi (status "paid").
- returnProofUrl VARCHAR(255) NULL – bukti foto siap dikembalikan.
- readyReturnDate DATETIME NULL – kapan user menandai "Siap Dikembalikan".

### Tabel `users` (tambahan)
- denda_unpaid (INT, agregat historis denda pengembalian belum lunas yang tersimpan). Digunakan bersama perhitungan active fine.

### Tabel baru: `fine_payment_notifications`
Digunakan untuk notifikasi admin terhadap pembayaran denda yang butuh verifikasi.
Kolom utama:
- id (PK)
- user_id (FK users.id)
- loan_ids (TEXT JSON array id loan yang dibayar bersama)
- amount_total (INT)
- method (VARCHAR) – metode pembayaran
- proof_url (VARCHAR) – bukti unggah
- status ENUM('pending_verification','paid','rejected')
- created_at TIMESTAMP

## 2. Alur Status Pinjaman (Ringkas)
1. Menunggu Persetujuan → Disetujui → Diambil/Sedang Dipinjam → (Terlambat jika lewat jatuh tempo) → Siap Dikembalikan (user upload foto) → Dikembalikan (admin proses + set fineAmount bila ada) → Selesai (opsional jika tanpa denda) / tetap Dikembalikan (memiliki denda menunggu bayar).

## 3. Alur Status Pembayaran Denda
```
UNPAID (belum inisiasi) 
  └─(user pilih metode bank/qris)
      → AWAITING_PROOF (harus upload bukti)
          └─(user upload bukti)→ PENDING_VERIFICATION (notifikasi admin)
              └─(admin approve) → PAID
              └─(admin reject)  → AWAITING_PROOF (user upload ulang)

UNPAID + pilih metode cash
  └─ langsung → PENDING_VERIFICATION (tanpa bukti file) → (admin verifikasi secara manual) → PAID
```
Catatan: Kolom `finePaid` diset 1 hanya saat final approved (paid). Untuk konsistensi gunakan `finePaymentStatus` di UI baru.

## 4. Perhitungan Denda Aktif (Active Fine)
Endpoint `/profile/active-fine` menghitung:
- runningFine: akumulasi denda berjalan (pinjaman sedang dipinjam & terlambat, dihitung per hari dari selisih tanggal).
- unpaidReturnedFine: nilai `denda_unpaid` dari tabel users (agregat denda pengembalian belum lunas).
- activeFine = runningFine + unpaidReturnedFine.
Dipakai pada UI agar user tahu total liabilitas berjalan.

## 5. Endpoint Utama (User)
- POST `/profile/initiate-fines` body: { loanIds:number[], method:'bank'|'qris'|'cash' }
  - Transition: unpaid → awaiting_proof (bank/qris) atau unpaid → pending_verification (cash)
- POST `/profile/upload-fine-proof` (FormData: loanIds JSON, proof file)
  - awaiting_proof → pending_verification + insert notifikasi
- POST `/profile/pay-fines` (legacy sementara untuk finalize direct – jarang dipakai kecuali scenario khusus)
- GET `/profile/active-fine` – kalkulasi active fine
- POST `/loans/ready-to-return/:loanId` – unggah foto siap dikembalikan
- GET `/books?sort=popular|newest` – filter buku

## 6. Endpoint (Admin)
- GET `/admin/returns/review` – daftar pinjaman siap dikembalikan (lihat bukti)
- POST `/admin/returns/process` – proses pengembalian + set denda (fineAmount) jika perlu
- GET `/admin/fines/pending` – daftar notifikasi pembayaran denda butuh verifikasi
- POST `/admin/fines/verify` body: { notificationId, action:'approve'|'reject' }
  - approve: loans → finePaymentStatus='paid', finePaid=1, finePaymentAt=NOW(), notifikasi → status=paid
  - reject: loans → finePaymentStatus='awaiting_proof', finePaymentProof=NULL, notifikasi → status=rejected
- GET `/admin/users` – kini mengembalikan active_unpaid_fine (agregat) + formatting rupiah di frontend

## 7. Komponen Frontend Baru / Diubah
- BorrowingPage:
  - FinePaymentProofModal (drag & drop, preview, validasi ukuran 5MB, image only)
  - Filter Buku: Semua / Populer / Tahun Terbaru memicu refetch backend dengan query `sort=`
  - Payment Flow: setelah initiate bank/qris → langsung buka modal upload bukti; cash → pesan menunggu verifikasi.
- AdminDashboard:
  - View fine_payments: list notifikasi denda pending + aksi approve / reject
  - Proof Modal: tampilan kartu terpusat dengan gambar dan tombol aksi.

## 8. Diagram Status (Pembayaran Denda)
```
        +----------------+
        |    UNPAID      |
        +--------+-------+
                 | initiate (bank/qris)
                 v
        +--------------------+
        |  AWAITING_PROOF    |
        +----+---------------+
             | upload proof
             v
        +-----------------------+
        |  PENDING_VERIFICATION |
        +-----+----------+------+
              | approve  | reject
              v          v
        +-----------+  +----------------+
        |   PAID    |  | AWAITING_PROOF |
        +-----------+  +----------------+

Cash path: UNPAID --(initiate cash)--> PENDING_VERIFICATION
```

## 9. Validasi & Error Handling Kunci
- Upload bukti: maksimum 5MB, tipe gambar (divalidasi di frontend & file size di backend multer).
- Re-initiate: jika loan sudah paid akan ditolak.
- Reject flow: bukti direset (proof=NULL) dan status kembali awaiting_proof.

## 10. Skenario Uji Manual (Checklist)
1. Pinjam buku → set waktu mundur agar terlambat → proses pengembalian oleh admin dengan fineAmount > 0.
2. User buka tab riwayat, pilih Bayar Denda (metode bank) → modal inisiasi → modal upload bukti tampil.
3. Upload bukti valid → status di kartu loan: "Menunggu Verifikasi".
4. Admin buka fine_payments → preview → Approve → loan status finePaymentStatus='paid'.
5. User refresh: badge denda menjadi Lunas, active fine berkurang.
6. Ulangi dengan metode cash (tanpa upload) → langsung pending_verification → admin approve.
7. Uji reject: admin reject → user kembali ke awaiting_proof dan bisa upload ulang.
8. Filter Buku: tombol Populer & Tahun Terbaru mengubah urutan sesuai data backend.

## 11. Potensi Peningkatan Lanjutan
- Notifikasi real-time (WebSocket) untuk status verifikasi.
- Riwayat detail pembayaran denda terpisah (audit trail).
- Batch return processing di admin.
- Halaman khusus ringkasan denda user (grafik / timeline).

## 12. Ringkasan Kunci
- State utama: finePaymentStatus menggantikan finePaid sebagai indikator modern.
- Endpoint terpisah untuk initiate vs upload proof memudahkan multi-loan bulk payment.
- Notifikasi admin menyatukan banyak loan dalam satu bukti & satu approval.
- Frontend sudah terintegrasi filter & modal bukti baru (drag & drop).

---
Diperbarui: 2025-10-09
