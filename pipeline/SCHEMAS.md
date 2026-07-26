# SCHEMAS.md — 대시보드 JSON 데이터 계약 (FROZEN, Phase 0-3)

- 동결: 2026-07-24 (worker-pipeline). 이 문서는 **파이프라인 산출(`pipeline/output/*.json`)과 web 소비의 계약**이다.
- **v1.1 (2026-07-27) 하위호환 추가 필드**: exposure `monthly.{precip_hours,rain_hours,snow_hours}` · `by_year` · `time_exposure` · `definitions.repr_time`, hypotheses `stats`, meta `cleaning_notes.hours_source`. 기존 필드 삭제·타입 변경 없음(§3.4·§3.7·§6 참조). 판정 지표·임계값은 동결 유지.
- 소비처: `web/public/data/*.json` (개발 시 복사 / 시연 시 compose 볼륨 오버레이).
- 목(mock) 픽스처: `pipeline/fixtures/*.json` (동일 스키마, 가짜 데이터 — worker-web 병렬 착수용).
- 변경 시 worker-pipeline + worker-web 양측 합의 필요. **필드 추가는 하위호환(무시 가능), 필드 삭제/타입 변경은 파괴적**.

## 0. 전역 규칙 (결정성 · 정렬 · 반올림)

- 직렬화: `json.dump(obj, fh, ensure_ascii=False, sort_keys=True, indent=1)` (facts.json만 예외: 아래 참조).
  - `sort_keys=True`로 **객체 키 순서 결정적**. **배열 요소는 파이프라인이 아래 명시 정렬키로 명시 정렬**(삽입 순서 의존 금지).
  - 재실행 시 **바이트 동일** 보장 (입력 고정 → 동일 float → 동일 출력). 시각·난수·해시순서 의존 절대 금지. build 메타에 타임스탬프 없음.
