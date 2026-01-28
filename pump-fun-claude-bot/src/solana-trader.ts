import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import bs58 from "bs58";
import { config } from "./config.js";
import type { TradeResult, PumpFunToken } from "./types.js";

// Pump.fun program constants
const PUMP_FUN_PROGRAM_ID = new PublicKey(
  "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P"
);
const PUMP_FUN_FEE_RECIPIENT = new PublicKey(
  "CebN5WGQ4jvEPvsVU4EoHEpgzq1VV7AbCJtGpGYKLXYi"
);
const PUMP_GLOBAL_STATE = new PublicKey(
  "4wTV1YmiEkRvAtNtsSGPtUrqRYQMe5SKy2uB4Jjaxnjf"
);

export class SolanaTrader {
  private connection: Connection;
  private wallet: Keypair | null = null;

  constructor() {
    this.connection = new Connection(config.solanaRpcUrl, "confirmed");
  }

  initializeWallet(): void {
    if (!config.solanaPrivateKey) {
      throw new Error("SOLANA_PRIVATE_KEY not configured");
    }
    try {
      const secretKey = bs58.decode(config.solanaPrivateKey);
      this.wallet = Keypair.fromSecretKey(secretKey);
      console.log(`Wallet initialized: ${this.wallet.publicKey.toBase58()}`);
    } catch {
      throw new Error("Invalid private key format");
    }
  }

  async getBalance(): Promise<number> {
    if (!this.wallet) {
      throw new Error("Wallet not initialized");
    }
    const balance = await this.connection.getBalance(this.wallet.publicKey);
    return balance / LAMPORTS_PER_SOL;
  }

  async getTokenBalance(mintAddress: string): Promise<number> {
    if (!this.wallet) {
      throw new Error("Wallet not initialized");
    }
    try {
      const mint = new PublicKey(mintAddress);
      const ata = await getAssociatedTokenAddress(mint, this.wallet.publicKey);
      const balance = await this.connection.getTokenAccountBalance(ata);
      return parseFloat(balance.value.uiAmountString || "0");
    } catch {
      return 0;
    }
  }

  async buyToken(
    token: PumpFunToken,
    solAmount: number
  ): Promise<TradeResult> {
    if (!this.wallet) {
      return { success: false, error: "Wallet not initialized", amountIn: solAmount };
    }

    if (solAmount > config.maxBuyAmount) {
      return {
        success: false,
        error: `Amount exceeds max buy limit of ${config.maxBuyAmount} SOL`,
        amountIn: solAmount,
      };
    }

    try {
      const mint = new PublicKey(token.mint);
      const bondingCurve = new PublicKey(token.bonding_curve);
      const associatedBondingCurve = new PublicKey(
        token.associated_bonding_curve
      );

      // Get or create associated token account
      const ata = await getAssociatedTokenAddress(mint, this.wallet.publicKey);

      // Check if ATA exists
      const ataInfo = await this.connection.getAccountInfo(ata);
      const instructions: TransactionInstruction[] = [];

      if (!ataInfo) {
        instructions.push(
          createAssociatedTokenAccountInstruction(
            this.wallet.publicKey,
            ata,
            this.wallet.publicKey,
            mint
          )
        );
      }

      // Calculate expected tokens with slippage
      const lamports = Math.floor(solAmount * LAMPORTS_PER_SOL);
      const expectedTokens = this.calculateExpectedTokens(
        lamports,
        token.virtual_sol_reserves,
        token.virtual_token_reserves
      );
      const minTokens = Math.floor(
        expectedTokens * (1 - config.slippageBps / 10000)
      );

      // Build buy instruction
      const buyInstruction = this.buildBuyInstruction(
        this.wallet.publicKey,
        mint,
        bondingCurve,
        associatedBondingCurve,
        ata,
        lamports,
        minTokens
      );
      instructions.push(buyInstruction);

      // Create and send transaction
      const transaction = new Transaction().add(...instructions);
      const { blockhash, lastValidBlockHeight } =
        await this.connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = this.wallet.publicKey;

      const signature = await sendAndConfirmTransaction(
        this.connection,
        transaction,
        [this.wallet],
        { commitment: "confirmed" }
      );

      return {
        success: true,
        signature,
        amountIn: solAmount,
        amountOut: expectedTokens / 1e6,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        amountIn: solAmount,
      };
    }
  }

