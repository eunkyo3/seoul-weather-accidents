/** 공용 집계 헬퍼 — 필터 적용, 계절 파생, 날씨 그룹화 */

import type { SeasonName, WeatherRaw } from "./types";
import type { WeatherKey } from "./palette";

/** 월(1-12) → 계절 */
export function seasonOfMonth(m: number): SeasonName {
  if (m >= 3 && m <= 5) return "봄";
  if (m >= 6 && m <= 8) return "여름";
  if (m >= 9 && m <= 11) return "가을";
  return "겨울";
}

/** 원본 기상상태 → 그룹 키 (맑음군/비/눈) */
export function weatherGroup(raw: WeatherRaw | string): WeatherKey {
  if (raw === "비") return "rain";
  if (raw === "눈") return "snow";
  return "clear"; // 맑음·흐림·기타
}

/** 연도 범위 필터 */
export function inYear(year: number, range: [number, number]): boolean {
  return year >= range[0] && year <= range[1];
}

/** 계절 필터 (빈 배열 = 전체 통과) */
export function seasonPass(season: SeasonName, selected: SeasonName[]): boolean {
  return selected.length === 0 || selected.includes(season);
}

/** 기상 그룹 필터 (빈 배열 = 전체 통과) */
export function weatherPass(raw: WeatherRaw | string, selected: WeatherKey[]): boolean {
  return selected.length === 0 || selected.includes(weatherGroup(raw));
}
