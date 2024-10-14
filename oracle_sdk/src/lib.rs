use anchor_lang::prelude::*;

pub const APRO_SVM_PROGRAM_ID: &str = "AfeSbLSZ8zMVTVBj4ALAHAbE6VnfM6s9ThcWETKKotkq";

#[derive(AnchorDeserialize, AnchorSerialize, Clone, Debug)]
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

pub fn load_price_feed_from_account_info(price_account_info: &AccountInfo) -> Result<PriceFeed> {
    let data = price_account_info.try_borrow_data()?;

    let mut price_feed_data = &data[8..];
    let price_feed = PriceFeed::deserialize(&mut price_feed_data)?;

    Ok(price_feed)
}
