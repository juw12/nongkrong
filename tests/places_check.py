"""Every place must look like its own place in 3D.

Visits several countries, regions and venues, screenshots the 3D stage after each switch and
compares the scene identity reported by the world (venue, region, theme) and the pixels.
Run: python tests/places_check.py   (writes tests/out/places/*.png and tests/out/places.json)
"""
import hashlib
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from probe_3d import GPU_ARGS, seed, serve  # noqa: E402

from playwright.sync_api import sync_playwright

OUT = Path(__file__).resolve().parent / "out" / "places"
OUT.mkdir(parents=True, exist_ok=True)

# (country, region, venue id) in visiting order; switches cover venue, region and country changes
VISITS = [
    ("ID", "batam", "warkop"),
    ("ID", "batam", "angkringan"),
    ("ID", "batam", "kafe"),
    ("ID", "jakarta", "kafe"),
    ("MY", "kuala lumpur", "mamak"),
    ("MY", "kuala lumpur", "kopitiam"),
    ("MY", "kuala lumpur", "kafe"),
    ("JP", "tokyo", "izakaya"),
    ("JP", "tokyo", "yatai"),
    ("JP", "tokyo", "kissaten"),
    ("GB", "london", "pub"),
    ("TR", "istanbul", "caybahcesi"),
]


def main():
    port = serve()
    report = {"errors": [], "visits": []}
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="chrome", args=GPU_ARGS)
        context = browser.new_context(viewport={"width": 1280, "height": 860})
        context.route("**/fonts.g*/**", lambda route: route.abort())
        page = context.new_page()
        page.add_init_script(seed("Rina", "ID", "batam"))
        page.on("pageerror", lambda exc: report["errors"].append(str(exc)))
        page.goto(f"http://127.0.0.1:{port}/index.html?local=1&hour=12", wait_until="domcontentloaded")
        page.wait_for_function("document.querySelector('#stage')?.dataset.ready === '1'", timeout=60000)
        for country, region, venue in VISITS:
            page.evaluate(
                "([c, r, v]) => window.nongkrong.goTo(c, r, v)",
                [country, region, venue],
            )
            page.wait_for_timeout(900)
            info = page.evaluate("window.nongkrong.state.world.info()")
            shot = OUT / f"{country}-{region.replace(' ', '-')}-{venue}.png"
            page.locator("#stage canvas").screenshot(path=str(shot))
            report["visits"].append({
                "asked": f"{country}/{region}/{venue}",
                "scene": info.get("scene"),
                "pixels": hashlib.sha1(shot.read_bytes()).hexdigest()[:12],
            })
        browser.close()

    scenes = [v["scene"] for v in report["visits"]]
    report["scene_matches_request"] = all(
        s and s.get("country") == a.split("/")[0] and s.get("region", "").lower().startswith(a.split("/")[1]) and s.get("venue") == a.split("/")[2]
        for s, a in zip(scenes, [v["asked"] for v in report["visits"]])
    )
    themes = [s.get("theme") if s else None for s in scenes]
    report["distinct_themes"] = len(set(themes))
    report["distinct_pixels"] = len({v["pixels"] for v in report["visits"]})
    report["visits_count"] = len(VISITS)
    (Path(__file__).resolve().parent / "out" / "places.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps({k: report[k] for k in ("scene_matches_request", "distinct_themes", "distinct_pixels", "visits_count", "errors")}, indent=1))
    ok = report["scene_matches_request"] and report["distinct_pixels"] == len(VISITS) and not report["errors"]
    sys.exit(0 if ok else 1)


main()
