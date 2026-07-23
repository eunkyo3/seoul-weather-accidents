# Work Plan: 날씨와 서울시 교통사고 인터랙티브 대시보드

- Status: **pending approval** (Planner/Architect/Critic 합의 완료 — 실행은 별도 승인 필요)
- Source spec: `.omc/specs/deep-interview-weather-accident-dashboard.md` (ambiguity 15%, PASSED)
- Generated: 2026-07-23
- Mode: RALPLAN-DR short / non-interactive

## Requirements Summary

대학 빅데이터-기획 PBL 과제. `data/사고분석-{2007..2025}.xlsx` 19개 파일(동일 스키마 22컬럼, 서울시 중상·사망사고 약 20만 건)을 Python 파이프라인으로 집계하고, **Next.js 인터랙티브 대시보드**로 시각화한다. 필수 분석 4개: ① 계절·월별 추이, ② 기상상태별 사고율(기상청 월별 데이터 노출 보정 포함), ③ 25개 자치구 단계구분도, ④ 날씨×심층 크로스 분석. 시연은 **로컬 `docker compose up`** 하나로 재현. 시각 완성도가 최우선 평가 기준. 기한 여유 1개월+. 빅데이터 **기획** 과목이므로 대시보드는 차트 모음이 아니라 **가설(H1~H4) 검증 서사**로 구성한다 (스펙 "Hypotheses" 섹션 참조).

## 가설 정의 (H1~H4)

| ID | 가설 | 검증 지표 | 검증 화면 |
|----|------|-----------|-----------|
| H1 | 계절에 따라 사고 발생 패턴이 뚜렷이 다르다 | 계절·월별 건수/사망자 추이 | 계절·추이 (AC-3) |
| H2 | 비·눈 오는 날은 맑은 날보다 하루당 사고율이 높다 | 노출 보정 사고율 + 맑음군 대비 배율 | 기상 분석 (AC-4) |
| H3 | 날씨의 영향은 자치구별로 다르게 나타난다 | 기상조건 필터별 구 단위 분포 변화 | 지도 (AC-5) |
| H4 | 날씨 영향은 주야·도로형태·차종·연령대에 따라 증폭/약화된다 | 날씨×축 교차 히트맵 | 크로스 분석 (AC-6) |

- 판정(supported/partial/rejected)은 **파이프라인이 결정적으로 산출** — 판정 규칙(임계값)은 Phase 0-2에서 확정하고 `SCHEMAS.md`에 명문화. 초안 예시: H2는 배율 ≥1.5 지지, 1.0~1.5 부분 지지, <1.0 기각 (확정은 프로파일링 실측 후).
- 월 단위 데이터의 한계상 **상관/경향**이며 인과가 아님을 화면에 명시. 가설 기각도 유효한 결과로 그대로 제시.

## RALPLAN-DR Summary (short)

### Principles
1. **화면이 왕이다** — 모든 기술 선택은 발표 화면의 인상과 반응성을 기준으로 판단한다.
2. **정적 우선** — 런타임 DB·API 서버 없이 사전 집계 JSON만으로 동작하게 하여 시연 리스크를 제거한다.
3. **한 방 재현** — `docker compose up` 단일 명령으로 파이프라인부터 화면까지 재현 가능해야 한다.
4. **정직한 데이터** — 데이터 한계(월 단위, 중상·사망 한정, 좌표 없음)를 화면에 명시한다.
5. **결정적 파이프라인** — 같은 입력이면 항상 같은 JSON이 나온다 (임의성·시점 의존 없음).

### Decision Drivers
1. 발표 시연의 시각적 임팩트와 안정성 (오프라인 로컬 실행)
2. 사용자의 요구 스택(React/Next.js)과 제작 기간(1개월+)의 균형
3. 데이터 해상도 제약(월 단위, 시군구 단위) 안에서 의미 있는 지표 도출

### Viable Options

**Option A — 정적 집계 JSON + Next.js (standalone) + ECharts** *(선택)*
- 접근: Python(pandas) 파이프라인이 `web/public/data/*.json` 사전 집계 생성 → Next.js가 클라이언트에서 로드·필터링 → ECharts로 차트·GeoJSON choropleth 렌더
- Pros: 시연 시 실패 지점 최소(정적 파일만), 필터링이 전부 클라이언트 메모리에서 즉각 반응, ECharts는 지도·애니메이션·다크테마 내장, compose 구성 단순
- Cons: 집계 축 조합이 늘면 JSON 설계가 중요해짐(사전 집계 설계 필요), 원본 행 단위 탐색은 불가

