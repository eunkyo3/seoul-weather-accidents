/** 6개 라우트 정의 — 사이드바 내비게이션과 페이지가 공유 */

export interface NavItem {
  href: string;
  label: string;
  desc: string;
  /** 관련 가설 ID (개요는 없음) */
  hypothesis?: "H1" | "H2" | "H3" | "H4";
  icon: string; // inline SVG path (24x24 viewBox, stroke)
}

export const NAV: NavItem[] = [
  {
    href: "/",
    label: "개요",
    desc: "핵심 지표와 가설 요약",
    icon: "M3 12l9-9 9 9M5 10v10h5v-6h4v6h5V10",
  },
  {
    href: "/trend",
    label: "계절·추이",
    desc: "월별·계절별 사고 추이",
    hypothesis: "H1",
    icon: "M3 17l6-6 4 4 8-8M21 7v6M21 7h-6",
  },
  {
    href: "/weather",
    label: "기상 분석",
    desc: "노출 보정 사고율 비교",
    hypothesis: "H2",
    icon: "M7 18a5 5 0 010-10 6 6 0 0111.5 1.5A4 4 0 0117 18zM8 21l-1 2M12 21l-1 2M16 21l-1 2",
  },
  {
    href: "/map",
    label: "지도",
    desc: "25개 자치구 단계구분도",
    hypothesis: "H3",
    icon: "M9 3L3 6v15l6-3 6 3 6-3V3l-6 3-6-3zM9 3v15M15 6v15",
  },
  {
    href: "/cross",
    label: "크로스 분석",
    desc: "날씨 × 심층 축 교차",
    hypothesis: "H4",
    icon: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
  },
  {
    href: "/about",
    label: "데이터 소개",
    desc: "출처·범위·한계 명시",
    icon: "M12 22a10 10 0 100-20 10 10 0 000 20zM12 16v-5M12 8h.01",
  },
];
