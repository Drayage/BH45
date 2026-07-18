import type { Metadata } from "next";
import { Black_Han_Sans, IBM_Plex_Sans_KR } from "next/font/google";
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
  description: "원작 카드 밸런스를 보존한 비공개 디지털 야구 카드게임 프로토타입",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body className={`${display.variable} ${body.variable}`}>{children}</body>
    </html>
  );
}
