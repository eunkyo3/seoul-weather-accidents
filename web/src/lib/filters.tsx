"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { WeatherKey } from "./palette";
import { SEASON_LABEL, type Season } from "./palette";

export const YEAR_MIN = 2007;
export const YEAR_MAX = 2025;
export const ALL_WEATHERS: WeatherKey[] = ["clear", "rain", "snow"];

export interface FilterState {
  yearRange: [number, number];
  /** 선택된 계절 집합 (빈 배열 = 전체) */
  seasons: Season[];
  /** 선택된 기상 집합 (빈 배열 = 전체) */
  weathers: WeatherKey[];
  /** 포커스 자치구 (null = 전체) */
  district: string | null;
}

interface FilterCtx extends FilterState {
  setYearRange: (r: [number, number]) => void;
  toggleSeason: (s: Season) => void;
  toggleWeather: (w: WeatherKey) => void;
  setDistrict: (d: string | null) => void;
  reset: () => void;
  /** 기본값에서 벗어난 필터가 있는지 */
  isDirty: boolean;
  /** 계절이 활성인지(선택됨 또는 전체) */
  seasonActive: (s: Season) => boolean;
  weatherActive: (w: WeatherKey) => boolean;
}

const DEFAULT: FilterState = {
  yearRange: [YEAR_MIN, YEAR_MAX],
  seasons: [],
  weathers: [],
  district: null,
};

const Ctx = createContext<FilterCtx | null>(null);

function parseFilters(sp: URLSearchParams): FilterState {
  const y0 = Number(sp.get("y0"));
  const y1 = Number(sp.get("y1"));
  const yearRange: [number, number] = [
    Number.isFinite(y0) && y0 >= YEAR_MIN && y0 <= YEAR_MAX ? y0 : YEAR_MIN,
    Number.isFinite(y1) && y1 >= YEAR_MIN && y1 <= YEAR_MAX ? y1 : YEAR_MAX,
  ];
  if (yearRange[0] > yearRange[1]) yearRange.reverse();

  const seasonRaw = (sp.get("s") ?? "").split(",").filter(Boolean);
  const seasons = seasonRaw.filter((s): s is Season =>
    (SEASON_LABEL as readonly string[]).includes(s),
  );

  const weatherRaw = (sp.get("w") ?? "").split(",").filter(Boolean);
  const weathers = weatherRaw.filter((w): w is WeatherKey =>
    (ALL_WEATHERS as string[]).includes(w),
  );

  const district = sp.get("d") || null;

  return { yearRange, seasons, weathers, district };
}

function serialize(state: FilterState): string {
  const sp = new URLSearchParams();
  if (state.yearRange[0] !== YEAR_MIN) sp.set("y0", String(state.yearRange[0]));
  if (state.yearRange[1] !== YEAR_MAX) sp.set("y1", String(state.yearRange[1]));
  if (state.seasons.length) sp.set("s", state.seasons.join(","));
  if (state.weathers.length) sp.set("w", state.weathers.join(","));
  if (state.district) sp.set("d", state.district);
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export function FilterProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const state = useMemo(
    () => parseFilters(new URLSearchParams(searchParams.toString())),
    [searchParams],
  );

  const commit = useCallback(
    (next: FilterState) => {
      router.replace(`${pathname}${serialize(next)}`, { scroll: false });
    },
    [router, pathname],
  );

  const setYearRange = useCallback(
    (r: [number, number]) => commit({ ...state, yearRange: r }),
    [commit, state],
  );

  const toggleSeason = useCallback(
    (s: Season) => {
      const has = state.seasons.includes(s);
      const seasons = has ? state.seasons.filter((x) => x !== s) : [...state.seasons, s];
      commit({ ...state, seasons });
    },
    [commit, state],
  );

  const toggleWeather = useCallback(
    (w: WeatherKey) => {
      const has = state.weathers.includes(w);
      const weathers = has ? state.weathers.filter((x) => x !== w) : [...state.weathers, w];
      commit({ ...state, weathers });
    },
    [commit, state],
  );

  const setDistrict = useCallback(
    (d: string | null) => commit({ ...state, district: d }),
    [commit, state],
  );

  const reset = useCallback(() => commit(DEFAULT), [commit]);

  const value: FilterCtx = useMemo(() => {
    const isDirty =
      state.yearRange[0] !== YEAR_MIN ||
      state.yearRange[1] !== YEAR_MAX ||
      state.seasons.length > 0 ||
      state.weathers.length > 0 ||
      state.district !== null;
    return {
      ...state,
      setYearRange,
      toggleSeason,
      toggleWeather,
      setDistrict,
      reset,
      isDirty,
      seasonActive: (s: Season) => state.seasons.length === 0 || state.seasons.includes(s),
      weatherActive: (w: WeatherKey) => state.weathers.length === 0 || state.weathers.includes(w),
    };
  }, [state, setYearRange, toggleSeason, toggleWeather, setDistrict, reset]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useFilters(): FilterCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useFilters must be used within FilterProvider");
  return ctx;
}
