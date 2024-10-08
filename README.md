# Apro SVM Oracle

This is a Solana program for an SVM Oracle that provides price feeds for the Apro Protocol.

## Development

### Prerequisites

Before you begin, ensure you have the following installed:

1. Solana CLI
2. Anchor Framework
3. Rust

### Installation

1. Install Solana CLI:

   ```bash
   sh -c "$(curl -sSfL https://release.solana.com/v1.14.17/install)"
   ```

2. Install Anchor Framework:

   ```bash
   cargo install --git https://github.com/coral-xyz/anchor avm --locked --force
   avm install latest
   avm use latest
   ```

3. Install Rust:
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
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
