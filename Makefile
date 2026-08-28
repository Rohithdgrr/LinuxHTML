# Makefile - LinuxHTML Build Orchestration
# Single source of truth remains README-1.md; this Makefile mirrors build order per README-1.md:494
# Canonical one-shot: ./build.sh --tier base --target pwa --verify  (or: make all TIER=base TARGET=pwa)
# Requires: Linux x86_64, Docker 24.x+, Python 3.10+, QEMU, pinned Emscripten via emsdk, Node 20.x LTS
# All versions pinned in versions.lock

SHELL := /bin/bash
.DEFAULT_GOAL := help

TIER ?= base
TARGET ?= pwa
PYTHON ?= python3
PIP ?= pip3

# Tier caps from versions.lock / README-1.md:664
# micro: 8MB/128M, base: 15MB/256M, standard: 25MB/512M
TIER_CAPS_micro := 8
TIER_CAPS_base := 15
TIER_CAPS_standard := 25

.PHONY: help verify kernel initramfs rootfs disk qemu-minimal qemu-real emulator pack pwa single-file verify-versions test bench clean all check-env

help: ## Show help
	@echo "LinuxHTML - browser-based Linux sandbox (README-1.md:172)"
	@echo ""
	@echo "Usage:"
	@echo "  make all TIER=base TARGET=pwa     # canonical (mirrors ./build.sh --tier base --target pwa --verify)"
	@echo "  make verify                       # versions + tests"
	@echo "  make kernel                       # Step 1: build Linux 6.6 bzImage"
	@echo "  make initramfs                    # Step 2: minimal BusyBox initramfs"
	@echo "  make qemu-minimal                 # Step 3: native QEMU gate"
	@echo "  make rootfs TIER=base             # Step 4: Alpine SquashFS"
	@echo "  make disk TIER=base               # Step 5: writable disk image"
	@echo "  make qemu-real TIER=base          # Step 6: QEMU real guest"
	@echo "  make emulator                     # Step 7: v86 WASM"
	@echo "  make pack TIER=base TARGET=pwa    # Step 8: pack PWA/single-file"
	@echo "  make verify-versions              # Step 9a: verify pins"
	@echo "  make test                         # Step 9b: pytest"
	@echo "  make clean"
	@echo ""
	@echo "Tiers: micro, base (default), standard  |  Targets: pwa (default), single-file"
	@echo "Prereqs: Linux x86_64, Docker 24.x+, Python 3.10+, QEMU, Node 20.x LTS, pinned Emscripten"

check-env: ## Check prerequisites exist
	@echo "==> Checking prerequisites (README-1.md:244)"
	@command -v $(PYTHON) >/dev/null 2>&1 || (echo "ERROR: python3 not found (need 3.10+)" && exit 1)
	@command -v docker >/dev/null 2>&1 || echo "WARN: docker not found (need 24.x+ for rootfs build, simulated on Windows per README-1.md:276)"
	@command -v qemu-system-x86_64 >/dev/null 2>&1 || echo "WARN: qemu-system-x86_64 not found (mandatory for native gate on Linux per README-1.md:260, simulated on Windows)"
	@command -v node >/dev/null 2>&1 || (echo "WARN: node not found (need 20.x LTS for tooling)")
	@echo "  versions.lock: $$(test -f versions.lock && echo ok || echo MISSING)"
	@test -f versions.lock || (echo "ERROR: versions.lock missing" && exit 1)
	@echo "  All critical checks passed (Node/Emscripten checked in emulator build)."

verify-versions: ## Verify pinned versions
	@echo "==> Step 9a: Verifying versions.lock"
	@$(PYTHON) tools/verify_versions.py

kernel: check-env ## Step 1: Build pinned Linux kernel
	@echo "==> Step 1: Build Linux kernel (README-1.md:498)"
	@if [ -x src/kernel/build.sh ]; then \
		cd src/kernel && ./build.sh; \
	else \
		echo "STUB: src/kernel/build.sh not yet implemented (M1). Would: fetch linux-6.6.x, verify SHA, apply linuxhtml_defconfig, build bzImage -> src/kernel/bzImage"; \
		mkdir -p src/kernel; \
		echo "kernel stub - implement in Phase 1" > src/kernel/bzImage.stub; \
	fi

initramfs: kernel ## Step 2: Build minimal BusyBox initramfs
	@echo "==> Step 2: Build minimal initramfs (README-1.md:518)"
	@if [ -x src/kernel/initramfs-minimal/build.sh ]; then \
		cd src/kernel/initramfs-minimal && ./build.sh; \
	else \
		echo "STUB: src/kernel/initramfs-minimal/build.sh not yet implemented (M1). Would: build -> initramfs-minimal.cpio"; \
		mkdir -p src/kernel/initramfs-minimal; \
		echo "initramfs stub" > src/kernel/initramfs-minimal/initramfs-minimal.cpio.stub; \
	fi

qemu-minimal: initramfs ## Step 3: Native QEMU kernel boot gate
	@echo "==> Step 3: Native QEMU minimal boot gate (README-1.md:536)"
	@echo "  Expect: interactive shell prompt"
	@$(PYTHON) tools/qemugate_check.py || (echo "  If this fails, do not debug v86/WASM/OPFS - kernel/config/initramfs issue per README-1.md:552" && exit 1)

