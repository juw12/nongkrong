"""Smoke-test the cafe roles: errors, shop maths, owner, barista (three cameras), guest order, CrewCup home.

Usage: python tests/cafe_check.py [nongkrong|crewcup]   (screenshots go to tests/out/cafe)
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

ROOT = os.environ.get("NK_ROOT", str(Path(__file__).resolve().parent.parent))
HOST_ARG = sys.argv[1] if len(sys.argv) > 1 and sys.argv[1] in ("nongkrong", "crewcup") else None
OUT = Path(__file__).resolve().parent / "out" / "cafe"
HOST = HOST_ARG or "nongkrong"
OUT.mkdir(parents=True, exist_ok=True)
for key in ("HTTP_PROXY", "HTTPS_PROXY", "http_proxy", "https_proxy"):
    os.environ.pop(key, None)


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


server = socketserver.ThreadingTCPServer(("127.0.0.1", 0), functools.partial(QuietHandler, directory=ROOT))
server.daemon_threads = True
threading.Thread(target=server.serve_forever, daemon=True).start()
BASE = "http://127.0.0.1:%d/index.html?local=1&hour=10&host=%s" % (server.server_address[1], HOST)
errors = []

SHOP_CHECK = """async () => {
  const S = await import('./shop.js');
  const shop = S.newShop({ countryCode: 'ID', venueId: 'kafe', venueName: 'Kafe', regionName: 'Batam', hour: 7 });
  const menu = S.menuOf(shop).map(m => m.name + ' ' + S.formatMoney(m.price, 'ID'));
  S.openStore(shop);
  S.hire(shop, 0);
  let served = 0, arrive = 0, walk = 0;
  let r = 0.37;
  const random = () => { r = (r * 9301 + 49297) % 233280 / 233280; return r; };
  for (let i = 0; i < 12 * 60; i++) {
    for (const e of S.tick(shop, 1, { random })) {
      if (e.type === 'served') served++;
      if (e.type === 'arrive') arrive++;
      if (e.type === 'walkout') walk++;
    }
  }
  const sum = S.closeStore(shop);
  const warkop = S.newShop({ countryCode: 'ID', venueId: 'warkop', venueName: 'Warung kopi', regionName: 'Batam' });
  const others = {};
  for (const c of ['GB', 'JP', 'AU', 'VN', 'IT', 'US']) {
    const s = S.newShop({ countryCode: c, venueId: 'cafe', venueName: 'Cafe', regionName: 'X' });
    others[c] = S.menuOf(s).map(m => m.name + ' ' + S.formatMoney(m.price, c)).join(' | ');
  }
  return { menu, arrive, served, walk, rating: shop.rating, cash: S.formatMoney(shop.cash, 'ID'), sum,
    warkop: S.menuOf(warkop).map(m => m.name + ' ' + S.formatMoney(m.price, 'ID')), rent: S.formatMoney(S.rentFor(warkop), 'ID'), others };
}"""


def new_page(browser, width=1440, height=900, role=None, extra=""):
    page = browser.new_page(viewport={"width": width, "height": height})
    page.add_init_script(
        "localStorage.setItem('nk:name', JSON.stringify('Juwen'));"
        "localStorage.setItem('nk:place', JSON.stringify({country:'ID', region:'batam'}));"
    )
    page.on("pageerror", lambda err: errors.append(str(err)))
    page.on("console", lambda msg: errors.append(msg.text) if msg.type == "error" else None)
    url = BASE + (f"&role={role}" if role else "") + extra
    page.goto(url, wait_until="domcontentloaded")
    page.wait_for_function("window.nongkrong && window.nongkrong.state.country", timeout=30000)
    page.evaluate("window.nongkrong.goTo('ID', 'batam', 'kafe')")
    page.wait_for_timeout(2500)
    return page


with sync_playwright() as p:
    browser = p.chromium.launch(channel="chrome", args=["--use-angle=d3d11", "--ignore-gpu-blocklist", "--enable-unsafe-swiftshader"])
    result = {}

    # owner: open the store, let a game hour pass, look at the room and the books
    page = new_page(browser, role="owner")
    result["shop"] = page.evaluate(SHOP_CHECK)
    page.click("#storeBtn")
    page.evaluate("() => { const s = window.nongkrong.cafe.debug.shop(); s.staff.length || null; }")
    page.evaluate("window.nongkrong.cafe.debug.fastForward(45)")
    page.wait_for_timeout(2500)
    result["owner"] = page.evaluate("""() => {
      const s = window.nongkrong.cafe.debug.shop();
      return { open: s.open, queue: s.queue.length, cash: s.cash, cups: s.today.cups, npcs: window.nongkrong.state.world?.info?.().avatars };
    }""")
    page.screenshot(path=str(OUT / "owner.png"))
    page.close()

    # barista: three cameras, mid-process
    for cam, step, frac in (("fp", 0, 0.6), ("tp", 3, 0.5), ("mix", 4, 0.75)):
        page = new_page(browser, role="barista", extra=f"&cam={cam}")
        page.evaluate("() => { const s = window.nongkrong.cafe.debug.shop(); window.nongkrong.cafe.debug.shop().open = true; }")
        page.evaluate("""() => {
          const shop = window.nongkrong.cafe.debug.shop();
          shop.queue.length = 0;
          const S = shop;
        }""")
        page.evaluate("""async () => {
          const S = await import('./shop.js');
          const shop = window.nongkrong.cafe.debug.shop();
          S.addOrder(shop, { recipe: 'latte', who: 'Rina', source: 'table', table: 3 });
          S.addOrder(shop, { recipe: 'iced', who: 'Budi' });
          S.addOrder(shop, { recipe: 'espresso', who: 'Sari' });
        }""")
        page.wait_for_function("window.nongkrong.cafe.debug.bar()", timeout=30000)
        page.evaluate("window.nongkrong.cafe.debug.pickNext()")
        page.wait_for_timeout(800)
        page.evaluate(f"window.nongkrong.cafe.debug.bar().jump({step}, {frac})")
        page.wait_for_timeout(2600)
        result["bar_" + cam] = page.evaluate("() => { const s = window.nongkrong.cafe.debug.bar().snapshot(); return { step: s.step && s.step.id, view: s.view, quality: s.quality }; }")
        page.screenshot(path=str(OUT / f"barista_{cam}.png"))
        page.close()

    # full barista run with real holds: make one espresso by holding the button
    page = new_page(browser, role="barista", extra="&cam=mix")
    page.evaluate("""async () => {
      const S = await import('./shop.js');
      const shop = window.nongkrong.cafe.debug.shop();
      shop.open = true;
      shop.queue.length = 0;
      S.addOrder(shop, { recipe: 'espresso', who: 'Ahmad' });
    }""")
    page.wait_for_function("window.nongkrong.cafe.debug.bar()", timeout=30000)
    page.evaluate("window.nongkrong.cafe.debug.pickNext()")
    page.wait_for_timeout(600)
    holds = {"grind": 18 / 2.6, "tamp": 15 / 9, "pull": 27.5 / 3.2}
    for _ in range(8):
        snap = page.evaluate("window.nongkrong.cafe.debug.bar().snapshot()")
        if snap["done"] or not snap["step"]:
            break
        step = snap["step"]
        box = page.locator("#holdBtn").bounding_box()
        page.mouse.move(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2)
        if step["kind"] == "hold":
            page.mouse.down()
            page.wait_for_timeout(int(holds.get(step["id"], 2) * 1000))
            page.mouse.up()
        else:
            page.mouse.down()
            page.mouse.up()
            page.wait_for_timeout(1100)
        page.wait_for_timeout(300)
    page.wait_for_timeout(1200)
    result["espresso_run"] = page.evaluate("() => { const s = window.nongkrong.cafe.debug.shop(); return { cups: s.today.cups, revenue: s.today.revenue, tips: s.today.tips, quality: s.today.quality }; }")
    page.close()

    # guest: sit, order, get it brought to the table
    page = new_page(browser, role="guest")
    page.evaluate("window.nongkrong.state.world && 1")
    page.evaluate("() => { const t = document.querySelector('#tables .t, #tables button'); t && t.click(); }")
    page.wait_for_timeout(1500)
    if not page.evaluate("Boolean(window.nongkrong.state.seat)"):
        page.evaluate("window.nongkrong.goTo('ID', 'batam', 'kafe')")
    page.wait_for_timeout(500)
    seated = page.evaluate("Boolean(window.nongkrong.state.seat)")
    result["guest_seated"] = seated
    if seated:
        page.click(".oc-item >> nth=1")
        page.wait_for_timeout(17500)
        result["guest_orders"] = page.evaluate("window.nongkrong.cafe.debug.mine().map(o => [o.name, o.status, o.by])")
    page.screenshot(path=str(OUT / "guest.png"))
    page.close()

    # CrewCup home (only meaningful with host=crewcup)
    page = new_page(browser, role="home" if HOST == "crewcup" else "guest")
    page.wait_for_timeout(800)
    page.screenshot(path=str(OUT / "home.png"))
    page.close()

    # phone barista
    page = new_page(browser, width=390, height=844, role="barista", extra="&cam=mix")
    page.evaluate("""async () => {
      const S = await import('./shop.js');
      const shop = window.nongkrong.cafe.debug.shop();
      shop.open = true;
      shop.queue.length = 0;
      S.addOrder(shop, { recipe: 'cappuccino', who: 'Dewi', source: 'table', table: 2 });
    }""")
    page.wait_for_function("window.nongkrong.cafe.debug.bar()", timeout=30000)
    page.evaluate("window.nongkrong.cafe.debug.pickNext()")
    page.wait_for_timeout(600)
    page.evaluate("window.nongkrong.cafe.debug.bar().jump(5, 0.85)")
    page.wait_for_timeout(2500)
    page.screenshot(path=str(OUT / "phone_barista.png"))
    page.close()

    browser.close()

result["errors"] = errors[:20]
print(json.dumps(result, indent=1, default=str)[:6000])
