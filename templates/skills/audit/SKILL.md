---
name: audit
description: "Security audit a Solana program"
---

Perform a security audit of the specified Solana program.

Read all source files in the program directory, then check for:

1. **Account validation** — Every account is checked for owner, signer status, writability, and PDA derivation
2. **Arithmetic safety** — All math uses checked_add/sub/mul/div, no unchecked casts
3. **Signer checks** — Authorities are verified as signers
4. **PDA validation** — PDAs are re-derived and compared, not trusted from input
5. **Reinitialization** — State accounts check `is_initialized` before init
6. **Access control** — Admin-only instructions verify the admin/authority
7. **Integer overflow** — No implicit u64 → u32 truncation, no multiplication overflow
8. **CPI safety** — CPI targets are validated program IDs, not arbitrary
9. **Rent exemption** — New accounts are checked for rent exemption
10. **Close account** — Closing accounts zeroes data and transfers lamports correctly

Output a severity-rated findings list: CRITICAL / HIGH / MEDIUM / LOW / INFO

Usage: `/audit [program-directory]`
