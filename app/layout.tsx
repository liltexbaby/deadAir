import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
  title: "deadAir",
  description:
    "deadAir is a multidisciplinary & independent label. Betting on human achievement since 2021.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Lets the fixed header sit under the notch and reach the screen edges; the
  // safe-area insets in globals.css keep content clear of it.
  viewportFit: "cover",
  // Matches the sky tone at the top of public/foggy-street.jpg.
  themeColor: "#cccccf",
  // Deliberately NOT setting maximumScale/userScalable — blocking pinch-zoom is
  // an accessibility regression.
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
