# data/weather — 기상청 서울(108) 월별 통계

교통사고 노출 보정(비/눈 사고율)의 **분모** 및 보조 표시(강수량·기온)용. 1회 수집 후 커밋 → 빌드·시연 시 네트워크 불필요.

- 출처: 기상자료개방포털 (data.kma.go.kr) — **로그인·API 키 불필요**
- 지점: 서울 108 (stnId=108)
- 기간: 2007-01 ~ 2025-12 (228개월)
- 수집일: 2026-07-24
- 수집 스크립트: `pipeline/fetch_weather.py` (재현 증빙; 지표당 1요청, 강수일수+강수량은 동일 엔드포인트 공유 → 총 3요청)
- 인코딩: 응답은 **UTF-8 JSON** (페이지 자체의 조회 AJAX 엔드포인트 사용). CSV *다운로드* 엔드포인트(`downloadGrnd*.do`)는 대화형 세션 없이는 ERROR 페이지를 반환하므로 미사용 — 계획서의 "cp949"는 다운로드 CSV 기준이며 채택 방식(ajax)과 무관.

## 엔드포인트 (POST, application/x-www-form-urlencoded, X-Requested-With: XMLHttpRequest)

| 지표 | URL | 핵심 파라미터 | 응답 키 |
|------|-----|--------------|---------|
| 강수일수 + 강수량 | `/stcs/grnd/grndRnDayMixChartAjaxList.do` | dataFormCd=F00513(월), schType=2(지점), schStnId=108, startYear=2007..endYear=2025, startMonth=01,endMonth=12 | `dataList[].dt`, `.rnDay`(강수일수), `.sumRn`(강수량 mm) |
| 눈일수 | `/climate/snw/selectSnwChartAjax.do` | dataFormCd=F00513, schType=2, schStnId=108, startYear/endYear/startMonth/endMonth, schTab=2, mddlClssCd=WWRPT01 | `data[].yyyy`,`.mm`,`.val`(눈일수; 무설월은 키 생략) |
| 평균/최저/최고기온 | `/stcs/grnd/grndTaAjaxList.do` | dataFormCd=F00513, dataTypeCd=standard, stnId=108, taElement=MIN,AVG,MAX, startYear/endYear/startMonth/endMonth | `[].dt`,`.avgTa`,`.minTa`,`.maxTa` |

수집 절차: 각 페이지를 GET(세션 쿠키 `mwakmasid` 획득) → 위 AJAX를 POST 1회. 기온 페이지는 schForm 히든필드 전체 + taElement(MIN/AVG/MAX) 동봉 필요.

## 파일

- `rain_days.csv` — `ym,rain_days,precip_mm` (226행; 2019-01·2020-10 무강수로 원본 생략 → build가 rain_days=0, precip_mm=null로 228개월 채움)
- `snow_days.csv` — `ym,snow_days` (228행; 무설월=0)
- `temperature.csv` — `ym,temp_avg,temp_min,temp_max` (228행, ℃)
- `*.raw.json` — 원본 응답(출처 증빙)

## 데이터 특성 (중요)

- **눈일수 ⊄ 강수일수**: 25개월에서 눈일수 > 강수일수 (기상청 강수일수=일강수량 ≥0.1mm 기준, 눈일수=눈 현상 관측 기준 → 미량 적설·진눈깨비는 강수일수 미포함). 노출 보정 맑음군 분모는 union 정의 `max(1, 월일수 − 강수일수 − 눈일수)` 채택. 상세 `pipeline/profile_report.md` §7.
- 강수량(sumRn)은 보조 지표. schType=2(지점) 사용으로 월당 단일행·현실값 확보(계획서가 우려한 다중행 이슈 없음).
