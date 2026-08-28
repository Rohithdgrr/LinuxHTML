// src/emulator/config/base.js - v86 Base tier configuration per README-1.md:1258
// Serves hybrid storage architecture: filesystem.baseurl (9P immutable) + hda (writable block) per README-1.md:1298
// Tier-specific values: memory, rootfs, disk size, display; mirrors micro/standard per README-1.md:1360
export const baseTierConfig = {
  wasm_path: "/assets/v86.wasm",

  memory_size: 256 * 1024 * 1024, // 256MB per README-1.md:664
  vga_memory_size: 8 * 1024 * 1024,

  bios: {
    url: "/assets/seabios.bin"
  },

  vga_bios: {
    url: "/assets/vgabios.bin"
  },

  bzimage: {
    url: "/assets/linux-6.6-linuxhtml.bzImage"
  },

  filesystem: {
    baseurl: "/assets/rootfs-base/"
    // Immutable 9P root per README-1.md:1302 -> Alpine SquashFS via filesystem.baseurl -> VirtIO 9P -> root=host9p
    // Do NOT treat as writable disk (README-1.md:1321) and do NOT pass SquashFS as -initrd (README-1.md:1324)
  },

  // Writable block disk - separate from root per README-1.md:1311
  // Raw image hda -> storage bridge -> dedicated Worker -> OPFS per README-1.md:1317
  hda: {
    url: "/assets/disk-base.img",
    async: true,
    // storage_bridge integration will be handled by src/bridge/storage.js
    // Do not expose directly - Worker owns handle per README-1.md:1317
  },

  network_relay_url: null, // OFF by default per README-1.md:1174; when enabled HTTP/HTTPS bridge via network.js

  screen_container: typeof document !== "undefined" ? document.getElementById("screen") : null,

  ac97: false,

  autostart: false // Remains false until integrity verification succeeds per README-1.md:1342

  // Kernel command line must include root=host9p rootfstype=9p rootflags=trans=virtio per README-1.md:1328
  // Version-controlled with this config per README-1.md:1337
};

// Boot gating per README-1.md:1342:
// async function boot() {
//   await verifyIntegrity(); // SHA-256 via Web Crypto per README-1.md:1501
//   const emulator = new V86(baseTierConfig);
//   emulator.run();
// }
