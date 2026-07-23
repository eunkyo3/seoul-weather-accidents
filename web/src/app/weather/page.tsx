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
  // 부분 범위면 monthly 재집계(총건수÷총일수). 실데이터에선 전체 범위에서 둘이 동일.
  const rates = useMemo(() => {
    if (exposure.status !== "ready") return null;
    const fullRange = f.yearRange[0] === 2007 && f.yearRange[1] === 2025;
    if (fullRange) {
      const p = exposure.data.pooled;
      return {
        clear: { rate: p.clear_rate, ratio: 1 },
        rain: { rate: p.rain_rate, ratio: p.rain_ratio },
        snow: { rate: p.snow_rate, ratio: p.snow_ratio },
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
    return {
      clear: { rate: clearRate, ratio: 1 },
      rain: { rate: rainRate, ratio: clearRate ? rainRate / clearRate : 0 },
      snow: { rate: snowRate, ratio: clearRate ? snowRate / clearRate : 0 },
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
    const data = GROUPS.map((g) => rates[g.key].rate);
    return {
      ...baseOption(mode),
      tooltip: {
        ...(baseOption(mode).tooltip as object),
        trigger: "axis",
        axisPointer: { type: "shadow" },
        valueFormatter: (v: number) => `${dec(v, 2)} 건/일`,
      },
      legend: { show: false },
      grid: { left: 8, right: 24, top: 24, bottom: 8, containLabel: true },
      xAxis: { type: "category", data: GROUPS.map((g) => g.label), ...catAxis(mode) },
      yAxis: { type: "value", ...valAxis(mode), name: "하루당 사고", nameTextStyle: { color: CHROME[mode].muted, fontSize: 10 } },
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
            fontSize: 12,
            fontWeight: "bold",
            color: CHROME[mode].textPrimary,
            formatter: (p: { dataIndex: number }) => {
              const g = GROUPS[p.dataIndex];
              return g.key === "clear" ? "기준 1.0배" : mult(rates[g.key].ratio);
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
        subtitle="절대 건수만 보면 맑은 날 사고가 압도적입니다. 하지만 날씨별 일수로 나눈 하루당 사고율로 보정하면 이야기가 달라집니다."
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
            title="노출 보정 하루당 사고율"
            hint="사고 건수 ÷ 해당 날씨 일수. 막대 위는 맑음군 대비 배율"
            right={rates ? <Badge tone="accent">비 {mult(rates.rain.ratio)}</Badge> : undefined}
          />
          <DataState state={exposure} height={330}>
            {() => rateOption && <EChart option={rateOption} height={330} notMerge aria-label="노출 보정 하루당 사고율" />}
          </DataState>
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
    </div>
  );
}
