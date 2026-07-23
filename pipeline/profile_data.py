"""Phase 0-1 profiler: scan all 19 xlsx files, emit profiling stats + facts.json sizing.

Run: python -X utf8 pipeline/profile_data.py
Outputs profiling data to stdout (redirect / captured by caller to build profile_report.md).
READ-ONLY on data/*.xlsx.
"""
import glob
import gzip
import json
import os
import re
from collections import Counter, defaultdict

DATA_GLOB = "data/사고분석-*.xlsx"

PROFILE_COLS = [
    "시군구", "기상상태", "노면상태", "사고내용", "주야",
    "도로형태", "가해운전자 차종", "가해운전자 연령대",
]
FACTS_AXES = ["기상상태", "구", "연월", "주야", "도로형태", "가해운전자 차종", "가해운전자 연령대"]

MONTH_RE = re.compile(r"(\d{4})\s*년\s*(\d{1,2})\s*월")


def parse_yearmonth(s):
    if not isinstance(s, str):
        return None, None
    m = MONTH_RE.search(s)
    if not m:
        return None, None
    return int(m.group(1)), int(m.group(2))


def strip_district(s):
    if not isinstance(s, str):
        return s
    return s.replace("서울특별시 ", "").strip()


def main():
    import pandas as pd

    files = sorted(glob.glob(DATA_GLOB))
    print(f"# FILES: {len(files)}")

    per_year_rows = {}
    # distinct values per profile column, tracked per-year for drift
    distinct_by_col_year = {c: defaultdict(Counter) for c in PROFILE_COLS}
    missing_by_col_year = defaultdict(lambda: defaultdict(int))
    # facts combos
    facts = defaultdict(lambda: [0, 0])  # key -> [count, deaths]
    frames = []  # per-file cleaned frames for vectorized facts groupby
    total_rows = 0
    total_deaths = 0
    total_serious = 0
    total_minor = 0
    # per-month weather-condition-by-yearmonth sanity (for exposure later)
    ym_weather = defaultdict(Counter)

    all_columns = None
    for f in files:
        year_label = os.path.basename(f)
        df = pd.read_excel(f, dtype=str)
        if all_columns is None:
            all_columns = list(df.columns)
        else:
            if list(df.columns) != all_columns:
                print(f"# COLUMN_MISMATCH in {year_label}: {list(df.columns)}")
        n = len(df)
        # derive year from 발생년월 (authoritative), fall back to filename
        yms = df["발생년월"].map(parse_yearmonth)
        years = [y for y, m in yms]
        file_year = Counter(y for y in years if y is not None).most_common(1)[0][0]
        per_year_rows[file_year] = per_year_rows.get(file_year, 0) + n
        total_rows += n

        # numeric sums
        for col, acc in (("사망자수", "d"), ("중상자수", "s"), ("경상자수", "mn")):
            vals = pd.to_numeric(df[col], errors="coerce").fillna(0)
            if acc == "d":
                total_deaths += int(vals.sum())
            elif acc == "s":
                total_serious += int(vals.sum())
            else:
                total_minor += int(vals.sum())

        deaths_series = pd.to_numeric(df["사망자수"], errors="coerce").fillna(0).astype(int).tolist()

        # profile columns
        for c in PROFILE_COLS:
            src = df[c]
            if c == "시군구":
                src = src.map(strip_district)
            vc = src.value_counts(dropna=False)
            for val, cnt in vc.items():
                key = "<NA>" if (val is None or (isinstance(val, float))) else str(val)
                if pd.isna(val):
                    key = "<NA>"
                distinct_by_col_year[c][file_year][key] += int(cnt)
            miss = int(src.isna().sum())
            missing_by_col_year[c][file_year] += miss

        # facts combos + ym weather (vectorized)
        ym_series = [f"{y}-{mo:02d}" if y else "<NA>" for y, mo in yms]
        cf = pd.DataFrame({
            "기상상태": df["기상상태"].fillna("<NA>").astype(str),
            "구": df["시군구"].map(strip_district).fillna("<NA>").astype(str),
            "연월": ym_series,
            "주야": df["주야"].fillna("<NA>").astype(str),
            "도로형태": df["도로형태"].fillna("<NA>").astype(str),
            "가해운전자 차종": df["가해운전자 차종"].fillna("<NA>").astype(str),
            "가해운전자 연령대": df["가해운전자 연령대"].fillna("<NA>").astype(str),
            "사망자수": pd.to_numeric(df["사망자수"], errors="coerce").fillna(0).astype(int),
        })
        frames.append(cf)
        # ym weather counts
        for ym, w in zip(ym_series, cf["기상상태"]):
            ym_weather[ym][w] += 1

        print(f"# LOADED {year_label} year={file_year} rows={n}")

    # vectorized facts aggregation across all files
    big = pd.concat(frames, ignore_index=True)
    grp = big.groupby(FACTS_AXES, sort=False).agg(cnt=("사망자수", "size"), deaths=("사망자수", "sum"))
    for key, row in zip(grp.index, grp.itertuples(index=False)):
        facts[tuple(str(k) for k in key)] = [int(row.cnt), int(row.deaths)]

    # ---- emit profiling JSON blob for report builder ----
    result = {
        "file_count": len(files),
        "columns": all_columns,
        "per_year_rows": dict(sorted(per_year_rows.items())),
        "total_rows": total_rows,
        "total_deaths": total_deaths,
        "total_serious": total_serious,
        "total_minor": total_minor,
        "distinct_by_col": {},
        "missing_by_col": {},
    }
    for c in PROFILE_COLS:
        # union of values across years, with per-year presence
        all_vals = Counter()
        for yr, cnt in distinct_by_col_year[c].items():
            all_vals.update(cnt)
        years_sorted = sorted(distinct_by_col_year[c].keys())
        val_year_matrix = {}
        for val in all_vals:
            val_year_matrix[val] = {
                yr: distinct_by_col_year[c][yr].get(val, 0) for yr in years_sorted
            }
        result["distinct_by_col"][c] = {
            "total_distinct": len(all_vals),
            "values_total_count": dict(all_vals.most_common()),
            "per_year": val_year_matrix,
            "years": years_sorted,
        }
        result["missing_by_col"][c] = dict(sorted(missing_by_col_year[c].items()))

    # ---- facts sizing ----
    facts_rows = []
    for key, (cnt, deaths) in facts.items():
        facts_rows.append(list(key) + [cnt, deaths])
    result["facts_distinct_combos"] = len(facts_rows)

    # serialize a representative facts.json (compact + as sorted array-of-arrays)
    facts_rows_sorted = sorted(facts_rows)
    facts_payload = json.dumps(facts_rows_sorted, ensure_ascii=False, separators=(",", ":"))
    raw_bytes = facts_payload.encode("utf-8")
    gz = gzip.compress(raw_bytes, compresslevel=9)
    result["facts_json_raw_bytes"] = len(raw_bytes)
    result["facts_json_gzip_bytes"] = len(gz)

    # also test an object-keyed variant for comparison (columnar dict)
    # columns: axes + count + deaths as separate arrays
    cols = list(zip(*facts_rows_sorted)) if facts_rows_sorted else []
    columnar = {name: list(cols[i]) for i, name in enumerate(FACTS_AXES + ["cnt", "deaths"])} if cols else {}
    columnar_payload = json.dumps(columnar, ensure_ascii=False, separators=(",", ":"))
    columnar_gz = gzip.compress(columnar_payload.encode("utf-8"), compresslevel=9)
    result["facts_json_columnar_raw_bytes"] = len(columnar_payload.encode("utf-8"))
    result["facts_json_columnar_gzip_bytes"] = len(columnar_gz)

    # ym weather coverage
    result["ym_count"] = len(ym_weather)
    result["ym_min"] = min(ym_weather.keys())
    result["ym_max"] = max(k for k in ym_weather.keys() if k != "<NA>")
    # snow/rain accident presence per year (weather category)
    result["ym_weather_sample"] = {k: dict(v) for k, v in list(sorted(ym_weather.items()))[:3]}

    os.makedirs("pipeline/_profile_cache", exist_ok=True)
    with open("pipeline/_profile_cache/profile_result.json", "w", encoding="utf-8") as fh:
        json.dump(result, fh, ensure_ascii=False, indent=1)
    # dump facts combos count distribution for fallback analysis
    with open("pipeline/_profile_cache/ym_weather.json", "w", encoding="utf-8") as fh:
        json.dump({k: dict(v) for k, v in ym_weather.items()}, fh, ensure_ascii=False, indent=1)

    print("# DONE")
    print(f"# TOTAL_ROWS {total_rows}")
    print(f"# FACTS_COMBOS {len(facts_rows)}")
    print(f"# FACTS_GZIP_BYTES {len(gz)}  ({len(gz)/1024/1024:.2f} MB)")
    print(f"# FACTS_COLUMNAR_GZIP_BYTES {len(columnar_gz)}  ({len(columnar_gz)/1024/1024:.2f} MB)")


if __name__ == "__main__":
    main()
