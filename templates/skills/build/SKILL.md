---
name: build
description: "Build Solana BPF programs for Mythic L2"
---

Build the specified program (or all programs) using `cargo build-sbf`.

Steps:
1. If a program name is given, `cd` into that program's directory
2. Run `cargo build-sbf` (add `--force-tools-install` if this is the first build)
3. Report the output .so file path and size
4. If build fails, diagnose the error and suggest fixes

Common fixes:
- Missing `blake3` pin: add `blake3 = ">=1.3, <1.8"` to workspace Cargo.toml
- Missing `getrandom` feature: add `getrandom = { version = "0.2", features = ["custom"] }`
- Version mismatch: ensure `solana-program = "=2.1.17"`

Usage: `/build [program-name|all]`
