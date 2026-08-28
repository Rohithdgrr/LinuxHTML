// src/ui/terminal/terminal.js - Terminal UI per README-1.md:452 Phase 3 M3
// Wraps display.js Canvas2D for terminal visible check per README-1.md:2373

export class Terminal {
  constructor({ display, container = document.getElementById("screen") } = {}) {
    this.display = display;
    this.container = container;
    console.log("[terminal] Terminal UI init per README-1.md:2373");
  }
  isVisible() {
    if (!this.container) return false;
    const style = getComputedStyle(this.container);
    return style.display !== "none" && this.container.width === 1024 && this.container.height === 768;
  }
}
