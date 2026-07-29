import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "QRNova Lab — Sistem Pengurusan Makmal",
  description: "Buku log makmal, pinjaman aset KEW.PA-9 dan laporan ujian MCCB dalam satu aplikasi.",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ms"><body>{children}</body></html>;
}
