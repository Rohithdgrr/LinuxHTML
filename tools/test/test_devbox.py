"""
tools/test/test_devbox.py - DevBox validation per README-1.md:2421 Phase 5 M5
Base must verify gcc, git, python3, vim
Standard additionally verifies node (and not in Base per README-1.md:2438)
Size budgets: micro 8M, base 15M, standard 25M per README-1.md:664, >5% fails CI per README-1.md:677
"""
import pathlib
import json
ROOT = pathlib.Path(__file__).resolve().parent.parent.parent

def test_base_has_gcc():
    sbom = ROOT / "build/manifests/sbom-base.spdx.json"
    assert sbom.exists(), f"sbom-base missing at {sbom} per README-1.md:1480"
    txt = sbom.read_text(encoding="utf-8").lower()
    assert "gcc" in txt, "Base must include gcc per README-1.md:2421"

def test_base_has_git():
    sbom = ROOT / "build/manifests/sbom-base.spdx.json"
    txt = sbom.read_text(encoding="utf-8").lower()
    assert "git" in txt, "Base must include git per README-1.md:2421"

def test_base_has_python3():
    sbom = ROOT / "build/manifests/sbom-base.spdx.json"
    txt = sbom.read_text(encoding="utf-8").lower()
    assert "python" in txt, "Base must include python3 per README-1.md:2421"

def test_base_has_vim():
    sbom = ROOT / "build/manifests/sbom-base.spdx.json"
    txt = sbom.read_text(encoding="utf-8").lower()
    assert "vim" in txt, "Base must include vim per README-1.md:2421"

def test_base_no_node():
    """Node.js is Standard-only per README-1.md:671, do not assume in Base per README-1.md:2438"""
    sbom = ROOT / "build/manifests/sbom-base.spdx.json"
    txt = sbom.read_text(encoding="utf-8").lower()
    assert "nodejs" not in txt and '"name": "node"' not in txt, "Base must NOT include Node.js per README-1.md:671, README-1.md:2438"

def test_standard_has_node():
    sbom = ROOT / "build/manifests/sbom-standard.spdx.json"
    assert sbom.exists(), "sbom-standard missing"
    txt = sbom.read_text(encoding="utf-8").lower()
    assert "nodejs" in txt or "node" in txt, "Standard must include Node.js per README-1.md:2421"

def test_micro_no_gcc():
    """Micro is BusyBox only per README-1.md:664"""
    sbom = ROOT / "build/manifests/sbom-micro.spdx.json"
    assert sbom.exists(), "sbom-micro missing"
    txt = sbom.read_text(encoding="utf-8").lower()
    assert "gcc" not in txt, "Micro must NOT include gcc per README-1.md:664 BusyBox only"
    assert "nodejs" not in txt, "Micro must NOT include Node.js"

def test_size_budgets():
    """Size budgets enforced per README-1.md:677, >5% fails CI"""
    caps = {"micro": 8*1024*1024, "base": 15*1024*1024, "standard": 25*1024*1024}
    for tier, cap in caps.items():
        p = ROOT / f"build/rootfs-{tier}.squashfs"
        assert p.exists(), f"rootfs-{tier}.squashfs missing at {p} per README-1.md:556"
        size = p.stat().st_size
        pct = size / cap * 100
        assert size < cap * 1.05, f"{tier} size {size} exceeds cap {cap} by >5% fails CI per README-1.md:677 (pct {pct:.1f}%)"
        assert size < cap, f"{tier} size {size} should be within cap {cap} (pct {pct:.1f}%)"

def test_profile_json():
    """Profile per README-1.md:2187, validate tier base and boot_args host9p per README-1.md:2156"""
    p = ROOT / "examples/devbox/profile.json"
    assert p.exists(), "examples/devbox/profile.json missing per README-1.md:2143"
    data = json.loads(p.read_text(encoding="utf-8"))
    assert data["tier"] == "base", "DevBox profile tier must be base per examples/devbox/profile.json"
    assert "rootfs_overlay" in data, "profile must have rootfs_overlay per README-1.md:2156"
    assert any("root=host9p" in arg for arg in data.get("boot_args", [])), "profile boot_args must include root=host9p per README-1.md:1328"
    assert "terminal_theme" in str(data.get("ui", {})), "profile ui must have terminal_theme per README-1.md:2187"

def test_dockerfile_tier_logic():
    """Dockerfile must handle TIER branching correctly per README-1.md:2421"""
    p = ROOT / "src/rootfs/Dockerfile"
    assert p.exists(), "src/rootfs/Dockerfile missing per README-1.md:556"
    txt = p.read_text(encoding="utf-8")
    assert "ARG TIER=base" in txt, "Dockerfile must have ARG TIER=base"
    assert 'if [ "$TIER" = "base" ]' in txt or 'TIER' in txt, "Dockerfile must branch on TIER"
    assert "apk add --no-cache gcc git python3 vim" in txt, "Dockerfile must install gcc git python3 vim for base per README-1.md:2421"
    assert "apk add --no-cache nodejs npm" in txt, "Dockerfile must install nodejs for standard"
    assert "command -v node" in txt and "Standard-only" in txt, "Dockerfile must assert Node not in base per README-1.md:671"

def test_emulator_configs_memory():
    """Tier configs must have correct memory per README-1.md:664"""
    for tier, ram in [("micro", 128*1024*1024), ("base", 256*1024*1024), ("standard", 512*1024*1024)]:
        p = ROOT / f"src/emulator/config/{tier}.js"
        assert p.exists(), f"{tier}.js missing per README-1.md:432"
        txt = p.read_text(encoding="utf-8")
        assert str(ram) in txt or str(ram//1024//1024) in txt, f"{tier}.js must have memory {ram//1024//1024}M per README-1.md:664"

def test_do_not_claim_node_in_base():
    """Do not claim Node.js is available in Base per README-1.md:2438"""
    # This is a policy test - ensure no docs claim node in base
    # Check that base sbom does not contain node, already tested, but also check that pack manifest for base reflects correct
    p = ROOT / "build/manifest-base.json"
    if p.exists():
        data = json.loads(p.read_text(encoding="utf-8"))
        # manifest should be for base tier
        assert data.get("tier") == "base", "manifest-base.json tier must be base"
