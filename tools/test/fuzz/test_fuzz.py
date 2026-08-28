"""
tools/test/fuzz/test_fuzz.py - Device fuzzing harness tests per README-1.md:1712
Fuzzing is nightly not per-PR per README-1.md:1719, coverage not exhaustive per README-1.md:1721
"""
import pathlib, subprocess, sys
ROOT = pathlib.Path(__file__).resolve().parent.parent.parent.parent

def test_fuzz_targets_defined():
    txt = (ROOT / "tools/fuzz/run_fuzz.py").read_text(encoding="utf-8")
    for target in ["virtio-block","vga","uart"]:
        assert target in txt, f"Fuzz must target {target} per README-1.md:1712"

def test_fuzz_is_nightly_not_pr():
    txt = (ROOT / "tools/fuzz/run_fuzz.py").read_text(encoding="utf-8")
    assert "Nightly not per-PR" in txt or "not exhaustive" in txt, "Must note nightly not per-PR per README-1.md:1719"

def test_fuzz_run_smoke():
    # Run fuzz with few iterations
    result = subprocess.run([sys.executable, str(ROOT / "tools/fuzz/run_fuzz.py"), "--iterations", "10"], capture_output=True, text=True, timeout=10)
    assert result.returncode == 0, f"Fuzz run failed: {result.stdout} {result.stderr}"
    assert "VirtIO block" in result.stdout, "Must fuzz VirtIO block per README-1.md:1712"
    assert "VGA" in result.stdout, "Must fuzz VGA"
    assert "UART" in result.stdout, "Must fuzz UART"
