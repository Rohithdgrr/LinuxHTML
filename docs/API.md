# API.md - Extension & Disk APIs

> **Source:** `README-1.md:22` Extension API `README-1.md:10.5` Disk API `README-1.md:939` `src/bridge/storage.js:1` `src/bridge/worker/storage-worker.js:1` `src/main.js:1`

## 1. Profile API `examples/devbox/profile.json:1` `README-1.md:2187` per `README-1.md:2156`

Downstream projects extend via `examples/<your-project>/profile.json` `+ overlay/` `+ bridge` per `README-1.md:2143` `do not fork src/ per README-1.md:2164` `propose upstream per README-1.md:2181`

```json
{
  "name": "devbox",
  "tier": "base",
  "description": "LinuxHTML DevBox per README-1.md:2421 - validates gcc git python3 vim (Standard adds Node.js)",
  "rootfs_overlay": "overlay/",
  "boot_args": ["root=host9p","rootfstype=9p","rootflags=trans=virtio"],
  "ui": { "terminal_theme": "default", "resolution": "1024x768" },
  "note": "Downstream projects extend via profile + overlay per README-1.md:2164, do not fork src/"
}
```

| Field | Required | Description | Example |
|-------|----------|-------------|---------|
| `name` | yes | Profile name `examples/<name>/` | `devbox` |
| `tier` | yes | `micro 8M/128M BusyBox, base 15M/256M +gcc git python3 vim, standard 25M/512M +nodejs` `README-1.md:664` | `base` |
| `rootfs_overlay` | no | Overlay dir merged into SquashFS `src/rootfs/Dockerfile:1` `COPY overlay/ /` | `overlay/` |
| `boot_args` | yes | Kernel cmdline `root=host9p rootfstype=9p rootflags=trans=virtio per README-1.md:1328` | `["root=host9p",...]` |
| `ui.terminal_theme` | no | `default, dark, light` | `default` |
| `ui.resolution` | no | `1024x768 per README-1.md:1242` | `1024x768` |

**Validation:** `python3 -m pytest tools/test/test_devbox.py::test_profile_json -xvs` `tier base overlay host9p terminal_theme` `[OK]`

## 2. Disk API `src/bridge/storage.js:1` `5928` `src/bridge/worker/storage-worker.js:1` `10001` `README-1.md:939` `MECHANISM.MD:3`

All calls serialized via dedicated `Worker` `src/bridge/worker/storage-worker.js:1` `queue Promise.resolve` `owns handle per README-1.md:917,918` `OPFS→IndexedDB→memory per README-1.md:889`

```js
import { StorageBridge } from "./bridge/storage.js";
const storage = new StorageBridge("/assets/worker/storage-worker.js");
await storage.open(); // {backend:"opfs"|"indexeddb"|"memory", size: 33554432}
await storage.write(0, new Uint8Array([1,2,3])); // bounds per README-1.md:977
await storage.flush(); // durability per README-1.md:987
const data = await storage.read(0, 3); // deterministic per README-1.md:964
await storage.truncate(16*1024*1024); // per README-1.md:993 reject <0 >256M
const size = await storage.size(); // per README-1.md:999
const blob = await storage.export(); // Blob per README-1.md:1003 download disk-{Date.now()}.img
await storage.import(file); // file: .img validate per README-1.md:1012
await storage.close(); // per README-1.md:1021
// Atomic per README-1.md:1026
import { atomicWrite } from "./bridge/storage.js";
await atomicWrite(storage, 0, data); // write temp→flush→finalize no partial per README-1.md:1037
```

| Method | Signature | Bounds | Backend | Notes |
|--------|-----------|--------|---------|-------|
| `open()` | `open() → {backend,size}` | N/A | OPFS `getFileHandle createSyncAccessHandle` `IndexedDB` `Memory Uint8Array 32M warning per README-1.md:910` | `verify metadata/version per README-1.md:954` `reopen after close per README-1.md:1623` |
| `read(offset,length)` | `read(offset,length) → Uint8Array` | `offset>=0 length>=0 offset+length<=size else RangeError per README-1.md:964` | `handle.read(buf,{at:offset})` | `deterministic no partial per README-1.md:964` `serialized per README-1.md:918` |
| `write(offset,data)` | `write(offset,Uint8Array)` | `offset+data.length<=size else RangeError, QuotaExceededError per README-1.md:977` | `handle.write(data,{at:offset})` `memoryStore.set` | `quota-safe no partial commit per README-1.md:977,1037` `simulateQuota per README-1.md:1623` |
| `flush()` | `flush() → {flushed,backend}` | N/A | `handle.flush()` per README-1.md:987 | `durability per backend` |
| `truncate(size)` | `truncate(size)` | `<0 or >256M RangeError per README-1.md:993` | `handle.truncate` `new Uint8Array` | `preserve metadata` |
| `size()` | `size() → bytes` | N/A | `diskSize` | `per README-1.md:999` |
| `export()` | `export() → Blob` | N/A | `handle.read full disk` | `download per README-1.md:1003` `Settings → Export disk` |
| `import(file)` | `import(File .img)` | `validate type/format/version/size per README-1.md:1012 256M limit` | `handle.truncate+write+flush` | `Settings → Import disk ← .img` |
| `close()` | `close() → {closed}` | N/A | `handle.close() null` | `per README-1.md:1021` |

