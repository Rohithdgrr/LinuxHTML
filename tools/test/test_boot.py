"""
tools/test/test_boot.py - Browser boot smoke test per README-1.md:1586
Launches headless Chromium, loads PWA, waits for boot, asserts login prompt, records timing.
Phase 0 stub: verifies PWA structure without real browser (will use playwright in M3)
"""
import pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
PWA = ROOT / "build" / "pwa"

def test_pwa_exists():
    assert PWA.exists(), f"PWA dir missing {PWA} - run python3 tools/pack.py --tier base --target pwa per README-1.md:630"
    assert (PWA / "index.html").exists(), "index.html missing"
    assert (PWA / "sw.js").exists(), "sw.js missing (versioned per README-1.md:815)"
    assert (PWA / "manifest.webmanifest").exists(), "manifest missing"

def test_index_has_first_run_disclosure():
    html = (PWA / "index.html").read_text(encoding="utf-8")
    assert "First-run disclosure" in html, "First-run disclosure missing per README-1.md:745"
    assert "SharedArrayBuffer" in html or "capability" in html, "Capability probe missing per README-1.md:1926"
    assert "verify" in html.lower(), "Integrity verification missing per README-1.md:1501"

# Future: real browser test per README-1.md:1586
# def test_boot_headless(playwright):
#     browser = playwright.chromium.launch()
#     page = browser.new_page()
#     page.goto("http://localhost:8080")
#     page.click("#acknowledge")
#     page.wait_for_selector("#status:has-text('Booted')")
