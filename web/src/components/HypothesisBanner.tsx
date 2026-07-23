"use client";

import { useJson } from "@/lib/useJson";
import { VERDICT_META, type HypothesesData, type HypothesisId } from "@/lib/types";
import { dec } from "@/lib/format";

/**
 * 가설 배너 (AC-12) — 각 분석 페이지 상단.
 * "가설 Hn: … → 데이터 판정: 지지/부분 지지/기각" + 근거 수치(evidence) + 해석(caveat).
 * hypotheses.json 소비. 미배선 시 가설 문장만 우아하게 표시.
 */
export function HypothesisBanner({ id, fallbackTitle }: { id: HypothesisId; fallbackTitle: string }) {
  const hyp = useJson<HypothesesData>("hypotheses");
  const result =
    hyp.status === "ready" ? hyp.data.hypotheses.find((r) => r.id === id) : undefined;
  const v = result ? VERDICT_META[result.verdict] : null;

  const toneRing: Record<string, string> = {
    good: "border-good/40",
    warning: "border-warning/40",
    critical: "border-critical/40",
  };
  const toneChip: Record<string, string> = {
    good: "bg-good/15 text-good",
    warning: "bg-warning/15 text-warning",
    critical: "bg-critical/15 text-critical",
  };

  const fmt = (n: number, unit: string | null) =>
    `${Number.isInteger(n) ? n.toLocaleString("ko-KR") : dec(n, n < 10 ? 3 : 1)}${unit ?? ""}`;

  return (
    <div
      className={[
        "mb-6 rounded-2xl border bg-surface/70 px-4 py-3.5 backdrop-blur",
        v ? toneRing[v.tone] : "border-border",
      ].join(" ")}
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-accent-soft text-[12px] font-bold text-accent">
          {id}
        </span>
        <p className="min-w-0 flex-1 text-[13.5px] font-medium leading-snug text-primary">
          <span className="text-muted">가설 </span>
          {result?.title ?? fallbackTitle}
        </p>
        {v && result ? (
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-[12px] text-muted">데이터 판정</span>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12.5px] font-bold ${toneChip[v.tone]}`}
            >
              {v.icon} {v.label}
            </span>
            <span className="hidden text-[12px] text-secondary sm:inline tnum">
              {result.metric_name} {result.metric_value}
            </span>
          </div>
        ) : (
          <span className="rounded-full bg-surface-3 px-3 py-1 text-[11.5px] font-semibold text-muted">
            판정 대기 중
          </span>
        )}
      </div>

      {result && (result.evidence.length > 0 || result.caveat) && (
        <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1.5 border-t border-border pt-2.5">
          {result.evidence.map((e) => (
            <span
              key={e.label}
              className="inline-flex items-baseline gap-1 rounded-md bg-surface-2 px-2 py-0.5 text-[11px]"
            >
              <span className="text-muted">{e.label}</span>
              <span className="font-semibold text-secondary tnum">{fmt(e.value, e.unit)}</span>
            </span>
          ))}
          {result.caveat && (
            <span className="ml-auto max-w-full text-[11px] leading-snug text-muted">
              {result.caveat}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
