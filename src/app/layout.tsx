// app/layout.tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MENG 2311 Attendance",
  description: "Attendance system for MENG 2311 class",
};

const louize = localFont({
  src: [
    {
      path: "../../public/fonts/louize-regular.otf",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../public/fonts/louize-medium.otf",
      weight: "500",
      style: "normal",
    },
  ],
  variable: "--font-louize",
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`dark ${louize.variable}`}>
      <body className="min-h-screen antialiased font-louize">
        {children}

        {/* Super subtle footer */}
        <footer className="mt-10 text-center text-[10px] text-zinc-500 opacity-90 select-none">
          built by Filippo :). If you have any feedback, please{" "}
          <a href="mailto:filippo.fonseca@yale.edu" className="text-white">
            reach out!
          </a>
        </footer>
      </body>
    </html>
  );
}
