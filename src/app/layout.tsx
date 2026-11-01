import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Poker Tongkrongan Online — Aturan Kumpul 3 & Bom Poker",
  description:
    "Game kartu online multiplayer 2-4 pemain dengan aturan khas tongkrongan: Kumpul Angka 3 (3 Sekop jalan awal), Seri Sejenis, Full House, dan Bom Poker!",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body className="antialiased min-h-screen">{children}</body>
    </html>
  );
}

