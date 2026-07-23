# Pipeline: 19 xlsx + KMA weather CSV -> aggregate JSON (offline, no network calls).
# Build context is ./pipeline (see docker-compose.yml). data/ is bind-mounted at
# runtime, not baked into the image, so build_aggregates.py's relative paths
# ("data/...", "pipeline/output") resolve exactly as they do when run locally
# from the repo root -- WORKDIR here plays the role of that repo root.
FROM python:3.14-slim

WORKDIR /app

COPY requirements.txt pipeline/requirements.txt
RUN pip install --no-cache-dir -r pipeline/requirements.txt

COPY build_aggregates.py pipeline/build_aggregates.py

# data/ (xlsx + weather CSVs) is bind-mounted read-only at /app/data by compose.
# Output is generated at pipeline/output/ (script default) then copied into the
# shared named volume mounted at /out for the web service to consume.
CMD ["sh", "-c", "python -X utf8 pipeline/build_aggregates.py && mkdir -p /out && cp -f pipeline/output/*.json /out/"]