  async sellToken(
    token: PumpFunToken,
    tokenAmount: number
  ): Promise<TradeResult> {
    if (!this.wallet) {
      return { success: false, error: "Wallet not initialized", amountIn: tokenAmount };
    }

    try {
      const mint = new PublicKey(token.mint);
      const bondingCurve = new PublicKey(token.bonding_curve);
      const associatedBondingCurve = new PublicKey(
        token.associated_bonding_curve
      );
      const ata = await getAssociatedTokenAddress(mint, this.wallet.publicKey);

      // Calculate expected SOL with slippage
      const tokenLamports = Math.floor(tokenAmount * 1e6);
      const expectedSol = this.calculateExpectedSol(
        tokenLamports,
        token.virtual_sol_reserves,
        token.virtual_token_reserves
      );
      const minSol = Math.floor(expectedSol * (1 - config.slippageBps / 10000));

      // Build sell instruction
      const sellInstruction = this.buildSellInstruction(
        this.wallet.publicKey,
        mint,
        bondingCurve,
        associatedBondingCurve,
        ata,
        tokenLamports,
        minSol
      );

      const transaction = new Transaction().add(sellInstruction);
      const { blockhash } = await this.connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = this.wallet.publicKey;

      const signature = await sendAndConfirmTransaction(
        this.connection,
        transaction,
        [this.wallet],
        { commitment: "confirmed" }
      );

      return {
        success: true,
        signature,
        amountIn: tokenAmount,
        amountOut: expectedSol / LAMPORTS_PER_SOL,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        amountIn: tokenAmount,
      };
    }
  }

  private calculateExpectedTokens(
    solLamports: number,
    virtualSolReserves: number,
    virtualTokenReserves: number
  ): number {
    // Constant product formula: x * y = k
    const k = virtualSolReserves * virtualTokenReserves;
    const newSolReserves = virtualSolReserves + solLamports;
    const newTokenReserves = k / newSolReserves;
    return virtualTokenReserves - newTokenReserves;
  }

  private calculateExpectedSol(
    tokenLamports: number,
    virtualSolReserves: number,
    virtualTokenReserves: number
  ): number {
    const k = virtualSolReserves * virtualTokenReserves;
    const newTokenReserves = virtualTokenReserves + tokenLamports;
    const newSolReserves = k / newTokenReserves;
    return virtualSolReserves - newSolReserves;
  }

  private buildBuyInstruction(
    buyer: PublicKey,
    mint: PublicKey,
    bondingCurve: PublicKey,
    associatedBondingCurve: PublicKey,
    buyerAta: PublicKey,
    solAmount: number,
    minTokens: number
  ): TransactionInstruction {
    // Pump.fun buy instruction discriminator
    const discriminator = Buffer.from([102, 6, 61, 18, 1, 218, 235, 234]);

    const data = Buffer.alloc(24);
    discriminator.copy(data, 0);
    data.writeBigUInt64LE(BigInt(minTokens), 8);
    data.writeBigUInt64LE(BigInt(solAmount), 16);

    return new TransactionInstruction({
      programId: PUMP_FUN_PROGRAM_ID,
      keys: [
        { pubkey: PUMP_GLOBAL_STATE, isSigner: false, isWritable: false },
        { pubkey: PUMP_FUN_FEE_RECIPIENT, isSigner: false, isWritable: true },
        { pubkey: mint, isSigner: false, isWritable: false },
        { pubkey: bondingCurve, isSigner: false, isWritable: true },
        { pubkey: associatedBondingCurve, isSigner: false, isWritable: true },
        { pubkey: buyerAta, isSigner: false, isWritable: true },
        { pubkey: buyer, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      ],
      data,
    });
  }

  private buildSellInstruction(
    seller: PublicKey,
    mint: PublicKey,
    bondingCurve: PublicKey,
    associatedBondingCurve: PublicKey,
    sellerAta: PublicKey,
    tokenAmount: number,
    minSol: number
  ): TransactionInstruction {
    // Pump.fun sell instruction discriminator
    const discriminator = Buffer.from([51, 230, 133, 164, 1, 127, 131, 173]);

    const data = Buffer.alloc(24);
    discriminator.copy(data, 0);
    data.writeBigUInt64LE(BigInt(tokenAmount), 8);
    data.writeBigUInt64LE(BigInt(minSol), 16);

    return new TransactionInstruction({
      programId: PUMP_FUN_PROGRAM_ID,
      keys: [
        { pubkey: PUMP_GLOBAL_STATE, isSigner: false, isWritable: false },
        { pubkey: PUMP_FUN_FEE_RECIPIENT, isSigner: false, isWritable: true },
        { pubkey: mint, isSigner: false, isWritable: false },
        { pubkey: bondingCurve, isSigner: false, isWritable: true },
        { pubkey: associatedBondingCurve, isSigner: false, isWritable: true },
        { pubkey: sellerAta, isSigner: false, isWritable: true },
        { pubkey: seller, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      ],
      data,
    });
  }
}
