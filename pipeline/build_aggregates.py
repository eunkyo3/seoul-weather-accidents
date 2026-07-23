"""Phase 1: 19 xlsx + KMA weather CSV -> deterministic aggregate JSON (pipeline/output/).

Run: python -X utf8 pipeline/build_aggregates.py
Determinism: fixed cleaning/canonical order, sort_keys, fixed rounding, sorted arrays.
Running twice => byte-identical output (verify_determinism() checks hashes).
Schemas frozen in pipeline/SCHEMAS.md. READ-ONLY on data/*.xlsx.
"""
import calendar
import glob
import gzip
import hashlib
import json
import os
import re

import pandas as pd

# ---------- canonical orders (SCHEMAS.md §1) ----------
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

CLEAR_SET = {"맑음", "흐림", "기타"}
SEASON_OF = {12: "겨울", 1: "겨울", 2: "겨울", 3: "봄", 4: "봄", 5: "봄",
             6: "여름", 7: "여름", 8: "여름", 9: "가을", 10: "가을", 11: "가을"}
MONTH_RE = re.compile(r"(\d{4})\s*년\s*(\d{1,2})\s*월")
DATA_GLOB = "data/사고분석-*.xlsx"
OUTDIR = "pipeline/output"
YEARS = list(range(2007, 2026))

USECOLS = ["발생년월", "주야", "시군구", "사고내용", "사망자수", "중상자수", "경상자수",
           "노면상태", "기상상태", "도로형태", "가해운전자 차종", "가해운전자 연령대"]

# rounding helpers -------------------------------------------------
def r4(x):
    return None if x is None else round(float(x), 4)

def r3(x):
    return None if x is None else round(float(x), 3)

def r1(x):
    return None if x is None else round(float(x), 1)

def ordkey(canon):
    idx = {v: i for i, v in enumerate(canon)}
    return lambda v: idx.get(v, len(canon))


# ---------- load & clean ----------
def load_accidents():
    frames = []
    for f in sorted(glob.glob(DATA_GLOB)):
        df = pd.read_excel(f, dtype=str, usecols=USECOLS)
        frames.append(df)
    df = pd.concat(frames, ignore_index=True)

    ym = df["발생년월"].str.extract(MONTH_RE)
    df["year"] = ym[0].astype(int)
    df["month"] = ym[1].astype(int)
    df["season"] = df["month"].map(SEASON_OF)
    df["ym"] = df["year"].astype(str) + "-" + df["month"].map(lambda m: f"{m:02d}")

    df["district"] = df["시군구"].str.replace("서울특별시 ", "", regex=False).str.strip()
    # weather: 안개 -> 기타 (before canonical order)
    df["weather"] = df["기상상태"].where(df["기상상태"] != "안개", "기타")
    # surface normalize (2017 표기개정)
    surf_map = {"습기": "젖음/습기", "결빙": "서리/결빙"}
    df["surface"] = df["노면상태"].replace(surf_map)
    df["daynight"] = df["주야"]
    df["content"] = df["사고내용"]
    df["road"] = df["도로형태"]
    df["vehicle"] = df["가해운전자 차종"]
    df["age"] = df["가해운전자 연령대"]
    for c in ("사망자수", "중상자수", "경상자수"):
        df[c] = pd.to_numeric(df[c], errors="coerce").fillna(0).astype(int)
    df.rename(columns={"사망자수": "deaths", "중상자수": "serious", "경상자수": "minor"}, inplace=True)
    return df


