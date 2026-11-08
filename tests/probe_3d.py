"""Visual probe of the 3D place: screenshots of several venues by day and night, two people present.
Run: python tests/probe_3d.py   (writes tests/out/probe-*.png and probe.json)
"""
import functools
import http.server
import json
import os
import socketserver
import sys
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "tests" / "out"
OUT.mkdir(parents=True, exist_ok=True)
for key in ("HTTP_PROXY", "HTTPS_PROXY", "http_proxy", "https_proxy"):
    os.environ.pop(key, None)
os.environ["NO_PROXY"] = "*"

GPU_ARGS = ["--use-angle=d3d11", "--ignore-gpu-blocklist", "--enable-unsafe-swiftshader", "--proxy-bypass-list=*"]


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def serve():
    handler = functools.partial(Quiet, directory=str(ROOT))
    server = socketserver.ThreadingTCPServer(("127.0.0.1", 0), handler)
    server.daemon_threads = True
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server.server_address[1]


def seed(name, country="ID", region="batam"):
    place = json.dumps({"country": country, "region": region})
    return (
        "localStorage.setItem('nk:name', JSON.stringify(%s));"
        "localStorage.setItem('nk:place', %s);" % (json.dumps(name), json.dumps(place))
    )


def main():
    port = serve()
    shots = sys.argv[1:] or ["ID:batam:warkop:12", "ID:batam:angkringan:21", "SG:central:kopitiam:10", "JP:tokyo:izakaya:20", "TH:bangkok:streetfood:19", "AU:sydney:pub:15"]
    report = {"errors": [], "shots": []}
    with sync_playwright() as p:
        try:
            browser = p.chromium.launch(channel="chrome", args=GPU_ARGS)
        except Exception:
            browser = p.chromium.launch(args=GPU_ARGS)
        for spec in shots:
            country, region, venue, hour = spec.split(":")
            context = browser.new_context(viewport={"width": 1440, "height": 900})
            context.route("**/fonts.g*/**", lambda route: route.abort())
            url = f"http://127.0.0.1:{port}/index.html?local=1&hour={hour}"
            pages = []
            for name in ("Rina", "Dimas", "Sari"):
                page = context.new_page()
                page.add_init_script(seed(name, country, region))
                page.on("pageerror", lambda exc, n=name: report["errors"].append(f"{spec} {n}: {exc}"))
                page.on("console", lambda msg, n=name: report["errors"].append(f"{spec} {n}: {msg.text}") if msg.type in ("error", "warning") and "fonts.g" not in msg.text and "ERR_FAILED" not in msg.text else None)
                page.goto(url, wait_until="domcontentloaded")
                pages.append(page)
            rina, dimas, sari = pages
            keyword = {"kopitiam": "Kopitiam", "warkop": "Warung", "angkringan": "Angkringan", "izakaya": "Izakaya", "streetfood": "Street", "pub": "Pub"}[venue]
            for page in pages:
                page.wait_for_function("document.querySelector('#stage')?.dataset.ready === '1'", timeout=60000)
                page.locator(".venue", has_text=keyword).first.click()
            rina.wait_for_timeout(1500)
            rina.locator(".t").nth(1).click()
            dimas.wait_for_timeout(300)
            dimas.locator(".t").nth(1).click()
            rina.wait_for_timeout(2500)
            rina.fill("#sayInput", "Kopi susu satu lagi?")
            rina.press("#sayInput", "Enter")
            # Sari walks a little toward the middle with the keyboard
            sari.locator(".world-canvas").focus()
            sari.keyboard.down("w")
            sari.wait_for_timeout(900)
            sari.keyboard.up("w")
            rina.wait_for_timeout(1800)
            info = rina.evaluate("window.nongkrong.state.world.info()")
            name = f"probe-{venue}-{hour}.png"
            rina.locator("#stage").screenshot(path=str(OUT / name))
            sari.locator("#stage").screenshot(path=str(OUT / ("sari-" + name)))
            report["shots"].append({"spec": spec, "file": name, "info": info, "sari": sari.evaluate("window.nongkrong.state.world.info()")})
            context.close()
        browser.close()
    (OUT / "probe.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))
    sys.stdout.flush()
    os._exit(0)


if __name__ == "__main__":
    try:
        main()
    except Exception:
        import traceback
        traceback.print_exc()
        sys.stdout.flush()
        os._exit(2)
