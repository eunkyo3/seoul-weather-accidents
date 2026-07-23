"use client";

import { PageHeader, Card, SectionTitle, DataState } from "@/components/ui";
import { HypothesisBanner } from "@/components/HypothesisBanner";
import { FilterBar } from "@/components/FilterBar";
import { useJson } from "@/lib/useJson";
import type { DistrictData } from "@/lib/types";

export default function MapPage() {
  const district = useJson<DistrictData>("district");

  return (
    <div className="mx-auto max-w-6xl animate-rise">
      <PageHeader
        eyebrow="지도"
        title="자치구별 위험도 지도"
        subtitle="서울 25개 자치구 단계구분도. 기상조건 필터에 따라 구별 색이 바뀝니다. 구를 클릭하면 상세가 열립니다."
      />
      <HypothesisBanner id="H3" fallbackTitle="날씨의 영향은 자치구별로 다르게 나타난다" />
      <FilterBar />

      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <Card>
          <SectionTitle title="자치구 단계구분도" hint="색이 진할수록 사고 집중" />
          <DataState state={district} height={460}>
            {() => <div className="h-[460px]" />}
          </DataState>
        </Card>
        <Card>
          <SectionTitle title="구 상세" hint="지도에서 자치구를 선택하세요" />
          <div className="grid h-[460px] place-items-center text-[12.5px] text-muted">
            자치구를 클릭하면 상세 지표가 표시됩니다
          </div>
        </Card>
      </div>
    </div>
  );
}
