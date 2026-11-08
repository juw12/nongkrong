"""Diagnostic: load one page, report JS errors and frames rendered in 3 seconds."""
import json
import sys
import time

sys.path.insert(0, __file__.rsplit("\\", 1)[0])
from probe_3d import GPU_ARGS, seed, serve  # noqa: E402

from playwright.sync_api import sync_playwright


def main():
    port = serve()
    report = {"errors": [], "console": []}
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="chrome", args=GPU_ARGS)
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        context.route("**/fonts.g*/**", lambda route: route.abort())
        page = context.new_page()
        page.add_init_script(seed("Rina"))
        page.on("pageerror", lambda exc: report["errors"].append(str(exc)))
        page.on("console", lambda msg: report["console"].append(f"{msg.type}: {msg.text}"[:300]))
        start = time.time()
        page.goto(f"http://127.0.0.1:{port}/index.html?local=1&hour=12", wait_until="domcontentloaded", timeout=60000)
        report["goto_s"] = round(time.time() - start, 1)
        page.wait_for_timeout(6000)
        start = time.time()
        report["frames_3s"] = page.evaluate(
            """() => new Promise((done) => {
                let n = 0;
                const end = performance.now() + 3000;
                const tick = () => { n++; if (performance.now() < end) requestAnimationFrame(tick); else done(n); };
                requestAnimationFrame(tick);
            })"""
        )
        report["eval_s"] = round(time.time() - start, 1)
        report["ready"] = page.evaluate("() => document.querySelector('[data-ready]') ? 1 : 0")
        browser.close()
    print(json.dumps(report, indent=1))


main()
