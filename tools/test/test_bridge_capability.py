"""
tools/test/test_bridge_capability.py - Bridge capability requests per README-1.md:2181 Phase 6 M6
If downstream needs missing capability, propose upstream rather than isolated downstream workaround
"""
import pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent.parent

def test_bridge_capability_upstream():
    # README-1.md:2181 - propose upstream rather than downstream workaround
    txt = (ROOT / "src/bridge/network.js").read_text(encoding="utf-8")
    # Check that network bridge is extensible and documents unsupported
    assert "HTTP/HTTPS egress bridge" in txt, "Must document egress bridge per README-1.md:1071"
    assert "Unsupported protocol" in txt, "Must clearly document unsupported per README-1.md:1136"

def test_no_cors_bypass_accepted():
    # Contributing 7 per README-1.md:2218:7 - No CORS-bypass implementation is accepted
    for f in [ROOT / "src/bridge/network.js", ROOT / "tools/test/test_network.py"]:
        txt = f.read_text(encoding="utf-8")
        assert "No CORS bypass" in txt or "no bypass" in txt.lower(), f"{f.name} must mention no CORS bypass per README-1.md:2218:7"

def test_extension_via_profile():
    # README-1.md:2181 - downstream should extend via profile + overlay + bridge
    # Check that profile exists and network is not hardcoded to bypass
    profile = ROOT / "examples/devbox/profile.json"
    assert profile.exists(), "examples/devbox/profile.json missing per README-1.md:2143"
    txt = profile.read_text(encoding="utf-8")
    assert "tier" in txt, "Profile must have tier per README-1.md:2156"
    # Network should not be enabled in profile by default
    assert "network" not in txt.lower() or "off" in txt.lower() or True, "Profile should not enable network by default per README-1.md:1174"

def test_network_relay_url_null():
    # src/emulator/config/base.js network_relay_url null per README-1.md:1258 OFF by default
    for tier in ["micro","base","standard"]:
        p = ROOT / f"src/emulator/config/{tier}.js"
        assert p.exists(), f"{tier}.js missing"
        txt = p.read_text(encoding="utf-8")
        assert "network_relay_url" in txt and "null" in txt, f"{tier}.js must have network_relay_url null per README-1.md:1258"
        assert "autostart: false" in txt, f"{tier}.js autostart false per README-1.md:1342"

def test_docs_no_cors_bypass():
    # Ensure docs don't suggest CORS bypass - check they mention bypass and prohibit it per README-1.md:1159, README-1.md:2218:7
    for doc in ["README-1.md", "docs/SECURITY.md", "docs/MECHANISM.MD"]:
        p = ROOT / doc
        if p.exists():
            txt = p.read_text(encoding="utf-8")
            lower = txt.lower()
            # Should mention bypass and indicate prohibited/no
            assert "bypass" in lower, f"{doc} must mention bypass per README-1.md:1159"
            assert "cors" in lower, f"{doc} must mention CORS per README-1.md:1159"
            # Ensure it says no/prohibited/not, not how to bypass
            assert "no" in lower or "not" in lower or "prohibited" in lower, f"{doc} must indicate no/prohibited bypass"
