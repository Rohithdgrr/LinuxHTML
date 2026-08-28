// src/bridge/encryption.js - Stronger storage encryption per Feature 9 per review suggestion 9 Features - Phase 9 Post-v1
// Currently opt-in AES-GCM off per README-1.md:1040, default unencrypted per README-1.md:1464
// Future: integrated key management per FUTURE-SCOPE.MD:3
import { StorageBridge } from "./storage.js";
export class EncryptedStorageBridge extends StorageBridge {
  constructor(workerUrl, key) {
    super(workerUrl);
    this.key = key; // Web Crypto CryptoKey, not plaintext per README-1.md:1042
    console.log("[encryption] Stronger encryption per Feature 9 - AES-GCM per README-1.md:1040");
  }
  async deriveKey(password, salt) {
    const enc = new TextEncoder();
    const baseKey = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]);
    return crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" }, baseKey, { name: "AES-GCM", length: 256 }, false, ["encrypt","decrypt"]);
  }
}
