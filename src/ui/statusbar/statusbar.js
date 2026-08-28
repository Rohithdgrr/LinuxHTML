// src/ui/statusbar/statusbar.js - Status bar per README-1.md:452 Phase 3 M3
// Shows capability, storage backend, network, integrity per README-1.md:1183

export class StatusBar {
  constructor({ el = document.getElementById("statusbar") || document.getElementById("status") } = {}) {
    this.el = el;
  }
  setStatus(text) {
    if (this.el) this.el.textContent = text;
    console.log("[statusbar]", text);
  }
  setBackend(backend) {
    this.setStatus(`Storage: ${backend} per README-1.md:889`);
  }
}
