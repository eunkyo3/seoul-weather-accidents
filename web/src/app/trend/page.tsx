"use client";

import { useMemo } from "react";
import { PageHeader, Card, SectionTitle, DataState } from "@/components/ui";
import { HypothesisBanner } from "@/components/HypothesisBanner";
import { FilterBar } from "@/components/FilterBar";
import { EChart } from "@/components/EChart";
import { useJson } from "@/lib/useJson";
import { useFilters } from "@/lib/filters";
import { useTheme } from "@/lib/theme";
import { baseOption, catAxis, valAxis, type EChartsCoreOption } from "@/lib/echarts";
import { CHROME, SEASON_COLORS, SEASON_LABEL, type ThemeMode } from "@/lib/palette";
import { inYear, seasonPass } from "@/lib/agg";
import type { TrendData } from "@/lib/types";

/** 연도 인덱스 → 파랑 sequential 색 (old=연함 → new=진함) */
function yearRamp(mode: ThemeMode, t: number): string {
  // t in [0,1]. 다크는 반대로 밝아지게.
  const stops =
    mode === "dark"
      ? ["#1c5cab", "#256abf", "#3987e5", "#5598e7", "#86b6ef"]
      : ["#cde2fb", "#86b6ef", "#3987e5", "#256abf", "#0d366b"];
  const x = Math.max(0, Math.min(1, t)) * (stops.length - 1);
  const i = Math.floor(x);
  return stops[Math.min(i, stops.length - 1)];
}

