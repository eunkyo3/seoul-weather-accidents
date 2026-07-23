"use client";

import { useMemo } from "react";
import { PageHeader, Card, SectionTitle, DataState, Badge } from "@/components/ui";
import { HypothesisBanner } from "@/components/HypothesisBanner";
import { FilterBar } from "@/components/FilterBar";
import { EChart } from "@/components/EChart";
import { useJson } from "@/lib/useJson";
import { useFilters } from "@/lib/filters";
import { useTheme } from "@/lib/theme";
import { baseOption, catAxis, valAxis, type EChartsCoreOption } from "@/lib/echarts";
import { CHROME, WEATHER_COLORS, SEVERITY_COLORS } from "@/lib/palette";
import { inYear, weatherGroup } from "@/lib/agg";
import { dec, mult, num } from "@/lib/format";
import type { WeatherData, ExposureData } from "@/lib/types";

const GROUPS = [
  { key: "clear" as const, label: "맑음군" },
  { key: "rain" as const, label: "비" },
  { key: "snow" as const, label: "눈" },
];

export default function WeatherPage() {
  const weather = useJson<WeatherData>("weather");
  const exposure = useJson<ExposureData>("exposure");
  const f = useFilters();
  const { mode } = useTheme();
  const wc = WEATHER_COLORS[mode];

  // 노출 보정 지표. 전체 연도면 권위 있는 pooled 사용(정의와 일치),
  // 부분 범위면 monthly 재집계. 대표비(repr)=사고 점유율÷일수 점유율이 정본 지표.
  const rates = useMemo(() => {
    if (exposure.status !== "ready") return null;
    const fullRange = f.yearRange[0] === 2007 && f.yearRange[1] === 2025;
    if (fullRange) {
      const p = exposure.data.pooled;
      return {
        clear: { rate: p.clear_rate, repr: 1 },
        rain: { rate: p.rain_rate, repr: p.rain_repr },
        snow: { rate: p.snow_rate, repr: p.snow_repr },
      };
    }
    let ra = 0,
      rd = 0,
      sa = 0,
      sd = 0,
      ca = 0,
      cd = 0;
    for (const m of exposure.data.monthly) {
      if (!inYear(m.year, f.yearRange)) continue;
      ra += m.rain_acc;
      rd += m.rain_days;
      sa += m.snow_acc;
      sd += m.snow_days;
      ca += m.clear_acc;
      cd += m.clear_denom_days;
    }
    const clearRate = cd ? ca / cd : 0;
    const rainRate = rd ? ra / rd : 0;
    const snowRate = sd ? sa / sd : 0;
    // 대표비 = (조건 사고/전체 사고) ÷ (조건 일수/전체 일수). 전체 일수 ≈ Σ(강수+눈+맑음군 분모일수)
    const totalAcc = ra + sa + ca;
    const totalDays = rd + sd + cd;
    const repr = (acc: number, days: number) =>
      totalAcc && days && totalDays ? acc / totalAcc / (days / totalDays) : 0;
    return {
      clear: { rate: clearRate, repr: 1 },
      rain: { rate: rainRate, repr: repr(ra, rd) },
      snow: { rate: snowRate, repr: repr(sa, sd) },
    };
  }, [exposure, f.yearRange]);

  // 절대 건수 (그룹별) — weather.monthly 를 연도 필터로 합산
  const counts = useMemo(() => {
    if (weather.status !== "ready") return null;
    const g = { clear: 0, rain: 0, snow: 0 };
    for (const r of weather.data.monthly) {
      if (!inYear(r.year, f.yearRange)) continue;
      g[weatherGroup(r.weather)] += r.count;
    }
    return g;
  }, [weather, f.yearRange]);

  const countOption = useMemo<EChartsCoreOption | null>(() => {
    if (!counts) return null;
    const total = counts.clear + counts.rain + counts.snow || 1;
    return {
      ...baseOption(mode),
      tooltip: {
        ...(baseOption(mode).tooltip as object),
        trigger: "axis",
        axisPointer: { type: "shadow" },
        valueFormatter: (v: number) => `${num(v)}건`,
      },
      legend: { show: false },
      grid: { left: 8, right: 24, top: 16, bottom: 8, containLabel: true },
      xAxis: { type: "category", data: GROUPS.map((g) => g.label), ...catAxis(mode) },
      yAxis: { type: "value", ...valAxis(mode) },
      series: [
        {
          type: "bar",
          barWidth: "46%",
          itemStyle: {
            borderRadius: [6, 6, 0, 0],
            color: (p: { dataIndex: number }) => wc[GROUPS[p.dataIndex].key],
          },
          label: {
            show: true,
            position: "top",
            color: CHROME[mode].textSecondary,
            fontSize: 11,
            formatter: (p: { value: number }) => `${((p.value / total) * 100).toFixed(1)}%`,
          },
          data: GROUPS.map((g) => counts[g.key]),
        },
      ],
    };
  }, [counts, mode, wc]);

  const rateOption = useMemo<EChartsCoreOption | null>(() => {
    if (!rates) return null;
    const c = CHROME[mode];
    const data = GROUPS.map((g) => rates[g.key].repr);
    return {
      ...baseOption(mode),
      tooltip: {
        ...(baseOption(mode).tooltip as object),
        trigger: "axis",
        axisPointer: { type: "shadow" },
        formatter: (params: Array<{ dataIndex: number }>) => {
          const g = GROUPS[params[0].dataIndex];
          return `${g.label}<br/>노출 보정 대표비 <b>${mult(rates[g.key].repr)}</b><br/><span style="color:${c.muted}">하루당 사고율 ${dec(rates[g.key].rate, 2)} 건/일</span>`;
        },
      },
      legend: { show: false },
      grid: { left: 8, right: 24, top: 28, bottom: 8, containLabel: true },
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
            color: (p: { dataIndex: number }) => wc[GROUPS[p.dataIndex].key],
          },
          markLine: {
            symbol: "none",
            silent: true,
            lineStyle: { color: c.muted, type: "dashed", width: 1 },
            label: { formatter: "1.0 (맑음군)", color: c.muted, fontSize: 10, position: "insideEndTop" },
            data: [{ yAxis: 1 }],
          },
          label: {
            show: true,
            position: "top",
            fontSize: 12,
            fontWeight: "bold",
            color: c.textPrimary,
            formatter: (p: { dataIndex: number }) => {
              const g = GROUPS[p.dataIndex];
              return g.key === "clear" ? "기준 1.0배" : mult(rates[g.key].repr);
            },
          },
          data,
        },
      ],
    };
  }, [rates, mode, wc]);

  const surfaceOption = useMemo<EChartsCoreOption | null>(() => {
    if (weather.status !== "ready") return null;
    const sev = SEVERITY_COLORS[mode];
    const surfaces = [...new Set(weather.data.surface_by_severity.map((r) => r.surface))];
    const bySurface = (content: string) =>
      surfaces.map(
        (s) =>
          weather.data.surface_by_severity.find((r) => r.surface === s && r.content === content)
            ?.count ?? 0,
      );
    return {
      ...baseOption(mode),
      tooltip: {
        ...(baseOption(mode).tooltip as object),
        trigger: "axis",
        axisPointer: { type: "shadow" },
      },
      legend: {
        ...(baseOption(mode).legend as object),
        data: ["중상사고", "사망사고"],
        top: 0,
        right: 0,
      },
      grid: { left: 8, right: 16, top: 32, bottom: 8, containLabel: true },
      xAxis: { type: "category", data: surfaces, ...catAxis(mode), axisLabel: { ...catAxis(mode).axisLabel, interval: 0, rotate: surfaces.length > 5 ? 24 : 0 } },
      yAxis: { type: "value", ...valAxis(mode) },
      series: [
        {
          name: "중상사고",
          type: "bar",
          stack: "sev",
          itemStyle: { color: sev.serious, borderRadius: [0, 0, 0, 0] },
          data: bySurface("중상사고"),
        },
        {
          name: "사망사고",
          type: "bar",
          stack: "sev",
          itemStyle: { color: sev.fatal, borderRadius: [4, 4, 0, 0] },
          data: bySurface("사망사고"),
        },
      ],
    };
  }, [weather, mode]);

  return (
    <div className="mx-auto max-w-6xl animate-rise">
      <PageHeader
        eyebrow="기상 분석"
        title="맑은 날 vs 비·눈 오는 날"
        subtitle="절대 건수만 보면 맑은 날 사고가 압도적입니다. 날씨별 일수로 노출 보정한 대표비(사고 점유율 ÷ 일수 점유율)로 봐야 공정하게 비교됩니다."
      />
      <HypothesisBanner id="H2" fallbackTitle="비·눈 오는 날은 맑은 날보다 하루당 사고율이 높다" />
      <FilterBar />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionTitle title="기상별 절대 건수" hint="막대 위 숫자는 전체 대비 비중 — 맑음군이 대부분" />
          <DataState state={weather} height={330}>
            {() => countOption && <EChart option={countOption} height={330} notMerge aria-label="기상별 절대 건수" />}
          </DataState>
        </Card>
        <Card>
          <SectionTitle
            title="노출 보정 대표비"
            hint="사고 점유율 ÷ 일수 점유율. 1.0보다 크면 그 날씨에 사고가 과대표집(더 위험)"
            right={rates ? <Badge tone="accent">비 {mult(rates.rain.repr)}</Badge> : undefined}
          />
          <DataState state={exposure} height={330}>
            {() => rateOption && <EChart option={rateOption} height={330} notMerge aria-label="노출 보정 대표비" />}
          </DataState>
          {rates && (
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border pt-2.5 text-[11px] text-muted">
              <span className="font-semibold text-secondary">보조 · 하루당 사고율(건/일)</span>
              <span>
                맑음군 <b className="text-primary tnum">{dec(rates.clear.rate, 2)}</b>
              </span>
              <span>
                비 <b className="text-primary tnum">{dec(rates.rain.rate, 2)}</b>
              </span>
              <span>
                눈 <b className="text-primary tnum">{dec(rates.snow.rate, 2)}</b>
              </span>
              <span className="text-muted">— 라벨 편향으로 판정엔 대표비 사용</span>
            </div>
          )}
        </Card>
        <Card className="lg:col-span-2">
          <SectionTitle title="노면상태 × 심각도" hint="노면 상태별 중상·사망 사고 (누적 막대)" />
          <DataState state={weather} height={300}>
            {() =>
              surfaceOption && <EChart option={surfaceOption} height={300} notMerge aria-label="노면상태별 심각도" />
            }
          </DataState>
        </Card>
      </div>

      <p className="mt-4 rounded-xl border border-border bg-surface-2/60 px-4 py-3 text-[11px] leading-relaxed text-muted">
        ※ 노출 보정 각주 — 맑음군 사고율의 분모는{" "}
        <span className="font-medium text-secondary">max(1, 월 일수 − 강수일수 − 눈일수)</span> 근사입니다. 실측에서
        눈일수가 강수일수의 부분집합이 아니어서(관측 25개월 위반) 강수·눈 일수를 모두 차감하는 합집합 정의를 채택했습니다.
        비·눈이 같은 날 겹치면 이중 차감될 수 있어 맑음군 사고율이 다소 높게(=비·눈 배율이 다소 낮게, 보수적으로) 추정됩니다.
        강수일수(일강수 ≥0.1mm)와 눈일수(눈 현상 관측)는 관측 기준이 다릅니다. 월 단위 해상도이며 흐림·맑음을 구분하지
        못하는 근사입니다. 상관 관계이며 인과가 아닙니다.
      </p>
    </div>
  );
}
