"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader, Card, SectionTitle, DataState, Badge } from "@/components/ui";
import { HypothesisBanner } from "@/components/HypothesisBanner";
import { FilterBar } from "@/components/FilterBar";
import { EChart } from "@/components/EChart";
import { echarts, type EChartsCoreOption } from "@/lib/echarts";
import { useJson } from "@/lib/useJson";
import { useFilters } from "@/lib/filters";
import { useTheme } from "@/lib/theme";
import { CHROME, SEQ_BLUE, SEQ_BY_WEATHER, WEATHER_LABEL } from "@/lib/palette";
import { inYear, weatherGroup } from "@/lib/agg";
import { num, pct } from "@/lib/format";
import type { DistrictData } from "@/lib/types";

const MAP_NAME = "seoul";

/** GeoJSON 로드 + registerMap (1회) */
function useSeoulMap(): { ready: boolean; error: boolean } {
  const [ready, setReady] = useState(() => echarts.getMap?.(MAP_NAME) != null);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (echarts.getMap?.(MAP_NAME)) return; // 이미 등록됨 — initial state가 true
    let cancelled = false;
    fetch("/geo/seoul.json", { cache: "force-cache" })
      .then((r) => r.json())
      .then((geo) => {
        if (cancelled) return;
        echarts.registerMap(MAP_NAME, geo);
        setReady(true);
      })
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
    };
  }, []);
  return { ready, error };
}

