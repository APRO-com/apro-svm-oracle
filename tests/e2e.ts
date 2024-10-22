import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { AproSvm } from "../target/types/apro_svm";
import { OracleClientExample } from "../target/types/oracle_client_example";
import * as dotenv from "dotenv";
import { Keypair, PublicKey } from "@solana/web3.js";
import { ethers } from "ethers";
import { expect } from "chai";

dotenv.config();

interface ReportDataResponse {
  report: {
    configDigest: string;
    epochAndRound: number;
    extraHash: string;
    feedID: string;
    validFromTimestamp: number;
    observationsTimestamp: number;
    nativeFee: string;
    tokenFee: string;
    expireAt: number;
    benchmarkPrice: string;
    askPrice: string;
    bidPrice: string;
    signatures: string[];
    recovery_ids: number[];
  };
}

interface SanitizedReportData {
  configDigest: Uint8Array;
  epochAndRound: anchor.BN;
  extraHash: Uint8Array;
  feedID: Uint8Array;
  validFromTimestamp: anchor.BN;
  observationsTimestamp: anchor.BN;
  nativeFee: anchor.BN;
  tokenFee: anchor.BN;
  expireAt: anchor.BN;
  benchmarkPrice: anchor.BN;
  askPrice: anchor.BN;
  bidPrice: anchor.BN;
  signatures: Uint8Array[];
  recoveryIds: number[];
}

function hexToBytes(hex: string): Uint8Array {
  return ethers.getBytes(hex.startsWith("0x") ? hex : `0x${hex}`);
}

async function fetchReportData(feed: string): Promise<SanitizedReportData> {
  const resp = await fetch(
    `https://live-api.apro.com/api/soon/reports/latest?feedID=${feed}`,
    {
      method: "GET",
      headers: {
        Authorization: process.env.APRO_API_KEY,
        "X-Authorization-Timestamp": Date.now().toString(),
      },
    },
  );
  if (!resp.ok) {
    throw new Error(`Failed to fetch report data: ${resp.statusText}`);
  }
  const data = (await resp.json()) as ReportDataResponse;
  return {
    configDigest: hexToBytes(data.report.configDigest),
    epochAndRound: new anchor.BN(data.report.epochAndRound),
    extraHash: hexToBytes(data.report.extraHash),
    feedID: hexToBytes(data.report.feedID),
    validFromTimestamp: new anchor.BN(data.report.validFromTimestamp),
    observationsTimestamp: new anchor.BN(data.report.observationsTimestamp),
    nativeFee: new anchor.BN(data.report.nativeFee),
    tokenFee: new anchor.BN(data.report.tokenFee),
    expireAt: new anchor.BN(data.report.expireAt),
    benchmarkPrice: new anchor.BN(data.report.benchmarkPrice),
    askPrice: new anchor.BN(data.report.askPrice),
    bidPrice: new anchor.BN(data.report.bidPrice),
    signatures: data.report.signatures.map((sig) => hexToBytes(sig)),
    recoveryIds: data.report.recovery_ids,
  };
}

function recoverAddresses(data: SanitizedReportData): string[] {
  const abiCoder = ethers.AbiCoder.defaultAbiCoder();
  const encodedReportData = abiCoder.encode(
    [
      "bytes32",
      "uint256",
      "uint256",
      "uint256",
      "uint256",
      "uint256",
      "uint256",
      "uint256",
      "uint256",
    ],
    [
      ethers.hexlify(data.feedID),
      BigInt(data.validFromTimestamp.toString()),
      BigInt(data.observationsTimestamp.toString()),
      BigInt(data.nativeFee.toString()),
      BigInt(data.tokenFee.toString()),
      BigInt(data.expireAt.toString()),
      BigInt(data.benchmarkPrice.toString()),
      BigInt(data.askPrice.toString()),
      BigInt(data.bidPrice.toString()),
    ],
  );
  const reportDataHash = ethers.keccak256(encodedReportData);

  const encodedReportContext = abiCoder.encode(
    ["bytes32", "uint256", "bytes32"],
    [
      ethers.hexlify(data.configDigest),
      BigInt(data.epochAndRound.toString()),
      ethers.hexlify(data.extraHash),
    ],
  );
  let value = new Uint8Array(32 * 4);
  value.set(hexToBytes(reportDataHash), 0);
  value.set(hexToBytes(encodedReportContext), 32);
  const hash = ethers.keccak256(value);

  return data.signatures.map((rawSig, i) => {
    const sig = {
      r: ethers.hexlify(rawSig.slice(0, 32)),
      s: ethers.hexlify(rawSig.slice(32, 64)),
      v: data.recoveryIds[i],
    };
    return ethers.recoverAddress(hash, sig);
  });
}

