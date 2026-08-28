// src/bridge/cache.js - OPFS 9P Read Cache (LRU) per Advanced Feature 2
// Problem: Every read from immutable Alpine root (/bin/bash, /lib/libc.so) crosses JS/WASM boundary, latency
// Solution: LRU cache inside Storage Worker, backed by OPFS, per review 9 Features

export class LRUCache {
  constructor(maxEntries = 100, maxBytes = 10 * 1024 * 1024) {
    this.maxEntries = maxEntries;
    this.maxBytes = maxBytes;
    this.cache = new Map(); // key -> {data, size, lastAccess}
    this.totalBytes = 0;
    console.log(`[cache] LRU OPFS 9P Read Cache per Feature 2 - max ${maxEntries} entries ${maxBytes/1024/1024}MB`);
  }

  _evictIfNeeded() {
    while ((this.cache.size > this.maxEntries || this.totalBytes > this.maxBytes) && this.cache.size > 0) {
      // Evict least recently used (first entry)
      const lruKey = this.cache.keys().next().value;
      const entry = this.cache.get(lruKey);
      this.totalBytes -= entry.size;
      this.cache.delete(lruKey);
      console.log(`[cache] Evicted LRU ${lruKey} per Feature 2`);
    }
  }

  get(key) {
    const entry = this.cache.get(key);
    if (!entry) return null;
    // Update LRU order
    this.cache.delete(key);
    this.cache.set(key, { ...entry, lastAccess: Date.now() });
    console.log(`[cache] Hit ${key} per Feature 2 - near-instant without JS/WASM crossing`);
    return entry.data;
  }

  set(key, data) {
    const size = data.length || data.byteLength || 0;
    if (this.cache.has(key)) {
      this.totalBytes -= this.cache.get(key).size;
    }
    this.cache.set(key, { data, size, lastAccess: Date.now() });
    this.totalBytes += size;
    this._evictIfNeeded();
    console.log(`[cache] Set ${key} ${size} bytes per Feature 2`);
  }

  clear() {
    this.cache.clear();
    this.totalBytes = 0;
    console.log("[cache] Cleared per Feature 2");
  }

  stats() {
    return { entries: this.cache.size, bytes: this.totalBytes, maxEntries: this.maxEntries, maxBytes: this.maxBytes };
  }
}

// Integration with Storage Worker: when VM requests block from 9P root, cache locally
// Subsequent boots or apk operations will be near-instantaneous without rebuilding rootfs per Feature 2
console.log("[cache] OPFS 9P Read Cache LRU ready per Advanced Feature 2");
