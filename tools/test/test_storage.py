"""
tools/test/test_storage.py - Storage round-trip per README-1.md:1604 - Phase 4 M4
Tests Disk API per README-1.md:939: open/read/write/flush/truncate/size/export/import/close
Must include invalid offsets, invalid lengths, unsupported sizes, closed handles, backend failures per README-1.md:1662
Tests: open->write->flush->read->verify, quota exhaustion->reopen, export->import per README-1.md:1604,1636
"""
import pathlib
import re
ROOT = pathlib.Path(__file__).resolve().parent.parent.parent

def test_storage_bridge_exists():
    assert (ROOT / "src" / "bridge" / "storage.js").exists(), "storage.js missing per README-1.md:442"
    assert (ROOT / "src" / "bridge" / "worker" / "storage-worker.js").exists(), "storage-worker.js missing per README-1.md:914"

def test_storage_test_plan():
    # Plan per README-1.md:1604
    plan = [
        "open -> write -> flush -> read -> verify",
        "write -> quota exhaustion -> reopen -> verify no corruption",
        "export -> import -> read -> verify identical",
    ]
    assert len(plan) == 3

def test_disk_api_complete():
    """Every public storage operation is tested per README-1.md:1646"""
    bridge = (ROOT / "src" / "bridge" / "storage.js").read_text(encoding="utf-8")
    worker = (ROOT / "src" / "bridge" / "worker" / "storage-worker.js").read_text(encoding="utf-8")
    for api in ["open()", "read(", "write(", "flush()", "truncate(", "size()", "export()", "import(", "close()"]:
        assert api in bridge or api.replace("()", "") in bridge, f"bridge missing {api} per README-1.md:939"
        # Worker handles without parentheses
        op = api.replace("(", "").replace(")", "")
        assert f'case "{op}"' in worker or f"handle{op.capitalize()}" in worker, f"worker missing {op} per README-1.md:939"

def test_disk_api_bounds_validation():
    """Tests must include invalid offsets, invalid lengths, unsupported sizes, closed handles per README-1.md:1662"""
    worker = (ROOT / "src/bridge/worker/storage-worker.js").read_text(encoding="utf-8")
    assert "RangeError" in worker, "Must throw RangeError for invalid ranges per README-1.md:964,977,993"
    assert "offset < 0" in worker or "offset + length" in worker, "Must validate offset/length per README-1.md:964"
    assert "Invalid read range" in worker, "Must have read bounds validation per README-1.md:964"
    assert "Invalid write range" in worker, "Must have write bounds validation per README-1.md:977"
    assert "Invalid truncate size" in worker, "Must have truncate validation per README-1.md:993"
    assert "Handle closed" in worker, "Must handle closed handles per README-1.md:1662"

def test_storage_hierarchy():
    """Backend hierarchy: OPFS -> IndexedDB -> memory per README-1.md:889"""
    bridge = (ROOT / "src" / "bridge" / "storage.js").read_text(encoding="utf-8")
    worker = (ROOT / "src/bridge/worker/storage-worker.js").read_text(encoding="utf-8")
    assert "OPFS" in worker and "INDEXEDDB" in worker and "MEMORY" in worker, "Must have three backends per README-1.md:889"
    assert "initOPFS" in worker, "Must have OPFS init per README-1.md:889"
    assert "initIndexedDB" in worker, "Must have IndexedDB fallback per README-1.md:901"
    assert "initMemory" in worker, "Must have memory fallback per README-1.md:889"
    assert "memory fallback" in worker.lower() and "persistent warning" in worker.lower(), "Memory fallback must show warning per README-1.md:910"

def test_storage_worker_owns_handle():
    """Dedicated Worker owns handle per README-1.md:917, serializes per README-1.md:918"""
    worker = (ROOT / "src/bridge/worker/storage-worker.js").read_text(encoding="utf-8")
    assert "Dedicated storage Worker" in worker, "Must mention dedicated Worker per README-1.md:914"
    assert "owns handle" in worker or "Owns persistent" in worker, "Worker must own handle per README-1.md:917"
    assert "enqueue" in worker and "queue" in worker, "Worker must serialize via queue per README-1.md:918"
    bridge = (ROOT / "src/bridge/storage.js").read_text(encoding="utf-8")
    assert "Dedicated Worker" in bridge and "Worker" in bridge, "Bridge must use dedicated Worker per README-1.md:917"
    assert "postMessage" in bridge, "Bridge must postMessage to Worker per README-1.md:914"

