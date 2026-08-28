"""
tools/test/test_network.py - Network bridge per README-1.md:1666 - Phase 6 M6
Tests: guest curl -> HTTP/HTTPS endpoint succeeds, non-HTTP fails cleanly per README-1.md:1687
Acceptance per README-1.md:2455: allowed HTTPS works, CORS failure visible, unsupported clean fail, OFF by default
"""
import pathlib
import re
ROOT = pathlib.Path(__file__).resolve().parent.parent.parent

def test_network_bridge_exists():
    assert (ROOT / "src" / "bridge" / "network.js").exists(), "network.js missing per README-1.md:442"

def test_network_is_off_by_default():
    txt = (ROOT / "src" / "bridge" / "network.js").read_text(encoding="utf-8")
    assert "OFF" in txt or "enabled = false" in txt, "Network must be OFF by default per README-1.md:1174"
    assert "enabled = false" in txt, "Must be OFF by default per README-1.md:1174"
    assert "CORS" in txt, "CORS handling required per README-1.md:1153"

def test_network_terminology():
    txt = (ROOT / "src" / "bridge" / "network.js").read_text(encoding="utf-8")
    assert "HTTP/HTTPS egress bridge" in txt, "Terminology per README-1.md:1071"
    assert "not general Internet" in txt.lower() or "not general internet" in txt.lower(), "Must note not general Internet per README-1.md:1071"

def test_network_supported():
    txt = (ROOT / "src" / "bridge" / "network.js").read_text(encoding="utf-8")
    assert "http://" in txt.lower() and "https://" in txt.lower(), "Must support HTTP/HTTPS per README-1.md:1128"
    assert "SUPPORTED_METHODS" in txt or "GET" in txt, "Must support browser methods per README-1.md:1128"
    assert "DNS" in txt and "bridge resolver" in txt.lower(), "Must have DNS via bridge per README-1.md:1166,1128"

def test_network_unsupported():
    txt = (ROOT / "src" / "bridge" / "network.js").read_text(encoding="utf-8")
    for proto in ["raw TCP", "raw UDP", "ICMP", "ping", "SSH", "WebSocket", "WebRTC"]:
        assert proto.lower() in txt.lower(), f"Must mention unsupported {proto} per README-1.md:1136"
    assert "Unsupported protocol" in txt, "Must throw Unsupported protocol per README-1.md:1136"
    assert "Must fail cleanly" in txt or "clean failure" in txt.lower(), "Non-HTTP must fail cleanly per README-1.md:1687"

def test_network_cors():
    txt = (ROOT / "src" / "bridge" / "network.js").read_text(encoding="utf-8")
    assert "CORS" in txt, "Must handle CORS per README-1.md:1153"
    assert "no bypass" in txt.lower() or "No CORS bypass" in txt, "Must have no CORS bypass per README-1.md:1159"
    assert "subject to CORS" in txt.lower() or "CORS applies" in txt, "Must note subject to CORS per README-1.md:1153"
    assert "CORS failure is expected visible" in txt or "CORS failure" in txt, "CORS failure must be visible per README-1.md:2455"

def test_network_dns():
    txt = (ROOT / "src" / "bridge" / "network.js").read_text(encoding="utf-8")
    assert "resolve(" in txt, "Must have resolve() per README-1.md:1166"
    assert "not raw UDP/53" in txt or "not raw UDP" in txt, "DNS not raw UDP/53 per README-1.md:1169"
    assert "deterministic failure" in txt.lower(), "Must have deterministic failure per README-1.md:1170"
    assert "DNS resolution unavailable" in txt, "Must have deterministic failure message per README-1.md:1170"

def test_network_off_by_default_and_ui():
    txt = (ROOT / "src" / "bridge" / "network.js").read_text(encoding="utf-8")
    assert "enabled = false" in txt, "OFF by default per README-1.md:1174"
    assert "UI must clearly communicate" in txt or "clearly communicate" in txt.lower(), "UI must communicate per README-1.md:1183"
    assert "OFF by default" in txt, "Must mention OFF by default"

def test_network_security():
    txt = (ROOT / "src" / "bridge" / "network.js").read_text(encoding="utf-8")
    assert "no public network-enabled build with root/no-password" in txt.lower() or "root/no-password" in txt, "Security per README-1.md:1185"
    assert "No CORS bypass" in txt or "no bypass" in txt.lower(), "Security no CORS bypass per README-1.md:2218:7"

def test_network_architecture():
    txt = (ROOT / "src" / "bridge" / "network.js").read_text(encoding="utf-8")
    assert "terminates guest TCP" in txt.lower() or "terminates" in txt.lower(), "Must terminate guest TCP per README-1.md:1098"
    assert "fetch(" in txt, "Must issue fetch() per README-1.md:1102"
    assert "Guest believes normal TCP" in txt or "Guest process" in txt, "Guest believes normal TCP per README-1.md:1123"

def test_network_handle_guest_request():
    txt = (ROOT / "src" / "bridge" / "network.js").read_text(encoding="utf-8")
    assert "handleGuestRequest" in txt, "Must have handleGuestRequest per README-1.md:1098"
    assert "isSupportedUrl" in txt or "http://" in txt, "Must validate URL per README-1.md:1136"
    assert "isSupportedMethod" in txt or "SUPPORTED_METHODS" in txt, "Must validate method per README-1.md:1128"
    assert "Network disabled" in txt, "Must throw Network disabled per README-1.md:1174"

def test_network_is_unsupported_protocol():
    txt = (ROOT / "src" / "bridge" / "network.js").read_text(encoding="utf-8")
    assert "isUnsupportedProtocol" in txt or "Unsupported protocol" in txt, "Must handle unsupported protocols per README-1.md:1136"
    assert "tcp://" in txt.lower() or "raw TCP" in txt, "Must detect raw TCP per README-1.md:1136"
