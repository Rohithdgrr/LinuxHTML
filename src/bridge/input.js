// src/bridge/input.js - DOM keyboard/mouse/touch -> PS/2 per README-1.md:1221 - Phase 3 M3
// Pipeline: Keyboard/Mouse/Touch DOM events -> input.js -> PS/2/device emulation -> Linux
// Touch includes basic on-screen trackpad per README-1.md:1236, functional but not polished per README-1.md:1238

// PS/2 Set 1 scancodes (subset for testing, layout-agnostic e.code per README-1.md:292)
export const SCANCODE_MAP = {
  "Escape": [0x01], "Digit1": [0x02], "Digit2": [0x03], "Digit3": [0x04], "Digit4": [0x05], "Digit5": [0x06],
  "Digit6": [0x07], "Digit7": [0x08], "Digit8": [0x09], "Digit9": [0x0A], "Digit0": [0x0B], "Minus": [0x0C], "Equal": [0x0D], "Backspace": [0x0E],
  "Tab": [0x0F], "KeyQ": [0x10], "KeyW": [0x11], "KeyE": [0x12], "KeyR": [0x13], "KeyT": [0x14], "KeyY": [0x15], "KeyU": [0x16], "KeyI": [0x17], "KeyO": [0x18], "KeyP": [0x19],
  "BracketLeft": [0x1A], "BracketRight": [0x1B], "Enter": [0x1C], "ControlLeft": [0x1D], "KeyA": [0x1E], "KeyS": [0x1F], "KeyD": [0x20], "KeyF": [0x21], "KeyG": [0x22],
  "KeyH": [0x23], "KeyJ": [0x24], "KeyK": [0x25], "KeyL": [0x26], "Semicolon": [0x27], "Quote": [0x28], "Backquote": [0x29], "ShiftLeft": [0x2A], "Backslash": [0x2B],
  "KeyZ": [0x2C], "KeyX": [0x2D], "KeyC": [0x2E], "KeyV": [0x2F], "KeyB": [0x30], "KeyN": [0x31], "KeyM": [0x32], "Comma": [0x33], "Period": [0x34], "Slash": [0x35],
  "ShiftRight": [0x36], "NumpadMultiply": [0x37], "AltLeft": [0x38], "Space": [0x39], "CapsLock": [0x3A],
  "F1": [0x3B], "F2": [0x3C], "F3": [0x3D], "F4": [0x3E], "F5": [0x3F], "F6": [0x40], "F7": [0x41], "F8": [0x42], "F9": [0x43], "F10": [0x44],
  "NumLock": [0x45], "ScrollLock": [0x46],
  "ArrowUp": [0xE0, 0x48], "ArrowLeft": [0xE0, 0x4B], "ArrowRight": [0xE0, 0x4D], "ArrowDown": [0xE0, 0x50],
  "Delete": [0xE0, 0x53], "Home": [0xE0, 0x47], "End": [0xE0, 0x4F], "PageUp": [0xE0, 0x49], "PageDown": [0xE0, 0x51],
};
// Break = make + 0x80 for non-extended, for extended: E0 xx then E0 xx+0x80 ??? Simplified: add 0x80 to last byte
function getBreakCodes(make) {
  if (make[0] === 0xE0) return [0xE0, make[1] | 0x80];
  return [make[0] | 0x80];
}

export class InputBridge {
  constructor({ emulator, screen = typeof document !== "undefined" ? document.getElementById("screen") : null } = {}) {
    this.emulator = emulator;
    this.screen = screen;
    this.attached = false;
    this.keyCount = 0;
    this.mouseCount = 0;
    this.touchCount = 0;
    this.lastMouse = { x: 512, y: 384 };
    console.log("[input] InputBridge init per README-1.md:1221 - Phase 3 M3");
    // Trackpad state for touch->mouse
    this.touchActive = false;
    this.touchStart = { x: 0, y: 0 };
  }

  attach() {
    if (!this.screen) {
      console.warn("[input] No screen element - input disabled");
      return;
    }
    if (this.attached) return;
    // Keyboard - use capture to prevent browser shortcuts, layout-agnostic e.code per README-1.md:292
    document.addEventListener("keydown", (e) => this.handleKey(e, true), true);
    document.addEventListener("keyup", (e) => this.handleKey(e, false), true);
    // Mouse - canvas relative, scale for 1024x768 per README-1.md:1242
    this.screen.addEventListener("mousedown", (e) => this.handleMouse(e, "down"));
    this.screen.addEventListener("mouseup", (e) => this.handleMouse(e, "up"));
    this.screen.addEventListener("mousemove", (e) => this.handleMouse(e, "move"));
    this.screen.addEventListener("wheel", (e) => this.handleMouse(e, "wheel"), { passive: false });
    this.screen.addEventListener("contextmenu", (e) => e.preventDefault());
    // Touch - basic trackpad per README-1.md:1236, not polished per README-1.md:1238
    this.screen.addEventListener("touchstart", (e) => this.handleTouch(e, "start"), { passive: false });
    this.screen.addEventListener("touchmove", (e) => this.handleTouch(e, "move"), { passive: false });
    this.screen.addEventListener("touchend", (e) => this.handleTouch(e, "end"), { passive: false });
    this.screen.addEventListener("touchcancel", (e) => this.handleTouch(e, "cancel"), { passive: false });

    // Create on-screen trackpad for mobile if touch is primary
    if (("ontouchstart" in window || navigator.maxTouchPoints > 0) && !document.getElementById("trackpad")) {
      const pad = document.createElement("div");
      pad.id = "trackpad";
      pad.style.cssText = "position:fixed;bottom:10px;left:10px;right:10px;height:120px;background:rgba(255,255,255,0.1);border:1px solid #555;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#888;font-size:12px;z-index:1000";
      pad.textContent = "Trackpad - drag to move, tap to click (Phase 3 touch functional not polished per README-1.md:1238)";
      pad.addEventListener("touchstart", (e) => this.handleTouch(e, "start"), { passive: false });
      pad.addEventListener("touchmove", (e) => this.handleTouch(e, "move"), { passive: false });
      pad.addEventListener("touchend", (e) => this.handleTouch(e, "end"), { passive: false });
      document.body.appendChild(pad);
      console.log("[input] On-screen trackpad created per README-1.md:1236");
    }

    this.attached = true;
    console.log("[input] attached keyboard/mouse/touch (touch: functional not polished per README-1.md:1238)");
    if (typeof window !== "undefined") window.linuxhtmlInput = this;
  }

