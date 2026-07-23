"use client";

import { PageHeader, Card, SectionTitle, DataState, Badge } from "@/components/ui";
import { useJson } from "@/lib/useJson";
import { compact, mult, num } from "@/lib/format";
import { VERDICT_META, type Meta, type HypothesesData } from "@/lib/types";
import type { ExposureData } from "@/lib/types";

export default function OverviewPage() {
  const meta = useJson<Meta>("meta");
  const hyp = useJson<HypothesesData>("hypotheses");
  const exposure = useJson<ExposureData>("exposure");

  return (
    <div className="mx-auto max-w-6xl animate-rise">
      <PageHeader
        eyebrow="개요"
        title="날씨는 서울의 교통사고를 어떻게 바꾸는가"
        subtitle="2007–2025년 서울시 중상·사망 교통사고 약 20만 건을 계절·비·눈 관점에서 분석합니다. 네 개의 가설(H1~H4)을 데이터로 검증한 결과를 아래에 요약했습니다."
      />

      {/* KPI 카드 */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <DataState state={meta} height={104}>
          {(m) => (
            <>
              <Kpi label="총 사고" value={compact(m.totalAccidents)} unit="건" tone="accent" />
              <Kpi label="사망자" value={num(m.totalDeaths)} unit="명" tone="critical" />
              <Kpi label="중상자" value={compact(m.totalSeriousInjuries)} unit="명" tone="warning" />
            </>
          )}
        </DataState>
        <DataState state={exposure} height={104}>
          {(e) => (
            <Kpi
              label="비 올 때 하루당 사고"
              value={mult(e.overall?.rainMultiple)}
              unit="맑은 날 대비"
              tone="rain"
            />
          )}
        </DataState>
      </section>

      {/* 오늘의 위험도 위젯 자리 (Stage B에서 Open-Meteo 연동) */}
      <div className="mt-3">
        <Card>
          <SectionTitle
            title="오늘의 위험도"
            hint="Open-Meteo로 서울 현재 날씨를 조회해 과거 통계상 위험 배율을 표시합니다. 예측이 아닌 과거 통계 조회입니다."
            right={<Badge tone="accent">준비 중</Badge>}
          />
          <div className="grid h-24 place-items-center rounded-xl border border-dashed border-border text-[12px] text-muted">
            데이터 배선 후 활성화됩니다 (AC-15)
          </div>
        </Card>
      </div>

      {/* 가설 요약 카드 4장 (AC-13) */}
      <section className="mt-6">
        <SectionTitle
          title="가설 검증 요약"
          hint="각 가설의 판정은 파이프라인이 결정적으로 산출합니다 (수동 판정 아님)."
        />
        <DataState state={hyp} height={220} emptyHint="hypotheses.json 산출 후 H1~H4 판정이 표시됩니다.">
          {(h) => (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {h.results.map((r) => {
                const v = VERDICT_META[r.verdict];
                return (
                  <Card key={r.id} className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <Badge tone="accent">{r.id}</Badge>
                      <Badge tone={v.tone}>
                        {v.icon} {v.label}
                      </Badge>
                    </div>
                    <p className="text-[13px] font-semibold leading-snug text-primary">{r.title}</p>
                    <div className="mt-auto">
                      <p className="text-[11px] text-muted">{r.keyMetric.label}</p>
                      <p className="text-[18px] font-bold text-primary tnum">{r.keyMetric.value}</p>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </DataState>
      </section>
    </div>
  );
}

function Kpi({
  label,
  value,
  unit,
  tone = "accent",
}: {
  label: string;
  value: string;
  unit?: string;
  tone?: "accent" | "critical" | "warning" | "rain";
}) {
  const bar: Record<string, string> = {
    accent: "bg-accent",
    critical: "bg-sev-fatal",
    warning: "bg-sev-serious",
    rain: "bg-w-rain",
  };
  return (
    <Card className="relative overflow-hidden">
      <span className={`absolute left-0 top-0 h-full w-1 ${bar[tone]}`} />
      <p className="text-[12px] font-medium text-secondary">{label}</p>
      <p className="mt-1.5 text-[26px] font-bold leading-none text-primary tnum">{value}</p>
      {unit && <p className="mt-1 text-[11px] text-muted">{unit}</p>}
    </Card>
  );
}