def load_weather():
    def read(name):
        rows = {}
        with open(f"data/weather/{name}", encoding="utf-8") as fh:
            header = fh.readline().strip().split(",")
            for line in fh:
                parts = line.rstrip("\n").split(",")
                rows[parts[0]] = dict(zip(header[1:], parts[1:]))
        return rows
    rain = read("rain_days.csv")
    snow = read("snow_days.csv")
    temp = read("temperature.csv")
    weather = {}
    for y in YEARS:
        for m in range(1, 13):
            ym = f"{y}-{m:02d}"
            rd = rain.get(ym, {})
            weather[ym] = {
                "rain_days": int(rd["rain_days"]) if rd.get("rain_days") not in (None, "") else 0,
                "precip_mm": (float(rd["precip_mm"]) if rd.get("precip_mm") not in (None, "") else None),
                "snow_days": int(snow.get(ym, {}).get("snow_days", 0) or 0),
                "temp_avg": (float(temp[ym]["temp_avg"]) if ym in temp and temp[ym]["temp_avg"] != "" else None),
                "days_in_month": calendar.monthrange(y, m)[1],
            }
    return weather


# ---------- builders ----------
def build_meta(df):
    return {
        "period": {"start": "2007-01", "end": "2025-12", "months": 228, "year_min": 2007, "year_max": 2025},
        "totals": {"accidents": int(len(df)), "deaths": int(df["deaths"].sum()),
                   "serious": int(df["serious"].sum()), "minor": int(df["minor"].sum()),
                   "fatal_accidents": int((df["content"] == "사망사고").sum()),
                   "serious_accidents": int((df["content"] == "중상사고").sum())},
        "scope": {"severity": CONTENT, "note": "중상·사망사고 한정(경상 제외)", "resolution": "월 단위", "has_coords": False},
        "categories": {"weather": WEATHER, "season": SEASON, "districts": DISTRICTS, "daynight": DAYNIGHT,
                       "content": CONTENT, "road": ROAD, "vehicle": VEHICLE, "age": AGE, "surface": SURFACE},
        "cleaning_notes": {"weather_merge": "안개→기타(총 67건)",
                           "surface_merge": ["습기→젖음/습기", "결빙→서리/결빙(2017년 표기개정)"],
                           "district_prefix_stripped": "서울특별시 "},
        "build": {"pipeline_version": "1.0.0", "source_files": 19, "deterministic": True},
    }


def build_trend(df):
    monthly = []
    g = df.groupby(["year", "month", "content"], sort=False).agg(
        count=("deaths", "size"), deaths=("deaths", "sum"), serious=("serious", "sum")).reset_index()
    ck = ordkey(CONTENT)
    recs = [{"year": int(r.year), "month": int(r.month), "season": SEASON_OF[int(r.month)],
             "content": r.content, "count": int(r.count), "deaths": int(r.deaths), "serious": int(r.serious)}
            for r in g.itertuples(index=False)]
    monthly = sorted(recs, key=lambda x: (x["year"], x["month"], ck(x["content"])))

    gy = df.groupby("year").agg(count=("deaths", "size"), deaths=("deaths", "sum")).reset_index()
    by_year = sorted([{"year": int(r.year), "count": int(r.count), "deaths": int(r.deaths)}
                      for r in gy.itertuples(index=False)], key=lambda x: x["year"])

    total = len(df)
    gs = df.groupby("season").agg(count=("deaths", "size"), deaths=("deaths", "sum")).reset_index()
    smap = {r.season: (int(r.count), int(r.deaths)) for r in gs.itertuples(index=False)}
    by_season = [{"season": s, "count": smap[s][0], "deaths": smap[s][1], "share": r4(smap[s][0] / total)}
                 for s in SEASON]

    gm = df.groupby("month").agg(count=("deaths", "size")).reset_index()
    mmap = {int(r.month): int(r.count) for r in gm.itertuples(index=False)}
    monthly_profile = [{"month": m, "count": mmap[m], "share": r4(mmap[m] / total),
                        "avg_per_year": r1(mmap[m] / len(YEARS))} for m in range(1, 13)]
    return {"monthly": monthly, "by_year": by_year, "by_season": by_season, "monthly_profile": monthly_profile}


