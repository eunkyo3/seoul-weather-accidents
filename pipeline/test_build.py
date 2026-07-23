"""pytest: schema conformance, cleaning, exposure, totals, districts, hypotheses determinism.

Run: python -X utf8 -m pytest pipeline/ -q
Builds output once (session fixture) if missing; determinism test rebuilds and compares hashes.
"""
import calendar
import glob
import gzip
import hashlib
import json
import os

import pytest

import build_aggregates as B

OUT = B.OUTDIR
TOTAL_ACCIDENTS = 223290  # profiled ground truth (19 files)
SEASON_OF = B.SEASON_OF


def _hashes():
    return {os.path.basename(f): hashlib.sha256(open(f, "rb").read()).hexdigest()
            for f in sorted(glob.glob(os.path.join(OUT, "*.json")))}


@pytest.fixture(scope="session", autouse=True)
def ensure_built():
    need = [f"{n}.json" for n in ("meta", "trend", "weather", "exposure", "district", "facts", "hypotheses")]
    if not all(os.path.exists(os.path.join(OUT, f)) for f in need):
        B.build_all()


def load(name):
    return json.load(open(os.path.join(OUT, f"{name}.json"), encoding="utf-8"))


# ---------- schema presence ----------
def test_top_level_keys():
    assert set(load("meta")) >= {"period", "totals", "scope", "categories", "cleaning_notes", "build"}
    assert set(load("trend")) >= {"monthly", "by_year", "by_season", "monthly_profile"}
    assert set(load("weather")) >= {"by_weather", "monthly", "weather_by_severity", "surface_by_severity"}
    assert set(load("exposure")) >= {"monthly", "pooled", "by_calendar_month", "definitions", "snow_subset_verified"}
    assert set(load("district")) >= {"by_district", "district_year_weather"}
    assert set(load("facts")) >= {"axes", "columns", "nrows"}
    assert set(load("hypotheses")) >= {"verdict_labels", "hypotheses"}


def test_build_has_no_timestamp():
    # determinism: build meta must not carry time-dependent fields
    b = load("meta")["build"]
    assert "pipeline_version" in b and b["deterministic"] is True
    assert not any("time" in k.lower() or "date" in k.lower() for k in b)


# ---------- totals / preservation ----------
def test_meta_totals():
    m = load("meta")["totals"]
    assert m["accidents"] == TOTAL_ACCIDENTS
    assert m["fatal_accidents"] + m["serious_accidents"] == TOTAL_ACCIDENTS


def test_total_preservation():
    m = load("meta")["totals"]["accidents"]
    assert sum(w["count"] for w in load("weather")["by_weather"]) == m
    assert sum(d["count"] for d in load("district")["by_district"]) == m
    assert sum(load("facts")["columns"]["cnt"]) == m
    assert sum(r["count"] for r in load("trend")["monthly"]) == m
    assert sum(y["count"] for y in load("trend")["by_year"]) == m
    assert sum(s["count"] for s in load("trend")["by_season"]) == m


def test_deaths_preservation():
    total_deaths = load("meta")["totals"]["deaths"]
    assert sum(w["deaths"] for w in load("weather")["by_weather"]) == total_deaths
    assert sum(load("facts")["columns"]["deaths"]) == total_deaths


# ---------- cleaning / canonical ----------
def test_season_mapping():
    for r in load("trend")["monthly"]:
        assert r["season"] == SEASON_OF[r["month"]]
    assert {s["season"] for s in load("trend")["by_season"]} == set(B.SEASON)


def test_weather_canonical_and_fog_merged():
    vals = {w["weather"] for w in load("weather")["by_weather"]}
    assert vals == set(B.WEATHER)
    assert "안개" not in vals
    assert "안개" not in set(load("facts")["columns"]["weather"])


def test_surface_normalized():
    surfaces = {s["surface"] for s in load("weather")["surface_by_severity"]}
    # 신·구 표기 병합 후 구표기(습기/결빙)는 없어야
    assert "습기" not in surfaces and "결빙" not in surfaces
    assert surfaces <= set(B.SURFACE)


