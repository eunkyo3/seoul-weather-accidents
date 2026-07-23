"use client";

import type { ReactNode } from "react";
import type { LoadState } from "@/lib/useJson";

/** 카드 컨테이너 */
export function Card({
  children,
  className = "",
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "section" | "article";
}) {
  return <Tag className={`card p-5 ${className}`}>{children}</Tag>;
}

/** 페이지 헤더 */
export function PageHeader({
  title,
  subtitle,
  eyebrow,
  actions,
}: {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && (
          <p className="mb-1 text-[11.5px] font-semibold uppercase tracking-wider text-accent">
            {eyebrow}
          </p>
        )}
        <h1 className="text-[22px] font-bold leading-tight text-primary sm:text-[26px]">{title}</h1>
        {subtitle && <p className="mt-1.5 max-w-2xl text-[13.5px] leading-relaxed text-secondary">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

/** 섹션 제목 + 설명 */
export function SectionTitle({
  title,
  hint,
  right,
}: {
  title: string;
  hint?: string;
  right?: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-start justify-between gap-3">
      <div>
        <h2 className="text-[15px] font-bold text-primary">{title}</h2>
        {hint && <p className="mt-0.5 text-[12px] leading-relaxed text-muted">{hint}</p>}
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  );
}

/** 뱃지 */
export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "good" | "warning" | "critical" | "accent";
}) {
  const tones: Record<string, string> = {
    neutral: "bg-surface-3 text-secondary",
    good: "bg-good/15 text-good",
    warning: "bg-warning/15 text-warning",
    critical: "bg-critical/15 text-critical",
    accent: "bg-accent-soft text-accent",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

/** 차트 스켈레톤 */
export function ChartSkeleton({ height = 320 }: { height?: number }) {
  return <div className="skeleton w-full" style={{ height }} aria-hidden />;
}

/** 로딩/빈/에러 상태 래퍼 — 데이터 상태에 따라 자식 렌더 */
export function DataState<T>({
  state,
  height = 320,
  children,
  emptyHint = "데이터 파이프라인 산출물이 아직 준비되지 않았습니다.",
}: {
  state: LoadState<T>;
  height?: number;
  children: (data: T) => ReactNode;
  emptyHint?: string;
}) {
  if (state.status === "loading") return <ChartSkeleton height={height} />;
  if (state.status === "empty")
    return (
      <div
        className="grid place-items-center rounded-xl border border-dashed border-border bg-surface-2/50 px-6 text-center"
        style={{ height }}
      >
        <div className="max-w-xs space-y-1.5">
          <div className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-surface-3 text-muted">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M4 7h16M4 12h16M4 17h10"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <p className="text-[13px] font-semibold text-secondary">데이터 대기 중</p>
          <p className="text-[11.5px] leading-relaxed text-muted">{emptyHint}</p>
        </div>
      </div>
    );
  if (state.status === "error")
    return (
      <div
        className="grid place-items-center rounded-xl border border-critical/30 bg-critical/5 px-6 text-center"
        style={{ height }}
      >
        <div className="space-y-1">
          <p className="text-[13px] font-semibold text-critical">데이터를 불러오지 못했습니다</p>
          <p className="text-[11.5px] text-muted">{state.error}</p>
        </div>
      </div>
    );
  return <>{children(state.data)}</>;
}