**Option B — Next.js API Routes + DuckDB(원본 적재)**
- 접근: 원본 20만 행을 DuckDB/Parquet로 적재하고 API Route에서 즉석 쿼리
- Pros: 임의 조합 쿼리 자유, 집계 설계 부담 없음
- Cons: 서버 의존으로 시연 실패 지점 증가, 구현 난이도·시간 비용 큼, 20만 행 수준에선 과잉 설계, 클라이언트 반응성은 오히려 낮아질 수 있음

**invalidation rationale**: 데이터가 고정된 과거 데이터(재수집 없음)이고 규모가 작아(집계 후 수 MB) 서버 기반 Option B의 유연성이 실익이 없다. Principles 2·3(정적 우선, 한 방 재현)에 따라 Option A 선택.

**Architect 종합안 채택 (하이브리드)**: Option A의 사전 집계 축 고정(axis-lock) 리스크를 해소하기 위해, 화면별 사전 집계 JSON에 더해 **경량 그룹화 팩트 테이블**(`facts.json`: 기상상태×구×연월×주야×도로형태×차종×연령대 조합별 건수·사망자수, 그룹화 후 수 MB 이내)을 함께 출력한다. 크로스 분석 페이지는 이 팩트 테이블을 클라이언트에서 Arquero로 자유 group-by하여 임의 축 조합 필터가 가능하다. 서버 추가 없이 정적 원칙 유지.

## Architecture

```
D:\nujino
├── data/                      # 원본 엑셀 19개 (기존, 불변)
│   └── weather/               # [신규] 기상청 월별 통계 CSV (1회 수집, 커밋)
├── pipeline/
│   ├── build_aggregates.py    # 엑셀+기상 CSV → JSON 집계 (결정적)
│   ├── requirements.txt       # pandas, openpyxl
│   └── Dockerfile
├── web/                       # Next.js (App Router, TypeScript)
│   ├── public/data/*.json     # 파이프라인 산출물 (git ignore, compose가 생성)
│   ├── public/geo/seoul.json  # 서울 25개구 GeoJSON (커밋)
│   ├── src/app/               # 페이지: 개요/추이/기상/지도/크로스/데이터소개
│   ├── src/components/charts/ # ECharts 래퍼 컴포넌트
│   └── Dockerfile
└── docker-compose.yml         # pipeline(1회 실행) → web(빌드·서빙), 공유 볼륨
```

- **차트**: ECharts(`echarts` + 얇은 React 래퍼) — choropleth는 `echarts.registerMap('seoul', geojson)`
- **GeoJSON 출처 고정**: `southkorea/seoul-maps` 저장소의 municipalities GeoJSON (공공 라이선스) — 커밋 시 출처·라이선스·다운로드 URL을 `web/public/geo/README.md`에 기록
- **기상청 데이터**: 기상자료개방포털 통계분석 코너의 CSV 엔드포인트로 **로그인·API 키 없이** 수집 (2026-07 실측 검증 완료, 지표당 요청 1회씩 총 4회). `pipeline/fetch_weather.py`가 아래 4개를 받아 `data/weather/`에 저장·커밋 → 시연·빌드 시 네트워크 불필요:
  - 강수일수: `POST /stcs/grnd/downloadGrndRnDayList.do` (rnElement=RN, dataFormCd=F00513, schType=2, schStnId=108, startYear/endYear/startMonth/endMonth) ✅ 검증됨
  - 눈일수: `POST /climate/snw/selectSnwDownload.do` (dataFormCd=F00513, schStnId=108, startMt/endMt 포함) ✅ 검증됨
  - 월평균기온: `POST /stcs/grnd/downloadGrndTaList.do` (taElement=AVG, **stnId**=108, startDt=200701&endDt=202512) ✅ 검증됨 (평균·최저·최고 포함)
  - 월강수량: `POST /stcs/grnd/downloadGrndRnList.do` — 기간은 수신되나 행이 월합계가 아닌 다중 행(관측소 혼재 추정)이라 **파라미터 재조정 또는 의미 확정 후 집계 필요** (분모 아님, 보조 지표라 비크리티컬)
  - 공통: 응답 인코딩 cp949, 내부 비공식 엔드포인트이므로 1회 수집 후 커밋 원칙 유지 (스크립트는 재현 증빙용)
