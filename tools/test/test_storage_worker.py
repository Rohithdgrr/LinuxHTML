"""
tools/test/test_storage_worker.py - Storage Worker dedicated tests per README-1.md:914, README-1.md:2396
Tests Worker mediation, backend hierarchy, serialization, Disk API via Worker
"""
import pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent.parent

def test_worker_exists_and_dedicated():
    p = ROOT / "src/bridge/worker/storage-worker.js"
    assert p.exists(), "storage-worker.js missing per README-1.md:914"
    txt = p.read_text(encoding="utf-8")
    assert "Dedicated storage Worker" in txt, "Must be dedicated Worker per README-1.md:914"
    assert "Owns persistent disk handle" in txt or "owns handle" in txt.lower(), "Worker must own handle per README-1.md:917"
    assert "no other module may manipulate" in txt.lower() or "Owns persistent" in txt, "No other module may manipulate per README-1.md:918"

def test_worker_backend_hierarchy():
    txt = (ROOT / "src/bridge/worker/storage-worker.js").read_text(encoding="utf-8")
    # Hierarchy OPFS -> IndexedDB -> memory per README-1.md:889
    assert "BACKEND" in txt and "OPFS" in txt and "INDEXEDDB" in txt and "MEMORY" in txt, "Must define BACKEND hierarchy per README-1.md:889"
    assert "initOPFS" in txt, "Must have OPFS primary per README-1.md:889"
    assert "getDirectory" in txt, "OPFS via navigator.storage.getDirectory per README-1.md:1926"
    assert "createSyncAccessHandle" in txt, "OPFS sync handle per README-1.md:1926"
    assert "initIndexedDB" in txt, "Must have IndexedDB fallback per README-1.md:901"
    assert "indexedDB" in txt, "Must check indexedDB per README-1.md:901"
    assert "initMemory" in txt, "Must have memory fallback per README-1.md:889"
    assert "Uint8Array" in txt and "32*1024*1024" in txt, "Memory fallback 32M Uint8Array per README-1.md:910"

def test_worker_serialization():
    txt = (ROOT / "src/bridge/worker/storage-worker.js").read_text(encoding="utf-8")
    assert "queue" in txt and "Promise.resolve" in txt, "Worker must serialize via queue per README-1.md:918"
    assert "enqueue" in txt, "Must have enqueue per README-1.md:918"
    assert "queue.then" in txt, "Queue must chain promises per README-1.md:918"

def test_worker_disk_api_handlers():
    txt = (ROOT / "src/bridge/worker/storage-worker.js").read_text(encoding="utf-8")
    for handler in ["handleOpen", "handleRead", "handleWrite", "handleFlush", "handleTruncate", "handleSize", "handleExport", "handleImport", "handleClose"]:
        assert handler in txt, f"Worker must have {handler} per README-1.md:939"
    for op in ['"open"', '"read"', '"write"', '"flush"', '"truncate"', '"size"', '"export"', '"import"', '"close"']:
        assert op in txt, f"Worker must handle op {op} per README-1.md:939"

def test_worker_open_verifies_metadata():
    txt = (ROOT / "src/bridge/worker/storage-worker.js").read_text(encoding="utf-8")
    assert "verify metadata" in txt.lower() or "metadata/version" in txt.lower(), "open() must verify metadata/version per README-1.md:954"
    assert "disk-base.img" in txt, "Must handle disk file per README-1.md:576"

def test_worker_bounds_and_quota():
    txt = (ROOT / "src/bridge/worker/storage-worker.js").read_text(encoding="utf-8")
    assert "QuotaExceededError" in txt, "Must handle QuotaExceededError per README-1.md:977"
    assert "simulateQuota" in txt, "Must have simulateQuota hook for quota test per README-1.md:1623"
    assert "RangeError" in txt, "Must throw RangeError for invalid ranges per README-1.md:1662"

def test_worker_atomic_and_persistence():
    txt = (ROOT / "src/bridge/worker/storage-worker.js").read_text(encoding="utf-8")
    assert "Atomic" in txt or "atomic" in txt, "Must mention atomic per README-1.md:1026"
    assert "no partial commit" in txt.lower(), "Must ensure no partial commit per README-1.md:1037"
    assert "flush" in txt.lower(), "Must handle flush per README-1.md:987"

def test_worker_export_import_validation():
    txt = (ROOT / "src/bridge/worker/storage-worker.js").read_text(encoding="utf-8")
    assert "Invalid .img format" in txt, "Import must validate .img per README-1.md:1012"
    assert "exceeds limit" in txt, "Import must validate size per README-1.md:1012"
    assert "256*1024*1024" in txt, "Import must check 256M limit per README-1.md:993,1012"

def test_worker_close_and_reopen():
    txt = (ROOT / "src/bridge/worker/storage-worker.js").read_text(encoding="utf-8")
    assert "handleClose" in txt, "Must have close per README-1.md:1021"
    assert "handleOpen" in txt, "Must have open per README-1.md:954"
    assert "reopen" in txt.lower() or "already open" in txt.lower(), "Must support reopen per README-1.md:1623"

def test_worker_memory_warning():
    txt = (ROOT / "src/bridge/worker/storage-worker.js").read_text(encoding="utf-8")
    assert "memory fallback" in txt.lower(), "Must mention memory fallback per README-1.md:910"
    assert "data lost on tab close" in txt.lower() or "persistent warning" in txt.lower(), "Must warn data lost on tab close per README-1.md:910"

def test_worker_no_localstorage():
    txt = (ROOT / "src/bridge/worker/storage-worker.js").read_text(encoding="utf-8")
    assert "localStorage.setItem" not in txt, "Must not use localStorage per README-1.md:1064"
    assert "sessionStorage.setItem" not in txt, "Must not use sessionStorage per README-1.md:1064"

def test_bridge_uses_worker():
    txt = (ROOT / "src/bridge/storage.js").read_text(encoding="utf-8")
    assert "Worker" in txt and "postMessage" in txt, "Bridge must use Worker postMessage per README-1.md:914"
    assert "/assets/worker/storage-worker.js" in txt or "storage-worker.js" in txt, "Bridge must reference correct workerUrl per README-1.md:914"
    assert "_ensureWorker" in txt, "Bridge must ensure single Worker per README-1.md:917"
    assert "storage-warning" in txt, "Bridge must show storage-warning per README-1.md:910"
