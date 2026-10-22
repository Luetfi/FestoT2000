import type { Metadata } from "next";
import localFont from "next/font/local";
import { Geist_Mono } from "next/font/google";
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
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
