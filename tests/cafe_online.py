"""Online cafe test: a guest and a barista in two separate browser profiles meet through the public relays.

The guest sits at a table and orders from the order card. The order must cross the network to the
barista's bar queue, the guest must see it acknowledged ("making"), the barista makes it with real
button holds, and the guest must get it served at the table.
Run: python tests/cafe_online.py [--url https://juw12.github.io/nongkrong/] [--proxy http://host:port] [--no-mdns]
     python tests/cafe_online.py --local   (same cafe protocol over the local tab-to-tab transport, no internet)
"""
import functools
import http.server
import json
import os
import socketserver
import sys
import threading
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "tests" / "out"
OUT.mkdir(parents=True, exist_ok=True)
PROXY = sys.argv[sys.argv.index("--proxy") + 1] if "--proxy" in sys.argv else None
LIVE_URL = sys.argv[sys.argv.index("--url") + 1] if "--url" in sys.argv else None
LOCAL_MODE = "--local" in sys.argv
HOLD_SECONDS = {"grind": 18 / 2.6, "tamp": 15 / 9, "pull": 27.5 / 3.2, "steam": 2.6, "pour": 2.4}


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def serve():
    handler = functools.partial(Quiet, directory=str(ROOT))
    server = socketserver.ThreadingTCPServer(("127.0.0.1", 0), handler)
    server.daemon_threads = True
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server.server_address[1]


def wait_until(page, expression, seconds):
    deadline = time.time() + seconds
    while time.time() < deadline:
        if page.evaluate(expression):
            return round(seconds - (deadline - time.time()), 1)
        page.wait_for_timeout(800)
    return None


def make_drink(page, who):
    """Work through the bar steps for one guest's order with real presses on the hold button."""
    for _ in range(14):
        snap = page.evaluate("window.nongkrong.cafe.debug.bar().snapshot()")
        order = snap.get("order") or {}
        # served: the bar either shows the finished cup or has moved on to the next customer
        if snap["done"] or not snap["step"] or order.get("who") != who:
            return True
        step = snap["step"]
        box = page.locator("#holdBtn").bounding_box()
        page.mouse.move(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2)
        page.mouse.down()
        if step["kind"] == "hold":
            page.wait_for_timeout(int(HOLD_SECONDS.get(step["id"], 2) * 1000))
        page.mouse.up()
        page.wait_for_timeout(1300)
    return False