describe("E2E Tests", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const oracle_program = anchor.workspace.AproSvm as Program<AproSvm>;
  const consumer_program = anchor.workspace
    .OracleClientExample as Program<OracleClientExample>;

  const rawFeedId =
    "0x0003665949c883f9e0f6f002eac32e00bd59dfe6c34e92a91c37d6a8322d6489";
  const admin = Keypair.generate();
  const oracleStateId = new anchor.BN(100);
  const requiredSignatures = new anchor.BN(2);
  const expirationPeriod = new anchor.BN(7200);

  let oracleStatePda: PublicKey;
  let consumerConfigPda: PublicKey;
  let priceFeedPda: PublicKey;

  before(async () => {
    [oracleStatePda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("oracle_state"), oracleStateId.toBuffer("le", 8)],
      oracle_program.programId,
    );
    [consumerConfigPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("config")],
      consumer_program.programId,
    );
  });

  it("Initializes the oracle", async () => {
    await oracle_program.methods
      .initializeOracle(oracleStateId, requiredSignatures, expirationPeriod)
      .accounts({
        oracleState: oracleStatePda,
        payer: provider.wallet.publicKey,
        admin: admin.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([admin])
      .rpc();

    const oracleState = await oracle_program.account.oracleState.fetch(
      oracleStatePda,
    );
    expect(oracleState.id.toNumber()).to.equal(oracleStateId.toNumber());
    expect(oracleState.requiredSignatures.toNumber()).to.equal(
      requiredSignatures.toNumber(),
    );
    expect(oracleState.expirationPeriod.toNumber()).to.equal(
      expirationPeriod.toNumber(),
    );
  });

  it("Adds known oracle addresses", async () => {
    const data = await fetchReportData(rawFeedId);
    const knownEthAddresses = recoverAddresses(data);

    for (const address of knownEthAddresses) {
      await oracle_program.methods
        .addOracle(Array.from(hexToBytes(address)))
        .accounts({
          oracleState: oracleStatePda,
          admin: admin.publicKey,
        })
        .signers([admin])
        .rpc();
    }

    const oracleState = await oracle_program.account.oracleState.fetch(
      oracleStatePda,
    );
    expect(oracleState.totalOracles.toNumber()).to.equal(
      knownEthAddresses.length,
    );
  });

  it("Updates price feed and fetches price", async () => {
    const data = await fetchReportData(rawFeedId);
    [priceFeedPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("price_feed"), oracleStatePda.toBuffer(), data.feedID],
      oracle_program.programId,
    );

    // First, update the price feed using the oracle program
    await oracle_program.methods
      .updatePrice(
        Array.from(data.feedID),
        data.validFromTimestamp,
        data.observationsTimestamp,
        data.nativeFee,
        data.tokenFee,
        data.expireAt,
        data.benchmarkPrice,
        data.askPrice,
        data.bidPrice,
        Array.from(data.configDigest),
        data.epochAndRound,
        Array.from(data.extraHash),
        data.signatures.map((sig) => [...sig]),
        Buffer.from(data.recoveryIds),
      )
      .accounts({
        oracleState: oracleStatePda,
        priceFeed: priceFeedPda,
        payer: provider.wallet.publicKey,
        admin: admin.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    // Now, fetch the price using the consumer program
    const [priceResultPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("price_result"), priceFeedPda.toBuffer()],
      consumer_program.programId,
    );

    await consumer_program.methods
      .fetchPrice()
      .accounts({
        payer: provider.wallet.publicKey,
        priceAccount: priceFeedPda,
        priceResult: priceResultPda,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    // Fetch and verify the price result
    const priceResult = await consumer_program.account.priceResult.fetch(
      priceResultPda,
    );
    expect(priceResult.price.toString()).to.equal(
      data.benchmarkPrice.toString(),
    );
    expect(priceResult.isValid).to.be.true;
  });

  it("Updates price using client example", async () => {
    const data = await fetchReportData(rawFeedId);
    [priceFeedPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("price_feed"), oracleStatePda.toBuffer(), data.feedID],
      oracle_program.programId,
    );

    const updateData = {
      feedId: Array.from(data.feedID),
      validTimeStamp: data.validFromTimestamp,
      observeTimeStamp: data.observationsTimestamp,
      nativeFee: data.nativeFee,
      aproTokenFee: data.tokenFee,
      expireAt: data.expireAt,
      benchmarkPrice: data.benchmarkPrice,
      askPrice: data.askPrice,
      bidPrice: data.bidPrice,
      configDigest: Array.from(data.configDigest),
      epochAndRound: data.epochAndRound,
      extraHash: Array.from(data.extraHash),
      signatures: data.signatures.map((sig) => [...sig]),
      recoveryIds: Buffer.from(data.recoveryIds),
    };

    await consumer_program.methods
      .updateOraclePrice(
        updateData.feedId,
        updateData.validTimeStamp,
        updateData.observeTimeStamp,
        updateData.nativeFee,
        updateData.aproTokenFee,
        updateData.expireAt,
        updateData.benchmarkPrice,
        updateData.askPrice,
        updateData.bidPrice,
        updateData.configDigest,
        updateData.epochAndRound,
        updateData.extraHash,
        updateData.signatures,
        updateData.recoveryIds,
      )
      .accounts({
        oracleState: oracleStatePda,
        priceFeed: priceFeedPda,
        payer: provider.wallet.publicKey,
        admin: admin.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
        oracleProgram: oracle_program.programId,
      })
      .rpc()
      .catch(async (error) => {
        console.error("Transaction failed!");
        if (error.logs) {
          console.error("Logs:", error.logs);
        }
        const txSignature = error.signature;
        if (txSignature) {
          try {
            const tx = await provider.connection.getTransaction(txSignature, {
              commitment: "confirmed",
              maxSupportedTransactionVersion: 0,
            });
            console.log("Full transaction info:", JSON.stringify(tx, null, 2));
          } catch (txError) {
            console.error("Error fetching transaction:", txError);
          }
        }
        throw error;
      });

    // Verify the update by fetching the price
    const [priceResultPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("price_result"), priceFeedPda.toBuffer()],
      consumer_program.programId,
    );

    await consumer_program.methods
      .fetchPrice()
      .accounts({
        payer: provider.wallet.publicKey,
        priceAccount: priceFeedPda,
        priceResult: priceResultPda,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    // Fetch and verify the price result
    const priceResult = await consumer_program.account.priceResult.fetch(
      priceResultPda,
    );
    expect(priceResult.price.toString()).to.equal(
      data.benchmarkPrice.toString(),
    );
    expect(priceResult.isValid).to.be.true;

    // Directly verify the price feed
    const priceFeed = await oracle_program.account.priceFeed.fetch(
      priceFeedPda,
    );
    expect(priceFeed.benchmarkPrice.toString()).to.equal(
      data.benchmarkPrice.toString(),
    );
    expect(priceFeed.askPrice.toString()).to.equal(data.askPrice.toString());
    expect(priceFeed.bidPrice.toString()).to.equal(data.bidPrice.toString());
  });
});
