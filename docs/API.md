# API.md - Extension & Disk APIs

> Derived from `README-1.md:22` Extension API and `README-1.md:10.5` Disk API.

## Profile API per README-1.md:2187

```json
{
  "name": "devbox",
  "tier": "base",
  "rootfs_overlay": "overlay/",
  "boot_args": ["root=host9p","rootfstype=9p","rootflags=trans=virtio"],
  "ui": { "terminal_theme": "default" }
}
```

Downstream: `examples/<your-project>/` + profile + overlay per `README-1.md:2143`, do not fork `src/` per `README-1.md:2164`.

## Disk API per README-1.md:939

```
open() -> handle
read(offset,length) -> data
write(offset,data)
flush()
truncate(size)
size() -> bytes
export() -> Blob .img
import(file)
close()
```

All serialized via Worker, bounds-validated, quota-safe per `README-1.md:954`.

## Bridge Capabilities

Propose upstream per `README-1.md:2181`.
