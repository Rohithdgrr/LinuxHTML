// src/emulator/config/standard.js - Standard tier (25MB/512M) + Node.js per README-1.md:664
// Node Standard-only per README-1.md:671 - do not assume in base
export const standardTierConfig = {
  wasm_path: "/assets/v86.wasm",
  memory_size: 512 * 1024 * 1024, // 512MB
  vga_memory_size: 8 * 1024 * 1024,
  bios: { url: "/assets/seabios.bin" },
  vga_bios: { url: "/assets/vgabios.bin" },
  bzimage: { url: "/assets/linux-6.6-linuxhtml.bzImage" },
  filesystem: { baseurl: "/assets/rootfs-standard/" }, // Base + Node.js per README-1.md:2421
  hda: { url: "/assets/disk-standard.img", async: true },
  network_relay_url: null,
  screen_container: typeof document !== "undefined" ? document.getElementById("screen") : null,
  ac97: false,
  autostart: false
};
