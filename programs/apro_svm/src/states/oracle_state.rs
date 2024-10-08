use anchor_lang::prelude::*;

#[account]
pub struct OracleState {
    pub id: u64,
    pub required_signatures: u64,
    pub total_oracles: u64,
    pub admin: Pubkey,
    pub oracles: Vec<[u8; 20]>,
    pub expiration_period: i64,
}

impl OracleState {
    pub const LEN: usize = 8 + 4 + 32 + 64 + 32 + 64 + 16 + 16 + 16 + 32;

    pub fn initialize(
        &mut self,
        id: u64,
        required_signatures: u64,
        admin: Pubkey,
        expiration_period: i64,
    ) -> Result<()> {
        self.id = id;
        self.required_signatures = required_signatures;
        self.total_oracles = 0;
        self.admin = admin;
        self.expiration_period = expiration_period;
        self.oracles = Vec::new();
        Ok(())
    }

    pub fn add_oracle(&mut self, oracle: [u8; 20]) -> Result<()> {
        self.oracles.push(oracle);
        self.total_oracles += 1;
        Ok(())
    }

    pub fn update_admin(&mut self, new_admin: Pubkey) -> Result<()> {
        self.admin = new_admin;
        Ok(())
    }
}
