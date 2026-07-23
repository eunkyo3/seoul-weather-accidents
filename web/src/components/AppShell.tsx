"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeProvider } from "@/lib/theme";
import { FilterProvider } from "@/lib/filters";
import { NAV } from "@/lib/nav";
import { ThemeToggle } from "./ThemeToggle";

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function Brand() {
  return (
    <Link href="/" className="group flex items-center gap-2.5" aria-label="홈으로">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-accent text-white shadow-sm">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M7 16a4 4 0 010-8 5 5 0 019.6 1.3A3.5 3.5 0 0116 16z"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
          <path d="M9 19l-1 2M13 19l-1 2M17 19l-1 2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
      </span>
      <span className="flex flex-col leading-tight">
        <span className="text-[13px] font-bold text-primary">날씨 × 서울 교통사고</span>
        <span className="text-[11px] text-muted">2007–2025 인터랙티브 대시보드</span>
      </span>
    </Link>
  );
}

function NavLinks({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-1" aria-label="주요 화면">
      {NAV.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={[
              "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors",
              active
                ? "bg-accent-soft text-primary"
                : "text-secondary hover:bg-surface-2 hover:text-primary",
            ].join(" ")}
          >
            {active && (
              <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-accent" />
            )}
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden
              className={active ? "text-accent" : "text-muted group-hover:text-secondary"}
            >
              <path d={item.icon} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="flex flex-1 flex-col leading-tight">
              <span className="flex items-center gap-1.5 text-[13.5px] font-semibold">
                {item.label}
                {item.hypothesis && (
                  <span
                    className={[
                      "rounded px-1 py-px text-[9.5px] font-bold tracking-wide",
                      active ? "bg-accent/20 text-accent" : "bg-surface-3 text-muted",
                    ].join(" ")}
                  >
                    {item.hypothesis}
                  </span>
                )}
              </span>
              <span className="text-[11px] text-muted">{item.desc}</span>
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

function Footer() {
  return (
    <div className="mt-auto space-y-1 border-t border-border px-1 pt-4 text-[10.5px] leading-relaxed text-muted">
      <p>사고: 도로교통공단 · 중상+사망 한정 · 월 단위</p>
      <p>기상: 기상청 기상자료개방포털(서울 108)</p>
      <p>경계: southkorea/seoul-maps · 실시간: Open-Meteo</p>
      <p className="pt-1 text-muted/80">상관 관계이며 인과가 아님</p>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <ThemeProvider>
      <FilterProvider>
        <div className="min-h-dvh lg:grid lg:grid-cols-[264px_1fr]">
          {/* 데스크톱 사이드바 */}
          <aside className="sticky top-0 hidden h-dvh flex-col gap-6 border-r border-border bg-surface/60 px-4 py-5 backdrop-blur-xl lg:flex">
            <Brand />
            <NavLinks pathname={pathname} />
            <Footer />
          </aside>

          {/* 모바일 상단바 */}
          <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-border bg-surface/80 px-4 py-3 backdrop-blur-xl lg:hidden">
            <Brand />
            <ThemeToggle />
          </header>

          <div className="flex min-w-0 flex-col">
            {/* 데스크톱 상단 유틸바 */}
            <div className="sticky top-0 z-20 hidden items-center justify-end gap-3 border-b border-border bg-page/70 px-6 py-3 backdrop-blur-xl lg:flex">
              <span className="text-[11px] text-muted">빅데이터 기획 PBL · 가설 검증 대시보드</span>
              <ThemeToggle />
            </div>

            {/* 모바일 가로 스크롤 내비 */}
            <div className="scrollbar-none flex gap-2 overflow-x-auto border-b border-border bg-page/70 px-4 py-2.5 backdrop-blur-xl lg:hidden">
              {NAV.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={[
                      "whitespace-nowrap rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors",
                      active
                        ? "bg-accent text-white"
                        : "bg-surface-2 text-secondary hover:text-primary",
                    ].join(" ")}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>

            <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
          </div>
        </div>
      </FilterProvider>
    </ThemeProvider>
  );
}
