use anchor_lang::prelude::*;
use instructions::*;

declare_id!("AfeSbLSZ8zMVTVBj4ALAHAbE6VnfM6s9ThcWETKKotkq");

pub mod constants;
pub mod errors;
pub mod instructions;
pub mod states;

#[program]
pub mod apro_svm {
    use super::*;

    pub fn initialize_oracle(
        ctx: Context<InitializeOracle>,
        id: u64,
        required_signatures: u64,
        expiration_period: i64,
    ) -> Result<()> {
        instructions::initialize_oracle::handler(ctx, id, required_signatures, expiration_period)
    }

    pub fn update_admin(ctx: Context<UpdateAdmin>, new_admin: Pubkey) -> Result<()> {
        instructions::update_admin::handler(ctx, new_admin)
    }

    pub fn add_oracle(ctx: Context<AddOracle>, oracle: [u8; 20]) -> Result<()> {
        instructions::add_oracle::handler(ctx, oracle)
    }

    pub fn update_price(
        ctx: Context<UpdatePrice>,
        feed_id: [u8; 32],
        valid_time_stamp: u128,
        observe_time_stamp: u128,
        native_fee: u128,
        apro_token_fee: u128,
        expire_at: u128,
        benchmark_price: u128,
        ask_price: u128,
        bid_price: u128,
        config_digest: [u8; 32],
        epoch_and_round: u128,
        extra_hash: [u8; 32],
        signatures: Vec<[u8; 64]>,
        recovery_ids: Vec<u8>,
    ) -> Result<()> {
        instructions::update_price::handler(
            ctx,
            feed_id,
            valid_time_stamp,
            observe_time_stamp,
            native_fee,
            apro_token_fee,
            expire_at,
            benchmark_price,
            ask_price,
            bid_price,
            config_digest,
            epoch_and_round,
            extra_hash,
            signatures,
            recovery_ids,
        )
    }
}
