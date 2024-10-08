use crate::constants::MAX_ORACLES;
use crate::errors::ErrorCode;
use crate::states::*;
use anchor_lang::prelude::*;

#[event]
pub struct OracleAdded {
    pub oracle: [u8; 20],
    pub total_oracles: u64,
}

#[derive(Accounts)]
#[instruction(oracle: [u8; 20])]
pub struct AddOracle<'info> {
    #[account(
        mut,
        has_one = admin @ ErrorCode::UnauthorizedAdmin,
        constraint = oracle_state.total_oracles < MAX_ORACLES as u64 @ ErrorCode::MaxOraclesReached,
        constraint = !oracle_state.oracles.contains(&oracle) @ ErrorCode::OracleAlreadyExists
    )]
    pub oracle_state: Account<'info, OracleState>,
    pub admin: Signer<'info>,
}

pub fn handler(ctx: Context<AddOracle>, oracle: [u8; 20]) -> Result<()> {
    let oracle_state = &mut ctx.accounts.oracle_state;
    oracle_state.add_oracle(oracle)?;
    emit!(OracleAdded {
        oracle,
        total_oracles: oracle_state.total_oracles,
    });

    Ok(())
}
