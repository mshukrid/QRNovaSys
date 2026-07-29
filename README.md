# QRNova Lab

Aplikasi web mudah alih untuk pengurusan makmal:

- Buku Log Makmal — kehadiran dan aktiviti harian
- KEW.PA-9 — permohonan pergerakan atau pinjaman aset alih
- MCCB Test Report — data ujian *opening under overload conditions*
- Dashboard ringkasan, carian dan rekod terkini

## Pembangunan

Keperluan: Node.js 22 atau lebih baharu.

```bash
pnpm install
pnpm dev
```

Semak binaan:

```bash
pnpm build
```

GitHub Actions menerbitkan versi statik ke GitHub Pages setiap kali cabang
`main` dikemas kini.

## Penyimpanan data

Versi semasa menyimpan rekod pada pelayar sebagai perlindungan luar talian.
Sambungan Google Drive masa nyata memerlukan Google OAuth Web Client ID atau
Google Apps Script endpoint.
