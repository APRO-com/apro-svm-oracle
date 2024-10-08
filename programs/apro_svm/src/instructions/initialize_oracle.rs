use crate::states::*;
use anchor_lang::prelude::*;

#[event]
pub struct OracleInitialized {
    pub id: u64,
    pub required_signatures: u64,
    pub admin: Pubkey,
    pub expiration_period: i64,
}

#[derive(Accounts)]
#[instruction(id: u64, required_signatures: u64)]
pub struct InitializeOracle<'info> {
    #[account(
        init,
        payer = payer,
        space = 8 + 8 + 8 + 8 + 32 + 32 * 20 + 8,
        seeds = [b"oracle_state", id.to_le_bytes().as_ref()],
        bump
    )]
    pub oracle_state: Account<'info, OracleState>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub admin: Signer<'info>,
    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<InitializeOracle>,
    id: u64,
    required_signatures: u64,
    expiration_period: i64,
) -> Result<()> {
    let oracle_state = &mut ctx.accounts.oracle_state;
    oracle_state.initialize(
        id,
        required_signatures,
        ctx.accounts.admin.key(),
        expiration_period,
    )?;

    emit!(OracleInitialized {
        id,
        required_signatures,
        admin: ctx.accounts.admin.key(),
        expiration_period,
    });

    Ok(())
}
