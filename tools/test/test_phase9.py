"""
tools/test/test_phase9.py - Phase 9 Post-v1 tests per FUTURE-SCOPE.MD:3, README-1.md:2524
Phase 9 is post-v1 only after v1 validated per README-1.md:2522, no committed timeline per README-1.md:2536
Tests WebSocket relay stub feature-flagged, richer tooling, maintenance
"""
import pathlib, subprocess, sys, json
ROOT = pathlib.Path(__file__).resolve().parent.parent.parent

def test_websocket_bridge_exists():
    p = ROOT / "src/bridge/websocket.js"
    assert p.exists(), "src/bridge/websocket.js missing per FUTURE-SCOPE.MD:3 Phase 9"
    txt = p.read_text(encoding="utf-8")
    assert "WebSocketBridge" in txt, "Must have WebSocketBridge per FUTURE-SCOPE.MD:3"
    assert "Phase 9" in txt, "Must mention Phase 9 per FUTURE-SCOPE.MD:3"
    assert "README-1.md:1146" in txt or "unsupported" in txt.lower(), "Must note v1 unsupported per README-1.md:1146"
    assert "?websocket=1" in txt, "Must be flagged via ?websocket=1 per FUTURE-SCOPE.MD:3"

def test_websocket_is_feature_flagged():
    txt = (ROOT / "src/bridge/websocket.js").read_text(encoding="utf-8")
    assert "enabled = false" in txt or "enabled=false" in txt, "Must be disabled by default per FUTURE-SCOPE.MD:3"
    assert "WebSocket relay disabled" in txt, "Must be disabled in v1"
    assert "Ws://" in txt or "ws://" in txt.lower(), "Must handle ws:// per FUTURE-SCOPE.MD:3"

def test_websocket_not_enabled_by_default():
    txt = (ROOT / "src/bridge/network.js").read_text(encoding="utf-8")
    # network.js should still be OFF by default, websocket is separate
    assert "enabled = false" in txt, "Network must still be OFF per README-1.md:1174"
    # network.js should mention Phase 9 websocket behind flag
    assert "Phase 9" in txt and "websocket" in txt.lower(), "network.js must mention Phase 9 websocket per FUTURE-SCOPE.MD:3"

def test_devbox_tooling_exists():
    for f in ["tools/devbox.sh", "tools/lint.sh", "tools/maintenance/kernel_eol_check.py"]:
        p = ROOT / f
        assert p.exists(), f"{f} missing per FUTURE-SCOPE.MD:3 richer tooling"
        txt = p.read_text(encoding="utf-8")
        assert "FUTURE-SCOPE" in txt or "Phase 9" in txt or "README-1.md" in txt, f"{f} must reference FUTURE-SCOPE"

def test_kernel_eol_check():
    result = subprocess.run([sys.executable, str(ROOT / "tools/maintenance/kernel_eol_check.py")], capture_output=True, text=True, timeout=10)
    # Should run and mention kernel version
    assert "6.6.72" in result.stdout or "Kernel" in result.stdout, "Must mention kernel per README-1.md:2267"
    assert result.returncode in [0,1], "Should exit 0 or 1"

def test_phase9_is_post_v1():
    # Phase 9 should not break v1: all v1 tests still pass
    # Check that v1 artifacts still exist and are correct
    assert (ROOT / "build/pwa/index.html").exists(), "PWA must still exist per v1"
    assert (ROOT / "build/manifest.json").exists(), "Manifest must still exist"
    assert (ROOT / "docs/BENCHMARKS.md").read_text(encoding="utf-8").count("v0.1.0") >= 1, "BENCHMARKS must still have v0.1.0 per README-1.md:2488"

def test_no_regression_v1_tests():
    # Ensure v1 tests still pass: run a subset
    result = subprocess.run([sys.executable, "-m", "pytest", "tools/test/test_devbox.py", "-q"], capture_output=True, text=True, timeout=30)
    assert result.returncode == 0, f"v1 devbox tests must still pass: {result.stdout} {result.stderr}"

def test_future_scope_documented():
    txt = (ROOT / "docs/FUTURE-SCOPE.MD").read_text(encoding="utf-8")
    assert "WebSocket" in txt, "FUTURE-SCOPE must mention WebSocket per README-1.md:2524"
    assert "Phase 9" in txt or "Post-v1" in txt, "Must mention Phase 9/Post-v1"
