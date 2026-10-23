#!/bin/sh
# Run inside a clean git archive on Linux arm64 with Node 24.21.0 and g++.
set -eu

commit=${1:?usage: build-release.sh COMMIT OUTPUT_DIRECTORY}
output=${2:?usage: build-release.sh COMMIT OUTPUT_DIRECTORY}
case "$commit" in *[!0-9a-f]*|'') echo 'Commit must be a lowercase hex Git ID' >&2; exit 1;; esac
test "$(uname -m)" = aarch64 || { echo 'Release build requires Linux arm64' >&2; exit 1; }
test "$(node --version)" = v24.21.0 || { echo 'Release build requires Node 24.21.0' >&2; exit 1; }
command -v g++ >/dev/null
command -v readelf >/dev/null
command -v sha256sum >/dev/null

node scripts/start-dashboard.js --check
for binary in simulation_cli.exe game_cli.exe multiplayer_cli.exe; do
  readelf -h "$binary" | grep -q 'Machine:.*AArch64' || {
    echo "Not an AArch64 ELF: $binary" >&2; exit 1;
  }
done

mkdir -p "$output"
output=$(cd "$output" && pwd)
stage=$(mktemp -d)
trap 'rm -rf "$stage"' EXIT HUP INT TERM
root="$stage/signalbound"
mkdir -p "$root/scripts" "$root/game/assets" "$root/dashboard" \
  "$root/migrations" "$root/deploy"
cp server.js room-server.js match-store.js deployment-config.js package.json \
  simulation_cli.exe game_cli.exe multiplayer_cli.exe "$root/"
cp game/*.js game/*.css game/*.html "$root/game/"
cp game/assets/*.ttf game/assets/*-OFL.txt "$root/game/assets/"
cp dashboard/app.js dashboard/index.html dashboard/styles.css "$root/dashboard/"
cp migrations/*.sql "$root/migrations/"
cp deploy/*.conf deploy/*.service deploy/*.example "$root/deploy/"
cp scripts/sqlite-backup.js scripts/smoke.js "$root/scripts/"
(
  cd "$root"
  find . -type f ! -name MANIFEST.sha256 -print | LC_ALL=C sort | \
    while IFS= read -r path; do sha256sum "$path"; done > MANIFEST.sha256
)
bundle="$output/signalbound-$commit-linux-arm64.tar.gz"
tar -C "$stage" --sort=name --mtime=@0 --owner=0 --group=0 \
  --numeric-owner -cf - signalbound | gzip -n > "$bundle"
sha256sum "$bundle" > "$bundle.sha256"
echo "$bundle"