- **실시간 날씨(오늘의 위험도 위젯)**: Open-Meteo API(키·가입 불필요, 클라이언트 fetch) — 실패·오프라인 시 날씨 수동 선택 토글로 폴백
- **compose**: `pipeline` 서비스가 명명 볼륨에 JSON 생성 후 종료 → `web` 서비스가 `depends_on: condition: service_completed_successfully`로 기동

## Implementation Steps

### Phase 0 — 프로파일링 & 데이터 계약 (게이트, Phase 1 착수 전 완료 필수)
0-1. **전수 프로파일링**: 19개 파일 전체의 고유 시군구·기상상태·노면상태·연령대 값, 결측 수를 스캔해 `pipeline/profile_report.md`로 출력 — 검증된 양 끝단(2007·2025)과 중간 연도의 스키마 일치 확인 (2025년에 `안개` 부재 등 연도별 카테고리 드리프트 명시). **`facts.json` 7축 조합의 실제 고유 조합 수와 예상 파일 크기(gzip)를 함께 산출**하여 예산 8MB(gzip) 이내인지 검증 — 초과 시 폴백: ① 기여도 최하 축(가해연령대 또는 도로형태) 제거, ② 연도별 파일 분할 로드, 순서로 적용
0-2. **노출 보정 지표 정의 확정** (AC-4의 핵심, 손 흔들기 금지):
   - 비 사고율 = 해당 월 `기상상태=비` 사고 건수 ÷ 기상청 월 강수일수
   - 눈 사고율 = 해당 월 `기상상태=눈` 사고 건수 ÷ 기상청 월 적설일수(관측 있는 월만)
   - 맑음군 사고율 = `기상상태∈{맑음,흐림,기타}` 사고 건수 ÷ (월 일수 − 강수일수) — **적설일수는 강수일수의 부분집합(눈=강수)이므로 이중 차감 금지**; 흐림·맑음 구분 불가 근사임을 명시. 채택한 집합 연산은 `SCHEMAS.md`에 명문화하고, 프로파일링에서 적설일수>강수일수인 월이 발견되면 합집합 정의(월 일수 − |강수∪적설|)로 전환
   - 배율 지표 = 비/눈 사고율 ÷ 맑음 사고율. 월 단위 해상도·카테고리 근사의 한계를 데이터 소개 페이지에 그대로 공개
   - **가설 판정 규칙 확정**: H1~H4 각각의 지지/부분 지지/기각 임계값을 프로파일링 실측을 참고해 확정하고 `SCHEMAS.md`에 명문화 (판정은 파이프라인 산출, 수동 판정 금지)
0-3. **화면-주도 JSON 계약 동결**: 6개 페이지 × 필요 데이터 매트릭스 작성 → 각 JSON 파일의 스키마(필드·타입·카테고리 순서)를 `pipeline/SCHEMAS.md`로 동결하고 목(mock) 픽스처 생성 → Phase 2 UI 작업이 파이프라인 완성 전에 병렬 착수 가능

### Phase 1 — 데이터 파이프라인 (pipeline/)
1. `pipeline/build_aggregates.py`: 19개 엑셀 로드·통합 (컬럼 스키마 검증 포함, `발생년월` 한국어 문자열("2007년 1월") → year/month 파싱, 계절 파생)
2. 정제 규칙: 기상 `안개`(연 0~5건)는 **카테고리 정렬 전에** `기타`로 병합, 시군구 "서울특별시 " 접두 제거, 정본(canonical) 카테고리 순서 고정, 결측·이상치 리포트 출력
3. 집계 JSON 출력 (스키마는 Phase 0-3에서 동결된 `SCHEMAS.md`를 따름; `sort_keys` + 고정 소수 자릿수 + 정렬된 인덱스로 바이트 결정성 보장):
   - `meta.json` — 기간, 총 건수, 사망·중상 합계, 마지막 빌드 정보
   - `trend.json` — 연×월×사고내용별 건수·사망자수 (계절 파생 포함)
   - `weather.json` — 연×월×기상상태별 건수·사망자·중상자
   - `exposure.json` — 기상청 월별(강수일수·적설일수·강수량·평균기온) + Phase 0-2 정의에 따른 3개 사고율(비÷강수일수, 눈÷적설일수, 맑음군÷잔여일수)과 맑음 대비 배율
   - `district.json` — 구×연×기상상태별 건수 (인구·면적 보정은 선택 확장)
   - `facts.json` — 그룹화 팩트 테이블(기상상태×구×연월×주야×도로형태×가해차종×가해연령대별 건수·사망자수) — 크로스 분석 페이지가 Arquero로 클라이언트 group-by
   - `hypotheses.json` — H1~H4별 핵심 지표 값·판정(supported/partial/rejected)·근거 수치 (Phase 0-2 판정 규칙 적용, 결정적 산출)
4. `data/weather/` 기상청 월자료 CSV 수집·커밋 — `fetch_weather.py`가 Architecture에 명시된 검증 완료 엔드포인트 4개 호출 (강수량만 파라미터 재조정 후 확정), cp949 디코딩·커버리지 검증(228개월) 포함
5. 단위 테스트(`pipeline/test_build.py`, pytest): 스키마 검증, 계절 매핑, 노출 보정 계산, 총합 보존(집계 합 = 원본 행수)

### Phase 2 — Next.js 대시보드 (web/)
6. Next.js 스캐폴드 (TypeScript, App Router, Tailwind), 한국어 UI, 다크 기본 테마
7. 공용 레이어: JSON 로더 훅(**모든 데이터 JSON은 런타임에 클라이언트 fetch — `next build`는 파이프라인 산출물에 의존하지 않으며, 볼륨 오버레이된 `public/data/`를 서빙만 함**), 전역 필터 상태(연도 범위·계절·기상·자치구, URL 쿼리 동기화), ECharts 래퍼, 크로스 페이지용 Arquero group-by 유틸
7.5. **가설 배너 공용 컴포넌트**: 각 분석 페이지 상단에 "가설: … → 데이터 판정: 지지/부분 지지/기각" 배너 (`hypotheses.json` 소비, 근거 수치 툴팁 포함)
8. **개요 페이지**: KPI 카드(총 사고, 사망자, "비 올 때 하루당 사고 ×N배" 헤드라인), **H1~H4 검증 결과 요약 카드 4장**, 하이라이트 차트
8.5. **"오늘의 위험도" 위젯** (개요 페이지 상단, AC-15): Open-Meteo로 서울 현재 날씨 조회 → 날씨를 {맑음군/비/눈}으로 매핑 → `exposure.json`의 해당 조건·현재 월 노출 보정 사고율 배율을 "과거 통계상 오늘 같은 날씨의 사고 위험 ×N배"로 표시. **"예측" 문구 금지, "과거 통계 조회" 표기.** API 실패·오프라인 시 날씨 수동 선택 토글로 자동 전환(수동 토글은 발표 중 "비라면? 눈이라면?" 인터랙티브 데모로도 사용). 위젯 하나로 한정 — 별도 페이지 확장 금지
9. **계절·추이 페이지** (AC-3): 월별 라인/영역 차트 + 연도 비교, 계절별 박스/막대
10. **기상 분석 페이지** (AC-4): 기상별 절대 건수 + 노출 보정 사고율 병렬 제시, 노면상태×심각도 보조 차트
11. **지도 페이지** (AC-5): 서울 25개구 choropleth, 기상조건 필터 연동, 구 클릭 시 상세 패널
12. **크로스 분석 페이지** (AC-6): 날씨×주야, 날씨×도로형태/차종/연령대 히트맵·그룹 막대 (최소 2축)
13. **데이터 소개 페이지** (AC-10): 출처, 범위(중상+사망 한정), 월 단위 해상도 한계 명시

### Phase 3 — Docker Compose & 마감 (AC-8)
14. `pipeline/Dockerfile`, `web/Dockerfile`(multi-stage: deps→build→standalone run), `docker-compose.yml`(공유 볼륨, 기동 순서)
15. README: `docker compose up` 시연 절차, 프로젝트 구조, 데이터 출처
16. E2E 스모크: compose 기동 후 각 페이지 HTTP 200 + 핵심 차트 렌더 확인(Playwright 선택)

## Risks and Mitigations
| Risk | Mitigation |
|------|------------|
| 사전 집계 축 누락으로 화면 요구 미충족 | Phase 0-3 데이터 계약 게이트로 스키마 사전 동결 + `facts.json` 팩트 테이블로 임의 축 조합 커버 |
| 노출 보정 지표의 통계적 근사(월 단위·카테고리 불일치)가 발표에서 공격받음 | Phase 0-2에서 정의 확정, 근사·한계를 데이터 소개 페이지에 선제 공개 (정직한 데이터 원칙) |
| 기상청 CSV 수집 실패/포맷 상이 | 무로그인 엔드포인트 4개 실측 검증 완료(강수일수·눈일수·기온 전량 수신); 강수량만 재조정 필요. 폐쇄 시 1회 수동 다운로드 폴백; exposure 지표만 분리되어 있어 나머지 화면은 영향 없음 |
| 오늘의 위험도 위젯 API 장애(발표장 네트워크 등) | 날씨 수동 선택 토글 폴백 내장 — 오프라인에서도 위젯 완전 동작 (AC-15) |
| GeoJSON 구 명칭 ≠ 데이터 시군구 명칭 | 파이프라인에서 명칭 정규화 + 25개 구 전수 매칭 테스트 |
| Windows에서 docker 볼륨 권한/경로 문제 | 명명 볼륨 사용(호스트 바인드 최소화), Windows에서 compose 실제 검증 |
| ECharts 번들 크기 | 사용 모듈만 임포트(tree-shaking), standalone 빌드 |
| 대시보드 완성도가 "발표용"에 못 미침 | Phase 2 후 designer 폴리시 패스 1회 + 실제 발표 시나리오로 리허설 |

## Verification Steps
1. `pytest pipeline/` 전체 통과 (스키마·총합 보존·보정 계산)
2. `python pipeline/build_aggregates.py` 2회 실행 → 산출 JSON 바이트 동일 (결정성)
3. `docker compose up` 클린 환경 기동 → `http://localhost:3000` 접속, 6개 페이지 렌더 확인
4. AC-1~AC-10 체크리스트 전수 확인 (스펙 문서 기준)
5. 필터 조작(연도·계절·기상·구) 시 모든 차트 갱신 확인

## Acceptance Criteria
스펙의 AC-1~AC-10을 그대로 상속하며, 다음을 구체화:
- [ ] AC-2': 파이프라인 재실행 시 JSON 산출물이 바이트 단위로 동일
- [ ] AC-4': 노출 보정 지표는 Phase 0-2 정의를 따름 — 비 사고율=비 사고÷강수일수, 눈 사고율=눈 사고÷적설일수, 맑음군 사고율={맑음,흐림,기타} 사고÷(월 일수−강수일수), 배율=비/눈 사고율÷맑음군 사고율
- [ ] AC-4'': 눈 사고율은 적설 관측이 있는 월만 산출하며, 맑음군 분모는 **max(1, 월 일수 − 강수일수 − 눈일수)** [union 근사 — Phase 0-2 실측에서 눈⊆강수 가정이 25개월 위반되어 계획된 폴백 발동, 비·눈 중복일 이중 차감 가능성은 보수적(배율 하향) 방향]를 테스트로 보장(전 월 분모 ≥ 1 검증); 잔여일수 근사(흐림·맑음 구분 불가)는 데이터 소개 페이지에 명시
- [ ] AC-11: `facts.json` gzip 크기 ≤ 8MB (프로파일링 실측 기반, 초과 시 계획된 폴백 적용 근거 기록)
- [ ] AC-5': GeoJSON 25개 구 ↔ 데이터 시군구 100% 매칭 테스트 통과
- [ ] AC-8': 클린 머신 기준 `docker compose up` 외 수동 단계 0개
- [ ] AC-12: 각 분석 화면 상단에 해당 가설(H1~H4)과 판정 배너 표시 (`hypotheses.json` 소비)
- [ ] AC-13: 개요 페이지에 H1~H4 검증 결과 요약 카드 4장 표시
- [ ] AC-14: 가설 판정 규칙이 `SCHEMAS.md`에 명문화되고 파이프라인이 결정적으로 산출 (재실행 시 판정 동일, pytest 검증)
- [ ] AC-15: 개요 페이지 "오늘의 위험도" 위젯 — Open-Meteo 실시간 조회 + 과거 통계 배율 표시("예측" 아님 명기), 네트워크 차단 상태에서 수동 토글로 완전 동작 검증

