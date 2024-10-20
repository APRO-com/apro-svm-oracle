import * as anchor from "@coral-xyz/anchor";
import {Program} from "@coral-xyz/anchor";
import {AproSvm} from "../target/types/apro_svm";
import {OracleConsumerExample} from "../target/types/oracle_consumer_example"
import * as dotenv from "dotenv";
import {Keypair} from "@solana/web3.js";
import {ethers} from "ethers";

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
    }
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
    return ethers.getBytes(hex.startsWith("0x") ? hex : `0x${hex}`)
}

async function fetchReportData(feed: string): Promise<SanitizedReportData> {
    const resp = await fetch(`https://live-api.apro.com/api/soon/reports/latest?feedID=${feed}`, {
        method: "GET",
        headers: {
            "Authorization": process.env.APRO_API_KEY,
            "X-Authorization-Timestamp": Date.now().toString(),
        },
    });
    if (!resp.ok) {
        throw new Error(`Failed to fetch report data: ${resp.statusText}`);
    }
    const data = await resp.json() as ReportDataResponse;
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
    }
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
        }
        return ethers.recoverAddress(hash, sig)
    })
}

async function main() {
    const provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);

    const oracle_program = anchor.workspace.AproSvm as Program<AproSvm>;
    const consumer_program = anchor.workspace.OracleConsumerExample as Program<OracleConsumerExample>;
    const rawFeedId = "0x0003665949c883f9e0f6f002eac32e00bd59dfe6c34e92a91c37d6a8322d6489";
    const admin = Keypair.generate();
    const oracleStateId = new anchor.BN(1);
    const requiredSignatures = new anchor.BN(2);
    const expirationPeriod = new anchor.BN(7200);
    const [oracleStatePda] = anchor.web3.PublicKey.findProgramAddressSync(
        [
            Buffer.from("oracle_state"),
            oracleStateId.toBuffer("le", 8),
        ],
        oracle_program.programId,
    );
    const [consumerConfigPda] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("config")],
        consumer_program.programId,
    );

    // Initialize oracle
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

    // Initialize consumer
    await consumer_program.methods
        .initialize()
        .accounts({
            payer: provider.wallet.publicKey,
            config: consumerConfigPda,
            oracleState: oracleStatePda,
            systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();

    // Fetch report data from API
    const data = await fetchReportData(rawFeedId);
    const knownEthAddresses = recoverAddresses(data);
    if (knownEthAddresses.length < 2) {
        throw new Error("Invalid number of oracle addresses");
    }

    // Add the known oracle addresses by admin
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

    // Update price feed by user
    const [priceFeedPda] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("price_feed"), oracleStatePda.toBuffer(), data.feedID],
        oracle_program.programId,
    );
    const feedId = Array.from(data.feedID);
    // prepare instruction for oracle update price
    const preInstruction = await oracle_program.methods
        .updatePrice(
            feedId,
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
            systemProgram: anchor.web3.SystemProgram.programId,
        })
        .instruction();
    // insert preInstruction in user's transaction
    await consumer_program.methods
        .fetchPrice(feedId)
        .preInstructions([preInstruction])
        .accounts({
            payer: provider.wallet.publicKey,
            config: consumerConfigPda,
            priceFeed: priceFeedPda,
            clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
        })
        .rpc({
            skipPreflight: false,
        });
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
})