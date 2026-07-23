# 날씨와 서울시 교통사고 인터랙티브 대시보드

서울시 중상·사망 교통사고(2007~2025, 19개년, 약 20만 건)와 기상청 월별 통계를 결합해
**"날씨가 사고에 어떤 영향을 미치는가"**를 검증하는 인터랙티브 대시보드입니다.
빅데이터 기획 PBL 과제 산출물로, 차트 모음이 아니라 4개의 가설(H1~H4)을 데이터로
검증하는 서사로 구성되어 있습니다.

## 가설 (H1~H4)

| ID | 가설 | 검증 지표 |
|----|------|-----------|
| H1 | 계절에 따라 사고 발생 패턴이 뚜렷이 다르다 | 계절·월별 건수/사망자 추이 |
| H2 | 비·눈 오는 날은 맑은 날보다 하루당 사고율이 높다 | 노출 보정 사고율(비/눈 사고 ÷ 관측일수) + 맑음군 대비 배율 |
| H3 | 날씨의 영향은 자치구별로 다르게 나타난다 | 기상조건 필터별 구 단위 분포 변화 |
| H4 | 날씨 영향은 주야·도로형태·차종·연령대에 따라 증폭/약화된다 | 날씨×축 교차 히트맵 |

각 판정(지지/부분 지지/기각)은 파이프라인이 결정적으로 산출하며, 대시보드 각 분석 화면
상단의 배너와 개요 페이지의 요약 카드에서 확인할 수 있습니다.

## 실행 방법

Docker만 설치되어 있으면 다른 준비물 없이 한 줄로 실행됩니다.

```bash
docker compose up
```

빌드·데이터 집계가 끝나면 브라우저에서 http://localhost:3000 접속.

- `pipeline` 컨테이너가 먼저 실행되어 `data/*.xlsx` + `data/weather/*.csv`를 집계 JSON으로
  변환하고 종료합니다(오프라인, 네트워크 호출 없음).
- `pipeline`이 성공적으로 끝나야 `web` 컨테이너가 기동하며, 집계 결과를 읽기 전용 볼륨으로
  전달받아 정적 파일로 서빙합니다.
- 클린 머신 기준으로 `docker compose up` 외 수동 단계는 없습니다.

종료: `Ctrl+C` 후 `docker compose down` (데이터 볼륨은 유지되어 재기동 시 재집계 불필요).
완전 초기화: `docker compose down -v`.

## 프로젝트 구조

```
D:\nujino
├── data/                      # 원본 엑셀 19개(2007~2025, 불변) + weather/ 기상청 월별 CSV
├── pipeline/                  # Python 집계 파이프라인
│   ├── build_aggregates.py    # xlsx + 기상 CSV -> pipeline/output/*.json (결정적)
│   ├── fetch_weather.py       # 기상청 CSV 1회 수집용(재현 증빙, 빌드 시 미실행)
│   ├── SCHEMAS.md             # JSON 스키마 + 가설 판정 규칙 동결 문서
│   ├── test_build.py          # pytest 단위 테스트
│   └── Dockerfile
├── web/                        # Next.js 16(App Router, TypeScript) 대시보드
│   ├── src/app/                # 개요/추이/기상/지도/크로스/데이터소개 페이지
│   ├── public/geo/seoul.json   # 서울 25개구 GeoJSON(커밋)
│   ├── public/data/            # 파이프라인 산출 JSON(gitignore, compose가 볼륨으로 채움)
│   └── Dockerfile
└── docker-compose.yml         # pipeline(1회 실행) -> web(서빙), 공유 named volume
```

## 데이터 출처 및 범위·한계

- **교통사고 원본**: `data/사고분석-{2007..2025}.xlsx` — 서울특별시 중상·사망 교통사고
  약 20만 건(경상 사고는 제외 범위). 22개 컬럼, 연도별 동일 스키마.
- **기상청 월별 통계**: `data/weather/` — 기상자료개방포털(data.kma.go.kr), 서울(지점 108),
  2007-01~2025-12(228개월), 로그인·API 키 없이 1회 수집 후 커밋(`pipeline/fetch_weather.py`가
  재현 스크립트, 빌드·시연 시에는 네트워크 호출 없음). 강수일수·강수량·눈일수·평균/최저/최고기온.
- **서울 25개구 GeoJSON**: `web/public/geo/seoul.json` — [southkorea/seoul-maps](https://github.com/southkorea/seoul-maps)
  저장소(통계청 2013 기준 행정경계), 출처·라이선스는 `web/public/geo/README.md` 참조.
- **실시간 날씨(오늘의 위험도 위젯)**: Open-Meteo API(키·가입 불필요, 클라이언트 fetch) —
  실패·오프라인 시 날씨 수동 선택 토글로 자동 폴백.

### 한계

- **월 단위 해상도**: 기상청 통계가 월 단위이므로 노출 보정 사고율도 월 단위 근사이며,
  일 단위 인과관계가 아니라 **상관·경향**으로 해석해야 합니다.
- **경상 사고 제외**: 원본 데이터 자체가 중상·사망 사고로 한정되어 있어, 전체 사고(경상 포함)
  통계와는 직접 비교할 수 없습니다.
- **날씨 카테고리 근사**: "맑음군"(맑음/흐림/기타)은 흐림·맑음을 구분하지 못하는 잔여일수
  근사이며, 눈일수는 강수일수의 부분집합이 아닌 경우가 있어 union 정의를 사용합니다.
  상세 정의는 `pipeline/SCHEMAS.md` 참조.
- 가설 기각(rejected) 판정도 유효한 결과로 그대로 제시하며, 임의로 숨기지 않습니다.

## 로컬 개발 방법

Docker 없이 직접 개발할 때:

```bash
# 1) 파이프라인: 집계 JSON 생성 (Python 3.14, pandas/openpyxl)
cd pipeline
pip install -r requirements.txt
python -X utf8 build_aggregates.py   # 저장소 루트에서 실행해도 무방(경로가 상대적)
# 산출물: pipeline/output/*.json

# 2) 웹: Next.js 개발 서버
cd web
npm install
cp -r ../pipeline/output/* public/data/   # 최초 1회, 또는 파이프라인 재실행 후 갱신
npm run dev   # http://localhost:3000
```

`web`의 `next build`는 `public/data/`가 비어 있어도 성공합니다(모든 데이터 JSON은
런타임에 클라이언트가 fetch). Docker 실행 시에는 이 복사 과정이 named volume 오버레이로
자동화됩니다.

## 파이프라인 재현성

- `build_aggregates.py`는 **결정적**입니다: 고정된 정제 규칙·카테고리 순서·`sort_keys`+고정
  소수 자릿수로, 같은 입력이면 항상 바이트 단위로 동일한 JSON을 출력합니다
  (`verify_determinism()`이 해시로 검증).
- `pytest pipeline/`로 스키마·계절 매핑·노출 보정 계산·총합 보존(집계 합 = 원본 행수)을
  검증합니다.
- 가설 판정 규칙(임계값)은 `pipeline/SCHEMAS.md`에 명문화되어 있으며, 파이프라인이 매 실행마다
  동일한 판정을 산출합니다(수동 판정 없음).

## 스모크 테스트

```powershell
pwsh scripts/smoke.ps1
```

`docker compose up -d --build` 후 6개 페이지(`/`, `/trend`, `/weather`, `/map`, `/cross`,
`/about`)와 `/data/meta.json`의 HTTP 200 응답을 확인합니다.