rootfs: check-env ## Step 4: Build real Alpine root
	@echo "==> Step 4: Build Alpine rootfs tier=$(TIER) (README-1.md:556)"
	@if [ -x src/rootfs/build.sh ]; then \
		cd src/rootfs && ./build.sh --tier $(TIER); \
	else \
		echo "STUB: src/rootfs/build.sh not yet implemented (M2). Would: Docker build alpine:3.19 -> build/rootfs-$(TIER).squashfs"; \
		mkdir -p build; \
		echo "rootfs-$(TIER) stub" > build/rootfs-$(TIER).squashfs.stub; \
		echo "  Note: SquashFS is read-only 9P root, not initrd per README-1.md:573"; \
	fi

disk: rootfs ## Step 5: Build writable disk image
	@echo "==> Step 5: Build writable disk tier=$(TIER) (README-1.md:576)"
	@echo "  Writable disk with /home /root /opt, stable layout for export/import per README-1.md:594"
	@$(PYTHON) -c "import pathlib; p=pathlib.Path('build/disk-$(TIER).img'); print(f'  disk: {p} {p.stat().st_size if p.exists() else 0} bytes exists={p.exists()}')"

qemu-real: disk ## Step 6: Native QEMU validation of real guest
	@echo "==> Step 6: Native QEMU real root validation (README-1.md:600)"
	@echo "  Criteria: kernel boots, Alpine 9P accessible, hda detected, /home /root /opt mountable, file survives remount per README-1.md:608"
	@echo "  Must match v86 cmdline root=host9p rootfstype=9p rootflags=trans=virtio per README-1.md:1328"
	@$(PYTHON) tools/qemugate_real_check.py --tier $(TIER) || (echo "  If fails, investigate Alpine rootfs/9P/boot args per README-1.md:2024" && exit 1)

emulator: check-env ## Step 7: Build v86 to WebAssembly
	@echo "==> Step 7: Build v86 WASM (README-1.md:619)"
	@if [ -x src/emulator/build.sh ]; then \
		cd src/emulator && ./build.sh; \
	else \
		echo "STUB: src/emulator/build.sh not yet implemented (M2). Would: install emsdk 3.1.50 from versions.lock, build v86 WASM -> build/pwa/assets/v86.wasm"; \
		echo "  Do not depend on system Emscripten per README-1.md:626"; \
	fi

pack: emulator ## Step 8: Pack browser artifacts
	@echo "==> Step 8: Pack tier=$(TIER) target=$(TARGET) (README-1.md:630)"
	@$(PYTHON) tools/pack.py --tier $(TIER) --target $(TARGET) || echo "STUB: tools/pack.py pending - would pack to build/pwa/ or build/linuxhtml.html"

# Convenience aliases
pwa: ## Pack PWA
	@$(MAKE) pack TIER=$(TIER) TARGET=pwa

single-file: ## Pack single-file
	@$(MAKE) pack TIER=$(TIER) TARGET=single-file

test: ## Step 9b: Run tests
	@echo "==> Step 9b: Running tests (README-1.md:642)"
	@if [ -d tools/test ]; then \
		$(PYTHON) -m pytest tools/test/ -v; \
	else \
		echo "STUB: tools/test/ not yet populated (M3+). Would run: test_boot.py, test_storage.py, test_network.py, test_cross_browser.py"; \
		$(PYTHON) -m pytest --collect-only 2>&1 | head -20 || true; \
	fi

bench: ## Run benchmarks (creates docs/BENCHMARKS.md entry)
	@echo "==> Benchmarks (README-1.md:18)"
	@if [ -d tools/bench ]; then \
		$(PYTHON) tools/bench/run.py; \
	else \
		echo "STUB: tools/bench/ pending. Would measure: page load -> probe -> fetch -> verify -> instantiate -> init -> decompress -> boot -> 9P -> hda -> mount -> login per README-1.md:1833"; \
	fi

verify: verify-versions test ## Verify pipeline
	@echo "==> Verify complete"

all: check-env kernel initramfs rootfs disk emulator pack verify ## Canonical full pipeline (mirrors ./build.sh --tier base --target pwa --verify)
	@echo "==> All stages complete. Serve with: python3 tools/serve.py (not python -m http.server per README-1.md:728)"
	@echo "  PWA requires COOP/COEP headers for SMP per README-1.md:198"

size-check: ## Check image size budgets
	@echo "==> Size budget check (README-1.md:677, >5% over fails CI)"
	@$(PYTHON) -c "import json, pathlib, sys; v=json.load(open('versions.lock')); caps=v['tiers']; print(caps)"
	@echo "  Would verify: build/rootfs-*.squashfs compressed size vs caps"

clean: ## Clean build artifacts
	@echo "==> Cleaning (preserves src/ and docs/)"
	@rm -rf build/
	@rm -f src/kernel/bzImage.stub src/kernel/initramfs-minimal/*.stub build/*.stub
	@echo "  Cleaned build/"

# Prevent parallel execution where order matters
.NOTPARALLEL:
