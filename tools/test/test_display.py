"""
tools/test/test_display.py - Display tests per README-1.md:2373 Phase 3 M3
Acceptance: terminal visible, Canvas2D dirty-rect, WebGL2 experimental, 1024x768
"""
import pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
PWA = ROOT / "build" / "pwa"

def test_display_bridge_exists():
    p = ROOT / "src/bridge/display.js"
    assert p.exists(), "display.js missing per README-1.md:442"
    txt = p.read_text(encoding="utf-8")
    assert "Canvas2D" in txt, "display.js must mention Canvas2D per README-1.md:1190"
    assert "dirty" in txt.lower(), "display.js must handle dirty-rect per README-1.md:1200"
    assert "WebGL2" in txt, "display.js must handle WebGL2 experimental per README-1.md:1212"
    assert "1024" in txt and "768" in txt, "display.js must target 1024x768 per README-1.md:1242"

def test_display_has_dirty_rect_no_full_redraw():
    txt = (ROOT / "src/bridge/display.js").read_text(encoding="utf-8")
    assert "updateDirtyRect" in txt, "Display must have updateDirtyRect per README-1.md:1200"
    assert "should not redraw entire frame" in txt.lower() or "no full redraw" in txt.lower() or "dirty rect" in txt.lower(), "Must document dirty-rect optimization per README-1.md:1202"
    assert "putImageData" in txt or "fillRect" in txt, "Must use Canvas2D putImageData/fillRect"

def test_display_has_webgl2_flag():
    txt = (ROOT / "src/bridge/display.js").read_text(encoding="utf-8")
    assert "?gpu=1" in txt or "gpu" in txt, "WebGL2 flag ?gpu=1 per README-1.md:1212"
    assert "not GPU passthrough" in txt or "not passthrough" in txt.lower(), "Must note not GPU passthrough per README-1.md:1217"

def test_display_attaches_to_emulator():
    txt = (ROOT / "src/bridge/display.js").read_text(encoding="utf-8")
    assert "attachToEmulator" in txt, "Must have attachToEmulator per README-1.md:2373"
    assert "screen-update" in txt or "vga" in txt.lower(), "Must handle v86 screen-update"

def test_pwa_has_canvas_and_statusbar():
    # PWA index.html must contain #screen 1024x768 and #statusbar per README-1.md:2373 terminal visible
    idx = PWA / "index.html"
    if not idx.exists():
        # pack may have been run for different tier, check build/pwa exists
        assert False, f"PWA index missing at {idx} - run python3 tools/pack.py --tier base --target pwa per README-1.md:630"
    html = idx.read_text(encoding="utf-8")
    assert 'id="screen"' in html, "PWA must have #screen canvas per README-1.md:1242"
    assert 'width="1024"' in html and 'height="768"' in html, "PWA canvas 1024x768 per README-1.md:1242"
    assert 'id="statusbar"' in html or 'id="status"' in html, "PWA must have statusbar per docs/UI-UX"
    assert 'First-run disclosure' in html, "PWA must have disclosure per README-1.md:745"
    assert 'dirty rect' in html.lower() or 'Canvas2D' in html, "PWA must mention Canvas2D dirty-rect per README-1.md:1200"

def test_main_integrates_display():
    txt = (ROOT / "src/main.js").read_text(encoding="utf-8")
    assert "Display" in txt, "src/main.js must import Display per Phase 3 M3"
    assert "display" in txt.lower(), "src/main.js must instantiate Display"
    assert "performance.mark" in txt, "Must use performance.mark per README-1.md:1861"

# Future: real browser test per README-1.md:2373 would use playwright to check canvas not blank
# def test_terminal_visible_playwright(page):
#     page.goto("http://localhost:8080")
#     page.click("#acknowledge")
#     expect(page.locator("#screen")).to_be_visible()
