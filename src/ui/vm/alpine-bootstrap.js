// Executed inside the experimental Alpine live guest, not in the browser host.
// All paths and the image compatibility marker are fixed by this build.
export const alpineBootstrap = String.raw`#!/bin/sh
set -e
lh_success=0
trap 'if [ "$lh_success" != 1 ]; then echo __LH_ROOT_FAILED__; fi' EXIT
mkdir -p /persist
mount -t ext2 /dev/sda /persist
if ! grep -qw overlay /proc/filesystems; then modprobe overlay; fi
D=/persist/.linuxhtml-root
mkdir -p "$D"
if [ -e "$D/version" ]; then
  [ "$(cat "$D/version")" = "alpine-3.24.3-overlay-v1" ]
else
  printf '%s\n' 'alpine-3.24.3-overlay-v1' > "$D/version"
fi
mkdir -p "$D/upper" "$D/work" "$D/root"
mount -t overlay overlay -o "lowerdir=/,upperdir=$D/upper,workdir=$D/work" "$D/root"
for d in proc run .modloop media/cdrom persist mnt; do
  mkdir -p "$D/root/$d"
  mount --bind "/$d" "$D/root/$d"
done
for d in dev sys; do
  mkdir -p "$D/root/$d"
  mount -o rbind "/$d" "$D/root/$d"
done
chroot "$D/root" /bin/sh -c 'echo __LH_ROOT_READY__; exec /bin/sh -l'
lh_success=1
echo __LH_ROOT_EXITED__
`;
