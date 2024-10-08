use crate::errors::ErrorCode;
use crate::states::*;
use anchor_lang::prelude::*;

#[event]
pub struct AdminUpdated {
    pub old_admin: Pubkey,
    pub new_admin: Pubkey,
}

#[derive(Accounts)]
pub struct UpdateAdmin<'info> {
    #[account(
        mut,
        has_one = admin @ ErrorCode::UnauthorizedAdmin
    )]
    pub oracle_state: Account<'info, OracleState>,

    pub admin: Signer<'info>,
}

pub fn handler(ctx: Context<UpdateAdmin>, new_admin: Pubkey) -> Result<()> {
    let oracle_state = &mut ctx.accounts.oracle_state;
    let old_admin = oracle_state.admin;

    oracle_state.update_admin(new_admin)?;

    emit!(AdminUpdated {
        old_admin,
        new_admin,
    });

    Ok(())
}
