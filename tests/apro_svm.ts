import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { AproSvm } from "../target/types/apro_svm";
import { PublicKey, Keypair } from "@solana/web3.js";
import { expect } from "chai";

describe("apro_svm", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.AproSvm as Program<AproSvm>;

  function hexToUint8Array(hex: string): Uint8Array {
    return Uint8Array.from(
      Buffer.from(hex.startsWith("0x") ? hex.slice(2) : hex, "hex"),
    );
  }

  const feedId = hexToUint8Array(
    "0003481a2f7fe21c01d427f39035541d2b7a53db9c76234dc36082e6ad6db715",
  );
  const validTimeStamp = new anchor.BN("66d9b95a", 16);
  const observeTimeStamp = new anchor.BN("66d9b978", 16);
  const nativeFee = new anchor.BN("0");
  const aproTokenFee = new anchor.BN("9d3e42ba92c434", 16);
  const expireAt = new anchor.BN("66db0af8", 16);
  const benchmarkPrice = new anchor.BN("c8ac3d633c260000", 16);
  const askPrice = new anchor.BN("d02ab486cedc0000", 16);
  const bidPrice = new anchor.BN("b469471f80140000", 16);

  const configDigest = hexToUint8Array(
    "0006617ef4c220df2746eef29f64201d7bdc132fe4438080fd5c1ae4102c23e9",
  );
  const epochAndRound = new anchor.BN("1c8603", 16);
  const extraHash = hexToUint8Array(
    "0000000000000000000000000000000000000000000000000000000000000000",
  );

  const signatures = [
    hexToUint8Array(
      "9f386ef5a0bfca8657a207df1cf333db7692f394da295f9a8cbbee4f80301c3a3d496f8de416accbbd819b48b956ac1fcd676700984fa6ad04968d0a4d1c9cfb",
    ),
    hexToUint8Array(
      "740aa23c9c2a193fbd253d1416b54ec73ecb731b303523ca4492f7c491444b5b123337455b202b6e7fde1a7213224a7065f72299e2a334c68b5b4b05636cf8b7",
    ),
  ];
  const recoveryIds = Buffer.from([0, 0]);
  const expectedEthAddresses = [
    hexToUint8Array("8664c5b40fd6491c308833d4916c48531c437110"),
    hexToUint8Array("0060c22f693a7023f4ab0f484b234a55b1fd0feb"),
  ];

  async function setupOracleState(
    oracleStateId: anchor.BN,
    requiredSignatures: anchor.BN,
    expirationPeriod: anchor.BN,
    admin: Keypair,
  ): Promise<{ oracleStatePda: PublicKey }> {
    const [oracleStatePda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("oracle_state"), oracleStateId.toBuffer("le", 8)],
      program.programId,
    );

    await program.methods
      .initializeOracle(oracleStateId, requiredSignatures, expirationPeriod)
      .accounts({
        oracleState: oracleStatePda,
        payer: provider.wallet.publicKey,
        admin: admin.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([admin])
      .rpc();

    for (const ethAddress of expectedEthAddresses) {
      await program.methods
        .addOracle(ethAddress)
        .accounts({
          oracleState: oracleStatePda,
          admin: admin.publicKey,
        })
        .signers([admin])
        .rpc();
    }

    return { oracleStatePda };
  }

  it("Initializes the oracle state successfully", async () => {
    const admin = Keypair.generate();
    const oracleStateId = new anchor.BN(1);
    const requiredSignatures = new anchor.BN(2);
    const expirationPeriod = new anchor.BN(7200);

    const { oracleStatePda } = await setupOracleState(
      oracleStateId,
      requiredSignatures,
      expirationPeriod,
      admin,
    );

    const oracleState = await program.account.oracleState.fetch(oracleStatePda);
    expect(oracleState.id.toNumber()).to.equal(1);
    expect(oracleState.requiredSignatures.toNumber()).to.equal(2);
    expect(oracleState.expirationPeriod.toNumber()).to.equal(7200);
    expect(oracleState.totalOracles.toNumber()).to.equal(2);

    expect(oracleState.oracles.length).to.equal(expectedEthAddresses.length);
    oracleState.oracles.forEach((oracle, index) => {
      expect(Buffer.from(oracle).toString("hex")).to.equal(
        Buffer.from(expectedEthAddresses[index]).toString("hex"),
      );
    });

    expect(oracleState.admin.toBase58()).to.equal(admin.publicKey.toBase58());
  });

  it("Updates price successfully", async () => {
    const admin = Keypair.generate();
    const oracleStateId = new anchor.BN(2);
    const requiredSignatures = new anchor.BN(2);
    const expirationPeriod = new anchor.BN(3600);

    const { oracleStatePda } = await setupOracleState(
      oracleStateId,
      requiredSignatures,
      expirationPeriod,
      admin,
    );

    const [priceFeedPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("price_feed"), oracleStatePda.toBuffer(), feedId],
      program.programId,
    );

    await program.methods
      .updatePrice(
        feedId,
        validTimeStamp,
        observeTimeStamp,
        nativeFee,
        aproTokenFee,
        expireAt,
        benchmarkPrice,
        askPrice,
        bidPrice,
        configDigest,
        epochAndRound,
        extraHash,
        signatures,
        recoveryIds,
      )
      .accounts({
        oracleState: oracleStatePda,
        priceFeed: priceFeedPda,
        payer: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const priceFeed = await program.account.priceFeed.fetch(priceFeedPda);

    expect(Uint8Array.from(priceFeed.feedId)).to.deep.equal(feedId);
    expect(priceFeed.validTimeStamp.toString()).to.equal(
      validTimeStamp.toString(),
    );
    expect(priceFeed.observeTimeStamp.toString()).to.equal(
      observeTimeStamp.toString(),
    );
    expect(priceFeed.nativeFee.toString()).to.equal(nativeFee.toString());
    expect(priceFeed.aproTokenFee.toString()).to.equal(aproTokenFee.toString());
    expect(priceFeed.expireAt.toString()).to.equal(expireAt.toString());
    expect(priceFeed.benchmarkPrice.toString()).to.equal(
      benchmarkPrice.toString(),
    );
    expect(priceFeed.askPrice.toString()).to.equal(askPrice.toString());
    expect(priceFeed.bidPrice.toString()).to.equal(bidPrice.toString());
    expect(Uint8Array.from(priceFeed.configDigest)).to.deep.equal(configDigest);
    expect(priceFeed.epochAndRound.toString()).to.equal(
      epochAndRound.toString(),
    );
    expect(Uint8Array.from(priceFeed.extraHash)).to.deep.equal(extraHash);
  });

  it("Fails to update price with insufficient signatures", async () => {
    const admin = Keypair.generate();
    const oracleStateId = new anchor.BN(3);
    const requiredSignatures = new anchor.BN(3);
    const expirationPeriod = new anchor.BN(3600);

    const { oracleStatePda } = await setupOracleState(
      oracleStateId,
      requiredSignatures,
      expirationPeriod,
      admin,
    );

    const [priceFeedPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("price_feed"), oracleStatePda.toBuffer(), feedId],
      program.programId,
    );

    try {
      await program.methods
        .updatePrice(
          feedId,
          validTimeStamp,
          observeTimeStamp,
          nativeFee,
          aproTokenFee,
          expireAt,
          benchmarkPrice,
          askPrice,
          bidPrice,
          configDigest,
          epochAndRound,
          extraHash,
          signatures,
          recoveryIds,
        )
        .accounts({
          oracleState: oracleStatePda,
          priceFeed: priceFeedPda,
          payer: provider.wallet.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();
      expect.fail("Expected an error but none was thrown");
    } catch (error) {
      expect(error.error.errorCode.code).to.equal("InsufficientSignatures");
    }
  });

  it("Updates admin successfully", async () => {
    const admin = Keypair.generate();
    const newAdmin = Keypair.generate();
    const oracleStateId = new anchor.BN(4);
    const requiredSignatures = new anchor.BN(2);
    const expirationPeriod = new anchor.BN(3600);

    const { oracleStatePda } = await setupOracleState(
      oracleStateId,
      requiredSignatures,
      expirationPeriod,
      admin,
    );

    await program.methods
      .updateAdmin(newAdmin.publicKey)
      .accounts({
        oracleState: oracleStatePda,
        admin: admin.publicKey,
      })
      .signers([admin])
      .rpc();

    const updatedOracleState = await program.account.oracleState.fetch(
      oracleStatePda,
    );
    expect(updatedOracleState.admin.toBase58()).to.equal(
      newAdmin.publicKey.toBase58(),
    );
  });
});
