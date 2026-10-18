"""RootCause API + static frontend.  Run:  uvicorn app.main:app --reload"""
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from redis.exceptions import ConnectionError as RedisConnectionError

from app import db, services

STATIC = Path(__file__).parent / "static"

app = FastAPI(title="RootCause", version="1.0")
app.add_middleware(GZipMiddleware, minimum_size=800)


@app.exception_handler(services.NotFound)
async def not_found(_: Request, exc: services.NotFound):
    return JSONResponse(status_code=404, content={"detail": str(exc)})


@app.exception_handler(RedisConnectionError)
async def db_down(_: Request, exc: RedisConnectionError):
    return JSONResponse(status_code=503, content={"detail": "The study graph is waking up. Try again in a moment."})


class DiagnoseIn(BaseModel):
    student_id: str
    concept_id: str


class QuizIn(BaseModel):
    student_id: str
    concept_id: str


class SubmitIn(BaseModel):
    student_id: str
    quiz_id: str
    stuck_id: str
    answers: list[int | None] = Field(default_factory=list)


@app.get("/api/health")
def health():
    count = db.ro("MATCH (c:Concept) RETURN count(c) AS n")[0]["n"]
    return {"ok": True, "concepts": count}


@app.get("/api/students")
def students():
    return services.list_students()


@app.get("/api/concepts")
def concepts():
    return services.list_concepts()


@app.get("/api/concepts/resolve")
def resolve(q: str = ""):
    if len(q) > 200:
        raise HTTPException(400, "That is a bit long. Try a short topic name.")
    return services.resolve_concept(q)


@app.post("/api/diagnose")
def diagnose(body: DiagnoseIn):
    return services.diagnose(body.student_id, body.concept_id)


@app.post("/api/quiz/generate")
def quiz_generate(body: QuizIn):
    return services.generate_quiz(body.student_id, body.concept_id)


@app.post("/api/quiz/submit")
def quiz_submit(body: SubmitIn):
    return services.submit_quiz(body.student_id, body.quiz_id, body.answers, body.stuck_id)


@app.get("/api/overview/{student_id}")
def overview(student_id: str):
    return services.overview(student_id)


# Service worker and manifest must be served from the root so the worker controls the whole app.
@app.get("/sw.js", include_in_schema=False)
def service_worker():
    return FileResponse(STATIC / "sw.js", media_type="application/javascript",
                        headers={"Cache-Control": "no-cache", "Service-Worker-Allowed": "/"})


@app.get("/manifest.webmanifest", include_in_schema=False)
def manifest():
    return FileResponse(STATIC / "manifest.webmanifest", media_type="application/manifest+json")


# Link previews (WhatsApp etc.) need an absolute og:image URL, so fill in the host we were reached on.
@app.get("/", include_in_schema=False)
def index(request: Request):
    html = (STATIC / "index.html").read_text(encoding="utf-8")
    base = str(request.base_url).rstrip("/")
    html = html.replace('content="/icons/og.png"', f'content="{base}/icons/og.png"')
    return HTMLResponse(html, headers={"Cache-Control": "no-cache"})


@app.middleware("http")
async def cache_headers(request: Request, call_next):
    response = await call_next(request)
    path = request.url.path
    if path.startswith("/icons/") or path.endswith((".png", ".svg")):
        response.headers["Cache-Control"] = "public, max-age=604800"
    elif path.startswith("/api/"):
        response.headers["Cache-Control"] = "no-store"
    return response


app.mount("/", StaticFiles(directory=STATIC, html=True), name="static")