def main():
    base = LIVE_URL or f"http://127.0.0.1:{serve()}/index.html"
    stamp = int(time.time())
    args = ["--use-angle=d3d11", "--ignore-gpu-blocklist", "--enable-unsafe-swiftshader"]
    if "--no-mdns" in sys.argv:
        # corporate networks often block mDNS, which hides local ICE candidates between two local browsers
        args.append("--disable-features=WebRtcHideLocalIpsWithMdns")
    if PROXY:
        args += [f"--proxy-server={PROXY}", "--proxy-bypass-list=127.0.0.1;localhost"]
    results = {"url": base, "transport": "local" if LOCAL_MODE else "relays + WebRTC"}
    errors = []
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="chrome", args=args)
        pages = {}
        shared_context = browser.new_context(viewport={"width": 1280, "height": 860}) if LOCAL_MODE else None
        for name, role in (("Bayu", "barista"), ("Rina", "guest")):
            if LOCAL_MODE:
                # local transport: two tabs of one profile talk over BroadcastChannel; the name is read once at load
                context = shared_context
            else:
                # separate contexts = separate profiles: no shared storage, no BroadcastChannel
                context = browser.new_context(viewport={"width": 1280, "height": 860})
            context.route("**/fonts.g*/**", lambda route: route.abort())
            page = context.new_page()
            page.add_init_script(
                "localStorage.setItem('nk:name', JSON.stringify(%s));"
                "localStorage.setItem('nk:place', JSON.stringify({country:'XX', region:'worldwide'}));" % json.dumps(name))
            page.on("pageerror", lambda exc, n=name: errors.append(f"{n}: {exc}"))
            page.on(
                "console",
                lambda msg, n=name: errors.append(f"{n}: {msg.text}")
                if msg.type == "error" and "fonts.g" not in msg.text and "WebSocket" not in msg.text
                else None,
            )
            separator = "&" if "?" in base else "?"
            local_flag = "local=1&" if LOCAL_MODE else ""
            page.goto(f"{base}{separator}{local_flag}role={role}&cam=mix&v={stamp}#XX/worldwide/lounge", wait_until="commit", timeout=90000)
            page.wait_for_function("window.nongkrong && window.nongkrong.cafe", timeout=90000)
            page.wait_for_timeout(1500)
            pages[name] = page
        barista, guest = pages["Bayu"], pages["Rina"]

        results["seconds_to_see_barista"] = wait_until(
            guest,
            "[...window.nongkrong.state.people.values()].some(x => x.role === 'barista')",
            90,
        )

        guest.locator(".t").nth(0).click()
        guest.wait_for_timeout(2500)
        order_button = guest.locator("#orderCard button[aria-label^='Order']").first
        results["order_label"] = order_button.get_attribute("aria-label")
        order_button.click()
        guest.wait_for_timeout(500)
        results["guest_status_after_click"] = guest.evaluate("window.nongkrong.cafe.debug.mine()[0]?.status")

        results["seconds_to_reach_bar"] = wait_until(
            barista,
            "window.nongkrong.cafe.debug.shop()?.queue.some(o => o.who === 'Rina' && o.source === 'table')",
            30,
        )
        results["seconds_to_ack"] = wait_until(
            guest,
            "window.nongkrong.cafe.debug.mine()[0]?.status === 'making'",
            20,
        )
        results["acked_by"] = guest.evaluate("window.nongkrong.cafe.debug.mine()[0]?.by")

        # background tabs pause animation frames, so the bar only advances in the front tab
        barista.bring_to_front()
        barista.wait_for_function("window.nongkrong.cafe.debug.bar()", timeout=30000)
        results["bar_before_pick"] = barista.evaluate(
            "(() => { const s = window.nongkrong.cafe.debug.bar().snapshot(); return { order: s.order?.who || null, step: s.step?.id || null, done: s.done }; })()"
        )
        barista.evaluate("""() => {
          const shop = window.nongkrong.cafe.debug.shop();
          const index = shop.queue.findIndex(o => o.who === 'Rina');
          if (index > 0) {
            shop.queue.unshift(shop.queue.splice(index, 1)[0]);
          }
        }""")
        barista.evaluate("window.nongkrong.cafe.debug.pickNext()")
        barista.wait_for_timeout(800)
        results["barista_making"] = barista.evaluate("window.nongkrong.cafe.debug.bar().snapshot().order?.who")
        barista.screenshot(path=str(OUT / "cafe-online-barista.png"))
        results["drink_finished"] = make_drink(barista, "Rina")

        results["bar_after_make"] = barista.evaluate(
            "(() => { const s = window.nongkrong.cafe.debug.bar().snapshot(); return { order: s.order?.who || null, step: s.step?.id || null, done: s.done }; })()"
        )
        guest.bring_to_front()
        results["seconds_to_serve"] = wait_until(
            guest,
            "window.nongkrong.cafe.debug.mine()[0]?.status === 'served'",
            30,
        )
        results["served_by"] = guest.evaluate("window.nongkrong.cafe.debug.mine()[0]?.by")
        results["barista_cups_today"] = barista.evaluate("window.nongkrong.cafe.debug.shop().today.cups")
        guest.wait_for_timeout(1500)
        guest.screenshot(path=str(OUT / "cafe-online-guest.png"))
        browser.close()

    checks = {
        "guest saw the barista online": results["seconds_to_see_barista"] is not None,
        "order reached the bar": results["seconds_to_reach_bar"] is not None,
        "guest saw it acknowledged": results["seconds_to_ack"] is not None and results["acked_by"] == "Bayu",
        "barista kept the order through a bar reload": results["barista_making"] == "Rina",
        "barista finished the drink": results["drink_finished"] is True,
        "guest got it served by Bayu": results["seconds_to_serve"] is not None and results["served_by"] == "Bayu",
    }
    failures = [name for name, ok in checks.items() if not ok]
    report = {"results": results, "checks": checks, "errors": errors, "failures": failures}
    (OUT / "cafe_online.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))
    sys.stdout.flush()
    os._exit(1 if failures else 0)


if __name__ == "__main__":
    try:
        main()
    except Exception:
        import traceback
        traceback.print_exc()
        sys.stdout.flush()
        os._exit(2)

