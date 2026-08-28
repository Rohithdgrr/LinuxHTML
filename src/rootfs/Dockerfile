# src/rootfs/Dockerfile - Reproducible Alpine root per README-1.md:556
# Pinned digest from versions.lock per README-1.md:569
# Build: cd src/rootfs && ./build.sh --tier base -> build/rootfs-base.squashfs
ARG ALPINE_VERSION=3.19.1
ARG ALPINE_DIGEST=sha256:c5b1261d6d3e43071626931bd746b6ba1393290e898ede1fffb962dc373a464c
FROM alpine:${ALPINE_VERSION}@${ALPINE_DIGEST}

# Labels for SBOM per README-1.md:1480
LABEL org.linuxhtml.tier="base"
LABEL org.linuxhtml.kernel="6.6.72"
LABEL org.linuxhtml.description="Immutable 9P root (read-only, not initrd per README-1.md:573)"

# Tier-based package installation
# micro: no extra packages beyond BusyBox
# base: gcc git python3 vim per README-1.md:2421
# standard: base + nodejs npm per README-1.md:2421

ARG TIER=base

# Install tier packages (real build will branch on TIER)
RUN if [ "$TIER" = "base" ] || [ "$TIER" = "standard" ]; then \
      apk add --no-cache gcc git python3 vim musl-dev; \
    fi && \
    if [ "$TIER" = "standard" ]; then \
      apk add --no-cache nodejs npm; \
    fi && \
    rm -rf /var/cache/apk/*

# Copy overlay (custom files) per README-1.md:442
COPY overlay/ /

# Ensure writable-disk mount points exist in overlay per README-1.md:589
RUN mkdir -p /home /root /opt && \
    echo "LinuxHTML Alpine 3.19 tier=$TIER - immutable root per README-1.md:834" > /etc/linuxhtml-release

# Verify Node.js only in standard (enforced in build.sh test)
RUN if [ "$TIER" = "base" ] && command -v node >/dev/null 2>&1; then echo "ERROR: Node.js found in base tier but Standard-only per README-1.md:671" && exit 1; fi

CMD ["/bin/sh"]