def build_weather(df):
    total = len(df)
    wk = ordkey(WEATHER)
    gw = df.groupby("weather").agg(count=("deaths", "size"), deaths=("deaths", "sum"),
                                   serious=("serious", "sum")).reset_index()
    wmap = {r.weather: (int(r.count), int(r.deaths), int(r.serious)) for r in gw.itertuples(index=False)}
    by_weather = [{"weather": w, "count": wmap.get(w, (0, 0, 0))[0], "deaths": wmap.get(w, (0, 0, 0))[1],
                   "serious": wmap.get(w, (0, 0, 0))[2], "share": r4(wmap.get(w, (0, 0, 0))[0] / total)}
                  for w in WEATHER]

    gm = df.groupby(["year", "month", "weather"], sort=False).agg(
        count=("deaths", "size"), deaths=("deaths", "sum"), serious=("serious", "sum")).reset_index()
    monthly = sorted([{"year": int(r.year), "month": int(r.month), "weather": r.weather,
                       "count": int(r.count), "deaths": int(r.deaths), "serious": int(r.serious)}
                      for r in gm.itertuples(index=False)],
                     key=lambda x: (x["year"], x["month"], wk(x["weather"])))

    ck = ordkey(CONTENT)
    gws = df.groupby(["weather", "content"]).agg(count=("deaths", "size")).reset_index()
    weather_by_severity = sorted([{"weather": r.weather, "content": r.content, "count": int(r.count)}
                                  for r in gws.itertuples(index=False)], key=lambda x: (wk(x["weather"]), ck(x["content"])))
    sk = ordkey(SURFACE)
    gss = df.groupby(["surface", "content"]).agg(count=("deaths", "size")).reset_index()
    surface_by_severity = sorted([{"surface": r.surface, "content": r.content, "count": int(r.count)}
                                  for r in gss.itertuples(index=False)], key=lambda x: (sk(x["surface"]), ck(x["content"])))
    return {"by_weather": by_weather, "monthly": monthly,
            "weather_by_severity": weather_by_severity, "surface_by_severity": surface_by_severity}


def _weather_group(w):
    if w == "비":
        return "rain"
    if w == "눈":
        return "snow"
    return "clear"


