use crate::errors::ErrorCode;
use crate::states::*;
use anchor_lang::prelude::*;
use anchor_lang::solana_program::{
    keccak::hash as keccak_hash, msg, secp256k1_recover::secp256k1_recover,
};
use ethabi::{encode, Token};

#[event]
pub struct PriceUpdated {
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

#[derive(Accounts)]
#[instruction(feed_id: [u8; 32])]
pub struct UpdatePrice<'info> {
    #[account(
        seeds = [b"oracle_state", oracle_state.id.to_le_bytes().as_ref()],
        bump,
    )]
    pub oracle_state: Account<'info, OracleState>,
    #[account(
        init_if_needed,
        payer = payer,
        space = 8 + 32 + 16 + 16 + 16 + 16 + 16 + 16 + 16 + 16 + 32 + 16 + 32,
        seeds = [
            b"price_feed",
            oracle_state.key().as_ref(),
            feed_id.as_ref()
        ],
        bump
    )]
    pub price_feed: Account<'info, PriceFeed>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<UpdatePrice>,
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
    let oracle_state = &ctx.accounts.oracle_state;
    let price_feed = &mut ctx.accounts.price_feed;

    require!(
        signatures.len() == recovery_ids.len(),
        ErrorCode::ArrayLengthMismatch
    );

    require!(
        signatures.len() as u64 >= oracle_state.required_signatures,
        ErrorCode::InsufficientSignatures
    );

    let report_data = vec![
        Token::FixedBytes(feed_id.to_vec()),
        Token::Uint(valid_time_stamp.into()),
        Token::Uint(observe_time_stamp.into()),
        Token::Uint(native_fee.into()),
        Token::Uint(apro_token_fee.into()),
        Token::Uint(expire_at.into()),
        Token::Uint(benchmark_price.into()),
        Token::Uint(ask_price.into()),
        Token::Uint(bid_price.into()),
    ];

    let report_context = vec![
        Token::FixedBytes(config_digest.to_vec()),
        Token::Uint(epoch_and_round.into()),
        Token::FixedBytes(extra_hash.to_vec()),
    ];

    let encoded_report_data = encode(&report_data);
    let report_data_hash = keccak_hash(&encoded_report_data);
    msg!("Report Data Hash: 0x{}", hex::encode(report_data_hash));

    let encoded_report_context = encode(&report_context);
    let value = [report_data_hash.as_ref(), &encoded_report_context].concat();
    msg!("Concatenated Value: 0x{}", hex::encode(&value));

    let h = keccak_hash(&value);
    msg!("Final Hash (h): 0x{}", hex::encode(h));

    let mut verified_signatures = 0;
    for i in 0..signatures.len() {
        let recovered_pubkey = secp256k1_recover(&h.to_bytes(), recovery_ids[i], &signatures[i])
            .map_err(|_| ErrorCode::SignatureVerificationFailed)?;

        let recovered_pubkey_bytes = recovered_pubkey.to_bytes();

        let pubkey_hash = keccak_hash(&recovered_pubkey_bytes);
        let eth_address = &pubkey_hash.to_bytes()[12..];

        if oracle_state
            .oracles
            .contains(&eth_address.try_into().unwrap())
        {
            verified_signatures += 1;
        }

        msg!("Recovered Ethereum address: 0x{}", hex::encode(eth_address));
    }

    require!(
        verified_signatures >= oracle_state.required_signatures,
        ErrorCode::InsufficientValidSignatures
    );

    price_feed.update_price(
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
    )?;

    emit!(PriceUpdated {
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
    });

    Ok(())
}
