"""End-to-end test in local mode (BroadcastChannel between tabs, no network needed).

Checks: presence shows up across tabs, chat reaches only the same table, a full table refuses
another sitter, no JS errors, no horizontal overflow at 390 and 1440 px.
Run: python tests/e2e_local.py   (needs Playwright + Chromium or Chrome)
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
os.environ["NO_PROXY"] = "127.0.0.1,localhost"


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def serve():
    handler = functools.partial(Quiet, directory=str(ROOT))
    server = socketserver.ThreadingTCPServer(("127.0.0.1", 0), handler)
    server.daemon_threads = True
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server.server_address[1]


def seed(name):
    place = json.dumps({"country": "ID", "region": "batam"})
    return (
        "localStorage.setItem('nk:name', JSON.stringify(%s));"
        "localStorage.setItem('nk:place', %s);" % (json.dumps(name), json.dumps(place))
    )


def offline_fonts(context):
    # External fonts are not needed for the checks and can hang behind a proxy.
    context.route("**/fonts.googleapis.com/**", lambda route: route.abort())
    context.route("**/fonts.gstatic.com/**", lambda route: route.abort())


def main():
    port = serve()
    url = f"http://127.0.0.1:{port}/index.html?local=1"
    results = {}
    errors = []
    with sync_playwright() as p:
        try:
            browser = p.chromium.launch(channel="chrome", args=["--proxy-bypass-list=127.0.0.1;localhost"])
        except Exception:
            browser = p.chromium.launch()
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        offline_fonts(context)
        pages = {}
        for name in ("Rina", "Dimas", "Sari"):
            page = context.new_page()
            page.add_init_script(seed(name))
            page.on("pageerror", lambda exc, n=name: errors.append(f"{n}: {exc}"))
            page.on("console", lambda msg, n=name: errors.append(f"{n}: {msg.text}") if msg.type == "error" and "fonts.g" not in msg.text and "ERR_FAILED" not in msg.text else None)
            page.goto(url, wait_until="domcontentloaded")
            pages[name] = page
        rina, dimas, sari = pages["Rina"], pages["Dimas"], pages["Sari"]
        rina.wait_for_timeout(1500)

        results["presence_count"] = rina.evaluate("window.nongkrong.state.people.size")

        # Rina and Dimas sit at table 2, Sari at table 3.
        rina.locator(".t").nth(1).click()
        dimas.wait_for_timeout(400)
        dimas.locator(".t").nth(1).click()
        sari.locator(".t").nth(2).click()
        rina.wait_for_timeout(1200)

        results["rina_table_members"] = rina.locator("#members li").count()
        results["sari_table_members"] = sari.locator("#members li").count()
        results["distinct_seats"] = rina.evaluate(
            "(() => { const s = window.nongkrong.state; const mine = s.seat.seat;"
            " const other = [...s.people.values()].find(p => p.name === 'Dimas'); return mine !== other.seat; })()")

        rina.fill("#sayInput", "Hujan di Nagoya, nongkrong online saja")
        rina.press("#sayInput", "Enter")
        rina.wait_for_timeout(800)
        results["dimas_got_message"] = dimas.locator(".msg p", has_text="Hujan di Nagoya").count() == 1
        results["sari_got_message"] = sari.locator(".msg p", has_text="Hujan di Nagoya").count() > 0

        sari.fill("#sayInput", "Meja 3 here")
        sari.press("#sayInput", "Enter")
        sari.wait_for_timeout(800)
        results["rina_got_other_table"] = rina.locator(".msg p", has_text="Meja 3 here").count() > 0

        # Floor plan for an observer shows both sitters at table 2.
        results["table2_taken_stools_seen_by_sari"] = sari.locator(".t").nth(1).locator(".stool.taken").count()

        # Table 6 in a warung kopi has 2 seats: fill it, the third person is refused.
        for page in (rina, dimas):
            page.locator("#leaveBtn").click()
        rina.wait_for_timeout(400)
        rina.locator(".t").nth(5).click()
        dimas.wait_for_timeout(400)
        dimas.locator(".t").nth(5).click()
        sari.locator("#leaveBtn").click()
        sari.wait_for_timeout(1000)
        sari.locator(".t").nth(5).click(force=True)
        sari.wait_for_timeout(300)
        results["full_table_refused"] = sari.evaluate("window.nongkrong.state.seat === null")

        # Hide (block) works locally: Dimas hides Rina and no longer sees her messages.
        dimas.locator("#members button", has_text="Hide").first.click()
        rina.fill("#sayInput", "can you see this")
        rina.press("#sayInput", "Enter")
        dimas.wait_for_timeout(700)
        results["hidden_person_filtered"] = dimas.locator(".msg p", has_text="can you see this").count() == 0

        rina.screenshot(path=str(OUT / "desktop-seated.png"))
        results["overflow_1440"] = rina.evaluate("document.documentElement.scrollWidth > innerWidth")

        phone = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2)
        offline_fonts(phone)
        mobile = phone.new_page()
        mobile.add_init_script(seed("Ahmad"))
        mobile.on("pageerror", lambda exc: errors.append(f"phone: {exc}"))
        mobile.goto(url, wait_until="domcontentloaded")
        mobile.wait_for_timeout(900)
        mobile.screenshot(path=str(OUT / "phone-floor.png"))
        results["overflow_390_floor"] = mobile.evaluate("document.documentElement.scrollWidth > innerWidth")
        mobile.locator(".t").first.click()
        mobile.wait_for_timeout(500)
        results["phone_switches_to_table"] = mobile.evaluate("document.querySelector('#main').dataset.view") == "table"
        mobile.screenshot(path=str(OUT / "phone-table.png"))
        results["overflow_390_table"] = mobile.evaluate("document.documentElement.scrollWidth > innerWidth")

        welcome = browser.new_context(viewport={"width": 390, "height": 844})
        offline_fonts(welcome)
        first = welcome.new_page()
        first.goto(url, wait_until="domcontentloaded")
        first.wait_for_timeout(500)
        results["welcome_dialog_open"] = first.evaluate("document.querySelector('#welcome').open")
        first.screenshot(path=str(OUT / "phone-welcome.png"))

    expected = {
        "presence_count": 2,
        "rina_table_members": 2,
        "sari_table_members": 1,
        "distinct_seats": True,
        "dimas_got_message": True,
        "sari_got_message": False,
        "rina_got_other_table": False,
        "table2_taken_stools_seen_by_sari": 2,
        "full_table_refused": True,
        "hidden_person_filtered": True,
        "overflow_1440": False,
        "overflow_390_floor": False,
        "phone_switches_to_table": True,
        "overflow_390_table": False,
        "welcome_dialog_open": True,
    }
    failures = [k for k, v in expected.items() if results.get(k) != v]
    report = {"results": results, "errors": errors, "failures": failures}
    (OUT / "e2e.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))
    sys.stdout.flush()
    os._exit(1 if failures or errors else 0)


if __name__ == "__main__":
    try:
        main()
    except Exception:
        import traceback
        traceback.print_exc()
        sys.stdout.flush()
        sys.stderr.flush()
        os._exit(2)