## ADR

- **Decision**: 정적 사전집계 JSON + 경량 그룹화 팩트 테이블(`facts.json`) 하이브리드를 데이터 레이어로, Next.js(App Router)+ECharts를 화면 레이어로, 일회성 pipeline 서비스→공유 볼륨→web 서비스 구조의 Docker Compose를 실행 레이어로 채택.
- **Drivers**: ① 발표 시연의 시각적 임팩트·안정성(오프라인 로컬), ② 사용자 지정 스택(React/Next.js)과 1개월+ 기간의 균형, ③ 월 단위·시군구 단위 데이터 해상도 제약 내 의미 있는 지표.
- **Alternatives considered**: Option B(Next.js API Routes + DuckDB 원본 적재) — 임의 쿼리 유연성은 있으나 서버 의존으로 시연 실패 지점 증가, 고정된 소규모 과거 데이터에 과잉 설계라 기각. Architect가 제기한 DuckDB-WASM 인브라우저 변형은 `facts.json`+Arquero 하이브리드로 핵심 이점(임의 축 조합)만 흡수.
- **Why chosen**: Principles 1·2·3(화면이 왕, 정적 우선, 한 방 재현)을 모두 만족하면서 사전집계의 축 고정 리스크를 팩트 테이블로 상쇄 — 서버 없이 즉각 반응하는 필터링 확보.
- **Consequences**: (+) 시연 실패 지점 최소화, 클라이언트 즉각 반응, 재현 단순. (−) JSON 스키마를 Phase 0에서 동결해야 하며(게이트), facts.json 용량은 8MB 예산으로 관리(초과 시 축 제거→연도 분할 폴백). 노출 보정 지표는 월 단위·카테고리 근사임을 화면에 공개.
- **Follow-ups**: Phase 0-1 프로파일링 실측으로 facts.json 예산 검증, 기상청 CSV 1회 수집, GeoJSON 출처·라이선스 기록, Phase 2 후 designer 폴리시 패스.

## Changelog (consensus)

- v1 초안 → Architect REVISE: 노출 보정 분모 미정의(MAJOR), JSON 계약 미단계화(MAJOR), 카테고리 드리프트·빌드 독립성·프로파일링(MINOR×3) → Phase 0 게이트 신설, facts.json 하이브리드 채택, 결정성 규칙 명문화.
- Architect APPROVE (문서 정합 nit 2건 반영: exposure.json 설명, AC-4' 공식).
- Critic REVISE: 분모 이중 차감 수정(적설⊂강수), facts.json 8MB 예산+폴백, GeoJSON 출처 고정 → 반영. Architect 재승인.
- Critic 최종: AC-4' 잔존 구공식 수정 후 APPROVED. 합의 2회전 만에 종료.
- v2 보강 (2026-07-23, 사용자 요청): 빅데이터 기획 과목 특성 반영 — H1~H4 가설 명문화, 가설 배너·개요 요약 카드(AC-12/13), `hypotheses.json` 결정적 판정 산출(AC-14), Phase 0-2에 판정 규칙 확정 게이트 추가. 문서 정리: 잘못 배치된 AC-5'/AC-8' 항목을 Acceptance Criteria 섹션으로 이동.
- v3 보강 (2026-07-24, 사용자 승인): ① 기상청 무로그인 수집 실측 검증 결과 반영 — 엔드포인트·파라미터 명문화, 회원가입/API 키/수동 다운로드 준비물 제거, 강수일수·눈일수·평균기온 228개월 전량 수신 확인(강수량만 재조정 필요). ② "오늘의 위험도" 위젯 추가(AC-15) — Open-Meteo + 수동 토글 폴백, 개요 페이지 위젯 하나로 스코프 한정. 실행은 계속 pending approval.
