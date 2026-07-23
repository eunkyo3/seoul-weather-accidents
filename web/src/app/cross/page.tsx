"use client";

import { useMemo, useState } from "react";
import { PageHeader, Card, SectionTitle, DataState } from "@/components/ui";
import { HypothesisBanner } from "@/components/HypothesisBanner";
import { FilterBar } from "@/components/FilterBar";
import { EChart } from "@/components/EChart";
import { useJson } from "@/lib/useJson";
import { useFilters } from "@/lib/filters";
import { useTheme } from "@/lib/theme";
import { baseOption, catAxis, valAxis, type EChartsCoreOption } from "@/lib/echarts";
import { CHROME, SEQ_BLUE, CATEGORICAL, WEATHER_COLORS } from "@/lib/palette";
import { SEASON_ORDER, DAYNIGHT_ORDER, type FactsData } from "@/lib/types";
import {
  factTable,
  applyFilters,
  pivot,
  CROSS_AXES,
  type CrossAxisKey,
  type Measure,
} from "@/lib/crosstab";
import { num } from "@/lib/format";

const ORDER: Partial<Record<CrossAxisKey, string[]>> = {
  weather: ["맑음군", "비", "눈"],
  season: [...SEASON_ORDER],
  daynight: [...DAYNIGHT_ORDER],
};

/** 기상 라벨 → 시맨틱 색 (그룹 막대에서 행 축이 기상일 때) */
const WEATHER_LABEL_COLOR = (mode: "light" | "dark", label: string): string | null => {
  const wc = WEATHER_COLORS[mode];
  if (label === "맑음군") return wc.clear;
  if (label === "비") return wc.rain;
  if (label === "눈") return wc.snow;
  return null;
};