def build_exposure(df, weather):
    df = df.copy()
    df["wg"] = df["weather"].map(_weather_group)
    gm = df.groupby(["ym", "wg"]).size().unstack(fill_value=0)
    monthly = []
    tot = {"rain_acc": 0, "snow_acc": 0, "clear_acc": 0, "rain_days": 0, "snow_days": 0, "clear_days": 0}
    cal = {m: {"rain_acc": 0, "snow_acc": 0, "clear_acc": 0, "rain_days": 0, "snow_days": 0, "clear_days": 0}
           for m in range(1, 13)}
    for y in YEARS:
        for m in range(1, 13):
            ym = f"{y}-{m:02d}"
            w = weather[ym]
            rain_acc = int(gm.loc[ym, "rain"]) if (ym in gm.index and "rain" in gm.columns) else 0
            snow_acc = int(gm.loc[ym, "snow"]) if (ym in gm.index and "snow" in gm.columns) else 0
            clear_acc = int(gm.loc[ym, "clear"]) if (ym in gm.index and "clear" in gm.columns) else 0
            rain_days = w["rain_days"]
            snow_days = w["snow_days"]
            clear_days = max(1, w["days_in_month"] - rain_days - snow_days)
            rain_rate = (rain_acc / rain_days) if rain_days > 0 else None
            snow_rate = (snow_acc / snow_days) if snow_days > 0 else None
            clear_rate = clear_acc / clear_days
            rain_ratio = (rain_rate / clear_rate) if (rain_rate is not None and clear_rate > 0) else None
            snow_ratio = (snow_rate / clear_rate) if (snow_rate is not None and clear_rate > 0) else None
            monthly.append({"year": y, "month": m, "rain_days": rain_days, "snow_days": snow_days,
                            "precip_mm": r1(w["precip_mm"]), "temp_avg": r1(w["temp_avg"]),
                            "rain_acc": rain_acc, "snow_acc": snow_acc, "clear_acc": clear_acc,
                            "clear_denom_days": clear_days,
                            "rain_rate": r4(rain_rate), "snow_rate": r4(snow_rate), "clear_rate": r4(clear_rate),
                            "rain_ratio": r3(rain_ratio), "snow_ratio": r3(snow_ratio)})
            tot["rain_acc"] += rain_acc; tot["snow_acc"] += snow_acc; tot["clear_acc"] += clear_acc
            tot["rain_days"] += rain_days; tot["snow_days"] += snow_days; tot["clear_days"] += clear_days
            for k in cal[m]:
                cal[m][k] += {"rain_acc": rain_acc, "snow_acc": snow_acc, "clear_acc": clear_acc,
                              "rain_days": rain_days, "snow_days": snow_days, "clear_days": clear_days}[k]
    p_rain = tot["rain_acc"] / tot["rain_days"]
    p_snow = tot["snow_acc"] / tot["snow_days"]
    p_clear = tot["clear_acc"] / tot["clear_days"]
    # exposure-correct representation ratio = (사고 점유율) ÷ (해당 조건 일수 점유율).
    # 라벨-per-day 배율(rain_ratio)은 맑음 지배 라벨로 clear_rate가 구조적으로 과대→편향. repr는 노출(일수) 정규화로 방어 가능.
    total_acc = tot["rain_acc"] + tot["snow_acc"] + tot["clear_acc"]
    total_days = tot["rain_days"] + tot["snow_days"] + tot["clear_days"]

    def repr_ratio(acc, days):
        return (acc / total_acc) / (days / total_days) if days > 0 else None
    pooled = {"rain_rate": r4(p_rain), "snow_rate": r4(p_snow), "clear_rate": r4(p_clear),
              "rain_ratio": r3(p_rain / p_clear), "snow_ratio": r3(p_snow / p_clear),
              "rain_repr": r3(repr_ratio(tot["rain_acc"], tot["rain_days"])),
              "snow_repr": r3(repr_ratio(tot["snow_acc"], tot["snow_days"])),
              "rain_acc_total": tot["rain_acc"], "snow_acc_total": tot["snow_acc"], "clear_acc_total": tot["clear_acc"],
              "rain_days_total": tot["rain_days"], "snow_days_total": tot["snow_days"], "clear_days_total": tot["clear_days"],
              "total_acc": total_acc, "total_days": total_days}
    by_cal = []
    for m in range(1, 13):
        c = cal[m]
        rr = c["rain_acc"] / c["rain_days"] if c["rain_days"] > 0 else None
        sr = c["snow_acc"] / c["snow_days"] if c["snow_days"] > 0 else None
        cr = c["clear_acc"] / c["clear_days"] if c["clear_days"] > 0 else None
        m_acc = c["rain_acc"] + c["snow_acc"] + c["clear_acc"]
        m_days = c["rain_days"] + c["snow_days"] + c["clear_days"]
        def mrepr(acc, days):
            return (acc / m_acc) / (days / m_days) if (days > 0 and m_acc > 0) else None
        by_cal.append({"month": m, "rain_rate": r4(rr), "snow_rate": r4(sr), "clear_rate": r4(cr),
                       "rain_ratio": r3(rr / cr) if (rr and cr) else None,
                       "snow_ratio": r3(sr / cr) if (sr and cr) else None,
                       "rain_repr": r3(mrepr(c["rain_acc"], c["rain_days"])),
                       "snow_repr": r3(mrepr(c["snow_acc"], c["snow_days"]))})
    return {"monthly": monthly, "pooled": pooled, "by_calendar_month": by_cal,
            "definitions": {"rain_rate": "비 사고건수 ÷ 강수일수", "snow_rate": "눈 사고건수 ÷ 눈일수(관측월만)",
                            "clear_rate": "맑음군({맑음,흐림,기타}) 사고건수 ÷ max(1, 월일수 − 강수일수 − 눈일수)",
                            "ratio": "각 사고율 ÷ 맑음군 사고율 (기술적 per-day 배율; 라벨 편향 有)",
                            "repr": "노출 보정 대표비 = (조건 사고 점유율) ÷ (조건 일수 점유율); >1이면 해당 날씨가 사고에 과대표집. H2 판정에 사용",
                            "caveat": "월단위·카테고리 근사, 상관(인과 아님)"},
            "snow_subset_verified": False}


