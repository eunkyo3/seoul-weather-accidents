"""Fetch KMA Seoul(108) monthly weather stats 2007.01–2025.12, no login/API key.

One request per source endpoint (3 requests total; 강수일수+강수량 share one endpoint):
  - 강수일수(rnDay) + 강수량(sumRn):  /stcs/grnd/grndRnDayMixChartAjaxList.do   (기후통계분석>기상현상일수>강수일수)
  - 눈일수(val):                       /climate/snw/selectSnwChartAjax.do          (기후통계분석>기상현상일수>눈일수)
  - 평균/최저/최고기온(avgTa..):        /stcs/grnd/grndTaAjaxList.do                (기후통계분석>통계분석>기온분석)

All three are the pages' own AJAX endpoints and return **UTF-8 JSON** (the CSV *download* endpoints
downloadGrnd*.do return an ERROR page without an interactive session and are NOT used).
Saves RAW JSON responses + tidy CSVs to data/weather/ so build/시연 need no network.

Run: python -X utf8 pipeline/fetch_weather.py
"""
import http.cookiejar
import json
import os
import socket
import urllib.parse
import urllib.request

socket.setdefaulttimeout(90)
OUT = "data/weather"
START_YEAR, END_YEAR = "2007", "2025"

RAIN_URL = "https://data.kma.go.kr/stcs/grnd/grndRnDayMixChartAjaxList.do"
RAIN_PAGE = "https://data.kma.go.kr/stcs/grnd/grndRnDay.do"
SNOW_URL = "https://data.kma.go.kr/climate/snw/selectSnwChartAjax.do"
SNOW_PAGE = "https://data.kma.go.kr/climate/snw/selectSnwChart.do"
TEMP_URL = "https://data.kma.go.kr/stcs/grnd/grndTaAjaxList.do"
TEMP_PAGE = "https://data.kma.go.kr/stcs/grnd/grndTaList.do"


def make_opener():
    cj = http.cookiejar.CookieJar()
    op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
    op.addheaders = [("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64)")]
    return op


def post_json(op, url, params, referer):
    op.addheaders = [("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"),
                     ("X-Requested-With", "XMLHttpRequest"), ("Referer", referer)]
    data = urllib.parse.urlencode(params, encoding="utf-8").encode("utf-8")
    with urllib.request.urlopen(urllib.request.Request(url, data=data)) as r:
        return r.read().decode("utf-8")


def save_raw(name, text):
    with open(os.path.join(OUT, name), "w", encoding="utf-8") as fh:
        fh.write(text)


def write_csv(name, header, rows):
    with open(os.path.join(OUT, name), "w", encoding="utf-8", newline="") as fh:
        fh.write(",".join(header) + "\n")
        for row in rows:
            fh.write(",".join("" if v is None else str(v) for v in row) + "\n")


def fetch_rain(op):
    op.open(RAIN_PAGE).read()  # establish session cookie
    p = {"rnElement": "RN", "pgmNo": "156", "menuNo": "432", "pageIndex": "1",
         "serviceSe": "F00101", "selectType": "1", "mddlClssCd": "SFC01", "firstLoading": "Y",
         "dataFormCd": "F00513", "schType": "2",
         "startYear": START_YEAR, "endYear": END_YEAR, "startMonth": "01", "endMonth": "12",
         "schStnId": "108"}
    txt = post_json(op, RAIN_URL, p, RAIN_PAGE)
    save_raw("rain_precip.raw.json", txt)
    obj = json.loads(txt)
    rows = []
    for d in obj["dataList"]:
        ym = d["dt"]  # YYYY-MM
        rn_day = d.get("rnDay")
        rn_day = int(round(float(rn_day))) if rn_day not in (None, "") else 0
        sum_rn = d.get("sumRn")
        sum_rn = float(sum_rn) if sum_rn not in (None, "") else None
        rows.append((ym, rn_day, sum_rn))
    rows.sort()
    write_csv("rain_days.csv", ["ym", "rain_days", "precip_mm"], rows)
    return rows


def fetch_snow(op):
    op.open(SNOW_PAGE).read()
    p = {"pgmNo": "697", "menuNo": "1142", "pageIndex": "1", "schTab": "2",
         "serviceSe": "F00101", "selectType": "1", "mddlClssCd": "WWRPT01", "lrgClssCd": "WWRPT",
         "firstLoading": "Y", "dataFormCd": "F00513", "schType": "2",
         "startYear": START_YEAR, "endYear": END_YEAR, "startMonth": "01", "endMonth": "12",
         "startMt": "01", "endMt": "12", "schStnId": "108"}
    txt = post_json(op, SNOW_URL, p, SNOW_PAGE)
    save_raw("snow_days.raw.json", txt)
    obj = json.loads(txt)
    rows = []
    for d in obj["data"]:
        ym = f"{d['yyyy']}-{d['mm']}"
        val = d.get("val")
        # months with no observed snow omit 'val' -> 0 snow days
        snow_days = int(round(float(val))) if val not in (None, "") else 0
        rows.append((ym, snow_days))
    rows.sort()
    write_csv("snow_days.csv", ["ym", "snow_days"], rows)
    return rows


def fetch_temp(op):
    t = op.open(TEMP_PAGE).read().decode("utf-8", "replace")
    import re
    i = t.find('id="schForm"'); j = t.find('</form>', i)
    base = []
    for m in re.finditer(r'<(input|select)\b[^>]*name="([^"]+)"[^>]*>', t[i:j]):
        v = re.search(r'value="([^"]*)"', m.group(0))
        base.append([m.group(2), v.group(1) if v else ""])
    setv = {"dataFormCd": "F00513", "dataTypeCd": "standard",
            "startYear": START_YEAR, "endYear": END_YEAR, "startMonth": "01", "endMonth": "12",
            "startDt": START_YEAR + "01", "endDt": END_YEAR + "12"}
    params = [(n, setv.get(n, v)) for n, v in base]
    for e in ("MIN", "AVG", "MAX"):
        params.append(("taElement", e))
    txt = post_json(op, TEMP_URL, params, TEMP_PAGE)
    save_raw("temperature.raw.json", txt)
    obj = json.loads(txt)
    rows = []
    for d in obj:
        ym = d["dt"]
        rows.append((ym, d.get("avgTa"), d.get("minTa"), d.get("maxTa")))
    rows.sort()
    write_csv("temperature.csv", ["ym", "temp_avg", "temp_min", "temp_max"], rows)
    return rows


def main():
    os.makedirs(OUT, exist_ok=True)
    op = make_opener()
    rain = fetch_rain(op)
    snow = fetch_snow(op)
    temp = fetch_temp(op)
    print(f"rain_days.csv   months={len(rain)}  first={rain[0]}  last={rain[-1]}")
    print(f"snow_days.csv   months={len(snow)}  first={snow[0]}  last={snow[-1]}")
    print(f"temperature.csv months={len(temp)} first={temp[0]} last={temp[-1]}")
    # coverage check
    for name, rows in (("rain", rain), ("snow", snow), ("temp", temp)):
        yms = {r[0] for r in rows}
        expected = {f"{y}-{m:02d}" for y in range(2007, 2026) for m in range(1, 13)}
        missing = sorted(expected - yms)
        print(f"{name}: {len(yms)} months, missing={missing[:5]}{'...' if len(missing) > 5 else ''} (count={len(missing)})")


if __name__ == "__main__":
    main()
