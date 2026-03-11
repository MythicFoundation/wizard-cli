---
name: new-program
description: "Scaffold a new Solana program for Mythic L2"
---

Generate a new Solana program scaffold compatible with Mythic L2.

Creates:
```
programs/<name>/
  Cargo.toml          # With correct dep pins for Mythic L2
  src/
    lib.rs            # Entrypoint + processor dispatch
    instruction.rs    # Instruction enum with borsh
    state.rs          # Account state structs
    error.rs          # Custom ProgramError variants
    processor.rs      # Instruction handlers
```

The scaffold includes:
- Correct `solana-program = "=2.1.17"` and `borsh = "0.10"` deps
- `blake3` and `getrandom` pins for BPF compatibility
- Account validation boilerplate
- Example Initialize instruction with PDA derivation
- Build profile: `overflow-checks = true`, `lto = "fat"`

Usage: `/new-program <name>`
