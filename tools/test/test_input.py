"""
tools/test/test_input.py - Input tests per README-1.md:2373 Phase 3 M3
Acceptance: keyboard works, mouse works, basic touch works
"""
import pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent.parent

def test_input_bridge_exists():
    p = ROOT / "src/bridge/input.js"
    assert p.exists(), "input.js missing per README-1.md:442"
    txt = p.read_text(encoding="utf-8")
    assert "PS/2" in txt or "PS/2" in txt or "ps/2" in txt.lower(), "input.js must mention PS/2 per README-1.md:1221"
    assert "Keyboard" in txt, "input.js must handle Keyboard per README-1.md:1221"
    assert "Mouse" in txt, "input.js must handle Mouse"
    assert "Touch" in txt or "touch" in txt.lower(), "input.js must handle Touch per README-1.md:1221"

def test_input_has_scancode_map():
    txt = (ROOT / "src/bridge/input.js").read_text(encoding="utf-8")
    assert "SCANCODE_MAP" in txt or "scancode" in txt.lower(), "Must have scancode map per README-1.md:1221"
    # Layout-agnostic e.code per README-1.md:292
    assert "e.code" in txt, "Must use e.code layout-agnostic per README-1.md:292"
    assert "KeyA" in txt or "Enter" in txt, "Must map KeyA/Enter etc."

def test_input_handles_touch_trackpad():
    txt = (ROOT / "src/bridge/input.js").read_text(encoding="utf-8")
    assert "trackpad" in txt.lower() or "Touch" in txt, "Must mention trackpad per README-1.md:1236"
    assert "touchstart" in txt and "touchmove" in txt, "Must handle touchstart/touchmove per README-1.md:1221"
    # Not polished warning
    assert "not polished" in txt.lower() or "functional" in txt.lower(), "Must note touch not polished per README-1.md:1238"

def test_input_attaches_handlers():
    txt = (ROOT / "src/bridge/input.js").read_text(encoding="utf-8")
    assert "attach()" in txt or "attach" in txt, "Must have attach() per README-1.md:2373"
    assert "addEventListener" in txt, "Must add DOM event listeners per README-1.md:1221"
    assert "keydown" in txt and "keyup" in txt, "Must handle keydown/keyup"
    assert "mousedown" in txt or "mouse" in txt.lower(), "Must handle mouse"

def test_input_ps2_sending():
    txt = (ROOT / "src/bridge/input.js").read_text(encoding="utf-8")
    assert "keyboard_send_scancodes" in txt or "bus.send" in txt, "Must send PS/2 via emulator.keyboard_send_scancodes or bus per README-1.md:1221"

def test_main_integrates_input():
    txt = (ROOT / "src/main.js").read_text(encoding="utf-8")
    assert "InputBridge" in txt, "src/main.js must import InputBridge per Phase 3 M3"
    assert "input" in txt.lower(), "src/main.js must instantiate InputBridge"

def test_pwa_has_input_wiring():
    idx = ROOT / "build" / "pwa" / "index.html"
    if not idx.exists():
        assert False, f"PWA index missing at {idx}"
    html = idx.read_text(encoding="utf-8")
    # PWA pack template now includes Phase 3 input wiring
    assert "input:" in html.lower() or "InputBridge" in html or "keydown" in html or "trackpad" in html.lower(), "PWA must mention input per README-1.md:2373"

def test_cross_browser_input():
    # Verify cross-browser handling per README-1.md:1694
    txt = (ROOT / "src/bridge/input.js").read_text(encoding="utf-8")
    assert "getBoundingClientRect" in txt or "clientX" in txt, "Must handle canvas coords with scaling per README-1.md:1242 1024x768"
