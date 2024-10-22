use anchor_lang::prelude::*;
use anchor_lang::solana_program::hash::hash;
use anchor_lang::solana_program::instruction::Instruction;
use anchor_lang::solana_program::program::invoke;

pub const APRO_SVM_PROGRAM_ID: &str = "AfeSbLSZ8zMVTVBj4ALAHAbE6VnfM6s9ThcWETKKotkq";

pub fn load_price_feed_from_account_info(price_account_info: &AccountInfo) -> Result<PriceFeed> {
    let data = price_account_info.try_borrow_data()?;

    let mut price_feed_data = &data[8..];
    let price_feed = PriceFeed::deserialize(&mut price_feed_data)?;

    Ok(price_feed)
}

pub fn update_price<'info>(
    oracle_state: &AccountInfo<'info>,
    price_feed: &AccountInfo<'info>,
    payer: &AccountInfo<'info>,
    admin: &AccountInfo<'info>,
    system_program: &AccountInfo<'info>,
    oracle_program: &AccountInfo<'info>,
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
    let ix = Instruction {
        program_id: *oracle_program.key,
        accounts: vec![
            AccountMeta::new_readonly(*oracle_state.key, false),
            AccountMeta::new(*price_feed.key, false),
            AccountMeta::new(*payer.key, true),
            AccountMeta::new(*admin.key, false),
            AccountMeta::new_readonly(*system_program.key, false),
        ],
        data: UpdatePriceArgs {
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
        }
        .data(),
    };

    invoke(
        &ix,
        &[
            oracle_state.clone(),
            price_feed.clone(),
            payer.clone(),
            admin.clone(),
            system_program.clone(),
            oracle_program.clone(),
        ],
    )?;

    Ok(())
}

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

#[derive(AnchorSerialize, AnchorDeserialize)]
struct UpdatePriceArgs {
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
}

impl UpdatePriceArgs {
    fn data(&self) -> Vec<u8> {
        let mut data = Vec::new();
        let preimage = "global:update_price".as_bytes();
        let hash = hash(preimage);
        let discriminator = &hash.to_bytes()[..8];
        data.extend_from_slice(discriminator);
        data.extend_from_slice(&AnchorSerialize::try_to_vec(self).unwrap());

        data
    }
}