  _sendScancodes(codes) {
    this.keyCount++;
    if (this.emulator) {
      if (typeof this.emulator.keyboard_send_scancodes === "function") {
        this.emulator.keyboard_send_scancodes(codes);
      } else if (this.emulator.bus && typeof this.emulator.bus.send === "function") {
        this.emulator.bus.send("keyboard-code", codes);
      }
    }
    if (this.keyCount <= 10 || this.keyCount % 50 === 0) {
      console.log(`[input] scancodes [${codes.map(c => "0x"+c.toString(16)).join(",")}] count=${this.keyCount} (per README-1.md:1221 PS/2)`);
    }
  }

  handleKey(e, down) {
    // Use e.code layout-agnostic per README-1.md:292, not e.key
    const make = SCANCODE_MAP[e.code];
    if (!make) {
      // Unknown code - log but don't send
      if (this.keyCount < 5) console.log(`[input] key ${e.code} (${e.key}) no scancode mapping (stub) per README-1.md:292`);
      return;
    }
    const codes = down ? make : getBreakCodes(make);
    this._sendScancodes(codes);
    // Prevent browser handling for captured keys (except F5, etc. but we capture most)
    if (["Tab","Space","ArrowUp","ArrowDown","ArrowLeft","ArrowRight","Backspace"].includes(e.code) || e.ctrlKey || e.altKey) {
      e.preventDefault();
    }
  }

  _getCanvasCoords(e) {
    if (!this.screen) return { x: 0, y: 0 };
    const rect = this.screen.getBoundingClientRect();
    const scaleX = this.screen.width / rect.width;
    const scaleY = this.screen.height / rect.height;
    const clientX = e.clientX !== undefined ? e.clientX : (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
    const clientY = e.clientY !== undefined ? e.clientY : (e.touches && e.touches[0] ? e.touches[0].clientY : 0);
    const x = Math.floor((clientX - rect.left) * scaleX);
    const y = Math.floor((clientY - rect.top) * scaleY);
    // Clamp to 1024x768 per README-1.md:1242
    return { x: Math.max(0, Math.min(1024, x)), y: Math.max(0, Math.min(768, y)) };
  }

  handleMouse(e, type) {
    this.mouseCount++;
    const { x, y } = this._getCanvasCoords(e);
    this.lastMouse = { x, y };
    let buttonMask = 0;
    if (e.buttons !== undefined) buttonMask = e.buttons & 0x7;
    else if (type === "down") buttonMask = 1;
    else if (type === "up") buttonMask = 0;

    if (this.emulator) {
      if (typeof this.emulator.mouse_send_delta === "function") {
        // For move, send delta if we have previous
        if (type === "move" && e.movementX !== undefined) {
          this.emulator.mouse_send_delta([e.movementX, e.movementY]);
        } else if (type === "down" || type === "up") {
          // Click handling via bus
          if (this.emulator.bus && typeof this.emulator.bus.send === "function") {
            this.emulator.bus.send("mouse-click", [x, y, buttonMask]);
          }
        }
      } else if (this.emulator.bus) {
        this.emulator.bus.send("mouse-event", { x, y, type, buttonMask });
      }
    }
    if (this.mouseCount <= 5) console.log(`[input] mouse ${type} ${x},${y} mask=${buttonMask} count=${this.mouseCount} (per README-1.md:1221)`);
    if (type === "wheel") e.preventDefault();
  }

  handleTouch(e, type) {
    this.touchCount++;
    // Prevent scrolling
    e.preventDefault();
    const touch = e.touches[0] || e.changedTouches[0];
    if (!touch) return;
    const { x, y } = this._getCanvasCoords(touch);
    // Map touch to mouse: trackpad style per README-1.md:1236
    if (type === "start") {
      this.touchActive = true;
      this.touchStart = { x, y };
      // Simulate mouse down at position
      this.handleMouse({ clientX: touch.clientX, clientY: touch.clientY, buttons: 1 }, "down");
    } else if (type === "move" && this.touchActive) {
      const dx = x - this.touchStart.x;
      const dy = y - this.touchStart.y;
      // Send delta
      if (this.emulator && typeof this.emulator.mouse_send_delta === "function") {
        this.emulator.mouse_send_delta([dx, dy]);
      }
      this.touchStart = { x, y };
    } else if (type === "end" || type === "cancel") {
      this.touchActive = false;
      this.handleMouse({ clientX: touch.clientX, clientY: touch.clientY, buttons: 0 }, "up");
    }
    if (this.touchCount <= 5) console.log(`[input] touch ${type} ${x},${y} count=${this.touchCount} (trackpad per README-1.md:1236, not polished per README-1.md:1238)`);
  }

  getStats() {
    return { keyCount: this.keyCount, mouseCount: this.mouseCount, touchCount: this.touchCount, attached: this.attached, lastMouse: this.lastMouse };
  }
}