def build_district(df):
    dk = ordkey(DISTRICTS)
    wk = ordkey(WEATHER)
    total_by_d = df.groupby("district").agg(count=("deaths", "size"), deaths=("deaths", "sum")).to_dict("index")
    wg = df.assign(wg=df["weather"].map(_weather_group)).groupby(["district", "wg"]).size().unstack(fill_value=0)
    by_district = []
    for d in DISTRICTS:
        cnt = int(total_by_d.get(d, {}).get("count", 0))
        rain = int(wg.loc[d, "rain"]) if (d in wg.index and "rain" in wg.columns) else 0
        snow = int(wg.loc[d, "snow"]) if (d in wg.index and "snow" in wg.columns) else 0
        clear = int(wg.loc[d, "clear"]) if (d in wg.index and "clear" in wg.columns) else 0
        by_district.append({"district": d, "count": cnt, "deaths": int(total_by_d.get(d, {}).get("deaths", 0)),
                            "rain_count": rain, "snow_count": snow, "clear_count": clear,
                            "rain_share": r4(rain / cnt) if cnt else 0.0})
    g = df.groupby(["district", "year", "weather"]).size().reset_index(name="count")
    dyw = sorted([{"district": r.district, "year": int(r.year), "weather": r.weather, "count": int(r["count"])}
                  for _, r in g.iterrows()], key=lambda x: (dk(x["district"]), x["year"], wk(x["weather"])))
    return {"by_district": by_district, "district_year_weather": dyw}


def build_facts(df):
    axes = ["weather", "district", "ym", "daynight", "road", "vehicle", "age"]
    g = df.groupby(axes, sort=False).agg(cnt=("deaths", "size"), deaths=("deaths", "sum")).reset_index()
    # deterministic sort by canonical indices
    ords = {"weather": ordkey(WEATHER), "district": ordkey(DISTRICTS), "daynight": ordkey(DAYNIGHT),
            "road": ordkey(ROAD), "vehicle": ordkey(VEHICLE), "age": ordkey(AGE)}
    records = g.to_dict("records")
    records.sort(key=lambda r: (ords["weather"](r["weather"]), ords["district"](r["district"]), r["ym"],
                                ords["daynight"](r["daynight"]), ords["road"](r["road"]),
                                ords["vehicle"](r["vehicle"]), ords["age"](r["age"])))
    cols = {a: [r[a] for r in records] for a in axes}
    cols["cnt"] = [int(r["cnt"]) for r in records]
    cols["deaths"] = [int(r["deaths"]) for r in records]
    return {"axes": axes, "columns": cols, "nrows": len(records)}


def verdict(v, sup_min, par_min):
    if v is None:
        return "rejected"
    if v >= sup_min:
        return "supported"
    if v >= par_min:
        return "partial"
    return "rejected"


