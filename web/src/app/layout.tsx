import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import "./globals.css";
import { AppShell } from "@/components/AppShell";

export const metadata: Metadata = {
  title: {
    default: "날씨와 서울 교통사고 대시보드",
    template: "%s · 날씨와 서울 교통사고 대시보드",
  },
  description:
    "2007–2025 서울시 중상·사망 교통사고 20만 건을 날씨(계절·비·눈) 관점에서 분석하는 인터랙티브 대시보드. 가설 H1~H4를 데이터로 검증합니다.",
  applicationName: "날씨와 서울 교통사고 대시보드",
  icons: { icon: "/favicon.ico" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0b0e14" },
    { media: "(prefers-color-scheme: light)", color: "#f4f6f9" },
  ],
  width: "device-width",
  initialScale: 1,
};

// 하이드레이션 전 테마 적용(플래시 방지). 다크가 기본.
const themeInit = `(function(){try{var t=localStorage.getItem('theme');var d=document.documentElement;if(t==='light'){d.classList.remove('dark');}else{d.classList.add('dark');}}catch(e){document.documentElement.classList.add('dark');}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="dark h-full" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body className="min-h-full">
        <Suspense fallback={null}>
          <AppShell>{children}</AppShell>
        </Suspense>
      </body>
    </html>
  );
}
