"use client";

import { useJson } from "@/lib/useJson";
import { VERDICT_META, type HypothesesData, type HypothesisId } from "@/lib/types";

/**
 * 가설 배너 (AC-12) — 각 분석 페이지 상단.
 * "가설 Hn: … → 데이터 판정: 지지/부분 지지/기각 (근거 수치)"
 * hypotheses.json 소비. 데이터 미배선 시 가설 문장만 우아하게 표시.
 */
export function HypothesisBanner({ id, fallbackTitle }: { id: HypothesisId; fallbackTitle: string }) {
  const hyp = useJson<HypothesesData>("hypotheses");
  const result =
    hyp.status === "ready" ? hyp.data.results.find((r) => r.id === id) : undefined;
  const v = result ? VERDICT_META[result.verdict] : null;

  const toneRing: Record<string, string> = {
    good: "border-good/40",
    warning: "border-warning/40",
    critical: "border-critical/40",
  };

  return (
    <div
      className={[
        "mb-6 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border bg-surface/70 px-4 py-3.5 backdrop-blur",
        v ? toneRing[v.tone] : "border-border",
      ].join(" ")}
    >
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-accent-soft text-[12px] font-bold text-accent">
        {id}
      </span>
      <p className="min-w-0 flex-1 text-[13.5px] font-medium leading-snug text-primary">
        <span className="text-muted">가설 </span>
        {result?.title ?? fallbackTitle}
      </p>
      {v ? (
        <div className="flex items-center gap-2.5">
          <span className="text-[12px] text-muted">데이터 판정</span>
          <span
            className={[
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12.5px] font-bold",
              v.tone === "good"
                ? "bg-good/15 text-good"
                : v.tone === "warning"
                  ? "bg-warning/15 text-warning"
                  : "bg-critical/15 text-critical",
            ].join(" ")}
            title={result?.rationale}
          >
            {v.icon} {v.label}
          </span>
          {result && (
            <span className="hidden text-[12px] text-secondary sm:inline tnum">
              {result.keyMetric.label} {result.keyMetric.value}
            </span>
          )}
        </div>
      ) : (
        <span className="rounded-full bg-surface-3 px-3 py-1 text-[11.5px] font-semibold text-muted">
          판정 대기 중
        </span>
      )}
    </div>
  );
}
