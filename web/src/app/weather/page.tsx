"use client";

import { PageHeader, Card, SectionTitle, DataState } from "@/components/ui";
import { HypothesisBanner } from "@/components/HypothesisBanner";
import { FilterBar } from "@/components/FilterBar";
import { useJson } from "@/lib/useJson";
import type { WeatherData, ExposureData } from "@/lib/types";

export default function WeatherPage() {
  const weather = useJson<WeatherData>("weather");
  const exposure = useJson<ExposureData>("exposure");

  return (
    <div className="mx-auto max-w-6xl animate-rise">
      <PageHeader
        eyebrow="기상 분석"
        title="맑은 날 vs 비·눈 오는 날"
        subtitle="절대 건수와 기상청 월별 데이터로 노출 보정한 하루당 사고율을 나란히 제시합니다."
      />
      <HypothesisBanner id="H2" fallbackTitle="비·눈 오는 날은 맑은 날보다 하루당 사고율이 높다" />
      <FilterBar />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionTitle title="기상별 절대 건수" hint="맑음군 · 비 · 눈" />
          <DataState state={weather} height={320}>
            {() => <div className="h-[320px]" />}
          </DataState>
        </Card>
        <Card>
          <SectionTitle title="노출 보정 하루당 사고율" hint="맑은 날 대비 배율 강조" />
          <DataState state={exposure} height={320}>
            {() => <div className="h-[320px]" />}
          </DataState>
        </Card>
        <Card className="lg:col-span-2">
          <SectionTitle title="노면상태 × 심각도" hint="보조 분석" />
          <DataState state={weather} height={280}>
            {() => <div className="h-[280px]" />}
          </DataState>
        </Card>
      </div>
    </div>
  );
}
