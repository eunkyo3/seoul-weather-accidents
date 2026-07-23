# 서울 자치구 GeoJSON (`seoul.json`)

서울특별시 25개 자치구 경계 단계구분도(choropleth)용 GeoJSON.

| 항목 | 내용 |
|------|------|
| 출처 저장소 | [southkorea/seoul-maps](https://github.com/southkorea/seoul-maps) |
| 원본 파일 | `kostat/2013/json/seoul_municipalities_geo_simple.json` |
| 다운로드 URL | https://raw.githubusercontent.com/southkorea/seoul-maps/master/kostat/2013/json/seoul_municipalities_geo_simple.json |
| 다운로드 일자 | 2026-07-24 |
| 라이선스 | 저장소 공개 데이터 (통계청 2013 기준 행정경계, 공공 이용 가능) |
| 피처 수 | 25 (서울 자치구 전수) |
| 자치구 명칭 속성 키 | `properties.name` (예: `"강동구"` — "서울특별시" 접두사 없음) |
| 기타 속성 | `code`(행정코드), `name_eng`, `base_year` |

## 사용 방식

- ECharts `echarts.registerMap('seoul', geojson)` 로 등록 후 choropleth 렌더.
- 데이터의 `시군구` 값은 파이프라인에서 "서울특별시 " 접두사가 제거되어 `properties.name`
  (`강동구` 형식)과 직접 매칭된다.
- 오프라인 원칙: 런타임/빌드 시 네트워크 요청 없이 이 로컬 파일만 사용한다.

## 재현

```bash
curl -sSL -o seoul.json \
  "https://raw.githubusercontent.com/southkorea/seoul-maps/master/kostat/2013/json/seoul_municipalities_geo_simple.json"
```
