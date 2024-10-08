use anchor_lang::prelude::*;

#[error_code]
#[derive(PartialEq)]
pub enum ErrorCode {
    #[msg("Insufficient signatures provided")]
    InsufficientSignatures,
    #[msg("Oracle has already been added")]
    OracleAlreadyExists,
    #[msg("Unauthorized admin")]
    UnauthorizedAdmin,
    #[msg("Array length mismatch")]
    ArrayLengthMismatch,
    #[msg("Maximum number of oracles reached")]
    MaxOraclesReached,
    #[msg("Signature verification failed")]
    SignatureVerificationFailed,
    #[msg("Insufficient valid signatures")]
    InsufficientValidSignatures,
}
