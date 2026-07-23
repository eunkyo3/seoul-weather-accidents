"use client";

import { PageHeader, Card, SectionTitle, DataState } from "@/components/ui";
import { HypothesisBanner } from "@/components/HypothesisBanner";
import { FilterBar } from "@/components/FilterBar";
import { useJson } from "@/lib/useJson";
import type { FactsData } from "@/lib/types";

export default function CrossPage() {
  const facts = useJson<FactsData>("facts");

  return (
    <div className="mx-auto max-w-6xl animate-rise">
      <PageHeader
        eyebrow="크로스 분석"
        title="날씨 × 심층 축 교차"
        subtitle="날씨와 주야·도로형태·차종·연령대를 교차해 어떤 조건에서 위험이 증폭되는지 봅니다. 축을 자유롭게 조합할 수 있습니다."
      />
      <HypothesisBanner id="H4" fallbackTitle="날씨 영향은 주야·도로형태·차종·연령대에 따라 증폭/약화된다" />
      <FilterBar />

      <Card>
        <SectionTitle title="교차 히트맵" hint="facts.json 을 클라이언트에서 group-by (Arquero)" />
        <DataState state={facts} height={420} emptyHint="facts.json 산출 후 축 조합 히트맵이 활성화됩니다.">
          {() => <div className="h-[420px]" />}
        </DataState>
      </Card>
    </div>
  );
}
