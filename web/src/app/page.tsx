"use client";

import Link from "next/link";
import { useMemo } from "react";
import { PageHeader, Card, SectionTitle, DataState, Badge } from "@/components/ui";
import { EChart } from "@/components/EChart";
import { TodayRisk } from "@/components/TodayRisk";
import { useJson } from "@/lib/useJson";
import { useTheme } from "@/lib/theme";
import { baseOption, catAxis, valAxis, type EChartsCoreOption } from "@/lib/echarts";
import { CHROME, WEATHER_COLORS } from "@/lib/palette";
import { compact, mult, num, dec } from "@/lib/format";
import { VERDICT_META, type Meta, type HypothesesData, type ExposureData } from "@/lib/types";

const GROUPS = [
  { key: "clear" as const, label: "맑음군" },
  { key: "rain" as const, label: "비" },
  { key: "snow" as const, label: "눈" },
];

export default function OverviewPage() {
  const meta = useJson<Meta>("meta");
  const hyp = useJson<HypothesesData>("hypotheses");
  const exposure = useJson<ExposureData>("exposure");
  const { mode } = useTheme();

  const rateOption = useMemo<EChartsCoreOption | null>(() => {
    if (exposure.status !== "ready") return null;
    const p = exposure.data.pooled;
    const c = CHROME[mode];
    const wc = WEATHER_COLORS[mode];
    const repr = { clear: 1, rain: p.rain_repr, snow: p.snow_repr };
    const rate = { clear: p.clear_rate, rain: p.rain_rate, snow: p.snow_rate };
    return {
      ...baseOption(mode),
      tooltip: {
        ...(baseOption(mode).tooltip as object),
        trigger: "axis",
        axisPointer: { type: "shadow" },
        formatter: (params: Array<{ dataIndex: number }>) => {
          const g = GROUPS[params[0].dataIndex];
          return `${g.label}<br/>노출 보정 대표비 <b>${mult(repr[g.key])}</b><br/><span style="color:${c.muted}">하루당 사고율 ${dec(rate[g.key], 2)} 건/일</span>`;
        },
      },
      legend: { show: false },
      grid: { left: 8, right: 20, top: 24, bottom: 8, containLabel: true },
      xAxis: { type: "category", data: GROUPS.map((g) => g.label), ...catAxis(mode) },
      yAxis: {
        type: "value",
        ...valAxis(mode),
        name: "대표비 (맑음군=1.0)",
        nameTextStyle: { color: c.muted, fontSize: 10 },
      },
      series: [
        {
          type: "bar",
          barWidth: "46%",
          itemStyle: {
            borderRadius: [6, 6, 0, 0],
            color: (pp: { dataIndex: number }) => wc[GROUPS[pp.dataIndex].key],
          },
          markLine: {
            symbol: "none",
            silent: true,
            lineStyle: { color: c.muted, type: "dashed", width: 1 },
            label: { formatter: "1.0", color: c.muted, fontSize: 10, position: "insideEndTop" },
            data: [{ yAxis: 1 }],
          },
          label: {
            show: true,
            position: "top",
            fontSize: 12,
            fontWeight: "bold",
            color: c.textPrimary,
            formatter: (pp: { dataIndex: number }) => {
              const g = GROUPS[pp.dataIndex];
              return g.key === "clear" ? "1.0배" : mult(repr[g.key]);
            },
          },
          data: GROUPS.map((g) => repr[g.key]),
        },
      ],
    };
  }, [exposure, mode]);

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
              <Kpi label="총 사고" value={compact(m.totals.accidents)} unit="건 (중상+사망)" tone="accent" />
              <Kpi label="사망자" value={num(m.totals.deaths)} unit="명" tone="critical" />
              <Kpi label="중상자" value={compact(m.totals.serious)} unit="명" tone="warning" />
            </>
          )}
        </DataState>
        <DataState state={exposure} height={104}>
          {(e) => (
            <Kpi
              label="비 오는 날 심각사고"
              value={mult(e.pooled.rain_repr, 2)}
              unit={e.pooled.rain_repr < 1 ? "일수 대비 · 예상과 반대(분모 민감)" : "일수 대비 · 맑은 날 기준"}
              tone="rain"
            />
          )}
        </DataState>
      </section>

      {/* 오늘의 위험도 위젯 (AC-15) */}
      <div className="mt-3">
        <TodayRisk />
      </div>

      {/* 하이라이트 + 가설 요약 */}
      <section className="mt-3 grid gap-3 lg:grid-cols-[1fr_1.1fr]">
        <Card>
          <SectionTitle title="기상별 노출 보정 대표비" hint="사고 점유율 ÷ 일수 점유율 · 1.0보다 크면 더 위험" />
          <DataState state={exposure} height={260}>
            {() => rateOption && <EChart option={rateOption} height={260} notMerge aria-label="기상별 하루당 사고율" />}
          </DataState>
        </Card>

        <Card>
          <SectionTitle
            title="가설 검증 요약"
            hint="판정은 파이프라인이 결정적으로 산출 (수동 아님)"
          />
          <DataState state={hyp} height={260} emptyHint="hypotheses.json 산출 후 H1~H4 판정이 표시됩니다.">
            {(h) => (
              <div className="grid gap-2.5 sm:grid-cols-2">
                {h.hypotheses.map((r) => {
                  const v = VERDICT_META[r.verdict];
                  const href = { H1: "/trend", H2: "/weather", H3: "/map", H4: "/cross" }[r.id];
                  return (
                    <Link
                      key={r.id}
                      href={href}
                      className="group flex flex-col gap-1.5 rounded-xl border border-border bg-surface-2 p-3 transition-colors hover:border-accent/50"
                    >
                      <div className="flex items-center justify-between">
                        <Badge tone="accent">{r.id}</Badge>
                        <Badge tone={v.tone}>
                          {v.icon} {v.label}
                        </Badge>
                      </div>
                      <p className="text-[12.5px] font-semibold leading-snug text-primary">{r.title}</p>
                      <p className="mt-auto text-[11px] text-muted">
                        {r.metric_name} <span className="font-bold text-secondary tnum">{r.metric_value}</span>
                      </p>
                    </Link>
                  );
                })}
              </div>
            )}
          </DataState>
        </Card>
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
