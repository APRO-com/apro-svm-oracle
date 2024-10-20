use anchor_lang::prelude::*;
use anchor_lang::solana_program::clock::UnixTimestamp;
use apro_svm::states::{OracleState, PriceFeed};

declare_id!("GuU7g6tNQnZ9bzsC3VMzGd9SLrqd6gaJke7bzjSgFzkH");

#[program]
pub mod oracle_consumer_example {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        ctx.accounts.config.oracle_state = ctx.accounts.oracle_state.key();
        Ok(())
    }

    pub fn fetch_price(ctx: Context<FetchPrice>, feed_id: [u8; 32]) -> Result<()> {
        if ctx.accounts.price_feed.expire_at < ctx.accounts.clock.unix_timestamp as u128 {
            return Err(ErrorCode::PriceExpired.into());
        }

        emit!(FetchPriceEvent {
            feed_id,
            timestamp: ctx.accounts.clock.unix_timestamp,
            expired_at: ctx.accounts.price_feed.expire_at,
            benchmark_price: ctx.accounts.price_feed.benchmark_price,
            ask_price: ctx.accounts.price_feed.ask_price,
            bid_price: ctx.accounts.price_feed.bid_price,
        });

        Ok(())
    }
}

#[event]
pub struct FetchPriceEvent {
    #[index]
    pub feed_id: [u8; 32],
    pub timestamp: i64,
    pub expired_at: u128,
    pub benchmark_price: u128,
    pub ask_price: u128,
    pub bid_price: u128,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Price expired")]
    PriceExpired,
}

#[account]
pub struct Config {
    pub oracle_state: Pubkey,
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        init,
        payer = payer,
        space = 8 + 32,
        seeds = [b"config"],
        bump
    )]
    pub config: Account<'info, Config>,
    #[account(
        seeds = [b"oracle_state", oracle_state.id.to_le_bytes().as_ref()],
        bump,
        seeds::program = apro_svm::id()
    )]
    pub oracle_state: Account<'info, OracleState>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(feed_id: [u8; 32])]
pub struct FetchPrice<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(seeds = [b"config"], bump)]
    pub config: Account<'info, Config>,
    #[account(
        seeds = [
            b"price_feed",
            config.oracle_state.as_ref(),
            feed_id.as_ref()
        ],
        bump,
        seeds::program = apro_svm::id()
    )]
    pub price_feed: Account<'info, PriceFeed>,
    pub clock: Sysvar<'info, Clock>,
}