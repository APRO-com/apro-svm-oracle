use anchor_lang::prelude::*;
use oracle_sdk::load_price_feed_from_account_info;

declare_id!("GzWu85MdbZtVBDcC4Xrmp1dWix7Qo52nUAkD2FjraJ6f");

#[program]
pub mod oracle_client_example {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
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

        let price_result = if current_timestamp - price_feed.valid_time_stamp <= staleness_threshold
        {
            PriceResult {
                price: price_feed.benchmark_price as u64,
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
}

#[derive(Accounts)]
pub struct Initialize<'info> {
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

#[account]
pub struct PriceResult {
    pub price: u64,
    pub is_valid: bool,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Invalid account data length")]
    InvalidAccountDataLength,
}
