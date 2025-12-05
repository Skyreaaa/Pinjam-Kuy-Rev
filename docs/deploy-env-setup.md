# Deploy & Env Setup (Netlify + Fly.io + Railway)

## Arsitektur
- Front-end: Netlify (React)
- Backend: Fly.io (Express, folder `be-pinjam-rev-main`)
- Database: Railway MySQL

## Environment Variables

### Front-end (Netlify)
Set env di Netlify UI atau lewat CLI:
- `REACT_APP_API_BASE_URL` → `https://<your-fly-app>.fly.dev/api`

Contoh file: `.env.production.example` di root proyek.

### Backend (Fly.io)
Gunakan `.env` di `be-pinjam-rev-main/` (jangan commit rahasia), referensi `.env.example`:
- `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_DATABASE` (dari Railway)
- `JWT_SECRET` (string acak panjang)
- `CORS_ORIGINS` (comma-separated): `https://<your-netlify>.netlify.app,http://localhost:3000`

Opsional (upload persisten):
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`

## CORS
Server telah menggunakan whitelist CORS berdasarkan `CORS_ORIGINS`. Pastikan domain Netlify Anda terdaftar.

## Build & Deploy

### FE → Netlify (via Git)
- Build command: `npm run build`
- Publish dir: `build`
- Env: set `REACT_APP_API_BASE_URL`

### BE → Fly.io
- Arahkan root layanan ke folder `be-pinjam-rev-main`
- Start command: `node server.js`
- Tambahkan env DB & JWT di Fly Secrets atau `fly.toml`
- Fly akan inject `PORT`, server sudah menghormati `process.env.PORT`

### DB → Railway
- Buat MySQL instance
- Ambil host/user/password/database/port lalu masukkan ke env backend

## Catatan Upload
Saat ini upload tersimpan di folder lokal `uploads/`. Di Fly.io storage bersifat ephemeral; gunakan Cloudinary untuk produksi agar file persisten.
