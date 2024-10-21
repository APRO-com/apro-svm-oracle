# Apro SVM Oracle

This is a Solana program for an SVM Oracle that provides price feeds for the Apro Protocol.

## Development

### Prerequisites

Before you begin, ensure you have the following installed:

1. Rust
2. Solana CLI
3. Anchor Framework

### Installation

1. Install Rust:
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
   ```
2. Install Solana CLI:

   ```bash
   sh -c "$(curl -sSfL https://release.anza.xyz/stable/install)"
   ```

3. Install Anchor Framework:

   ```bash
   cargo install --git https://github.com/coral-xyz/anchor --tag v0.29.0 avm --locked
   avm use 0.29.0
   ```

### Building

To build the program, run:

```bash
anchor build
```

### Testing

To run the tests, use:

```bash
anchor test
```

### E2E Integration

To run the E2E tests, start the local validator firstly:

```bash
anchor localnet
```

Then run the E2E tests:

```bash 
anchor run e2e
```