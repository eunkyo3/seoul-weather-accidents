"""Generate mock fixtures matching SCHEMAS.md exactly (plausible fake data).

Run: python -X utf8 pipeline/make_fixtures.py
Output: pipeline/fixtures/*.json  (for worker-web parallel UI start; NOT real data)
Deterministic: fixed seed, same canonical orders/rounding as the real pipeline.
"""
import json
import os
import random

WEATHER = ["맑음", "흐림", "비", "눈", "기타"]
SEASON = ["봄", "여름", "가을", "겨울"]
DAYNIGHT = ["주간", "야간"]
CONTENT = ["중상사고", "사망사고"]
SURFACE = ["건조", "젖음/습기", "서리/결빙", "적설", "해빙", "침수", "기타"]
DISTRICTS = ["강남구", "강동구", "강북구", "강서구", "관악구", "광진구", "구로구", "금천구", "노원구", "도봉구",
             "동대문구", "동작구", "마포구", "서대문구", "서초구", "성동구", "성북구", "송파구", "양천구", "영등포구",
             "용산구", "은평구", "종로구", "중구", "중랑구"]
ROAD = ["단일로 - 기타", "교차로 - 교차로안", "교차로 - 교차로부근", "단일로 - 횡단보도상", "기타 - 기타",
        "교차로 - 교차로횡단보도내", "단일로 - 횡단보도부근", "단일로 - 교량", "단일로 - 터널",
        "단일로 - 지하차도(도로)내", "미분류 - 미분류", "단일로 - 고가도로위", "주차장 - 주차장", "단일로 - 철길건널목"]
VEHICLE = ["승용", "화물", "승합", "이륜", "자전거", "원동기", "기타불명", "건설기계", "개인형이동수단(PM)", "특수", "사륜오토바이(ATV)", "농기계"]
AGE = ["20세 이하", "21-30세", "31-40세", "41-50세", "51-60세", "61-64세", "65세 이상", "기타불명"]

YEARS = list(range(2007, 2026))
MONTHS = list(range(1, 13))
SEASON_OF = {12: "겨울", 1: "겨울", 2: "겨울", 3: "봄", 4: "봄", 5: "봄",
             6: "여름", 7: "여름", 8: "여름", 9: "가을", 10: "가을", 11: "가을"}
DAYS_IN = {1: 31, 2: 28, 3: 31, 4: 30, 5: 31, 6: 30, 7: 31, 8: 31, 9: 30, 10: 31, 11: 30, 12: 31}

R = random.Random(20260724)


