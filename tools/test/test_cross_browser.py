"""
tools/test/test_cross_browser.py - Cross-browser per README-1.md:1694
Suite validates Chromium/Firefox/WebKit capability-dependent backend selection.
Phase 0 stub: checks capability probe exists
"""
import pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent.parent

def test_main_has_capability_probe():
    txt = (ROOT / "src" / "main.js").read_text(encoding="utf-8")
    assert "capabilityProbe" in txt, "capabilityProbe missing per README-1.md:1926"
    assert "SharedArrayBuffer" in txt
    assert "OPFS" in txt or "getDirectory" in txt

def test_browser_matrix_docs_exists():
    # Matrix per README-1.md:1903
    assert (ROOT / "docs" / "TECH-STACK.MD").exists()
