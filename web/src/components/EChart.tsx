"use client";

import { useEffect, useRef } from "react";
import { echarts, type EChartsCoreOption } from "@/lib/echarts";
import type { ECharts } from "echarts/core";

type EventHandler = (params: unknown) => void;

interface EChartProps {
  option: EChartsCoreOption;
  /** 컨테이너 높이 (px 또는 CSS 문자열). 기본 320 */
  height?: number | string;
  className?: string;
  /** notMerge 로 setOption — 시리즈 수가 바뀔 때 잔상 방지 */
  replaceMerge?: string[];
  notMerge?: boolean;
  /** ECharts 이벤트 바인딩 (예: { click: fn }) */
  onEvents?: Record<string, EventHandler>;
  /** 인스턴스 접근이 필요할 때 */
  onInit?: (chart: ECharts) => void;
  "aria-label"?: string;
}

export function EChart({
  option,
  height = 320,
  className,
  replaceMerge,
  notMerge,
  onEvents,
  onInit,
  ...rest
}: EChartProps) {
  const elRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ECharts | null>(null);
  const eventsRef = useRef(onEvents);
  eventsRef.current = onEvents;

  // 인스턴스 생성 / 해제
  useEffect(() => {
    if (!elRef.current) return;
    const chart = echarts.init(elRef.current, undefined, { renderer: "canvas" });
    chartRef.current = chart;
    onInit?.(chart);

    const ro = new ResizeObserver(() => chart.resize());
    ro.observe(elRef.current);

    return () => {
      ro.disconnect();
      chart.dispose();
      chartRef.current = null;
    };
    // onInit 는 의도적으로 deps 제외 (마운트 1회)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 옵션 반영
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    chart.setOption(option, {
      notMerge: notMerge ?? false,
      replaceMerge,
    });
  }, [option, notMerge, replaceMerge]);

  // 이벤트 바인딩 (핸들러는 ref로 최신화, 바인딩은 1회)
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !onEvents) return;
    const names = Object.keys(onEvents);
    const handlers: Record<string, EventHandler> = {};
    for (const name of names) {
      const h: EventHandler = (params) => eventsRef.current?.[name]?.(params);
      handlers[name] = h;
      chart.on(name, h);
    }
    return () => {
      for (const name of names) chart.off(name, handlers[name]);
    };
    // 이벤트 이름 목록이 바뀔 때만 재바인딩
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onEvents ? Object.keys(onEvents).join(",") : ""]);

  return (
    <div
      ref={elRef}
      className={className}
      style={{ width: "100%", height: typeof height === "number" ? `${height}px` : height }}
      role="img"
      aria-label={rest["aria-label"]}
    />
  );
}