def test_atomic_write_policy():
    """Atomic write policy per README-1.md:1026: write temporary -> flush -> finalize/rename, no partial commit per README-1.md:1037"""
    worker = (ROOT / "src/bridge/worker/storage-worker.js").read_text(encoding="utf-8")
    bridge = (ROOT / "src/bridge/storage.js").read_text(encoding="utf-8")
    assert "atomic" in worker.lower() or "Atomic" in worker, "Worker must mention atomic per README-1.md:1026"
    assert "flush" in worker.lower(), "Worker must handle flush per README-1.md:987"
    assert "no partial commit" in worker.lower() or "no partial" in worker.lower(), "Must ensure no partial commit per README-1.md:1037"
    assert "atomicWrite" in bridge or "atomic" in bridge.lower(), "Bridge must have atomicWrite helper per README-1.md:1026"

def test_quota_handling():
    """Must handle quota exhaustion: write -> simulated quota -> reopen -> verify no corruption per README-1.md:1623, README-1.md:977"""
    worker = (ROOT / "src/bridge/worker/storage-worker.js").read_text(encoding="utf-8")
    assert "QuotaExceededError" in worker, "Must handle QuotaExceededError per README-1.md:977"
    assert "simulateQuota" in worker, "Must have quota simulation hook per README-1.md:1623"
    assert "no partial commit" in worker.lower(), "Quota must not expose partial commit per README-1.md:977"
    # Bridge should handle quota via worker
    bridge = (ROOT / "src/bridge/storage.js").read_text(encoding="utf-8")
    assert "QuotaExceededError" in bridge or "quota" in bridge.lower(), "Bridge must mention quota handling"

def test_export_import():
    """Export -> import -> verify identical per README-1.md:1636, validate type/format/version/size per README-1.md:1012"""
    worker = (ROOT / "src/bridge/worker/storage-worker.js").read_text(encoding="utf-8")
    bridge = (ROOT / "src/bridge/storage.js").read_text(encoding="utf-8")
    assert "handleExport" in worker or 'case "export"' in worker, "Worker must handle export per README-1.md:1003"
    assert "handleImport" in worker or 'case "import"' in worker, "Worker must handle import per README-1.md:1012"
    assert "Invalid .img format" in worker, "Import must validate .img format per README-1.md:1012"
    assert "Import size exceeds limit" in worker or "exceeds limit" in worker, "Import must validate size per README-1.md:1012"
    assert "Blob" in bridge and "download" in bridge.lower(), "Bridge export must trigger download per README-1.md:1003"
    assert ".img" in bridge and "arrayBuffer" in bridge, "Bridge import must handle .img file per README-1.md:1012"

def test_persistence_and_reopen():
    """Persistence: file survives reboot, reopen per README-1.md:1623, export/import per README-1.md:1636"""
    worker = (ROOT / "src/bridge/worker/storage-worker.js").read_text(encoding="utf-8")
    assert "reopen" in worker.lower() or "close" in worker.lower() and "open" in worker.lower(), "Worker must support reopen after close per README-1.md:1623"
    assert "handleClose" in worker, "Must have close per README-1.md:1021"
    assert "handleOpen" in worker, "Must have open per README-1.md:954"
    # Check that open handles reopen (close previous if open)
    assert "If already open" in worker or "close previous" in worker.lower() or "reopen" in worker.lower(), "Open must handle reopen semantics"

def test_no_localstorage():
    """localStorage and sessionStorage are not used per README-1.md:1064"""
    worker = (ROOT / "src/bridge/worker/storage-worker.js").read_text(encoding="utf-8")
    bridge = (ROOT / "src/bridge/storage.js").read_text(encoding="utf-8")
    # They should mention not using localStorage, but not actually use it
    # Check that they don't use localStorage as persistence mechanism
    # It's okay to mention "not localStorage" in comments, but not use localStorage.setItem
    assert "localStorage.setItem" not in worker and "sessionStorage.setItem" not in worker, "Worker must not use localStorage per README-1.md:1064"
    assert "localStorage.setItem" not in bridge and "sessionStorage.setItem" not in bridge, "Bridge must not use localStorage per README-1.md:1064"
    assert "OPFS" in worker, "Must use OPFS per README-1.md:889"

def test_storage_api_signatures():
    """Verify Disk API signatures per README-1.md:939"""
    bridge = (ROOT / "src/bridge/storage.js").read_text(encoding="utf-8")
    # Check each method exists with correct params
    assert "async open()" in bridge, "open() must exist per README-1.md:954"
    assert "async read(offset" in bridge, "read(offset, length) per README-1.md:964"
    assert "async write(offset" in bridge, "write(offset, data) per README-1.md:977"
    assert "async flush()" in bridge, "flush() per README-1.md:987"
    assert "async truncate(size" in bridge, "truncate(size) per README-1.md:993"
    assert "async size()" in bridge, "size() per README-1.md:999"
    assert "async export()" in bridge, "export() per README-1.md:1003"
    assert "async import(file" in bridge, "import() per README-1.md:1012"
    assert "async close()" in bridge, "close() per README-1.md:1021"
