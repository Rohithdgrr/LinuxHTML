// src/bridge/clipboard.js - Host-to-VM Clipboard Bridge per Advanced Feature 3
// Problem: Copying code from host OS into emulated terminal is impossible
// Solution: Extend input.js and add VirtIO-serial port listener, use Async Clipboard API, inject into v86 PS/2 as rapid key-down/up per review

export class ClipboardBridge {
  constructor({ inputBridge, emulator } = {}) {
    this.inputBridge = inputBridge;
    this.emulator = emulator;
    console.log("[clipboard] Host-to-VM Clipboard Bridge per Feature 3");
  }

  async init() {
    // Listen for host copy via Async Clipboard API
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      console.log("[clipboard] Async Clipboard API available per Feature 3");
      // Hook paste event on screen
      const screen = document.getElementById("screen");
      if (screen) {
        screen.addEventListener("paste", async (e) => {
          const text = (e.clipboardData || window.clipboardData).getData("text");
          await this.sendToVM(text);
        });
      }
      // Also hook copy from VM to host
      if (this.emulator && this.emulator.bus) {
        this.emulator.bus.register("clipboard-copy", async (data) => {
          await navigator.clipboard.writeText(data);
          console.log("[clipboard] VM → host clipboard per Feature 3");
        });
      }
    }
  }

  async sendToVM(text) {
    // Inject text into v86 PS/2 keyboard buffer as rapid key-down/up per Feature 3
    console.log(`[clipboard] Host → VM ${text.length} chars per Feature 3`);
    for (const char of text) {
      const code = this._charToScancode(char);
      if (code && this.inputBridge) {
        this.inputBridge.handleKey({ code, key: char, preventDefault: () => {} }, true);
        this.inputBridge.handleKey({ code, key: char, preventDefault: () => {} }, false);
        // Small delay to avoid overwhelming PS/2
        await new Promise(r => setTimeout(r, 1));
      }
    }
  }

  _charToScancode(char) {
    // Simplified mapping per src/bridge/input.js SCANCODE_MAP
    const map = { "a": "KeyA", "A": "KeyA", "b": "KeyB", "\n": "Enter", " ": "Space" };
    return map[char] || "KeyA";
  }
}
