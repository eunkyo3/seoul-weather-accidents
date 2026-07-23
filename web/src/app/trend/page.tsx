"use client";

import { PageHeader, Card, SectionTitle, DataState } from "@/components/ui";
import { HypothesisBanner } from "@/components/HypothesisBanner";
import { FilterBar } from "@/components/FilterBar";
import { useJson } from "@/lib/useJson";
import type { TrendData } from "@/lib/types";

export default function TrendPage() {
  const trend = useJson<TrendData>("trend");

  return (
    <div className="mx-auto max-w-6xl animate-rise">
      <PageHeader eyebrow="계절·추이" title="계절과 월별 사고 추이" subtitle="연도 비교로 계절성 패턴을 확인합니다." />
      <HypothesisBanner id="H1" fallbackTitle="계절에 따라 사고 발생 패턴이 뚜렷이 다르다" />
      <FilterBar />

      <div className="grid gap-4">
        <Card>
          <SectionTitle title="월별 사고 추이" hint="연도별 라인/영역 비교" />
          <DataState state={trend} height={360}>
            {() => <div className="h-[360px]" />}
          </DataState>
        </Card>
        <Card>
          <SectionTitle title="계절별 요약" hint="봄·여름·가을·겨울 건수와 사망자" />
          <DataState state={trend} height={300}>
            {() => <div className="h-[300px]" />}
          </DataState>
        </Card>
      </div>
    </div>
  );
}