export default function CrossPage() {
  const facts = useJson<FactsData>("facts");
  const f = useFilters();
  const { mode } = useTheme();

  const [rowAxis, setRowAxis] = useState<CrossAxisKey>("weather");
  const [colAxis, setColAxis] = useState<CrossAxisKey>("age");
  const [measure, setMeasure] = useState<Measure>("count");

  const result = useMemo(() => {
    if (facts.status !== "ready") return null;
    if (rowAxis === colAxis) return null;
    const t = applyFilters(factTable(facts.data), f);
    return pivot(t, rowAxis, colAxis, measure, {
      rows: ORDER[rowAxis],
      cols: ORDER[colAxis],
    });
  }, [facts, f, rowAxis, colAxis, measure]);

  const heatmapOption = useMemo<EChartsCoreOption | null>(() => {
    if (!result) return null;
    const c = CHROME[mode];
    const dense = result.rows.length * result.cols.length > 40;
    const ramp = mode === "dark" ? SEQ_BLUE.dark : SEQ_BLUE.light;
    return {
      ...baseOption(mode),
      tooltip: {
        ...(baseOption(mode).tooltip as object),
        position: "top",
        formatter: (p: { data: [number, number, number] }) =>
          `${result.rows[p.data[1]]} · ${result.cols[p.data[0]]}<br/><b>${num(p.data[2])}</b> ${
            measure === "count" ? "건" : "명"
          }`,
      },
      grid: { left: 8, right: 12, top: 12, bottom: 8, containLabel: true },
      xAxis: {
        type: "category",
        data: result.cols,
        ...catAxis(mode),
        axisLabel: { ...catAxis(mode).axisLabel, interval: 0, rotate: result.cols.length > 6 ? 30 : 0 },
        splitArea: { show: false },
      },
      yAxis: {
        type: "category",
        data: result.rows,
        ...catAxis(mode),
        axisLabel: { ...catAxis(mode).axisLabel, interval: 0 },
        splitArea: { show: false },
      },
      visualMap: {
        min: 0,
        max: result.max || 1,
        calculable: true,
        orient: "horizontal",
        left: "center",
        bottom: -4,
        inRange: { color: [ramp[0], ramp[3], ramp[6]] },
        textStyle: { color: c.muted, fontSize: 10 },
        itemHeight: 90,
      },
      series: [
        {
          type: "heatmap",
          data: result.cells,
          label: {
            show: !dense,
            color: c.textPrimary,
            fontSize: 10,
            formatter: (p: { data: [number, number, number] }) => (p.data[2] ? num(p.data[2]) : ""),
          },
          itemStyle: { borderColor: c.surface, borderWidth: 2, borderRadius: 3 },
          emphasis: { itemStyle: { borderColor: c.textPrimary, borderWidth: 1 } },
        },
      ],
    };
  }, [result, mode, measure]);

  const barOption = useMemo<EChartsCoreOption | null>(() => {
    if (!result) return null;
    const pal = CATEGORICAL[mode];
    // rows 를 시리즈로, cols 를 x 카테고리로 (그룹 막대)
    const series = result.rows.map((rname, ri) => ({
      name: rname,
      type: "bar" as const,
      itemStyle: {
        color:
          (rowAxis === "weather" ? WEATHER_LABEL_COLOR(mode, rname) : null) ?? pal[ri % pal.length],
        borderRadius: [3, 3, 0, 0] as [number, number, number, number],
      },
      emphasis: { focus: "series" as const },
      data: result.cols.map((_, ci) => result.matrix[ri][ci]),
    }));
    return {
      ...baseOption(mode),
      tooltip: {
        ...(baseOption(mode).tooltip as object),
        trigger: "axis",
        axisPointer: { type: "shadow" },
      },
      legend: { ...(baseOption(mode).legend as object), top: 0, type: "scroll" },
      grid: { left: 8, right: 12, top: 34, bottom: 8, containLabel: true },
      xAxis: {
        type: "category",
        data: result.cols,
        ...catAxis(mode),
        axisLabel: { ...catAxis(mode).axisLabel, interval: 0, rotate: result.cols.length > 6 ? 30 : 0 },
      },
      yAxis: { type: "value", ...valAxis(mode) },
      series,
    };
  }, [result, mode, rowAxis]);

  return (
    <div className="mx-auto max-w-6xl animate-rise">
      <PageHeader
        eyebrow="크로스 분석"
        title="날씨 × 심층 축 교차"
        subtitle="두 축을 자유롭게 골라 어떤 조건 조합에서 사고가 집중되는지 봅니다. facts 테이블을 브라우저에서 즉시 group-by 합니다."
      />
      <HypothesisBanner id="H4" fallbackTitle="날씨 영향은 주야·도로형태·차종·연령대에 따라 증폭/약화된다" />
      <FilterBar />

      {/* 축 선택기 */}
      <div className="card mb-4 flex flex-wrap items-center gap-x-5 gap-y-3 px-4 py-3">
        <AxisPicker label="행 축" value={rowAxis} exclude={colAxis} onChange={setRowAxis} />
        <span className="text-muted">×</span>
        <AxisPicker label="열 축" value={colAxis} exclude={rowAxis} onChange={setColAxis} />
        <span className="hidden h-5 w-px bg-border sm:block" />
        <div className="flex items-center gap-1.5">
          <span className="text-[11.5px] font-semibold text-muted">지표</span>
          {(["count", "deaths"] as Measure[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMeasure(m)}
              aria-pressed={measure === m}
              className={[
                "rounded-full border px-3 py-1 text-[12px] font-semibold transition-colors",
                measure === m
                  ? "border-accent bg-accent-soft text-primary"
                  : "border-border bg-surface-2 text-secondary hover:text-primary",
              ].join(" ")}
            >
              {m === "count" ? "사고 건수" : "사망자수"}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4">
        <Card>
          <SectionTitle
            title={`히트맵 — ${CROSS_AXES[rowAxis].label} × ${CROSS_AXES[colAxis].label}`}
            hint="색이 진할수록 값이 큼"
          />
          <DataState state={facts} height={420} emptyHint="facts.json 산출 후 축 조합 히트맵이 활성화됩니다.">
            {() =>
              heatmapOption ? (
                <EChart option={heatmapOption} height={420} notMerge aria-label="크로스 히트맵" />
              ) : (
                <div className="grid h-[420px] place-items-center text-[13px] text-muted">
                  행 축과 열 축을 다르게 선택하세요.
                </div>
              )
            }
          </DataState>
        </Card>

        <Card>
          <SectionTitle
            title={`그룹 막대 — ${CROSS_AXES[colAxis].label}별 ${CROSS_AXES[rowAxis].label} 분포`}
            hint="같은 데이터를 막대로 — 시리즈는 행 축"
          />
          <DataState state={facts} height={360}>
            {() =>
              barOption ? (
                <EChart option={barOption} height={360} notMerge replaceMerge={["series"]} aria-label="크로스 그룹 막대" />
              ) : (
                <div className="h-[360px]" />
              )
            }
          </DataState>
        </Card>
      </div>
    </div>
  );
}

function AxisPicker({
  label,
  value,
  exclude,
  onChange,
}: {
  label: string;
  value: CrossAxisKey;
  exclude: CrossAxisKey;
  onChange: (v: CrossAxisKey) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11.5px] font-semibold text-muted">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as CrossAxisKey)}
        className="rounded-lg border border-border bg-surface-2 px-2.5 py-1 text-[12.5px] font-semibold text-primary outline-none focus:border-accent"
      >
        {(Object.keys(CROSS_AXES) as CrossAxisKey[]).map((k) => (
          <option key={k} value={k} disabled={k === exclude}>
            {CROSS_AXES[k].label}
          </option>
        ))}
      </select>
    </div>
  );
}
