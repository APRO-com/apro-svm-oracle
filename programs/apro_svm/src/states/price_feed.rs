use anchor_lang::prelude::*;

#[account]
pub struct PriceFeed {
    pub feed_id: [u8; 32],
    pub valid_time_stamp: u128,
    pub observe_time_stamp: u128,
    pub native_fee: u128,
    pub apro_token_fee: u128,
    pub expire_at: u128,
    pub benchmark_price: u128,
    pub ask_price: u128,
    pub bid_price: u128,
    pub config_digest: [u8; 32],
    pub epoch_and_round: u128,
    pub extra_hash: [u8; 32],
}

impl PriceFeed {
    pub const LEN: usize = 8 + 4 + 32 + 64 + 32 + 64 + 16 + 16 + 16 + 32;

    pub fn update_price(
        &mut self,
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
    ) -> Result<()> {
        self.feed_id = feed_id;
        self.valid_time_stamp = valid_time_stamp;
        self.observe_time_stamp = observe_time_stamp;
        self.native_fee = native_fee;
        self.apro_token_fee = apro_token_fee;
        self.expire_at = expire_at;
        self.benchmark_price = benchmark_price;
        self.ask_price = ask_price;
        self.bid_price = bid_price;
        self.config_digest = config_digest;
        self.epoch_and_round = epoch_and_round;
        self.extra_hash = extra_hash;
        Ok(())
    }
}
