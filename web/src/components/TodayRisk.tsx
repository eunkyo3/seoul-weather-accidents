"use client";

import { useEffect, useMemo, useState } from "react";
import { useJson } from "@/lib/useJson";
import { useTheme } from "@/lib/theme";
import { Card, SectionTitle, Badge } from "./ui";
import { WEATHER_COLORS, WEATHER_LABEL, type WeatherKey } from "@/lib/palette";
import { mult, dec } from "@/lib/format";
import type { ExposureData } from "@/lib/types";

/** WMO weather_code → {clear|rain|snow} 그룹 */
function codeToWeather(code: number): WeatherKey {
  if (code >= 71 && code <= 77) return "snow";
  if (code === 85 || code === 86) return "snow";
  if (code >= 51 && code <= 67) return "rain";
  if (code >= 80 && code <= 82) return "rain";
  if (code >= 95) return "rain"; // 뇌우
  return "clear"; // 0-3 맑음/구름, 45/48 안개 → 맑음군(기타)
}

type ApiState =
  | { s: "loading" }
  | { s: "ok"; weather: WeatherKey; temp: number | null }
  | { s: "failed" };

export function TodayRisk() {
  const exposure = useJson<ExposureData>("exposure");
  const { mode } = useTheme();
  const [api, setApi] = useState<ApiState>({ s: "loading" });
  const [manual, setManual] = useState<WeatherKey | null>(null);

  useEffect(() => {
    let cancelled = false;
    const url =
      "https://api.open-meteo.com/v1/forecast?latitude=37.5665&longitude=126.978&current=weather_code,temperature_2m";
    fetch(url, { signal: AbortSignal.timeout?.(6000) })
      .then((r) => {
        if (!r.ok) throw new Error("bad");
        return r.json();
      })
      .then((j: { current?: { weather_code?: number; temperature_2m?: number } }) => {
        if (cancelled) return;
        const code = j.current?.weather_code;
        if (typeof code !== "number") throw new Error("no code");
        setApi({ s: "ok", weather: codeToWeather(code), temp: j.current?.temperature_2m ?? null });
      })
      .catch(() => {
        if (!cancelled) setApi({ s: "failed" });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const month = new Date().getMonth() + 1; // 1-12
  const apiWeather = api.s === "ok" ? api.weather : null;
  const effective: WeatherKey = manual ?? apiWeather ?? "clear";

  // 노출 보정 대표비(repr) — 위젯 정본 지표(SCHEMAS §3.4)
  const ratio = useMemo(() => {
    if (exposure.status !== "ready") return null;
    const row = exposure.data.by_calendar_month.find((r) => r.month === month);
    if (!row) return null;
    if (effective === "clear") return 1;
    if (effective === "rain") return row.rain_repr;
    return row.snow_repr; // 관측 없으면 null
  }, [exposure, month, effective]);

  const wc = WEATHER_COLORS[mode];
  const usingManual = manual != null;
  const fellBack = api.s === "failed";

  return (
    <Card>
      <SectionTitle
        title="오늘의 위험도"
        hint="Open-Meteo로 서울 현재 날씨를 조회해 과거 통계상 위험 배율을 보여줍니다. 예측이 아니라 과거 통계 조회입니다."
        right={
          api.s === "loading" ? (
            <Badge>조회 중…</Badge>
          ) : fellBack ? (
            <Badge tone="warning">오프라인 · 수동</Badge>
          ) : (
            <Badge tone="good">실시간 조회됨</Badge>
          )
        }
      />

      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        {/* 배율 표시 */}
        <div className="flex items-baseline gap-3">
          <div>
            <p className="text-[12px] text-muted">
              {month}월 · {usingManual ? "선택한" : "현재"} 날씨{" "}
              <span className="font-semibold" style={{ color: wc[effective] }}>
                {WEATHER_LABEL[effective]}
              </span>
              {api.s === "ok" && !usingManual && api.temp != null && (
                <span className="text-muted"> · {dec(api.temp, 1)}℃</span>
              )}
            </p>
            <p className="mt-1 flex items-baseline gap-2">
              <span className="text-[40px] font-bold leading-none tnum" style={{ color: wc[effective] }}>
                {ratio == null ? "관측 부족" : effective === "clear" ? "1.0배" : mult(ratio)}
              </span>
            </p>
            <p className="mt-1.5 max-w-md text-[12.5px] leading-relaxed text-secondary">
              과거 통계상 오늘 같은 날씨({WEATHER_LABEL[effective]})의 하루당 사고 위험은{" "}
              <b className="text-primary">맑은 날의 {ratio == null ? "—" : effective === "clear" ? "1.0배" : mult(ratio)}</b>
              입니다.
            </p>
          </div>
        </div>

        {/* 수동 토글 — 항상 노출 (발표용 "비라면? 눈이라면?") */}
        <div className="flex flex-col gap-2">
          <span className="text-[11px] font-semibold text-muted">
            {fellBack ? "날씨 선택" : "다른 날씨라면?"}
          </span>
          <div className="flex gap-1.5">
            {(["clear", "rain", "snow"] as WeatherKey[]).map((w) => {
              const on = effective === w;
              return (
                <button
                  key={w}
                  type="button"
                  onClick={() => setManual(manual === w ? null : w)}
                  aria-pressed={on}
                  className={[
                    "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] font-semibold transition-colors",
                    on ? "border-transparent text-white" : "border-border bg-surface-2 text-secondary hover:text-primary",
                  ].join(" ")}
                  style={on ? { background: wc[w] } : undefined}
                >
                  <span className="h-2 w-2 rounded-full" style={{ background: on ? "#fff" : wc[w] }} />
                  {WEATHER_LABEL[w]}
                </button>
              );
            })}
          </div>
          {manual != null && (
            <button
              type="button"
              onClick={() => setManual(null)}
              className="text-left text-[11px] text-muted underline-offset-2 hover:text-secondary hover:underline"
            >
              {fellBack ? "" : "실시간 값으로 돌아가기"}
            </button>
          )}
        </div>
      </div>

      <p className="mt-3 border-t border-border pt-2.5 text-[10.5px] leading-relaxed text-muted">
        ※ 과거 통계 조회이며 예측이 아닙니다. 배율은 {month}월 노출 보정 대표비(그 날씨의 사고 점유율 ÷ 일수 점유율)로,
        1.0보다 크면 맑은 날보다 사고가 과대표집됨을 뜻합니다. 상관 관계이며 인과가 아닙니다.
      </p>
    </Card>
  );
}
