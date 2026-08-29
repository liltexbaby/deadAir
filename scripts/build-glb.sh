#!/usr/bin/env bash
#
# Rebuild the web GLBs from a raw Blender export.
#
#   ./scripts/build-glb.sh ~/path/to/DA_raw.glb
#
# Produces:
#   public/DA.glb         desktop  (2K textures)
#   public/DA.mobile.glb  mobile   (1K textures)
#
# Run this after EVERY Blender re-export — it's what keeps the two builds in
# sync, so they never have to be maintained by hand.
#
# NOTE: deliberately does NOT use `gltf-transform optimize`. That pipeline
# includes join/flatten/instance/palette, which merge and rename nodes — and the
# whole site is wired to exact names and extras baked into the GLB:
#   hit_*        -> section clicking (glTF `extras`)
#   cam_*        -> the camera rig
#   Cube.050 etc -> the practical lights
#   Cylinder.005 -> the radio-wave shader
# Losing any of them silently breaks interactivity while still looking fine.

set -euo pipefail

SRC="${1:-}"
if [[ -z "$SRC" || ! -f "$SRC" ]]; then
  echo "usage: $0 <raw-export.glb>" >&2
  exit 1
fi

CLI="npx --yes @gltf-transform/cli@latest"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

build() {
  local size="$1" quality="$2" out="$3"
  echo "=== ${out} (${size}px textures) ==="
  $CLI resize  "$SRC"          "$TMP/a.glb" --width "$size" --height "$size" 2>&1 | grep '^info' || true
  $CLI webp    "$TMP/a.glb"    "$TMP/b.glb" --quality "$quality"             2>&1 | grep '^info' || true
  $CLI meshopt "$TMP/b.glb"    "$out"                                         2>&1 | grep '^info' || true
}

build 2048 85 public/DA.glb
build 1024 80 public/DA.mobile.glb

echo
ls -la public/DA.glb public/DA.mobile.glb | awk '{printf "%-26s %6.1f MB\n", $NF, $5/1048576}'
echo
echo "Now verify the contract survived:  node scripts/verify-glb.mjs"