def test_districts_canonical():
    ds = [d["district"] for d in load("district")["by_district"]]
    assert len(ds) == 25 and set(ds) == set(B.DISTRICTS)
    assert not any("서울특별시" in d for d in ds)
    assert set(load("facts")["columns"]["district"]) <= set(B.DISTRICTS)


# ---------- exposure ----------
def test_exposure_228_months_and_denominator_positive():
    mo = load("exposure")["monthly"]
    assert len(mo) == 228
    for r in mo:
        exp_denom = max(1, calendar.monthrange(r["year"], r["month"])[1] - r["rain_days"] - r["snow_days"])
        assert r["clear_denom_days"] == exp_denom
        assert r["clear_denom_days"] >= 1  # 분모 > 0 (전 월)


def test_exposure_snow_not_subset_of_rain():
    # 실측 발견: 눈일수 ⊄ 강수일수 → snow_subset_verified=False, union 정의
    assert load("exposure")["snow_subset_verified"] is False
    mo = load("exposure")["monthly"]
    assert any(r["snow_days"] > r["rain_days"] for r in mo), "위반 월이 존재해야(정의 전환 근거)"


def test_exposure_rate_formulas():
    for r in load("exposure")["monthly"]:
        if r["rain_days"] > 0:
            assert r["rain_rate"] == round(r["rain_acc"] / r["rain_days"], 4)
        else:
            assert r["rain_rate"] is None
        if r["snow_days"] > 0:
            assert r["snow_rate"] == round(r["snow_acc"] / r["snow_days"], 4)
        else:
            assert r["snow_rate"] is None
        assert r["clear_rate"] == round(r["clear_acc"] / r["clear_denom_days"], 4)


def test_exposure_accident_totals_match():
    p = load("exposure")["pooled"]
    assert p["total_acc"] == TOTAL_ACCIDENTS
    assert p["rain_acc_total"] + p["snow_acc_total"] + p["clear_acc_total"] == TOTAL_ACCIDENTS
    # representation ratio present and consistent sign
    assert p["rain_repr"] is not None and p["snow_repr"] is not None


# ---------- facts ----------
def test_facts_columns_aligned_and_budget():
    f = load("facts")
    assert f["axes"] == ["weather", "district", "ym", "daynight", "road", "vehicle", "age"]
    n = f["nrows"]
    for k, col in f["columns"].items():
        assert len(col) == n, f"column {k} length mismatch"
    raw = open(os.path.join(OUT, "facts.json"), "rb").read()
    gz = len(gzip.compress(raw, 9))
    assert gz <= 8 * 1024 * 1024, f"facts.json gzip {gz} > 8MB budget"


# ---------- hypotheses ----------
def _expected_verdict(v, th):
    if v >= th["supported_min"]:
        return "supported"
    if v >= th["partial_min"]:
        return "partial"
    return "rejected"


def test_hypotheses_structure_and_verdict_rule():
    h = load("hypotheses")
    assert set(h["verdict_labels"]) == {"supported", "partial", "rejected"}
    ids = [x["id"] for x in h["hypotheses"]]
    assert ids == ["H1", "H2", "H3", "H4"]
    for x in h["hypotheses"]:
        assert x["verdict"] in {"supported", "partial", "rejected"}
        assert x["verdict"] == _expected_verdict(x["metric_value"], x["thresholds"])
        assert x["evidence"] and all("label" in e and "value" in e for e in x["evidence"])


def test_hypotheses_deterministic_rebuild():
    before = _hashes()
    B.build_all()
    after = _hashes()
    assert before == after, "재실행 시 산출 JSON 바이트 불일치(결정성 위반)"


def test_geojson_district_match():
    # AC-5': 서울 GeoJSON 25개 구 ↔ 데이터 시군구 100% 매칭 (소스 교체·표기 변경 회귀 방지)
    geo_path = os.path.join(os.path.dirname(__file__), "..", "web", "public", "geo", "seoul.json")
    with open(geo_path, encoding="utf-8") as f:
        geo = json.load(f)
    features = geo["features"]
    assert len(features) == 25
    geo_names = {ft["properties"]["name"] for ft in features}
    assert geo_names == set(B.DISTRICTS)
    ds = load("district")
    assert geo_names == {row["district"] for row in ds["by_district"]}
