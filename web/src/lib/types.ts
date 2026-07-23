/**
 * 파이프라인 산출 JSON 타입.
 *
 * ⚠️ 잠정(provisional) — pipeline/SCHEMAS.md 가 동결되면 Stage B에서 정본으로 교체한다.
 * 필드명/카테고리 순서는 계획서(weather-accident-dashboard-plan.md) Phase 1 step 3
 * 의 JSON 설명을 근거로 추정했다. 모든 소비 컴포넌트는 이 파일만 참조하므로
 * 스키마 확정 시 한 곳만 고치면 된다.
 */
import type { Season } from "./palette";

export type HypothesisId = "H1" | "H2" | "H3" | "H4";
export type Verdict = "supported" | "partial" | "rejected";

/** meta.json */
export interface Meta {
  period: { start: string; end: string }; // "2007-01" ~ "2025-12"
  yearMin: number;
  yearMax: number;
  totalAccidents: number;
  totalDeaths: number;
  totalSeriousInjuries: number;
  builtAt?: string;
  note?: string;
}

/** trend.json — 연×월×사고내용 */
export interface TrendRow {
  year: number;
  month: number;
  season: Season;
  count: number;
  deaths: number;
  seriousInjuries?: number;
}
export interface TrendData {
  rows: TrendRow[];
}

/** weather.json — 연×월×기상상태 */
export interface WeatherRow {
  year: number;
  month: number;
  weather: string; // 원본 기상상태(맑음/비/흐림/눈/기타)
  count: number;
  deaths: number;
  seriousInjuries: number;
}
export interface WeatherData {
  rows: WeatherRow[];
}

/** exposure.json — 노출 보정 사고율 */
export interface ExposureMonthRow {
  year: number;
  month: number;
  rainDays: number; // 강수일수
  snowDays: number | null; // 적설일수(관측 있는 월만)
  precip?: number | null; // 강수량(보조)
  avgTemp?: number | null; // 평균기온(보조)
  clearDays: number; // 잔여일수 = 월 일수 − 강수일수
  rainRate: number | null; // 비 사고율 = 비 사고 ÷ 강수일수
  snowRate: number | null; // 눈 사고율 = 눈 사고 ÷ 적설일수
  clearRate: number | null; // 맑음군 사고율
  rainMultiple: number | null; // 비/맑음 배율
  snowMultiple: number | null; // 눈/맑음 배율
}
export interface ExposureData {
  rows: ExposureMonthRow[];
  /** 조건×월 평균 배율 조회 (오늘의 위험도 위젯) — month(1-12) 기준 집계 */
  byConditionMonth?: {
    rain: (number | null)[]; // index 0..11 = 1월..12월 배율
    snow: (number | null)[];
  };
  /** 전체 평균 배율 (헤드라인 KPI) */
  overall?: { rainMultiple: number | null; snowMultiple: number | null };
}

/** district.json — 구×연×기상상태 */
export interface DistrictRow {
  district: string; // "강동구" (접두사 없음, geojson name과 일치)
  year: number;
  weather: string;
  count: number;
  deaths?: number;
}
export interface DistrictData {
  rows: DistrictRow[];
}

/** facts.json — 그룹화 팩트 테이블 (크로스 분석) */
export interface FactRow {
  weather: string; // 기상상태 원본
  district: string;
  year: number;
  month: number;
  season: Season;
  daynight: string; // 주야
  road: string; // 도로형태
  vehicle: string; // 가해차종
  age: string; // 가해연령대
  count: number;
  deaths: number;
}
export type FactsData = FactRow[];

/** hypotheses.json — H1~H4 판정 */
export interface HypothesisResult {
  id: HypothesisId;
  title: string; // 가설 문장
  verdict: Verdict;
  /** 핵심 근거 수치 표시용 */
  keyMetric: { label: string; value: string };
  /** 판정 근거 설명 */
  rationale: string;
  /** 판정 규칙(임계값) 요약 */
  rule?: string;
}
export interface HypothesesData {
  results: HypothesisResult[];
}

export const VERDICT_META: Record<
  Verdict,
  { label: string; icon: string; tone: "good" | "warning" | "critical" }
> = {
  supported: { label: "지지", icon: "✅", tone: "good" },
  partial: { label: "부분 지지", icon: "⚠️", tone: "warning" },
  rejected: { label: "기각", icon: "❌", tone: "critical" },
};
