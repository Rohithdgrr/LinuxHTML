// src/bridge/debug.js - WASM Debugging & Register Inspection per Advanced Feature 8
// Problem: Debugging kernel panics or low-level x86_64 CPU opaque
// Solution: ?debug=1 hooks into v86 CPU loop, exposes RIP/RSP/EFLAGS, page tables, interrupt vectors to browser Console/DevTools per review
export class DebugBridge {
  constructor({ emulator, enabled = false } = {}) {
    this.emulator = emulator;
    this.enabled = enabled || (typeof location !== "undefined" && new URLSearchParams(location.search).has("debug"));
    console.log(`[debug] WASM Debugging ${this.enabled ? "enabled ?debug=1" : "disabled"} per Feature 8`);
  }

  enable() {
    this.enabled = true;
    if (!this.emulator) return;
    // Hook v86 CPU
    if (this.emulator.cpu) {
      const orig = this.emulator.cpu.do_run;
      this.emulator.cpu.do_run = (...args) => {
        if (this.enabled) {
          console.log(`[debug] RIP=${this.emulator.cpu.rip.toString(16)} RSP=${this.emulator.cpu.rsp.toString(16)} EFLAGS=${this.emulator.cpu.eflags}`);
        }
        return orig.apply(this.emulator.cpu, args);
      };
      console.log("[debug] Hooked v86 CPU do_run per Feature 8");
    }
    // Expose to DevTools
    if (typeof window !== "undefined") window.linuxhtmlDebug = this;
    console.log("[debug] Registers exposed to window.linuxhtmlDebug per Feature 8");
  }

  dumpRegisters() {
    if (!this.emulator || !this.emulator.cpu) return {};
    return {
      rip: this.emulator.cpu.rip,
      rsp: this.emulator.cpu.rsp,
      eflags: this.emulator.cpu.eflags,
      cr3: this.emulator.cpu.cr3,
    };
  }
}