- 반올림 (round(), 고정 자릿수):
  - 정수 카운트(count/deaths/serious/minor/*_days/*_acc): **정수**
  - 사고율(rate, 일당): **소수 4자리**
  - 배율(ratio): **소수 3자리**
  - share/비율(0~1 분수): **소수 4자리**
  - 기온(℃): **소수 1자리**, 강수량(mm): **소수 1자리**
  - null 허용: 관측 없는 눈 사고율/배율, 결측 강수량 → `null` (NaN 금지)
- 문자열 결측 표기: 데이터에 결측 없음(프로파일링 확인). 방어적 코드만 유지, 출력에는 `<NA>` 미등장 기대.

## 1. 정본(canonical) 카테고리 & 순서 (모든 JSON 공통)

```
WEATHER   = ["맑음","흐림","비","눈","기타"]          # 안개→기타 병합 후 5종. 이 순서 고정.
SEASON    = ["봄","여름","가을","겨울"]                # 3-5 / 6-8 / 9-11 / 12,1,2
DAYNIGHT  = ["주간","야간"]
CONTENT   = ["중상사고","사망사고"]
SURFACE   = ["건조","젖음/습기","서리/결빙","적설","해빙","침수","기타"]   # 습기+젖음/습기, 결빙+서리/결빙 병합 후
DISTRICTS = ["강남구","강동구","강북구","강서구","관악구","광진구","구로구","금천구","노원구","도봉구",
             "동대문구","동작구","마포구","서대문구","서초구","성동구","성북구","송파구","양천구","영등포구",
             "용산구","은평구","종로구","중구","중랑구"]   # 25구, 가나다순
ROAD      = ["단일로 - 기타","교차로 - 교차로안","교차로 - 교차로부근","단일로 - 횡단보도상","기타 - 기타",
             "교차로 - 교차로횡단보도내","단일로 - 횡단보도부근","단일로 - 교량","단일로 - 터널",
             "단일로 - 지하차도(도로)내","미분류 - 미분류","단일로 - 고가도로위","주차장 - 주차장","단일로 - 철길건널목"]  # 14종, 빈도 내림차순
VEHICLE   = ["승용","화물","승합","이륜","자전거","원동기","기타불명","건설기계","개인형이동수단(PM)","특수","사륜오토바이(ATV)","농기계"]  # 12종, 빈도 내림차순
AGE       = ["20세 이하","21-30세","31-40세","41-50세","51-60세","61-64세","65세 이상","기타불명"]  # 8종, 연령 오름차순+기타불명 말미
WEATHER_GROUP: 맑음군 = {맑음,흐림,기타}, 비, 눈
```

정제 규칙(파이프라인 적용 순서): ① 발생년월 파싱 → year/month/season ② 시군구 "서울특별시 " 접두 제거 ③ **기상 안개→기타 병합(정렬 전)** ④ 노면 습기→젖음/습기·결빙→서리/결빙 병합 ⑤ 정본 순서 적용.

## 2. 화면 × 데이터 매트릭스 (6 페이지 + 위젯)

| 화면 | AC | 소비 JSON | 가설 배너 |
|------|----|-----------|-----------|
| 개요 | 7.5/8/8.5 | `meta` + `hypotheses`(요약카드4) + `exposure`(오늘의 위험도 위젯: `by_calendar_month`) + `trend`(하이라이트) | H1~H4 요약 |
| 계절·추이 | AC-3 | `trend` | H1 |
| 기상 분석 | AC-4 | `weather` + `exposure` | H2 |
| 지도 | AC-5 | `district` (+ `web/public/geo/seoul.json`) | H3 |
| 크로스 분석 | AC-6 | `facts` (Arquero group-by) | H4 |
| 데이터 소개 | AC-10 | `meta` | — |

## 3. 파일별 스키마

### 3.1 `meta.json`
```jsonc
{
  "period": {"start":"2007-01","end":"2025-12","months":228,"year_min":2007,"year_max":2025},
  "totals": {"accidents":<int>,"deaths":<int>,"serious":<int>,"minor":<int>,
             "fatal_accidents":<int>,"serious_accidents":<int>},
  "scope": {"severity":["중상사고","사망사고"], "note":"중상·사망사고 한정(경상 제외)",
            "resolution":"월 단위","has_coords":false},
  "categories": {"weather":WEATHER,"season":SEASON,"districts":DISTRICTS,"daynight":DAYNIGHT,
                 "content":CONTENT,"road":ROAD,"vehicle":VEHICLE,"age":AGE,"surface":SURFACE},
  "cleaning_notes": {"weather_merge":"안개→기타(총 67건)",
                     "surface_merge":["습기→젖음/습기","결빙→서리/결빙(2017년 표기개정)"],
                     "district_prefix_stripped":"서울특별시 "},
  "build": {"pipeline_version":"1.0.0","source_files":19,"deterministic":true}
}
```
- build에 **타임스탬프 없음**(결정성). 소스 파일 수·버전만.

### 3.2 `trend.json`  (H1 / 계절·추이)
```jsonc
{
  "monthly": [ {"year":<int>,"month":<int 1-12>,"season":<SEASON>,"content":<CONTENT>,
                "count":<int>,"deaths":<int>,"serious":<int>} ],   // 정렬키: (year,month,CONTENT순). 최대 228×2=456행
  "by_year":   [ {"year":<int>,"count":<int>,"deaths":<int>} ],    // 정렬키: year
  "by_season": [ {"season":<SEASON>,"count":<int>,"deaths":<int>,"share":<0~1,4자리>} ], // 정렬키: SEASON순, share=계절/전체
  "monthly_profile": [ {"month":<int 1-12>,"count":<int>,"share":<4자리>,"avg_per_year":<1자리>} ] // 12행, 정렬키:month, share=월/전체
}
```

### 3.3 `weather.json`  (H2 / 기상 분석)
```jsonc
{
  "by_weather": [ {"weather":<WEATHER>,"count":<int>,"deaths":<int>,"serious":<int>,"share":<4자리>} ], // 정렬키: WEATHER순
  "monthly":    [ {"year":<int>,"month":<int>,"weather":<WEATHER>,"count":<int>,"deaths":<int>,"serious":<int>} ], // 정렬키:(year,month,WEATHER순). 0건 조합은 생략 가능
  "weather_by_severity": [ {"weather":<WEATHER>,"content":<CONTENT>,"count":<int>} ], // 정렬키:(WEATHER,CONTENT). 보조
  "surface_by_severity": [ {"surface":<SURFACE>,"content":<CONTENT>,"count":<int>} ]  // 정렬키:(SURFACE,CONTENT). 노면×심각도 보조차트
}
```

### 3.4 `exposure.json`  (H2 / 기상 분석 + 오늘의 위험도 위젯)
노출 보정 정의는 profile_report.md §5. 분모=기상청 서울(108) 월별.
```jsonc
{
  "monthly": [ {"year":<int>,"month":<int>,
      "rain_days":<int>,"snow_days":<int>,"precip_mm":<1자리|null>,"temp_avg":<1자리|null>,
      "rain_acc":<int>,"snow_acc":<int>,"clear_acc":<int>,         // 그 달 기상상태 그룹별 사고 건수
      "clear_denom_days":<int>,                                     // = max(1, 월일수 - 강수일수 - 눈일수) [union 정의, 눈⊄강수 실측 반영]
      "rain_rate":<4자리>,"snow_rate":<4자리|null>,"clear_rate":<4자리>,
      "rain_ratio":<3자리>,"snow_ratio":<3자리|null>              // per-day 배율(=사고율÷맑음군사고율). 기술적 표시용, 라벨 편향 有
  } ],  // 228행, 정렬키:(year,month)
  "pooled": { "rain_rate":<4>,"snow_rate":<4>,"clear_rate":<4>,"rain_ratio":<3>,"snow_ratio":<3>,
              "rain_repr":<3>,"snow_repr":<3>,                    // ★노출 보정 대표비(=사고점유율÷일수점유율). H2 판정·헤드라인에 사용
              "rain_acc_total":<int>,"snow_acc_total":<int>,"clear_acc_total":<int>,
              "rain_days_total":<int>,"snow_days_total":<int>,"clear_days_total":<int>,
              "total_acc":<int>,"total_days":<int> },  // 풀링(총건수÷총일수)
  "by_calendar_month": [ {"month":<int 1-12>,
      "rain_rate":<4>,"snow_rate":<4|null>,"clear_rate":<4>,"rain_ratio":<3>,"snow_ratio":<3|null>,
      "rain_repr":<3>,"snow_repr":<3|null> } ], // 12행. 위젯: 현재 월 rain_repr/snow_repr 조회
  "definitions": {"rain_rate":"비 사고건수 ÷ 강수일수","snow_rate":"눈 사고건수 ÷ 눈일수(관측월만)",
                  "clear_rate":"맑음군({맑음,흐림,기타}) 사고건수 ÷ max(1, 월일수 − 강수일수 − 눈일수)",
                  "ratio":"각 사고율 ÷ 맑음군 사고율 (per-day, 라벨 편향)",
                  "repr":"노출 보정 대표비 = 조건 사고 점유율 ÷ 조건 일수 점유율 (>1 과대표집=더 위험)",
                  "repr_time":"시간 기반 대표비 = 조건 사고 점유율 ÷ 조건 '시간' 점유율 (분모 민감도용, v1.1)",
                  "caveat":"월단위·카테고리 근사, 상관(인과 아님)"},
  "snow_subset_verified": false,  // 실측: 눈일수 ⊄ 강수일수 (25개월 위반) → union 정의(강수·눈 모두 차감). profile §7

  // ---- v1.1 추가 (하위호환·additive — 구 소비자는 무시 가능) ----
  // monthly 행에 ERA5 월별 강수시간 3필드 추가: "precip_hours":<1자리>, "rain_hours":<1자리>, "snow_hours":<1자리>
  "by_year": [ {"year":<int>, "rain_acc":<int>,"snow_acc":<int>,"clear_acc":<int>,
      "rain_repr":<3|null>,"snow_repr":<3|null>,          // 일 기반 연도별 대표비 (추이 차트)
      "rain_repr_time":<3|null>,"snow_repr_time":<3|null> // 시간 기반 (민감도)
  } ],  // 19행, 정렬키: year
  "time_exposure": {              // 분모 민감도(P2): 분모 강수'일수'→'시간' 전환 시 대표비 변화 정량화
    "source":<string>, "split_note":<string>,             // Open-Meteo ERA5 재분석, CC-BY 4.0; 눈/비 일 단위 분리 근사
    "rain_hours_total":<1>,"snow_hours_total":<1>,"precip_hours_total":<1>,"total_hours":<int>,  // 166,560 = 6,940일×24
    "rain_hours_share":<4>,"rain_days_share":<4>,"rain_acc_share":<4>,
    "rain_repr_time":<3>,"snow_repr_time":<3>,"wet_repr_time":<3>,
    "caveat":<string>             // 판정은 동결된 일 기반 유지 — 실측: 비 0.246(일)→0.641(시간), 방향(<1) 유지
  }
}
```
- **시간 해상도 불일치(v1.1 명문화)**: 분자(사고 라벨)는 사고 '순간' 기상, 일 기반 분모는 '0.1mm 이상 일수' —
  강수일 점유율 30.5% vs 실제 강수시간 점유율 11.7%(ERA5)로 일 기반 대표비는 구조적 하향 편향.
  `time_exposure`가 이를 정량화(민감도 분석). 데이터: `data/weather/rain_hours.csv` (`fetch_weather.py --hours-only` 재현).
- **⚠️ 지표 2종 구분**: `rain_ratio`(per-day 배율)는 맑음이 지배 라벨(85%)이라 clear_rate가 구조적으로 과대 → 편향(참고·기술 표시용). **H2 판정·"×N배" 헤드라인은 노출 보정 `rain_repr`/`snow_repr`(대표비) 사용** — 일수로 정규화되어 방어 가능. 상세 profile_report §5·§7.
- **오늘의 위험도 위젯**: Open-Meteo로 현재 날씨→{맑음군/비/눈} 매핑 후, `by_calendar_month[현재월]`의 `rain_repr`(비) 또는 `snow_repr`(눈)를 "과거 통계상 오늘 같은 날씨 사고 위험 ×N배"로 표기. 맑음군이면 1.0 기준. **"예측" 문구 금지, "과거 통계 조회"**.

### 3.5 `district.json`  (H3 / 지도)
```jsonc
{
  "by_district": [ {"district":<DISTRICTS>,"count":<int>,"deaths":<int>,
                    "rain_count":<int>,"snow_count":<int>,"clear_count":<int>,
                    "rain_share":<4자리>} ],   // 25행, 정렬키: DISTRICTS(가나다), 풀링 전기간. rain_share=비/전체
  "district_year_weather": [ {"district":<DISTRICTS>,"year":<int>,"weather":<WEATHER>,"count":<int>} ]
      // 정렬키:(DISTRICTS,year,WEATHER순). 연도범위×기상 필터 연동용. 0건 조합 생략 가능. 최대 25×19×5=2375행
}
```
- choropleth 기본값 = `by_district.count`. 기상 필터 시 `district_year_weather`에서 (연도범위,기상) 합산.

### 3.6 `facts.json`  (H4 / 크로스 분석 — Arquero)
**columnar 직렬화** (축별 배열 dict). gzip ≈ 0.35MB (예산 8MB의 4.4%). Arquero `aq.table(facts.columns)` 직접 로드.
```jsonc
{
  "axes": ["weather","district","ym","daynight","road","vehicle","age"],
  "columns": {
     "weather":  [<WEATHER 문자열>, ...],   // 모두 병합·정본 적용 후
     "district": [<구명, 접두 제거>, ...],
     "ym":       ["YYYY-MM", ...],
     "daynight": [<주간|야간>, ...],
     "road":     [<ROAD>, ...],
     "vehicle":  [<VEHICLE>, ...],
     "age":      [<AGE>, ...],
     "cnt":      [<int>, ...],
     "deaths":   [<int>, ...]
  },
  "nrows": <int>   // 병합 후 고유 조합 수 (병합 전 실측 184,187 이하)
}
```
- **직렬화**: `json.dump(..., ensure_ascii=False, sort_keys=True, separators=(",",":"))` (indent 없음, 크기 최소). 행 순서 = 7축 정본 인덱스 튜플 오름차순 정렬(결정적).
- Arquero 소비: `weather`, `daynight`, `road`, `vehicle`, `age`, `ym`에서 파생(연/월) group-by → 날씨×주야/도로/차종/연령 히트맵.

### 3.7 `hypotheses.json`  (AC-12/13/14 / 전 분석 화면 배너 + 개요 카드)
```jsonc
{
  "verdict_labels": {"supported":"지지","partial":"부분 지지","rejected":"기각"},
  "hypotheses": [
    {
      "id":"H1", "title":<string>, "screen":<string>,
      "metric_name":<string>, "metric_value":<number>,
      "thresholds": {"supported_min":<number>,"partial_min":<number>},  // v≥supported_min→supported; partial_min≤v<supported_min→partial; v<partial_min→rejected
      "verdict":"supported|partial|rejected",
      "evidence": [ {"label":<string>,"value":<number>,"unit":<string|null>} ],
      "stats": {                                        // v1.1 추가(additive) — 결정적 통계 검정(scipy 미사용, 순수 수치)
        "test":<string>, "statistic":<number>, "df":<int|null>,
        "p_value":<number>,                             // 1e-6 미만은 0.0 언더플로 → 표시층에서 "p < 0.001"
        "repr_ci95":[<3>,<3>]?,                         // H2만: Wilson CI(사고점유율)÷일수점유율 조건부 CI
        "note":<string>                                 // n=22만 대표본 — 유의성은 자명, 임계값은 효과크기 기준
      },
      "caveat":<string>
    }
    // H1,H2,H3,H4 — 정렬키: id
  ]
}
```
판정 지표·임계값(profile_report.md §6 확정):
- **H1** metric=계절 건수 최대/최소 비율; supported_min=1.30, partial_min=1.12. → 실측 **1.183 = partial**
- **H2** metric=노출 보정 대표비 max(비 repr, 눈 repr); supported_min=1.20, partial_min=0.90. → 실측 **0.246 = rejected** (일 기반 정의 기준. v1.1 해석 갱신: 분자·분모 시간 해상도 불일치로 구조적 하향 — 시간 기반 민감도 0.641, 방향 <1 유지. 통행량 감소 효과와 분리 불가; profile §8)
- **H3** metric=구별 비-사고비율 최대/최소 비율; supported_min=1.50, partial_min=1.20. → 실측 **1.404 = partial** (종로 0.087 / 성동 0.062; 구별 노출 보정 없음 명시)
- **H4** metric=축 하위그룹 비-사고비율 최대/최소 배율의 최댓값(표본 ≥1000); supported_min=1.50, partial_min=1.20. → 실측 **3.132 = supported** (차종: 승용 0.081 / 자전거 0.026. v1.1 해석 갱신: 위험 '증폭'이 아닌 우천 시 통행 구성 변화(노출 감소)를 주로 반영 가능 — '날씨에 따른 사고 구성 변화'로 해석)
- verdict는 파이프라인이 metric_value와 thresholds로 **결정적 계산**(수동 금지). pytest로 재실행 동일성 검증.
- v1.1: 각 가설에 결정적 통계 검정(`stats`) 병기 — H1 chi² 적합도(계절 일수 비례 기대치), H2 이항 z + 대표비 Wilson CI, H3 2×25 동질성 chi², H4 2×k 동질성 chi²(최대 축). 전부 p < 0.001(n=223,290) — **임계값은 유의성이 아닌 효과크기 경계**임을 명시.

## 4. 산출 경로

- 정본 출력: `pipeline/output/{meta,trend,weather,exposure,district,facts,hypotheses}.json`
- web 복사(개발): `web/public/data/`로 복사. 시연: compose 볼륨 오버레이.
- 픽스처: `pipeline/fixtures/*.json` (동일 스키마, 가짜 값 — 스키마 검증·UI 병렬 착수).