def dump(name, obj, compact=False):
    os.makedirs("pipeline/fixtures", exist_ok=True)
    with open(f"pipeline/fixtures/{name}.json", "w", encoding="utf-8") as fh:
        if compact:
            json.dump(obj, fh, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
        else:
            json.dump(obj, fh, ensure_ascii=False, sort_keys=True, indent=1)


def meta():
    return {
        "period": {"start": "2007-01", "end": "2025-12", "months": 228, "year_min": 2007, "year_max": 2025},
        "totals": {"accidents": 223290, "deaths": 6409, "serious": 243188, "minor": 78817,
                   "fatal_accidents": 6266, "serious_accidents": 217024},
        "scope": {"severity": CONTENT, "note": "중상·사망사고 한정(경상 제외)", "resolution": "월 단위", "has_coords": False},
        "categories": {"weather": WEATHER, "season": SEASON, "districts": DISTRICTS, "daynight": DAYNIGHT,
                       "content": CONTENT, "road": ROAD, "vehicle": VEHICLE, "age": AGE, "surface": SURFACE},
        "cleaning_notes": {"weather_merge": "안개→기타(총 67건)",
                           "surface_merge": ["습기→젖음/습기", "결빙→서리/결빙(2017년 표기개정)"],
                           "district_prefix_stripped": "서울특별시 "},
        "build": {"pipeline_version": "1.0.0", "source_files": 19, "deterministic": True},
    }


def trend():
    monthly = []
    for y in YEARS:
        for m in MONTHS:
            for c in CONTENT:
                base = R.randint(300, 900) if c == "중상사고" else R.randint(5, 40)
                monthly.append({"year": y, "month": m, "season": SEASON_OF[m], "content": c,
                                "count": base, "deaths": (0 if c == "중상사고" else R.randint(1, base)),
                                "serious": (base if c == "중상사고" else 0)})
    by_year = [{"year": y, "count": R.randint(7000, 17000), "deaths": R.randint(200, 400)} for y in YEARS]
    shares = {"봄": 0.255, "여름": 0.255, "가을": 0.266, "겨울": 0.225}
    by_season = [{"season": s, "count": int(223290 * shares[s]), "deaths": R.randint(1400, 1800),
                  "share": shares[s]} for s in SEASON]
    monthly_profile = [{"month": m, "count": R.randint(15000, 20500),
                        "share": round(R.uniform(0.069, 0.092), 4), "avg_per_year": round(R.uniform(810, 1080), 1)}
                       for m in MONTHS]
    return {"monthly": monthly, "by_year": by_year, "by_season": by_season, "monthly_profile": monthly_profile}


def weather():
    shares = {"맑음": 0.853, "흐림": 0.055, "비": 0.075, "눈": 0.006, "기타": 0.011}
    by_weather = [{"weather": w, "count": int(223290 * shares[w]), "deaths": R.randint(20, 5500),
                   "serious": int(223290 * shares[w] * 1.05), "share": shares[w]} for w in WEATHER]
    monthly = []
    for y in YEARS:
        for m in MONTHS:
            for w in WEATHER:
                cnt = int(R.randint(300, 900) * shares[w])
                if cnt <= 0:
                    continue
                monthly.append({"year": y, "month": m, "weather": w, "count": cnt,
                                "deaths": R.randint(0, 3), "serious": cnt})
    weather_by_severity = [{"weather": w, "content": c, "count": R.randint(5, 5000)}
                           for w in WEATHER for c in CONTENT]
    surface_by_severity = [{"surface": s, "content": c, "count": R.randint(1, 5000)}
                           for s in SURFACE for c in CONTENT]
    return {"by_weather": by_weather, "monthly": monthly,
            "weather_by_severity": weather_by_severity, "surface_by_severity": surface_by_severity}


def exposure():
    monthly = []
    for y in YEARS:
        for m in MONTHS:
            rain_days = R.randint(4, 16)
            snow_days = R.randint(0, 6) if m in (12, 1, 2, 3, 11) else 0
            din = DAYS_IN[m]
            clear_denom = din - rain_days
            rain_acc = R.randint(20, 120)
            snow_acc = R.randint(0, 15) if snow_days else 0
            clear_acc = R.randint(400, 900)
            rain_rate = round(rain_acc / rain_days, 4)
            snow_rate = round(snow_acc / snow_days, 4) if snow_days else None
            clear_rate = round(clear_acc / clear_denom, 4)
            monthly.append({
                "year": y, "month": m, "rain_days": rain_days, "snow_days": snow_days,
                "precip_mm": round(R.uniform(10, 350), 1), "temp_avg": round(R.uniform(-5, 28), 1),
                "rain_acc": rain_acc, "snow_acc": snow_acc, "clear_acc": clear_acc,
                "clear_denom_days": clear_denom,
                "rain_rate": rain_rate, "snow_rate": snow_rate, "clear_rate": clear_rate,
                "rain_ratio": round(rain_rate / clear_rate, 3),
                "snow_ratio": (round(snow_rate / clear_rate, 3) if snow_rate else None),
            })
    pooled = {"rain_rate": 7.9141, "snow_rate": 2.6708, "clear_rate": 47.3626,
              "rain_ratio": 0.167, "snow_ratio": 0.056, "rain_repr": 0.246, "snow_repr": 0.083,
              "rain_acc_total": 16762, "snow_acc_total": 1306, "clear_acc_total": 205222,
              "rain_days_total": 2118, "snow_days_total": 489, "clear_days_total": 4333,
              "total_acc": 223290, "total_days": 6940}
    by_calendar_month = [{"month": m, "rain_rate": round(R.uniform(3, 7), 4),
                          "snow_rate": (round(R.uniform(2, 5), 4) if m in (12, 1, 2, 3, 11) else None),
                          "clear_rate": round(R.uniform(30, 60), 4),
                          "rain_ratio": round(R.uniform(0.1, 0.4), 3),
                          "snow_ratio": (round(R.uniform(0.02, 0.2), 3) if m in (12, 1, 2, 3, 11) else None),
                          "rain_repr": round(R.uniform(0.15, 0.5), 3),
                          "snow_repr": (round(R.uniform(0.05, 0.3), 3) if m in (12, 1, 2, 3, 11) else None)}
                         for m in MONTHS]
    return {"monthly": monthly, "pooled": pooled, "by_calendar_month": by_calendar_month,
            "definitions": {"rain_rate": "비 사고건수 ÷ 강수일수", "snow_rate": "눈 사고건수 ÷ 눈일수(관측월만)",
                            "clear_rate": "맑음군({맑음,흐림,기타}) 사고건수 ÷ max(1, 월일수 − 강수일수 − 눈일수)",
                            "ratio": "각 사고율 ÷ 맑음군 사고율 (기술적 per-day 배율; 라벨 편향 有)",
                            "repr": "노출 보정 대표비 = (조건 사고 점유율) ÷ (조건 일수 점유율); H2 판정에 사용",
                            "caveat": "월단위·카테고리 근사, 상관(인과 아님)"},
            "snow_subset_verified": False}


def district():
    by_district = []
    for d in DISTRICTS:
        total = R.randint(5000, 12000)
        rain = int(total * R.uniform(0.06, 0.09))
        snow = int(total * R.uniform(0.003, 0.008))
        clear = total - rain - snow
        by_district.append({"district": d, "count": total, "deaths": R.randint(150, 350),
                            "rain_count": rain, "snow_count": snow, "clear_count": clear,
                            "rain_share": round(rain / total, 4)})
    dyw = []
    for d in DISTRICTS:
        for y in YEARS:
            for w in WEATHER:
                cnt = R.randint(1, 400)
                dyw.append({"district": d, "year": y, "weather": w, "count": cnt})
    return {"by_district": by_district, "district_year_weather": dyw}


def facts():
    # small mock: a few hundred combos, columnar
    cols = {k: [] for k in ["weather", "district", "ym", "daynight", "road", "vehicle", "age", "cnt", "deaths"]}
    n = 0
    for _ in range(400):
        cols["weather"].append(R.choice(WEATHER))
        cols["district"].append(R.choice(DISTRICTS))
        cols["ym"].append(f"{R.choice(YEARS)}-{R.choice(MONTHS):02d}")
        cols["daynight"].append(R.choice(DAYNIGHT))
        cols["road"].append(R.choice(ROAD))
        cols["vehicle"].append(R.choice(VEHICLE))
        cols["age"].append(R.choice(AGE))
        c = R.randint(1, 30)
        cols["cnt"].append(c)
        cols["deaths"].append(R.randint(0, 2))
        n += 1
    return {"axes": ["weather", "district", "ym", "daynight", "road", "vehicle", "age"],
            "columns": cols, "nrows": n}


def hypotheses():
    return {
        "verdict_labels": {"supported": "지지", "partial": "부분 지지", "rejected": "기각"},
        "hypotheses": [
            {"id": "H1", "title": "계절에 따라 사고 발생 패턴이 뚜렷이 다르다", "screen": "계절·추이",
             "metric_name": "계절 사고건수 최대/최소 비율", "metric_value": 1.18,
             "thresholds": {"supported_min": 1.30, "partial_min": 1.12}, "verdict": "partial",
             "evidence": [{"label": "가을 share", "value": 0.266, "unit": None},
                          {"label": "겨울 share", "value": 0.225, "unit": None},
                          {"label": "월 peak/trough(10월/2월)", "value": 1.33, "unit": "배"}],
             "caveat": "월 단위·상관 관계, 인과 아님"},
            {"id": "H2", "title": "비·눈 오는 날은 맑은 날보다 하루당 사고율이 높다", "screen": "기상 분석",
             "metric_name": "노출 보정 대표비 max(비, 눈) = 사고점유율÷일수점유율", "metric_value": 0.246,
             "thresholds": {"supported_min": 1.20, "partial_min": 0.90}, "verdict": "rejected",
             "evidence": [{"label": "비 대표비(노출보정)", "value": 0.246, "unit": "배"},
                          {"label": "눈 대표비(노출보정)", "value": 0.083, "unit": "배"}],
             "caveat": "노출 보정·월단위 근사, 인과 아님. 대표비<1: 심각사고 한정 데이터에서 강수·적설일 통행 감소 (MOCK 값)"},
            {"id": "H3", "title": "날씨의 영향은 자치구별로 다르게 나타난다", "screen": "지도",
             "metric_name": "구별 비-사고비율 최대/최소", "metric_value": 1.42,
             "thresholds": {"supported_min": 1.50, "partial_min": 1.20}, "verdict": "partial",
             "evidence": [{"label": "최대 구", "value": 0.088, "unit": None},
                          {"label": "최소 구", "value": 0.062, "unit": None}],
             "caveat": "MOCK 값"},
            {"id": "H4", "title": "날씨 영향은 주야·도로형태·차종·연령대에 따라 증폭/약화된다", "screen": "크로스 분석",
             "metric_name": "축 하위그룹 비-비율 최대/최소 배율", "metric_value": 1.61,
             "thresholds": {"supported_min": 1.50, "partial_min": 1.20}, "verdict": "supported",
             "evidence": [{"label": "최대 증폭 축", "value": 1.61, "unit": "배"}],
             "caveat": "MOCK 값"},
        ],
    }


def main():
    dump("meta", meta())
    dump("trend", trend())
    dump("weather", weather())
    dump("exposure", exposure())
    dump("district", district())
    dump("facts", facts(), compact=True)
    dump("hypotheses", hypotheses())
    print("fixtures written to pipeline/fixtures/")
    for f in sorted(os.listdir("pipeline/fixtures")):
        sz = os.path.getsize(f"pipeline/fixtures/{f}")
        print(f"  {f}  {sz} bytes")


if __name__ == "__main__":
    main()
