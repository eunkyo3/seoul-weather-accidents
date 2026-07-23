/**
 * 파이프라인 산출 JSON 타입 — pipeline/SCHEMAS.md (FROZEN 2026-07-24) 정본.
 * 모든 소비 컴포넌트는 이 파일만 참조한다.
 */

export type HypothesisId = "H1" | "H2" | "H3" | "H4";
export type Verdict = "supported" | "partial" | "rejected";

/** 정본 카테고리 (SCHEMAS §1) */
export const WEATHER_ORDER = ["맑음", "흐림", "비", "눈", "기타"] as const;
export const SEASON_ORDER = ["봄", "여름", "가을", "겨울"] as const;
export const DAYNIGHT_ORDER = ["주간", "야간"] as const;
export const CONTENT_ORDER = ["중상사고", "사망사고"] as const;
export type WeatherRaw = (typeof WEATHER_ORDER)[number];
export type SeasonName = (typeof SEASON_ORDER)[number];
export type ContentName = (typeof CONTENT_ORDER)[number];

/** 3.1 meta.json */
export interface Meta {
  period: { start: string; end: string; months: number; year_min: number; year_max: number };
  totals: {
    accidents: number;
    deaths: number;
    serious: number;
    minor: number;
    fatal_accidents: number;
    serious_accidents: number;
  };
  scope: { severity: string[]; note: string; resolution: string; has_coords: boolean };
  categories: {
    weather: string[];
    season: string[];
    districts: string[];
    daynight: string[];
    content: string[];
    road: string[];
    vehicle: string[];
    age: string[];
    surface: string[];
  };
  cleaning_notes: Record<string, unknown>;
  build: { pipeline_version: string; source_files: number; deterministic: boolean };
}

/** 3.2 trend.json */
export interface TrendMonthly {
  year: number;
  month: number;
  season: SeasonName;
  content: ContentName;
  count: number;
  deaths: number;
  serious: number;
}
export interface TrendData {
  monthly: TrendMonthly[];
  by_year: { year: number; count: number; deaths: number }[];
  by_season: { season: SeasonName; count: number; deaths: number; share: number }[];
  monthly_profile: { month: number; count: number; share: number; avg_per_year: number }[];
}

/** 3.3 weather.json */
export interface WeatherData {
  by_weather: {
    weather: WeatherRaw;
    count: number;
    deaths: number;
    serious: number;
    share: number;
  }[];
  monthly: {
    year: number;
    month: number;
    weather: WeatherRaw;
    count: number;
    deaths: number;
    serious: number;
  }[];
  weather_by_severity: { weather: WeatherRaw; content: ContentName; count: number }[];
  surface_by_severity: { surface: string; content: ContentName; count: number }[];
}

/** 3.4 exposure.json */
export interface ExposureMonthly {
  year: number;
  month: number;
  rain_days: number;
  snow_days: number;
  precip_mm: number | null;
  temp_avg: number | null;
  rain_acc: number;
  snow_acc: number;
  clear_acc: number;
  clear_denom_days: number;
  rain_rate: number;
  snow_rate: number | null;
  clear_rate: number;
  rain_ratio: number;
  snow_ratio: number | null;
}
export interface ExposurePooled {
  rain_rate: number;
  snow_rate: number;
  clear_rate: number;
  rain_ratio: number;
  snow_ratio: number;
  rain_acc_total: number;
  snow_acc_total: number;
  clear_acc_total: number;
  rain_days_total: number;
  snow_days_total: number;
  clear_days_total: number;
}
export interface ExposureCalMonth {
  month: number;
  rain_rate: number;
  snow_rate: number | null;
  clear_rate: number;
  rain_ratio: number;
  snow_ratio: number | null;
}
export interface ExposureData {
  monthly: ExposureMonthly[];
  pooled: ExposurePooled;
  by_calendar_month: ExposureCalMonth[];
  definitions: Record<string, string>;
  snow_subset_verified: boolean;
}

/** 3.5 district.json */
export interface DistrictAgg {
  district: string;
  count: number;
  deaths: number;
  rain_count: number;
  snow_count: number;
  clear_count: number;
  rain_share: number;
}
export interface DistrictYearWeather {
  district: string;
  year: number;
  weather: WeatherRaw;
  count: number;
}
export interface DistrictData {
  by_district: DistrictAgg[];
  district_year_weather: DistrictYearWeather[];
}

/** 3.6 facts.json — columnar */
export interface FactsData {
  axes: string[];
  columns: {
    weather: string[];
    district: string[];
    ym: string[];
    daynight: string[];
    road: string[];
    vehicle: string[];
    age: string[];
    cnt: number[];
    deaths: number[];
  };
  nrows: number;
}

/** 3.7 hypotheses.json */
export interface HypothesisEvidence {
  label: string;
  value: number;
  unit: string | null;
}
export interface Hypothesis {
  id: HypothesisId;
  title: string;
  screen: string;
  metric_name: string;
  metric_value: number;
  thresholds: { supported_min: number; partial_min: number };
  verdict: Verdict;
  evidence: HypothesisEvidence[];
  caveat: string;
}
export interface HypothesesData {
  verdict_labels: Record<Verdict, string>;
  hypotheses: Hypothesis[];
}

export const VERDICT_META: Record<
  Verdict,
  { label: string; icon: string; tone: "good" | "warning" | "critical" }
> = {
  supported: { label: "지지", icon: "✅", tone: "good" },
  partial: { label: "부분 지지", icon: "⚠️", tone: "warning" },
  rejected: { label: "기각", icon: "❌", tone: "critical" },
};
