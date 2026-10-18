# One container: FalkorDB (the only database) + the RootCause API.
# Set FALKORDB_HOST to a FalkorDB Cloud host to use that instead of the bundled server.
FROM falkordb/falkordb:latest

RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 python3-venv \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /srv/rootcause
COPY requirements.txt .
RUN python3 -m venv /venv && /venv/bin/pip install --no-cache-dir -r requirements.txt

COPY app ./app
COPY scripts/__init__.py scripts/seed.py scripts/start.sh ./scripts/

ENV FALKORDB_HOST=127.0.0.1 FALKORDB_PORT=6379 PORT=8000 BROWSER=0 PYTHONUNBUFFERED=1
EXPOSE 8000
ENTRYPOINT []
CMD ["sh", "scripts/start.sh"]