def build_hypotheses(df, trend, exposure):
    # H1: season count max/min ratio
    shares = {s["season"]: s["count"] for s in trend["by_season"]}
    hi_s = max(shares, key=shares.get); lo_s = min(shares, key=shares.get)
    h1_metric = shares[hi_s] / shares[lo_s]
    mp = {m["month"]: m["count"] for m in trend["monthly_profile"]}
    peak_m = max(mp, key=mp.get); trough_m = min(mp, key=mp.get)
    h1 = {"id": "H1", "title": "계절에 따라 사고 발생 패턴이 뚜렷이 다르다", "screen": "계절·추이",
          "metric_name": "계절 사고건수 최대/최소 비율", "metric_value": round(h1_metric, 3),
          "thresholds": {"supported_min": 1.30, "partial_min": 1.12}, "verdict": verdict(h1_metric, 1.30, 1.12),
          "evidence": [{"label": f"{hi_s} 사고건수", "value": shares[hi_s], "unit": "건"},
                       {"label": f"{lo_s} 사고건수", "value": shares[lo_s], "unit": "건"},
                       {"label": f"월 최대/최소({peak_m}월/{trough_m}월)", "value": round(mp[peak_m] / mp[trough_m], 3), "unit": "배"}],
          "caveat": "월 단위·상관 관계, 인과 아님"}

    # H2: 노출 보정 대표비 max(rain_repr, snow_repr). repr>1 => 해당 날씨가 사고에 과대표집(=더 위험).
    # (라벨 per-day 배율 rain_ratio/snow_ratio는 맑음 지배 라벨로 편향 → 판정엔 미사용, 참고치로 노출)
    rrep = exposure["pooled"]["rain_repr"]; srep = exposure["pooled"]["snow_repr"]
    h2_metric = max(rrep, srep)
    h2 = {"id": "H2", "title": "비·눈 오는 날은 맑은 날보다 하루당 사고율이 높다", "screen": "기상 분석",
          "metric_name": "노출 보정 대표비 max(비, 눈) = 사고점유율÷일수점유율", "metric_value": round(h2_metric, 3),
          "thresholds": {"supported_min": 1.20, "partial_min": 0.90}, "verdict": verdict(h2_metric, 1.20, 0.90),
          "evidence": [{"label": "비 대표비(노출보정)", "value": rrep, "unit": "배"},
                       {"label": "눈 대표비(노출보정)", "value": srep, "unit": "배"},
                       {"label": "비 사고 점유율", "value": r4(exposure["pooled"]["rain_acc_total"] / exposure["pooled"]["total_acc"]), "unit": None},
                       {"label": "강수일 점유율", "value": r4(exposure["pooled"]["rain_days_total"] / exposure["pooled"]["total_days"]), "unit": None}],
          "caveat": "노출 보정·월단위 근사, 상관(인과 아님). 대표비<1: 중상·사망사고 한정 데이터에서 강수·적설일 통행량 감소·서행으로 심각사고 과소표집(예상과 반대, 기획상 유효 결과)"}

    # H3: district rain_share max/min
    dstats = df.assign(is_rain=(df["weather"] == "비")).groupby("district").agg(
        total=("is_rain", "size"), rain=("is_rain", "sum"))
    dstats["share"] = dstats["rain"] / dstats["total"]
    hi_d = dstats["share"].idxmax(); lo_d = dstats["share"].idxmin()
    h3_metric = dstats["share"].max() / dstats["share"].min()
    h3 = {"id": "H3", "title": "날씨의 영향은 자치구별로 다르게 나타난다", "screen": "지도",
          "metric_name": "구별 비-사고비율 최대/최소", "metric_value": round(float(h3_metric), 3),
          "thresholds": {"supported_min": 1.50, "partial_min": 1.20}, "verdict": verdict(float(h3_metric), 1.50, 1.20),
          "evidence": [{"label": f"최대 {hi_d}", "value": r4(dstats["share"].max()), "unit": None},
                       {"label": f"최소 {lo_d}", "value": r4(dstats["share"].min()), "unit": None}],
          "caveat": "월 단위·상관 관계, 인과 아님"}

    # H4: over cross axes, max/min of subgroup rain-share (subgroups with total>=1000)
    MIN_N = 1000
    best = {"axis": None, "ratio": 0.0, "hi": None, "lo": None, "hi_v": None, "lo_v": None}
    for axis, label in (("daynight", "주야"), ("road", "도로형태"), ("vehicle", "차종"), ("age", "연령대")):
        st = df.assign(is_rain=(df["weather"] == "비")).groupby(axis).agg(
            total=("is_rain", "size"), rain=("is_rain", "sum"))
        st = st[st["total"] >= MIN_N]
        if len(st) < 2:
            continue
        st["share"] = st["rain"] / st["total"]
        ratio = st["share"].max() / st["share"].min()
        if ratio > best["ratio"]:
            best = {"axis": label, "ratio": float(ratio), "hi": st["share"].idxmax(), "lo": st["share"].idxmin(),
                    "hi_v": r4(st["share"].max()), "lo_v": r4(st["share"].min())}
    h4 = {"id": "H4", "title": "날씨 영향은 주야·도로형태·차종·연령대에 따라 증폭/약화된다", "screen": "크로스 분석",
          "metric_name": "축 하위그룹 비-사고비율 최대/최소 배율(최대 축)", "metric_value": round(best["ratio"], 3),
          "thresholds": {"supported_min": 1.50, "partial_min": 1.20}, "verdict": verdict(best["ratio"], 1.50, 1.20),
          "evidence": [{"label": f"최대 증폭 축: {best['axis']}", "value": round(best["ratio"], 3), "unit": "배"},
                       {"label": f"최고 {best['hi']}", "value": best["hi_v"], "unit": None},
                       {"label": f"최저 {best['lo']}", "value": best["lo_v"], "unit": None}],
          "caveat": f"하위그룹 표본 ≥{MIN_N}건 한정, 월 단위·상관(인과 아님)"}

    return {"verdict_labels": {"supported": "지지", "partial": "부분 지지", "rejected": "기각"},
            "hypotheses": [h1, h2, h3, h4]}


