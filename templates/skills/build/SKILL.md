---
name: build
command: /build
description: Build Solana BPF programs for Mythic L2
---

# Build Program

Build one or all Mythic L2 Solana programs using `cargo build-sbf`.

## Instructions

1. If an argument is provided, build that specific program from `programs/<name>/`
2. If argument is "all", build all programs in the `programs/` directory
3. If no argument, list available programs and ask which to build

## Build Command

```bash
cd programs/<name> && cargo build-sbf
```

First-time builds need `--force-tools-install`:
```bash
cargo build-sbf --force-tools-install
```

## Required Cargo.toml Pins

Verify these exist in the workspace Cargo.toml before building:
- `blake3 = ">=1.3, <1.8"`
- `getrandom = { version = "0.2", features = ["custom"] }`
- `solana-program = "=2.1.17"`

## Build Profile

```toml
[profile.release]
overflow-checks = true
lto = "fat"
```

## Post-Build

After successful build, report:
- Program .so file location and size
- Any warnings from the build
- Deployed program ID (from constants or Cargo.toml)
