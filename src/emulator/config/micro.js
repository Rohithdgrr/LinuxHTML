// src/emulator/config/micro.js - Micro tier (8MB/128M) per README-1.md:664
export const microTierConfig = {
  wasm_path: "/assets/v86.wasm",
  memory_size: 128 * 1024 * 1024, // 128MB
  vga_memory_size: 4 * 1024 * 1024,
  bios: { url: "/assets/seabios.bin" },
  vga_bios: { url: "/assets/vgabios.bin" },
  bzimage: { url: "/assets/linux-6.6-linuxhtml.bzImage" },
  filesystem: { baseurl: "/assets/rootfs-micro/" }, // BusyBox only per README-1.md:664
  hda: { url: "/assets/disk-micro.img", async: true },
  network_relay_url: null,
  screen_container: typeof document !== "undefined" ? document.getElementById("screen") : null,
  ac97: false,
  autostart: false
};
