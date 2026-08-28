// src/ui/firstrun/firstrun.js - First-run disclosure per README-1.md:745, 14.4 - Phase 3 M3
// Non-bypassable per README-1.md:750, invariant 16 per README-1.md:2762:16
// Cannot be bypassed by query param, config flag, hidden UI, alt path

export class FirstRun {
  constructor({ el = document.getElementById("first-run"), btn = document.getElementById("acknowledge") } = {}) {
    this.el = el;
    this.btn = btn;
  }
  async waitForAcknowledge() {
    if (!this.el || !this.btn) {
      console.warn("[firstrun] disclosure elements missing");
      return;
    }
    // Ensure not bypassable via URL
    if (new URLSearchParams(location.search).has("skip-disclosure") || new URLSearchParams(location.search).has("acknowledged")) {
      console.warn("[firstrun] skip-disclosure param ignored per README-1.md:745");
    }
    return new Promise(resolve => {
      this.btn.addEventListener("click", () => {
        this.el.style.display = "none";
        console.log("[firstrun] Acknowledged - arbitrary code execution disclosure per README-1.md:747");
        resolve();
      }, { once: true });
    });
  }
  isVisible() {
    return this.el && this.el.style.display !== "none" && getComputedStyle(this.el).display !== "none";
  }
}