export default function MapPage() {
  const district = useJson<DistrictData>("district");
  const { ready: mapReady, error: mapErr } = useSeoulMap();
  const f = useFilters();
  const { mode } = useTheme();

  const districtList = useMemo(
    () => (district.status === "ready" ? district.data.by_district.map((d) => d.district) : []),
    [district],
  );

  // 필터 반영 구별 값. 필터 결과가 0건이면 전기간·전기상 값으로 폴백(isFallback).
  const values = useMemo(() => {
    if (district.status !== "ready") return null;
    const m = new Map<string, number>();
    for (const r of district.data.district_year_weather) {
      if (!inYear(r.year, f.yearRange)) continue;
      if (f.weathers.length && !f.weathers.includes(weatherGroup(r.weather))) continue;
      m.set(r.district, (m.get(r.district) ?? 0) + r.count);
    }
    if (m.size === 0) {
      for (const d of district.data.by_district) m.set(d.district, d.count);
      return { map: m, isFallback: true };
    }
    return { map: m, isFallback: false };
  }, [district, f.yearRange, f.weathers]);

  const selectedDetail = useMemo(() => {
    if (district.status !== "ready" || !f.district) return null;
    return district.data.by_district.find((d) => d.district === f.district) ?? null;
  }, [district, f.district]);

  const singleWeather = f.weathers.length === 1 ? f.weathers[0] : null;

  const mapOption = useMemo<EChartsCoreOption | null>(() => {
    if (!values) return null;
    const c = CHROME[mode];
    const entries = [...values.map.entries()];
    const max = Math.max(1, ...entries.map(([, v]) => v));
    const ramp = singleWeather ? SEQ_BY_WEATHER[mode][singleWeather] : null;
    const rangeColors = ramp
      ? [ramp[0], ramp[1]]
      : mode === "dark"
        ? [SEQ_BLUE.dark[0], SEQ_BLUE.dark[6]]
        : [SEQ_BLUE.light[1], SEQ_BLUE.light[7]];

    return {
      tooltip: {
        trigger: "item",
        backgroundColor: c.tooltipBg,
        borderColor: c.tooltipBorder,
        borderWidth: 1,
        padding: [8, 12],
        extraCssText: "border-radius:10px;",
        textStyle: { color: c.textPrimary, fontSize: 12 },
        formatter: (p: { name: string; value: number }) =>
          `<b>${p.name}</b><br/>사고 ${num(Number.isFinite(p.value) ? p.value : 0)}건`,
      },
      visualMap: {
        min: 0,
        max,
        left: 12,
        bottom: 16,
        orient: "vertical",
        text: ["많음", "적음"],
        calculable: true,
        inRange: { color: rangeColors },
        textStyle: { color: c.muted, fontSize: 11 },
        itemWidth: 12,
        itemHeight: 90,
      },
      series: [
        {
          type: "map",
          map: MAP_NAME,
          roam: false,
          selectedMode: "single",
          nameProperty: "name",
          label: { show: false },
          emphasis: {
            label: { show: true, color: c.textPrimary, fontSize: 11, fontWeight: "bold" },
            itemStyle: { areaColor: undefined },
          },
          select: {
            label: { show: true, color: c.textPrimary, fontSize: 11, fontWeight: "bold" },
            itemStyle: { areaColor: mode === "dark" ? "#5598e7" : "#1c5cab", borderColor: c.textPrimary },
          },
          itemStyle: {
            borderColor: mode === "dark" ? "#0b0e14" : "#ffffff",
            borderWidth: 1,
          },
          data: entries.map(([name, value]) => ({
            name,
            value,
            selected: name === f.district,
          })),
        },
      ],
    };
  }, [values, mode, singleWeather, f.district]);

  const onMapClick = (params: unknown) => {
    const p = params as { name?: string };
    if (!p?.name) return;
    f.setDistrict(p.name === f.district ? null : p.name);
  };

  return (
    <div className="mx-auto max-w-6xl animate-rise">
      <PageHeader
        eyebrow="지도"
        title="자치구별 위험도 지도"
        subtitle="서울 25개 자치구 단계구분도. 기상 필터를 바꾸면 구별 색이 그 조건의 사고 분포로 바뀝니다. 구를 클릭하면 오른쪽에 상세가 열립니다."
      />
      <HypothesisBanner id="H3" fallbackTitle="날씨의 영향은 자치구별로 다르게 나타난다" />
      <FilterBar districts={districtList} />

      <div className="grid gap-4 lg:grid-cols-[1.55fr_1fr]">
        <Card>
          <SectionTitle
            title="자치구 단계구분도"
            hint={
              values?.isFallback
                ? "선택한 조건에 데이터가 없어 전체 기간·전체 기상 기준으로 표시 중"
                : singleWeather
                  ? `${WEATHER_LABEL[singleWeather]} 조건 · ${f.yearRange[0]}–${f.yearRange[1]}`
                  : `전체 기상 · ${f.yearRange[0]}–${f.yearRange[1]}`
            }
            right={
              values?.isFallback ? (
                <Badge tone="warning">폴백</Badge>
              ) : singleWeather ? (
                <Badge tone="accent">{WEATHER_LABEL[singleWeather]} 기준</Badge>
              ) : undefined
            }
          />
          {mapErr ? (
            <div className="grid h-[460px] place-items-center text-[13px] text-critical">
              지도 데이터를 불러오지 못했습니다.
            </div>
          ) : (
            <DataState state={district} height={460}>
              {() =>
                mapReady && mapOption ? (
                  <EChart
                    option={mapOption}
                    height={460}
                    notMerge
                    onEvents={{ click: onMapClick }}
                    aria-label="서울 자치구 단계구분도"
                  />
                ) : (
                  <div className="skeleton h-[460px] w-full" />
                )
              }
            </DataState>
          )}
        </Card>

        <Card>
          <SectionTitle
            title={selectedDetail ? `${selectedDetail.district} 상세` : "구 상세"}
            hint={selectedDetail ? "전 기간 기준 지표" : "지도에서 자치구를 클릭하세요"}
          />
          {selectedDetail ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Stat label="총 사고" value={`${num(selectedDetail.count)}건`} />
                <Stat label="사망자" value={`${num(selectedDetail.deaths)}명`} tone="critical" />
                <Stat label="비 사고" value={`${num(selectedDetail.rain_count)}건`} tone="rain" />
                <Stat label="비 사고 비중" value={pct(selectedDetail.rain_share)} tone="rain" />
              </div>
              <div className="rounded-xl bg-surface-2 p-3 text-[12px] leading-relaxed text-secondary">
                <p className="mb-1 font-semibold text-primary">기상 구성</p>
                <WeatherBar
                  clear={selectedDetail.clear_count}
                  rain={selectedDetail.rain_count}
                  snow={selectedDetail.snow_count}
                  mode={mode}
                />
              </div>
              <button
                type="button"
                onClick={() => f.setDistrict(null)}
                className="w-full rounded-lg border border-border py-2 text-[12.5px] font-semibold text-secondary transition-colors hover:bg-surface-2 hover:text-primary"
              >
                선택 해제
              </button>
            </div>
          ) : (
            <div className="grid h-[400px] place-items-center px-6 text-center text-[12.5px] leading-relaxed text-muted">
              자치구를 클릭하면 총 사고·사망자·비 사고 비중과 기상 구성이 표시됩니다.
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "critical" | "rain" }) {
  const color =
    tone === "critical" ? "text-sev-fatal" : tone === "rain" ? "text-w-rain" : "text-primary";
  return (
    <div className="rounded-xl border border-border bg-surface-2 p-3">
      <p className="text-[11px] text-muted">{label}</p>
      <p className={`mt-0.5 text-[18px] font-bold tnum ${color}`}>{value}</p>
    </div>
  );
}

function WeatherBar({
  clear,
  rain,
  snow,
  mode,
}: {
  clear: number;
  rain: number;
  snow: number;
  mode: "light" | "dark";
}) {
  const total = clear + rain + snow || 1;
  const wc = {
    clear: mode === "dark" ? "#c98500" : "#eda100",
    rain: mode === "dark" ? "#3987e5" : "#2a78d6",
    snow: mode === "dark" ? "#199e70" : "#1baf7a",
  };
  return (
    <div>
      <div className="flex h-3 overflow-hidden rounded-full">
        <span style={{ width: `${(clear / total) * 100}%`, background: wc.clear }} />
        <span style={{ width: `${(rain / total) * 100}%`, background: wc.rain }} />
        <span style={{ width: `${(snow / total) * 100}%`, background: wc.snow }} />
      </div>
      <div className="mt-1.5 flex justify-between text-[10.5px] text-muted">
        <span>맑음군 {pct(clear / total)}</span>
        <span>비 {pct(rain / total)}</span>
        <span>눈 {pct(snow / total)}</span>
      </div>
    </div>
  );
}
