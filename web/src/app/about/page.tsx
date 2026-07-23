"use client";

import { PageHeader, Card, SectionTitle, Badge } from "@/components/ui";

const SOURCES = [
  {
    name: "교통사고 데이터",
    detail: "도로교통공단 사고분석 자료 · 2007–2025년 · 19개 연도 파일 · 서울시 중상·사망 약 20만 건",
    note: "발생년월(월 단위), 주야, 시군구, 사고내용, 사망/중상자수, 기상상태, 노면상태, 도로형태, 가해 차종·연령대 등",
  },
  {
    name: "기상 통계",
    detail: "기상청 기상자료개방포털 · 서울 108 지점 · 월별 강수일수·적설일수·강수량·평균기온",
    note: "노출 보정 사고율의 분모로 사용 (로그인·API 키 없이 수집)",
  },
  {
    name: "행정 경계",
    detail: "southkorea/seoul-maps · 서울 25개 자치구 GeoJSON",
    note: "단계구분도(choropleth) 렌더에 사용",
  },
  {
    name: "실시간 날씨",
    detail: "Open-Meteo API · 오늘의 위험도 위젯",
    note: "키·가입 불필요 · 실패 시 수동 선택으로 폴백",
  },
];

const SCOPE = [
  { k: "대상 사고", v: "중상 + 사망 사고만 포함 (경상 제외)" },
  { k: "시간 해상도", v: "월 단위 — 일별/시간대별 날씨-사고 매칭 불가" },
  { k: "공간 해상도", v: "시군구(자치구) 단위 — 좌표 없음, 점 지도 불가" },
  { k: "기간", v: "2007년 1월 ~ 2025년 12월" },
];

const LIMITS = [
  {
    title: "상관 ≠ 인과",
    body: "월 단위 데이터로 확인하는 것은 경향과 상관 관계입니다. 날씨가 사고의 직접 원인임을 증명하지 않으며, 통행량·도로 여건 등 교란 요인이 개입할 수 있습니다.",
  },
  {
    title: "맑음군 분모 근사 (이중 차감)",
    body: "맑음·흐림·기타를 '맑음군'으로 묶고, 분모는 max(1, 월 일수 − 강수일수 − 눈일수)로 근사합니다. 실측에서 눈일수가 강수일수의 부분집합이 아니어서(관측 25개월 위반) 강수·눈 일수를 모두 차감하는 합집합 정의를 채택했습니다. 비·눈이 같은 날 겹치면 이중 차감될 수 있어 맑음군 사고율이 다소 높게(=비·눈 배율이 다소 낮게, 보수적으로) 추정됩니다. 흐림과 맑음도 구분하지 못하는 근사입니다.",
  },
  {
    title: "관측 기준 상이",
    body: "강수일수는 일강수량 ≥0.1mm 기준, 눈일수는 눈 현상 관측 기준이라 미량 적설이 눈일수에만 잡히는 등 두 지표의 관측 기준이 다릅니다.",
  },
  {
    title: "대표비와 per-day 배율 구분",
    body: "맑음군이 전체의 약 85%라 하루당 사고율의 단순 비(比)는 맑음 쪽으로 편향됩니다. 그래서 판정·헤드라인은 노출 보정 '대표비'(그 날씨의 사고 점유율 ÷ 일수 점유율)를 씁니다. 1.0보다 크면 그 날씨에 사고가 과대표집(더 위험)됨을 뜻합니다.",
  },
  {
    title: "가설 기각도 유효한 결과",
    body: "예컨대 적설일에는 통행량 감소로 심각사고율이 예상과 다를 수 있습니다. 가설이 기각되어도(대표비 < 1) 그대로 해석해 제시합니다.",
  },
  {
    title: "카테고리 드리프트",
    body: "연도별로 기상상태 카테고리가 미세하게 다릅니다(예: 일부 연도 '안개' 부재). 안개(연 0~5건)는 정렬 전에 '기타'로 병합했습니다.",
  },
];

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-4xl animate-rise">
      <PageHeader
        eyebrow="데이터 소개"
        title="출처 · 범위 · 한계"
        subtitle="정직한 데이터 원칙에 따라, 이 대시보드가 무엇을 보여주고 무엇을 보여주지 않는지 명시합니다."
      />

      <div className="grid gap-4">
        <Card>
          <SectionTitle title="데이터 출처" />
          <ul className="divide-y divide-border">
            {SOURCES.map((s) => (
              <li key={s.name} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0">
                <div className="flex items-center gap-2">
                  <Badge tone="accent">{s.name}</Badge>
                </div>
                <p className="text-[13.5px] font-medium text-primary">{s.detail}</p>
                <p className="text-[12px] leading-relaxed text-muted">{s.note}</p>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <SectionTitle title="분석 범위" />
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            {SCOPE.map((s) => (
              <div key={s.k} className="flex flex-col gap-0.5">
                <dt className="text-[11.5px] font-semibold uppercase tracking-wide text-muted">{s.k}</dt>
                <dd className="text-[13.5px] font-medium text-primary">{s.v}</dd>
              </div>
            ))}
          </dl>
        </Card>

        <Card>
          <SectionTitle title="노출 보정 지표 정의" hint="AC-4의 핵심 — 손 흔들기 없이 명문화" />
          <div className="space-y-2 rounded-xl bg-surface-2 p-4 text-[13px] leading-relaxed text-secondary">
            <p>
              <span className="font-semibold text-primary">비 사고율</span> = 해당 월 「기상=비」 사고 건수 ÷ 기상청 월
              강수일수(일강수 ≥0.1mm)
            </p>
            <p>
              <span className="font-semibold text-primary">눈 사고율</span> = 해당 월 「기상=눈」 사고 건수 ÷ 월
              눈일수 (관측 있는 월만)
            </p>
            <p>
              <span className="font-semibold text-primary">맑음군 사고율</span> = 「맑음·흐림·기타」 사고 건수 ÷ max(1,
              월 일수 − 강수일수 − 눈일수)
            </p>
            <p>
              <span className="font-semibold text-primary">대표비 (판정·헤드라인 정본)</span> = 그 날씨의 사고 점유율 ÷
              일수 점유율. <span className="text-muted">1.0보다 크면 과대표집(더 위험).</span>
            </p>
            <p className="text-muted">
              per-day 배율(사고율 ÷ 맑음군 사고율)은 맑음 지배 라벨로 편향되어 참고·기술 표시용으로만 씁니다.
            </p>
          </div>
        </Card>

        <Card>
          <SectionTitle title="한계와 유의점" />
          <div className="grid gap-3 sm:grid-cols-2">
            {LIMITS.map((l) => (
              <div key={l.title} className="rounded-xl border border-border bg-surface-2 p-3.5">
                <p className="mb-1 flex items-center gap-1.5 text-[13px] font-bold text-primary">
                  <span className="text-warning">⚠</span>
                  {l.title}
                </p>
                <p className="text-[12px] leading-relaxed text-muted">{l.body}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <SectionTitle title="재현" hint="한 방 재현 원칙" />
          <p className="text-[13px] leading-relaxed text-secondary">
            전체 파이프라인부터 화면까지{" "}
            <code className="rounded bg-surface-3 px-1.5 py-0.5 font-mono text-[12px] text-primary">
              docker compose up
            </code>{" "}
            한 명령으로 로컬에서 재현됩니다. 파이프라인은 같은 입력이면 항상 같은 JSON을 산출합니다(결정적).
          </p>
        </Card>
      </div>
    </div>
  );
}
