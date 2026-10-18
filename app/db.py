"""FalkorDB connection. The whole product runs on this one graph."""
import os
from functools import lru_cache

from falkordb import FalkorDB


def _load_dotenv(path: str = ".env") -> None:
    # Tiny .env reader so we don't need python-dotenv.
    if not os.path.exists(path):
        return
    with open(path, encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip())


_load_dotenv()

GRAPH_NAME = os.getenv("FALKORDB_GRAPH", "rootcause")


@lru_cache(maxsize=1)
def client() -> FalkorDB:
    return FalkorDB(
        host=os.getenv("FALKORDB_HOST", "localhost"),
        port=int(os.getenv("FALKORDB_PORT", "6379")),
        username=os.getenv("FALKORDB_USERNAME") or None,
        password=os.getenv("FALKORDB_PASSWORD") or None,
    )


def graph():
    return client().select_graph(GRAPH_NAME)


def run(query: str, params: dict | None = None) -> list[dict]:
    """Run a Cypher query and return rows as dicts keyed by column name."""
    result = graph().query(query, params or {})
    cols = [h[1] if isinstance(h, (list, tuple)) else h for h in result.header]
    return [dict(zip(cols, row)) for row in result.result_set]


def ro(query: str, params: dict | None = None) -> list[dict]:
    """Read-only variant (GRAPH.RO_QUERY), safe to run on replicas."""
    result = graph().ro_query(query, params or {})
    cols = [h[1] if isinstance(h, (list, tuple)) else h for h in result.header]
    return [dict(zip(cols, row)) for row in result.result_set]
