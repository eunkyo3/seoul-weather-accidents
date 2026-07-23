/**
 * 대시보드 전역 색상 시스템 — 단일 진실 원천(single source of truth).
 *
 * dataviz 스킬의 검증된 팔레트에서 파생. 날씨 3개 카테고리(맑음군/비/눈)는
 * 모든 차트·페이지에서 아래 고정 색을 일관되게 사용한다.
 * light/dark 두 모드 모두 CVD(색각이상) 검증 통과:
 *   - 비/맑음군/눈 = blue/amber/aqua, 양쪽 모드 all-pairs PASS
 * ECharts는 canvas 렌더라 CSS 변수를 직접 못 읽으므로 여기 hex를 그대로 쓴다.
 * globals.css의 CSS 변수와 값이 동기화되어야 한다.
 */

export type ThemeMode = "light" | "dark";

/** 날씨 카테고리 정본(canonical) 키 */
export type WeatherKey = "clear" | "rain" | "snow";

/** 날씨 카테고리 한국어 라벨 */
export const WEATHER_LABEL: Record<WeatherKey, string> = {
  clear: "맑음군",
  rain: "비",
  snow: "눈",
};

/** 데이터의 기상상태 원본 값 → 정본 키 매핑 (맑음·흐림·기타 → clear) */
export const WEATHER_KEY_BY_RAW: Record<string, WeatherKey> = {
  맑음: "clear",
  흐림: "clear",
  기타: "clear",
  맑음군: "clear",
  비: "rain",
  눈: "snow",
};

/** 날씨별 고정 색 (검증 완료) */
export const WEATHER_COLORS: Record<ThemeMode, Record<WeatherKey, string>> = {
  light: {
    clear: "#eda100", // amber — 해
    rain: "#2a78d6", // blue — 물
    snow: "#1baf7a", // aqua — 얼음
  },
  dark: {
    clear: "#c98500",
    rain: "#3987e5",
    snow: "#199e70",
  },
};

/** 심각도(사망/중상) 색 — 상태(status) 계열, 날씨색과 구분 */
export const SEVERITY_COLORS: Record<ThemeMode, { fatal: string; serious: string }> = {
  light: { fatal: "#d03b3b", serious: "#eb6834" },
  dark: { fatal: "#e66767", serious: "#d95926" },
};

export const SEVERITY_LABEL = { fatal: "사망", serious: "중상" } as const;

/**
 * 범용 categorical 팔레트 (크로스 분석의 임의 축 시리즈용).
 * dataviz 검증 순서 그대로. 인접 CVD 통과. 최대 8개, 초과 시 "기타"로 접기.
 */
export const CATEGORICAL: Record<ThemeMode, string[]> = {
  light: ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"],
  dark: ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9", "#e66767"],
};

/** 순차(sequential) blue 램프 — choropleth·heatmap 자기값 인코딩 */
export const SEQ_BLUE: Record<ThemeMode, string[]> = {
  light: ["#eef4fc", "#cde2fb", "#9ec5f4", "#6da7ec", "#3987e5", "#256abf", "#184f95", "#0d366b"],
  dark: ["#12233d", "#16345c", "#184f95", "#256abf", "#3987e5", "#5598e7", "#86b6ef", "#cde2fb"],
};

/** 날씨 hue 기반 순차 램프 (weather 필터 활성 시 choropleth 틴트) */
export const SEQ_BY_WEATHER: Record<ThemeMode, Record<WeatherKey, [string, string]>> = {
  light: {
    clear: ["#fbf1d6", "#b57900"],
    rain: ["#dcebfb", "#184f95"],
    snow: ["#d6f2e6", "#0f7a54"],
  },
  dark: {
    clear: ["#241d0a", "#e0a83a"],
    rain: ["#0f2036", "#6da7ec"],
    snow: ["#0c231a", "#3fbf90"],
  },
};

/** 차트 크롬(축·격자·잉크) — globals.css와 동기화 */
export const CHROME: Record<
  ThemeMode,
  {
    surface: string;
    pagePlane: string;
    textPrimary: string;
    textSecondary: string;
    muted: string;
    grid: string;
    axis: string;
    tooltipBg: string;
    tooltipBorder: string;
  }
> = {
  light: {
    surface: "#ffffff",
    pagePlane: "#f4f6f9",
    textPrimary: "#0f1729",
    textSecondary: "#475069",
    muted: "#8a93a6",
    grid: "#e6e9ef",
    axis: "#cfd5df",
    tooltipBg: "rgba(255,255,255,0.98)",
    tooltipBorder: "rgba(15,23,41,0.10)",
  },
  dark: {
    surface: "#12161f",
    pagePlane: "#0b0e14",
    textPrimary: "#f1f4f9",
    textSecondary: "#a8b3c4",
    muted: "#6b7688",
    grid: "#232a37",
    axis: "#2f3745",
    tooltipBg: "rgba(18,22,31,0.98)",
    tooltipBorder: "rgba(255,255,255,0.12)",
  },
};

/** 계절 색 (추이 페이지 보조) — 봄/여름/가을/겨울 */
export const SEASON_LABEL = ["봄", "여름", "가을", "겨울"] as const;
export type Season = (typeof SEASON_LABEL)[number];
export const SEASON_COLORS: Record<ThemeMode, Record<Season, string>> = {
  light: { 봄: "#1baf7a", 여름: "#e34948", 가을: "#eb6834", 겨울: "#2a78d6" },
  dark: { 봄: "#199e70", 여름: "#e66767", 가을: "#d95926", 겨울: "#3987e5" },
};

export function weatherColor(mode: ThemeMode, key: WeatherKey): string {
  return WEATHER_COLORS[mode][key];
}
