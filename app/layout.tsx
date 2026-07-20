import type { Metadata, Viewport } from "next";
import { Black_Han_Sans, IBM_Plex_Sans_KR } from "next/font/google";
import { PwaRegister } from "./pwa-register";
import "./globals.css";

const display = Black_Han_Sans({
  variable: "--font-display",
  weight: "400",
  subsets: ["latin"],
});

const body = IBM_Plex_Sans_KR({
  variable: "--font-body",
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "하이라이트 리그 2045",
  description: "미래 야구 카드게임을 모바일과 데스크톱에서 즐기는 디지털 프로토타입",
  applicationName: "하이라이트 리그 2045",
  manifest: "/manifest.webmanifest",
  formatDetection: {
    telephone: false,
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "리그 2045",
  },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    shortcut: "/favicon.svg",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  colorScheme: "dark",
  themeColor: "#0a151b",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body className={`${display.variable} ${body.variable}`}>
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
