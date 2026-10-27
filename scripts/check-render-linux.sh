#!/bin/sh
# Compile and smoke-test the native executables on the deployment CPU.
set -eu

test "$(node --version)" = v24.21.0
command -v g++ >/dev/null
command -v readelf >/dev/null
arch=$(uname -m)
case "$arch" in
  x86_64) machine='Advanced Micro Devices X86-64' ;;
  aarch64) machine='AArch64' ;;
  *) echo "Unsupported Linux CPU: $arch" >&2; exit 1 ;;
esac

npm run check
for binary in simulation_cli.exe game_cli.exe multiplayer_cli.exe; do
  readelf -h "$binary" | grep -Fq "Machine:                           $machine" || {
    echo "Wrong architecture for $binary (expected $arch)" >&2; exit 1;
  }
done
./simulation_cli.exe --rounds 1 --strategy mixed >/dev/null
./game_cli.exe --seed 17 --profile mixed --actions '' >/dev/null
./multiplayer_cli.exe --seed 17 --players 2 --rounds '' >/dev/null
echo "Render native build ready on $arch."
