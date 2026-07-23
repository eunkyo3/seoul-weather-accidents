/**
 * ECharts 트리셰이킹 등록 — 사용하는 차트/컴포넌트만 번들에 포함.
 * 모든 차트는 이 모듈의 `echarts` 를 임포트해 쓴다.
 */
import * as echarts from "echarts/core";
import { LineChart, BarChart, HeatmapChart, MapChart, CustomChart, PieChart } from "echarts/charts";
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  VisualMapComponent,
  DataZoomComponent,
  TitleComponent,
  MarkLineComponent,
  MarkAreaComponent,
  GraphicComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import type { EChartsCoreOption } from "echarts/core";
import { CHROME, type ThemeMode } from "./palette";

echarts.use([
  LineChart,
  BarChart,
  HeatmapChart,
  MapChart,
  CustomChart,
  PieChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  VisualMapComponent,
  DataZoomComponent,
  TitleComponent,
  MarkLineComponent,
  MarkAreaComponent,
  GraphicComponent,
  CanvasRenderer,
]);

export { echarts };
export type { EChartsCoreOption };

const FONT =
  '"Pretendard","Pretendard Variable",-apple-system,BlinkMacSystemFont,system-ui,"Segoe UI","Malgun Gothic","맑은 고딕","Noto Sans KR",sans-serif';

/**
 * 테마별 공통 옵션 조각. 각 차트는 이걸 펴서(merge) 위에 series 등을 얹는다.
 */
export function baseOption(mode: ThemeMode): EChartsCoreOption {
  const c = CHROME[mode];
  return {
    textStyle: { fontFamily: FONT, color: c.textSecondary },
    animationDuration: 600,
    animationEasing: "cubicOut",
    grid: {
      left: 8,
      right: 18,
      top: 28,
      bottom: 8,
      containLabel: true,
    },
    tooltip: {
      backgroundColor: c.tooltipBg,
      borderColor: c.tooltipBorder,
      borderWidth: 1,
      padding: [10, 12],
      extraCssText: "backdrop-filter:blur(8px);border-radius:12px;box-shadow:0 8px 28px rgba(0,0,0,0.22);",
      textStyle: { color: c.textPrimary, fontSize: 12, fontFamily: FONT },
    },
    legend: {
      textStyle: { color: c.textSecondary, fontFamily: FONT, fontSize: 12 },
      icon: "roundRect",
      itemWidth: 12,
      itemHeight: 12,
      itemGap: 16,
    },
  };
}

/** 카테고리 축 공통 스타일 */
export function catAxis(mode: ThemeMode) {
  const c = CHROME[mode];
  return {
    axisLine: { lineStyle: { color: c.axis } },
    axisTick: { show: false },
    axisLabel: { color: c.muted, fontSize: 11, fontFamily: FONT },
    splitLine: { show: false },
  };
}

/** 값 축 공통 스타일 */
export function valAxis(mode: ThemeMode) {
  const c = CHROME[mode];
  return {
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: { color: c.muted, fontSize: 11, fontFamily: FONT },
    splitLine: { lineStyle: { color: c.grid, type: [4, 4] as [number, number] } },
  };
}