export default function TrendPage() {
  const trend = useJson<TrendData>("trend");
  const f = useFilters();
  const { mode } = useTheme();

  const monthlyByYearOption = useMemo<EChartsCoreOption | null>(() => {
    if (trend.status !== "ready") return null;
    const c = CHROME[mode];
    const [y0, y1] = f.yearRange;
    const years: number[] = [];
    for (let y = y0; y <= y1; y++) years.push(y);

    // year×month 건수 합 (content 합산)
    const grid = new Map<string, number>();
    for (const r of trend.data.monthly) {
      if (!inYear(r.year, f.yearRange)) continue;
      if (!seasonPass(r.season, f.seasons)) continue;
      const k = `${r.year}-${r.month}`;
      grid.set(k, (grid.get(k) ?? 0) + r.count);
    }
    const months = Array.from({ length: 12 }, (_, i) => i + 1);
    // 겨울이 포함되면 계절-연도 순서(3→…→12→1→2)로 배열해 겨울이 12→1→2로 읽히게 한다.
    // 겨울 미포함(기본 포함)이면 1→12 유지.
    const SEASON_YEAR = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2];
    const base = f.seasons.includes("겨울") ? SEASON_YEAR : months;
    const activeMonths = f.seasons.length
      ? base.filter((m) => seasonPass(monthSeason(m), f.seasons))
      : base;

    const series = years.map((y, idx) => ({
      name: String(y),
      type: "line" as const,
      smooth: true,
      symbol: "none",
      lineStyle: { width: years.length > 8 ? 1.4 : 2, color: yearRamp(mode, years.length > 1 ? idx / (years.length - 1) : 1) },
      itemStyle: { color: yearRamp(mode, years.length > 1 ? idx / (years.length - 1) : 1) },
      emphasis: { focus: "series" as const, lineStyle: { width: 3 } },
      data: activeMonths.map((m) => grid.get(`${y}-${m}`) ?? null),
    }));

    // 평균 프로파일 (강조 라인)
    const avg = activeMonths.map((m) => {
      let s = 0;
      let n = 0;
      for (const y of years) {
        const v = grid.get(`${y}-${m}`);
        if (v != null) {
          s += v;
          n++;
        }
      }
      return n ? Math.round(s / n) : null;
    });
    series.push({
      name: "기간 평균",
      type: "line",
      smooth: true,
      symbol: "circle",
      // @ts-expect-error symbolSize allowed on line series
      symbolSize: 6,
      lineStyle: { width: 3.5, color: c.textPrimary },
      itemStyle: { color: c.textPrimary },
      emphasis: { focus: "series", lineStyle: { width: 4 } },
      z: 10,
      data: avg,
    });

    return {
      ...baseOption(mode),
      tooltip: { ...(baseOption(mode).tooltip as object), trigger: "axis" },
      legend: { show: false },
      grid: { left: 8, right: 20, top: 16, bottom: 8, containLabel: true },
      xAxis: {
        type: "category",
        boundaryGap: false,
        data: activeMonths.map((m) => `${m}월`),
        ...catAxis(mode),
      },
      yAxis: { type: "value", ...valAxis(mode) },
      series,
    };
  }, [trend, f.yearRange, f.seasons, mode]);

  const byYearOption = useMemo<EChartsCoreOption | null>(() => {
    if (trend.status !== "ready") return null;
    const c = CHROME[mode];
    const rows = trend.data.by_year.filter((r) => inYear(r.year, f.yearRange));
    return {
      ...baseOption(mode),
      tooltip: { ...(baseOption(mode).tooltip as object), trigger: "axis" },
      legend: { show: false },
      grid: { left: 8, right: 16, top: 16, bottom: 8, containLabel: true },
      xAxis: { type: "category", data: rows.map((r) => `${r.year}`), ...catAxis(mode) },
      yAxis: { type: "value", ...valAxis(mode) },
      series: [
        {
          type: "line",
          smooth: true,
          symbol: "circle",
          symbolSize: 7,
          data: rows.map((r) => r.count),
          lineStyle: { width: 2.5, color: c.textPrimary === "#ffffff" ? "#3987e5" : "#2a78d6" },
          itemStyle: { color: mode === "dark" ? "#3987e5" : "#2a78d6" },
          areaStyle: {
            color: {
              type: "linear",
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: mode === "dark" ? "rgba(57,135,229,0.35)" : "rgba(42,120,214,0.28)" },
                { offset: 1, color: "rgba(57,135,229,0.02)" },
              ],
            },
          },
        },
      ],
    };
  }, [trend, f.yearRange, mode]);

  const seasonOption = useMemo<EChartsCoreOption | null>(() => {
    if (trend.status !== "ready") return null;
    // by_season 은 전기간 풀링 → 필터 연도면 monthly 로 재집계
    const useFilter = f.yearRange[0] !== 2007 || f.yearRange[1] !== 2025;
    let rows: { season: string; count: number }[];
    if (useFilter) {
      const m = new Map<string, number>();
      for (const r of trend.data.monthly) {
        if (!inYear(r.year, f.yearRange)) continue;
        m.set(r.season, (m.get(r.season) ?? 0) + r.count);
      }
      rows = SEASON_LABEL.map((s) => ({ season: s, count: m.get(s) ?? 0 }));
    } else {
      rows = SEASON_LABEL.map((s) => ({
        season: s,
        count: trend.data.by_season.find((x) => x.season === s)?.count ?? 0,
      }));
    }
    const total = rows.reduce((a, b) => a + b.count, 0) || 1;
    return {
      ...baseOption(mode),
      tooltip: {
        ...(baseOption(mode).tooltip as object),
        trigger: "axis",
        axisPointer: { type: "shadow" },
      },
      legend: { show: false },
      grid: { left: 8, right: 20, top: 16, bottom: 8, containLabel: true },
      xAxis: { type: "category", data: rows.map((r) => r.season), ...catAxis(mode) },
      yAxis: { type: "value", ...valAxis(mode) },
      series: [
        {
          type: "bar",
          barWidth: "46%",
          itemStyle: {
            borderRadius: [6, 6, 0, 0],
            color: (p: { name: string }) =>
              SEASON_COLORS[mode][p.name as (typeof SEASON_LABEL)[number]],
          },
          label: {
            show: true,
            position: "top",
            color: CHROME[mode].textSecondary,
            fontSize: 11,
            formatter: (p: { value: number }) => `${((p.value / total) * 100).toFixed(1)}%`,
          },
          data: rows.map((r) => r.count),
        },
      ],
    };
  }, [trend, f.yearRange, mode]);

  return (
    <div className="mx-auto max-w-6xl animate-rise">
      <PageHeader
        eyebrow="계절·추이"
        title="계절과 월별 사고 추이"
        subtitle="연도 비교로 계절성 패턴을 확인합니다. 옅은 선일수록 과거, 진한 선일수록 최근 연도이며 검은 선은 기간 평균입니다."
      />
      <HypothesisBanner id="H1" fallbackTitle="계절에 따라 사고 발생 패턴이 뚜렷이 다르다" />
      <FilterBar />

      <div className="grid gap-4">
        <Card>
          <SectionTitle
            title="월별 사고 추이 — 연도 비교"
            hint={`${f.yearRange[0]}–${f.yearRange[1]} · 연도별 선(과거→최근 = 옅음→진함) + 기간 평균`}
          />
          <DataState state={trend} height={380}>
            {() =>
              monthlyByYearOption && (
                <EChart option={monthlyByYearOption} height={380} notMerge aria-label="월별 사고 추이 연도 비교" />
              )
            }
          </DataState>
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <SectionTitle title="연도별 총 사고" hint="장기 추세" />
            <DataState state={trend} height={300}>
              {() => byYearOption && <EChart option={byYearOption} height={300} notMerge aria-label="연도별 총 사고" />}
            </DataState>
          </Card>
          <Card>
            <SectionTitle title="계절별 사고 분포" hint="막대 위 숫자는 전체 대비 비중" />
            <DataState state={trend} height={300}>
              {() =>
                seasonOption && <EChart option={seasonOption} height={300} notMerge aria-label="계절별 사고 분포" />
              }
            </DataState>
          </Card>
        </div>
      </div>
    </div>
  );
}

function monthSeason(m: number) {
  if (m >= 3 && m <= 5) return "봄" as const;
  if (m >= 6 && m <= 8) return "여름" as const;
  if (m >= 9 && m <= 11) return "가을" as const;
  return "겨울" as const;
}
