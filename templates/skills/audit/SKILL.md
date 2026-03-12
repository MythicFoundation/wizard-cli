---
name: audit
command: /audit
description: Security audit a Solana program
---

# Security Audit

Perform a security audit on a Mythic L2 Solana program.

## Instructions

1. If argument provided, audit `programs/<name>/`
2. If no argument, list programs and ask which to audit
3. Read all source files in the program directory

## Audit Checklist

### Account Validation
- [ ] All accounts checked for correct owner
- [ ] Signer checks on authority accounts
- [ ] Writable checks on mutable accounts
- [ ] PDA seeds verified (not just address comparison)
- [ ] Account data length validated before deserialization

### Arithmetic Safety
- [ ] All math uses `checked_add`, `checked_sub`, `checked_mul`, `checked_div`
- [ ] No integer overflow/underflow possible
- [ ] Fee calculations handle rounding correctly
- [ ] Token amounts respect decimal precision

### Access Control
- [ ] Admin-only functions verify admin signer
- [ ] Initialization can only happen once
- [ ] Upgrade authority properly restricted
- [ ] No unauthorized state mutations

### Token Safety
- [ ] Token account ownership verified
- [ ] Mint authority checks in place
- [ ] Transfer amounts validated
- [ ] Proper CPI invocation with correct signers

### Cross-Program Invocation
- [ ] CPI calls use correct program IDs
- [ ] Signer seeds properly derived
- [ ] Return data handled safely

### Data Validation
- [ ] All instruction data deserialized safely
- [ ] Enum variants exhaustively matched
- [ ] String/byte inputs bounded
- [ ] No uninitialized memory access

## Output Format

Report findings as:
- **CRITICAL**: Exploitable vulnerabilities
- **HIGH**: Significant security issues
- **MEDIUM**: Best practice violations
- **LOW**: Code quality improvements
- **INFO**: Informational notes
