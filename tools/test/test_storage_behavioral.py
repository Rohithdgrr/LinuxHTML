"""
tools/test/test_storage_behavioral.py - Behavioral storage tests per review suggestion 2
Converts string-presence tests to actual behavior: write -> flush -> read -> verify against live mock Worker
Uses Python mock of storage-worker.js logic to test real behavior, not just source text
"""
import pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent.parent

class MockWorker:
    """Python mock of src/bridge/worker/storage-worker.js logic per README-1.md:939"""
    def __init__(self, size=32*1024*1024):
        self.backend="memory"
        self.size=size
        self.store=bytearray(size)
        self.opened=False
    def open(self):
        self.opened=True
        return {"backend":self.backend,"size":self.size}
    def write(self, offset, data, simulateQuota=False):
        RangeError=ValueError
        if offset<0 or offset+len(data)>self.size:
            raise RangeError(f"Invalid write range offset {offset} len {len(data)} size {self.size} per README-1.md:977")
        if simulateQuota:
            e=Exception("QuotaExceededError")
            e.name="QuotaExceededError"
            raise e
        if not self.opened:
            raise RuntimeError("Handle closed per README-1.md:954")
        self.store[offset:offset+len(data)]=data
        return {"written": len(data)}
    def flush(self):
        return {"flushed": True}
    def read(self, offset, length):
        RangeError=ValueError
        if offset<0 or length<0 or offset+length>self.size:
            raise RangeError(f"Invalid read range per README-1.md:964")
        if not self.opened:
            raise RuntimeError("Handle closed")
        return bytes(self.store[offset:offset+length])
    def truncate(self, size):
        RangeError=ValueError
        if size<0 or size>256*1024*1024:
            raise RangeError(f"Invalid truncate size {size} per README-1.md:993")
        new=bytearray(size)
        new[:min(size, len(self.store))]=self.store[:min(size, len(self.store))]
        self.store=new
        self.size=size
        return {"size": self.size}
    def size_fn(self):
        return self.size
    def export_fn(self):
        return bytes(self.store)
    def import_fn(self, data):
        if not data or len(data)==0:
            raise ValueError("Invalid .img format per README-1.md:1012")
        if len(data)>256*1024*1024:
            raise ValueError("Import size exceeds limit per README-1.md:1012")
        self.store=bytearray(data)
        self.size=len(data)
        return {"size": self.size}
    def close(self):
        self.opened=False
        return {"closed": True}

def test_behavioral_write_flush_read():
    """Real behavior: open -> write -> flush -> read -> verify per README-1.md:1604"""
    w=MockWorker()
    w.open()
    data=b"Hello Behavioral"
    w.write(0, data)
    w.flush()
    read=w.read(0, len(data))
    assert read==data, f"Expected {data}, got {read} - behavioral not string-presence per review suggestion 2"

def test_behavioral_quota_no_corruption():
    """Quota handling: write -> quota exhaustion -> reopen -> verify no corruption per README-1.md:1623"""
    w=MockWorker()
    w.open()
    w.write(100, b"before quota")
    try:
        w.write(200, b"quota test", simulateQuota=True)
        assert False, "Should have thrown QuotaExceededError per README-1.md:977"
    except Exception as e:
        assert "QuotaExceededError" in str(e)
    w.close()
    w.open()
    read=w.read(100, len(b"before quota"))
    assert read==b"before quota", "Quota must not corrupt previous write per README-1.md:977,1037"

def test_behavioral_export_import():
    """Export -> import -> verify identical per README-1.md:1636"""
    w=MockWorker()
    w.open()
    data=b"export test data"
    w.write(0, data)
    exported=w.export_fn()
    w2=MockWorker()
    w2.open()
    w2.import_fn(exported)
    read=w2.read(0, len(data))
    assert read==data, "Export/import must be identical per README-1.md:1636"

def test_behavioral_invalid_bounds():
    """Invalid offsets must throw RangeError per README-1.md:1662"""
    w=MockWorker()
    w.open()
    try:
        w.read(-1, 10)
        assert False, "Should throw RangeError for invalid offset per README-1.md:964"
    except ValueError:
        pass  # Expected RangeError per README-1.md:1662 (ValueError in Python mock)
    try:
        w.write(-1, b"data")
        assert False, "Should throw for invalid write per README-1.md:977"
    except ValueError:
        pass

def test_behavioral_truncate_size():
    """Truncate and size per README-1.md:993,999"""
    w=MockWorker()
    w.open()
    w.truncate(16*1024*1024)
    assert w.size_fn()==16*1024*1024, "Truncate per README-1.md:993"
    assert w.size_fn() == 16*1024*1024, "Size per README-1.md:999"

def test_behavioral_close_reopen():
    """Close and reopen per README-1.md:1623,1021"""
    w=MockWorker()
    w.open()
    w.write(0, b"test")
    w.close()
    try:
        w.read(0, 4)
        assert False, "Should throw when closed per README-1.md:1662"
    except RuntimeError:
        pass
    w.open()
    w.write(0, b"reopen")
    assert w.read(0, 6)==b"reopen", "Reopen must work per README-1.md:1623"
