"use client";

import { useFilters, YEAR_MIN, YEAR_MAX, ALL_WEATHERS } from "@/lib/filters";
import { WEATHER_LABEL, WEATHER_COLORS, SEASON_LABEL, type WeatherKey } from "@/lib/palette";
import { useTheme } from "@/lib/theme";

const YEARS = Array.from({ length: YEAR_MAX - YEAR_MIN + 1 }, (_, i) => YEAR_MIN + i);

/**
 * 전역 필터 바 (AC-7): 연도 범위 · 계절 · 기상 · 자치구.
 * 변경 시 URL 쿼리에 동기화되어 모든 차트가 실시간 반영.
 * @param districts 선택 가능한 자치구 목록(지도/데이터에서 전달). 없으면 자치구 필터 숨김.
 */
export function FilterBar({ districts }: { districts?: string[] }) {
  const f = useFilters();
  const { mode } = useTheme();

  return (
    <div className="card mb-6 flex flex-wrap items-center gap-x-5 gap-y-3 px-4 py-3">
      {/* 연도 범위 */}
      <div className="flex items-center gap-2">
        <span className="text-[11.5px] font-semibold text-muted">연도</span>
        <YearSelect
          value={f.yearRange[0]}
          max={f.yearRange[1]}
          onChange={(y) => f.setYearRange([y, Math.max(y, f.yearRange[1])])}
        />
        <span className="text-muted">–</span>
        <YearSelect
          value={f.yearRange[1]}
          min={f.yearRange[0]}
          onChange={(y) => f.setYearRange([Math.min(f.yearRange[0], y), y])}
        />
      </div>

      <Divider />

      {/* 계절 */}
      <div className="flex items-center gap-1.5">
        <span className="mr-1 text-[11.5px] font-semibold text-muted">계절</span>
        {SEASON_LABEL.map((s) => {
          const on = f.seasons.includes(s);
          return (
            <Chip key={s} on={on} onClick={() => f.toggleSeason(s)}>
              {s}
            </Chip>
          );
        })}
      </div>

      <Divider />

      {/* 기상 */}
      <div className="flex items-center gap-1.5">
        <span className="mr-1 text-[11.5px] font-semibold text-muted">기상</span>
        {ALL_WEATHERS.map((w: WeatherKey) => {
          const on = f.weathers.includes(w);
          const color = WEATHER_COLORS[mode][w];
          return (
            <Chip key={w} on={on} onClick={() => f.toggleWeather(w)} dot={color}>
              {WEATHER_LABEL[w]}
            </Chip>
          );
        })}
      </div>

      {districts && districts.length > 0 && (
        <>
          <Divider />
          <div className="flex items-center gap-2">
            <span className="text-[11.5px] font-semibold text-muted">자치구</span>
            <select
              value={f.district ?? ""}
              onChange={(e) => f.setDistrict(e.target.value || null)}
              className="rounded-lg border border-border bg-surface-2 px-2.5 py-1 text-[12.5px] font-medium text-primary outline-none focus:border-accent"
            >
              <option value="">전체</option>
              {districts.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
        </>
      )}

      {f.isDirty && (
        <button
          type="button"
          onClick={f.reset}
          className="ml-auto flex items-center gap-1 rounded-lg px-2.5 py-1 text-[12px] font-semibold text-secondary transition-colors hover:bg-surface-2 hover:text-primary"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M4 4v5h5M20 20v-5h-5M4.6 9a8 8 0 0114-2M19.4 15a8 8 0 01-14 2"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          초기화
        </button>
      )}
    </div>
  );
}

function YearSelect({
  value,
  min = YEAR_MIN,
  max = YEAR_MAX,
  onChange,
}: {
  value: number;
  min?: number;
  max?: number;
  onChange: (y: number) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="rounded-lg border border-border bg-surface-2 px-2 py-1 text-[12.5px] font-semibold text-primary tabular-nums outline-none focus:border-accent"
    >
      {YEARS.filter((y) => y >= min && y <= max).map((y) => (
        <option key={y} value={y}>
          {y}
        </option>
      ))}
    </select>
  );
}

function Chip({
  children,
  on,
  onClick,
  dot,
}: {
  children: React.ReactNode;
  on: boolean;
  onClick: () => void;
  dot?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={[
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-semibold transition-colors",
        on
          ? "border-accent bg-accent-soft text-primary"
          : "border-border bg-surface-2 text-secondary hover:text-primary",
      ].join(" ")}
    >
      {dot && (
        <span
          className="h-2.5 w-2.5 rounded-full"
          style={{ background: dot, opacity: on ? 1 : 0.55 }}
        />
      )}
      {children}
    </button>
  );
}

function Divider() {
  return <span className="hidden h-5 w-px bg-border sm:block" />;
}