# ---------- output ----------
def dump(name, obj, compact=False):
    path = os.path.join(OUTDIR, name)
    with open(path, "w", encoding="utf-8") as fh:
        if compact:
            json.dump(obj, fh, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
        else:
            json.dump(obj, fh, ensure_ascii=False, sort_keys=True, indent=1)


def build_all():
    os.makedirs(OUTDIR, exist_ok=True)
    df = load_accidents()
    weather = load_weather()
    meta = build_meta(df)
    trend = build_trend(df)
    weather_json = build_weather(df)
    exposure = build_exposure(df, weather)
    district = build_district(df)
    facts = build_facts(df)
    hypotheses = build_hypotheses(df, trend, exposure)
    dump("meta.json", meta)
    dump("trend.json", trend)
    dump("weather.json", weather_json)
    dump("exposure.json", exposure)
    dump("district.json", district)
    dump("facts.json", facts, compact=True)
    dump("hypotheses.json", hypotheses)
    return df


def file_hashes():
    hashes = {}
    for f in sorted(glob.glob(os.path.join(OUTDIR, "*.json"))):
        with open(f, "rb") as fh:
            hashes[os.path.basename(f)] = hashlib.sha256(fh.read()).hexdigest()
    return hashes


def main():
    build_all()
    print("== output files ==")
    for f in sorted(glob.glob(os.path.join(OUTDIR, "*.json"))):
        sz = os.path.getsize(f)
        extra = ""
        if f.endswith("facts.json"):
            with open(f, "rb") as fh:
                extra = f"  gzip={len(gzip.compress(fh.read(), 9))/1024/1024:.2f}MB"
        print(f"  {os.path.basename(f):20} {sz:>10} bytes{extra}")
    hp = json.load(open(os.path.join(OUTDIR, "hypotheses.json"), encoding="utf-8"))
    print("== hypotheses ==")
    for h in hp["hypotheses"]:
        print(f"  {h['id']} {h['verdict']:9} metric={h['metric_value']}  ({h['metric_name']})")


if __name__ == "__main__":
    main()
