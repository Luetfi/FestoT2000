import type { Metadata } from "next";
import { Suspense } from "react";
import localFont from "next/font/local";
import { Geist_Mono } from "next/font/google";
import { FestoHeader } from "@/components/layout/festo-header";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

// Festo Display Font (for logo)
const festoFont = localFont({
  src: "./fonts/Festo-Bold.ttf",
  variable: "--font-festo",
  weight: "700",
});

// MetaPlusLF Bold for headings
const metaPlusBold = localFont({
  src: "./fonts/MetaPlusLF-Bold.ttf",
  variable: "--font-title",
  weight: "700",
});

// MetaPlusLF Regular for body text
const metaPlusRegular = localFont({
  src: "./fonts/MetaPlusLF-Regular.ttf",
  variable: "--font-body",
  weight: "400",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: 'FESTO Video Search',
  description: 'Find technical video solutions for Festo automation products',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de" suppressHydrationWarning>
      <body
        className={`${festoFont.variable} ${metaPlusBold.variable} ${metaPlusRegular.variable} ${geistMono.variable} antialiased min-w-[1280px]`}
      >
        <ThemeProvider>
          <Suspense fallback={
            <header className="sticky top-0 z-10 bg-background border-b-2 border-[#0091DC]">
              <div className="flex items-center justify-between px-6 py-3">
                <div className="h-8 w-24 bg-muted animate-pulse rounded" />
                <div className="h-8 w-48 bg-muted animate-pulse rounded" />
              </div>
            </header>
          }>
            <FestoHeader />
          </Suspense>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
