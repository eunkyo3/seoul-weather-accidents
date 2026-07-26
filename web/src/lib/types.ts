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
  /** v1.1 추가 — ERA5 월별 강수시간(민감도 분석용), 구 산출물 하위호환 위해 optional */
  precip_hours?: number;
  rain_hours?: number;
  snow_hours?: number;
}
export interface ExposurePooled {
  rain_rate: number;
  snow_rate: number;
  clear_rate: number;
  /** per-day 배율(=사고율÷맑음군사고율). 맑음 지배 라벨로 편향 — 참고·기술 표시용 */
  rain_ratio: number;
  snow_ratio: number;
  /** ★노출 보정 대표비(=사고 점유율÷일수 점유율). >1=과대표집(더 위험). H2 판정·헤드라인 정본 */
  rain_repr: number;
  snow_repr: number;
  rain_acc_total: number;
  snow_acc_total: number;
  clear_acc_total: number;
  rain_days_total: number;
  snow_days_total: number;
  clear_days_total: number;
  total_acc: number;
  total_days: number;
}
export interface ExposureCalMonth {
  month: number;
  rain_rate: number;
  snow_rate: number | null;
  clear_rate: number;
  rain_ratio: number;
  snow_ratio: number | null;
  /** 위젯이 조회하는 노출 보정 대표비 */
  rain_repr: number;
  snow_repr: number | null;
}
/** 연도별 대표비(일 기반 + 시간 기반) — 추이·추세 민감도 (v1.1 추가) */
export interface ExposureByYear {
  year: number;
  rain_acc: number;
  snow_acc: number;
  clear_acc: number;
  rain_repr: number | null;
  snow_repr: number | null;
  rain_repr_time: number | null;
  snow_repr_time: number | null;
}
/** 시간 기반 분모 민감도(ERA5 강수시간) — H2 판정은 일 기반 유지, 크기 민감도 정량화 (v1.1 추가) */
export interface TimeExposure {
  source: string;
  split_note: string;
  rain_hours_total: number;
  snow_hours_total: number;
  precip_hours_total: number;
  total_hours: number;
  rain_hours_share: number;
  rain_days_share: number;
  rain_acc_share: number;
  rain_repr_time: number;
  snow_repr_time: number;
  wet_repr_time: number;
  caveat: string;
}
export interface ExposureData {
  monthly: ExposureMonthly[];
  pooled: ExposurePooled;
  by_calendar_month: ExposureCalMonth[];
  /** v1.1 추가 필드 — 구 산출물과의 하위호환 위해 optional */
  by_year?: ExposureByYear[];
  time_exposure?: TimeExposure;
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
/** 결정적 통계 검정 결과 (v1.1 추가) — p_value 0.0은 1e-6 미만 언더플로("p < 0.001" 표기) */
export interface HypothesisStats {
  test: string;
  statistic: number;
  df: number | null;
  p_value: number;
  repr_ci95?: [number, number];
  note: string;
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
  /** v1.1 추가 — 구 산출물 하위호환 위해 optional */
  stats?: HypothesisStats;
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
