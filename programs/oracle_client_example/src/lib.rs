use anchor_lang::prelude::*;
use oracle_sdk::{load_price_feed_from_account_info, update_price};

declare_id!("GzWu85MdbZtVBDcC4Xrmp1dWix7Qo52nUAkD2FjraJ6f");

#[program]
pub mod oracle_client_example {
    use super::*;

    pub fn fetch_price(ctx: Context<FetchPrice>) -> Result<()> {
        //fetch price feed from oracle
        let price_feed = load_price_feed_from_account_info(&ctx.accounts.price_account)?;

        msg!("Price Feed Details:");
        msg!("Feed ID: {:?}", price_feed.feed_id);
        msg!("Valid Timestamp: {}", price_feed.valid_time_stamp);
        msg!("Observe Timestamp: {}", price_feed.observe_time_stamp);
        msg!("Benchmark Price: {}", price_feed.benchmark_price);
        msg!("Ask Price: {}", price_feed.ask_price);
        msg!("Bid Price: {}", price_feed.bid_price);

        let current_timestamp = Clock::get()?.unix_timestamp as u128;
        let staleness_threshold = 3600u128;

        //store the price in the price_result account
        let price_result = if current_timestamp - price_feed.valid_time_stamp <= staleness_threshold
        {
            PriceResult {
                price: price_feed.benchmark_price,
                is_valid: true,
            }
        } else {
            PriceResult {
                price: 0,
                is_valid: false,
            }
        };

        ctx.accounts.price_result.set_inner(price_result);

        Ok(())
    }

    pub fn update_oracle_price(
        ctx: Context<UpdateOraclePrice>,
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
        //update the price feed through CPI
        update_price(
            &ctx.accounts.oracle_state.to_account_info(),
            &ctx.accounts.price_feed.to_account_info(),
            &ctx.accounts.payer.to_account_info(),
            &ctx.accounts.admin.to_account_info(),
            &ctx.accounts.system_program.to_account_info(),
            &ctx.accounts.oracle_program.to_account_info(),
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
        )?;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct FetchPrice<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    /// CHECK: This account is owned by the Oracle program
    pub price_account: UncheckedAccount<'info>,
    #[account(
        init_if_needed,
        payer = payer,
        space = 8 + 16 + 1, // discriminator + price (u128) + is_valid
        seeds = [b"price_result", price_account.key().as_ref()],
        bump
    )]
    pub price_result: Account<'info, PriceResult>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateOraclePrice<'info> {
    /// CHECK: This account is verified in the update_price function
    pub oracle_state: UncheckedAccount<'info>,
    /// CHECK: This account is verified in the update_price function
    #[account(mut)]
    pub price_feed: UncheckedAccount<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
    /// CHECK: This account is verified in the update_price function
    #[account(mut)]
    pub admin: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
    /// CHECK: This account is verified in the update_price function
    pub oracle_program: UncheckedAccount<'info>,
}

#[account]
pub struct PriceResult {
    pub price: u128,
    pub is_valid: bool,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Invalid account data length")]
    InvalidAccountDataLength,
}
