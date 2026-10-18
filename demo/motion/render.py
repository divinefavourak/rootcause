"""Render the GSAP launch film frame by frame, build its soundtrack with FFmpeg, and mux the MP4.

Run from the repo root:  python demo/motion/render.py
"""
import http.server
import shutil
import socketserver
import subprocess
import threading
from functools import partial
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "demo"
FRAMES = OUT / "motion" / "_frames"
FPS = 30
PORT = 0  # filled in by serve() with a free port

# Moments the soundtrack lines up with (seconds), matching the GSAP timeline in index.html.
CUTS = [4.5, 10, 19, 27, 33, 38, 42.5]
POPS = [10.6, 11.4, 12.2, 13.0, 13.8, 33.4, 34.0, 34.6, 35.2, 40.9, 41.05, 41.2, 41.35]
CHIMES = [14.8, 28.8, 43.0]
STAMP = [2.6, 27.1]


def serve():
    # Windows can map .js to text/plain via the registry; ES modules need a JavaScript type.
    http.server.SimpleHTTPRequestHandler.extensions_map.update({".js": "application/javascript", ".mjs": "application/javascript"})
    handler = partial(http.server.SimpleHTTPRequestHandler, directory=str(ROOT))
    handler.log_message = lambda *a, **k: None
    socketserver.ThreadingTCPServer.allow_reuse_address = True
    global PORT
    httpd = socketserver.ThreadingTCPServer(("127.0.0.1", 0), handler)
    httpd.daemon_threads = True
    PORT = httpd.server_address[1]
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


def render_frames():
    if FRAMES.exists():
        shutil.rmtree(FRAMES)
    FRAMES.mkdir(parents=True)
    with sync_playwright() as p:
        b = p.chromium.launch(args=["--allow-file-access-from-files", "--use-gl=angle", "--enable-webgl", "--ignore-gpu-blocklist"])
        page = b.new_page(viewport={"width": 1280, "height": 720})
        page.goto((ROOT / "demo" / "motion" / "index.html").as_uri())
        page.wait_for_function("window.READY === true && !!window.TL", timeout=30000)
        duration = page.evaluate("window.DURATION")
        total = int(duration * FPS)
        for i in range(total):
            page.evaluate("(t) => window.TL.seek(t, false)", i / FPS)
            page.screenshot(path=str(FRAMES / f"f{i:05d}.jpg"), type="jpeg", quality=90)
            if i % 150 == 0:
                print(f"frame {i}/{total}")
        b.close()
    return duration


def ff(*args):
    subprocess.run(["ffmpeg", "-y", "-v", "error", *args], check=True)


def soundtrack(duration):
    """A small synth bed (pad + kick + hats) and sound effects, all generated, nothing downloaded."""
    a = OUT / "motion" / "_audio"
    a.mkdir(exist_ok=True)
    d = f"{duration:.2f}"
    # Chord pad: Am, F, C, G, 2.4 s each (100 BPM, 4 beats), soft fade at every chord change.
    f = lambda n: f"if(lt(mod(t,9.6),2.4),{n[0]},if(lt(mod(t,9.6),4.8),{n[1]},if(lt(mod(t,9.6),7.2),{n[2]},{n[3]})))"
    root, third, fifth = f([220, 174.61, 261.63, 196]), f([261.63, 220, 329.63, 246.94]), f([329.63, 261.63, 392, 293.66])
    env = "min(1,mod(t,2.4)*3)*min(1,(2.4-mod(t,2.4))*3)"
    pad = f"0.06*({env})*(sin(2*PI*{root}*t)+0.8*sin(2*PI*{third}*t)+0.7*sin(2*PI*{fifth}*t)+0.3*sin(4*PI*{root}*t))"
    gate = "gte(t,2.6)*lt(t,45.5)"
    kick = f"{gate}*0.55*sin(2*PI*t*(48+90*exp(-mod(t-2.6,0.6)*28)))*exp(-mod(t-2.6,0.6)*9)"
    hats = f"{gate}*0.05*(random(0)*2-1)*exp(-mod(t-2.9,0.6)*45)"
    typing = "between(t,0.3,1.9)*0.18*(random(1)*2-1)*exp(-mod(t-0.3,0.065)*160)"
    ff("-f", "lavfi", "-i", f"aevalsrc=exprs='{pad}+{kick}+{hats}+{typing}|{pad}+{kick}+{hats}+{typing}':s=44100:d={d}", str(a / "bed.wav"))
    # One-shot effects.
    ff("-f", "lavfi", "-i", "anoisesrc=d=0.6:c=pink:a=0.6", "-af", "highpass=f=400,lowpass=f=6000,afade=t=in:d=0.25,afade=t=out:st=0.3:d=0.3,volume=0.55", "-ac", "2", str(a / "whoosh.wav"))
    ff("-f", "lavfi", "-i", "aevalsrc=exprs='0.5*sin(2*PI*t*(520+500*exp(-t*40)))*exp(-t*28)':s=44100:d=0.25", "-ac", "2", str(a / "pop.wav"))
    ff("-f", "lavfi", "-i", "aevalsrc=exprs='0.32*(sin(2*PI*880*t)+0.6*sin(2*PI*1318.5*t)+0.3*sin(2*PI*1760*t))*exp(-t*3.2)':s=44100:d=1.6", "-ac", "2", str(a / "chime.wav"))
    ff("-f", "lavfi", "-i", "aevalsrc=exprs='0.8*sin(2*PI*t*(70+160*exp(-t*18)))*exp(-t*7)+0.25*(random(0)*2-1)*exp(-t*30)':s=44100:d=0.5", "-ac", "2", str(a / "stamp.wav"))

    events = [("whoosh", t - 0.15) for t in CUTS] + [("pop", t) for t in POPS] + [("chime", t) for t in CHIMES] + [("stamp", t) for t in STAMP]
    inputs, filters, labels = ["-i", str(a / "bed.wav")], [], ["[0:a]"]
    for i, (name, t) in enumerate(events, start=1):
        inputs += ["-i", str(a / f"{name}.wav")]
        ms = max(0, int(t * 1000))
        filters.append(f"[{i}:a]adelay={ms}|{ms}[e{i}]")
        labels.append(f"[e{i}]")
    graph = ";".join(filters) + ";" + "".join(labels) + f"amix=inputs={len(labels)}:normalize=0,afade=t=out:st={duration - 1.8:.2f}:d=1.8,alimiter=limit=0.9[mix]"
    ff(*inputs, "-filter_complex", graph, "-map", "[mix]", "-t", d, str(a / "mix.wav"))
    return a / "mix.wav"


def main():
    duration = render_frames()
    mix = soundtrack(duration)
    out = OUT / "rootcause-launch.mp4"
    ff("-framerate", str(FPS), "-i", str(FRAMES / "f%05d.jpg"), "-i", str(mix),
       "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p",
       "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", str(out))
    print("wrote", out)


if __name__ == "__main__":
    main()