**Tests:** `python3 -m pytest tools/test/test_storage.py::test_disk_api_complete -xvs` `9 ops` `[OK]` `test_storage_worker 12` `simulate_storage.py 6/6 PASS` `open→write→flush→read verify, quota→reopen, export→import` `README-1.md:1604,1636`

**No localStorage:** `localStorage.setItem not in worker/bridge per README-1.md:1064` `test_no_localstorage` `[OK]`

## 3. Network API `src/bridge/network.js:1` `8826` `README-1.md:1071`

```js
import { NetworkBridge } from "./bridge/network.js";
const net = new NetworkBridge({enabled:false}); // OFF per README-1.md:1174
net.enable(); // UI Network: ON per README-1.md:1183
await net.handleGuestRequest({method:"GET",url:"https://example.com"}); // via fetch() per README-1.md:1098 CORS per README-1.md:1153
await net.resolve("example.com"); // DNS via bridge not UDP/53 per README-1.md:1169 deterministic failure per README-1.md:1170
// Unsupported clean fail per README-1.md:1136,1687
try { await net.handleGuestRequest({url:"tcp://host:22"}); } catch(e){ /* Unsupported protocol per README-1.md:1136 */ }
```

| Method | Supported | Unsupported clean fail per README-1.md:1136,1687 | Security |
|--------|-----------|--------------------------------------------------|----------|
| `handleGuestRequest` | `http:// https:// SUPPORTED_METHODS GET POST... per README-1.md:1128` | `raw TCP/UDP ICMP/ping SSH WebSocket/WebRTC relay` `throw Unsupported protocol` | `CORS subject to CORS per README-1.md:1153 no bypass per README-1.md:1159 visible per README-1.md:2455` `OFF by default per README-1.md:1174` `no public root/no-password per README-1.md:1185` |
| `resolve` | `DNS via bridge per README-1.md:1166` | `deterministic failure per README-1.md:1170` | `not raw UDP/53 per README-1.md:1169` |

**Tests:** `test_network 12` `test_bridge_capability 5` `17 passed` `handleGuestRequest isSupportedUrl isSupportedMethod Network disabled` `isUnsupportedProtocol tcp://` `[OK]`

## 4. Display/Input API `src/bridge/display.js:1` `8545` `src/bridge/input.js:1` `9803` `README-1.md:2373`

```js
import { Display } from "./bridge/display.js";
const display = new Display({container: document.getElementById("screen"), width:1024, height:768});
display.updateDirtyRect(x,y,w,h,ImageData); // only dirty rect per README-1.md:1200
display.attachToEmulator(emulator); // screen-update per README-1.md:2373
display.setResolution(1024,768); // per README-1.md:1242
// WebGL2 ?gpu=1 per README-1.md:1212 not passthrough per README-1.md:1217
import { InputBridge, SCANCODE_MAP } from "./bridge/input.js";
const input = new InputBridge({emulator, screen}); input.attach();
// Keyboard e.code layout-agnostic per README-1.md:292 KeyA 0x1E Enter 0x1C ArrowUp E0 0x48
// Mouse getBoundingClientRect scaleX 1024/rect.width
// Touch trackpad per README-1.md:1236 not polished per README-1.md:1238
```

**Tests:** `test_display 6` `test_input 8` `14 passed` `Canvas2D dirty-rect WebGL2 ?gpu=1 1024x768 attachToEmulator putImageData` `SCANCODE_MAP e.code trackpad` `[OK]`

## 5. Post-v1 WebSocket `src/bridge/websocket.js:1` `3166` `FUTURE-SCOPE.MD:3` `README-1.md:1146`

```js
import { WebSocketBridge } from "./bridge/websocket.js";
const ws = new WebSocketBridge({enabled:false}); // disabled by default per README-1.md:1146 v1 unsupported
ws.enable(); // ?websocket=1 per FUTURE-SCOPE.MD:11
await ws.connect("wss://example.com"); // ws:// wss:// per FUTURE-SCOPE.MD:3
```

**Tests:** `test_phase9 8` `WebSocketBridge Phase 9 ?websocket=1` `[OK]`

## 6. References

*   `README-1.md:22` Extension API `README-1.md:10.5` Disk API `README-1.md:25` Milestones `docs/PHASEWISE.MD` `VERSION v0.1.0` `92 tests` `20 invariants`
