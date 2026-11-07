"""Online test: two separate browser profiles meet through the public Nostr relays.

Checks that presence crosses the network, chat reaches the table-mate, and a fake microphone
stream arrives at the table-mate but not at a third person sitting at another table.
Needs internet access to wss:// Nostr relays and a WebRTC path between the browsers.
Run: python tests/e2e_online.py [--proxy http://host:port]
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


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def serve():
    handler = functools.partial(Quiet, directory=str(ROOT))
    server = socketserver.ThreadingTCPServer(("127.0.0.1", 0), handler)
    server.daemon_threads = True
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server.server_address[1]


def main():
    url = LIVE_URL or f"http://127.0.0.1:{serve()}/index.html"
    region = "XX/worldwide"
    args = ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", "--autoplay-policy=no-user-gesture-required"]
    if PROXY:
        args += [f"--proxy-server={PROXY}", "--proxy-bypass-list=127.0.0.1;localhost"]
    results = {"region": region}
    errors = []
    with sync_playwright() as p:
        try:
            browser = p.chromium.launch(channel="chrome", args=args)
        except Exception:
            browser = p.chromium.launch(args=args)
        browsers = [browser]
        pages = {}
        for name in ("Rina", "Dimas", "Sari"):
            # Each context is a separate profile: no shared storage, no BroadcastChannel.
            context = browser.new_context(viewport={"width": 1280, "height": 860}, permissions=["microphone"])
            context.route("**/fonts.g*/**", lambda route: route.abort())
            # The test people sit in Anywhere > Open lounge for under a minute.
            context.add_init_script(
                "localStorage.setItem('nk:name', JSON.stringify(%s));"
                "localStorage.setItem('nk:place', JSON.stringify({country:'XX', region:'worldwide'}));" % json.dumps(name))
            page = context.new_page()
            page.on("pageerror", lambda exc, n=name: errors.append(f"{n}: {exc}"))
            page.goto(url + "#XX/worldwide/lounge", wait_until="commit", timeout=90000)
            page.wait_for_selector(".t", timeout=90000)
            pages[name] = page
        rina, dimas, sari = pages["Rina"], pages["Dimas"], pages["Sari"]

        deadline = time.time() + 60
        while time.time() < deadline:
            counts = [pg.evaluate("window.nongkrong ? window.nongkrong.state.people.size : 0") for pg in pages.values()]
            if min(counts) >= 2:
                break
            rina.wait_for_timeout(1000)
        results["presence_counts"] = counts
        results["seconds_to_meet"] = round(60 - (deadline - time.time()), 1)

        rina.locator(".t").nth(0).click()
        dimas.wait_for_timeout(1500)
        dimas.locator(".t").nth(0).click()
        sari.wait_for_timeout(1500)
        sari.locator(".t").nth(1).click()

        deadline = time.time() + 45
        while time.time() < deadline:
            if rina.evaluate("window.nongkrong.state.tableRoom && Object.keys(window.nongkrong.state.tableRoom.getPeers()).length") >= 1:
                break
            rina.wait_for_timeout(1000)
        results["table_peers_rina"] = rina.evaluate("Object.keys(window.nongkrong.state.tableRoom.getPeers()).length")
        results["table_peers_sari"] = sari.evaluate("Object.keys(window.nongkrong.state.tableRoom.getPeers()).length")

        rina.fill("#sayInput", "halo dari meja 1")
        rina.press("#sayInput", "Enter")
        dimas.wait_for_timeout(3000)
        results["dimas_got_text"] = dimas.locator(".msg p", has_text="halo dari meja 1").count() == 1
        results["sari_got_text"] = sari.locator(".msg p", has_text="halo dari meja 1").count() > 0

        rina.locator("#voiceBtn").click()
        deadline = time.time() + 30
        while time.time() < deadline:
            if dimas.evaluate("window.nongkrong.state.audio.size") >= 1:
                break
            dimas.wait_for_timeout(1000)
        results["dimas_receives_voice"] = dimas.evaluate("window.nongkrong.state.audio.size") >= 1
        results["sari_receives_voice"] = sari.evaluate("window.nongkrong.state.audio.size") >= 1
        results["rina_voice_flag_seen_by_sari"] = sari.evaluate(
            "[...window.nongkrong.state.people.values()].some(p => p.name === 'Rina' && p.voice)")
        dimas.screenshot(path=str(OUT / "online-dimas.png"))
        for browser in browsers:
            try:
                browser.close()
            except Exception:
                pass

    expected = {
        "dimas_got_text": True,
        "sari_got_text": False,
        "dimas_receives_voice": True,
        "sari_receives_voice": False,
        "rina_voice_flag_seen_by_sari": True,
    }
    failures = [k for k, v in expected.items() if results.get(k) != v]
    if min(results["presence_counts"]) < 2:
        failures.append("presence_counts")
    report = {"results": results, "errors": errors, "failures": failures}
    (OUT / "online.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
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
