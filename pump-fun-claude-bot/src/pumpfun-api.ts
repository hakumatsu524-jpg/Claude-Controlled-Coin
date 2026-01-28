import { config } from "./config.js";
import type { PumpFunToken } from "./types.js";

export class PumpFunAPI {
  private baseUrl: string;

  constructor() {
    this.baseUrl = config.pumpfunApiUrl;
  }

  async getToken(mintAddress: string): Promise<PumpFunToken | null> {
    try {
      const response = await fetch(`${this.baseUrl}/coins/${mintAddress}`);
      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return (await response.json()) as PumpFunToken;
    } catch (error) {
      console.error(`Error fetching token ${mintAddress}:`, error);
      return null;
    }
  }

  async getLatestTokens(
    limit: number = 50,
    offset: number = 0
  ): Promise<PumpFunToken[]> {
    try {
      const response = await fetch(
        `${this.baseUrl}/coins?offset=${offset}&limit=${limit}&sort=created_timestamp&order=DESC&includeNsfw=false`
      );
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return (await response.json()) as PumpFunToken[];
    } catch (error) {
      console.error("Error fetching latest tokens:", error);
      return [];
    }
  }

  async getKingOfTheHill(): Promise<PumpFunToken | null> {
    try {
      const response = await fetch(`${this.baseUrl}/coins/king-of-the-hill`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return (await response.json()) as PumpFunToken;
    } catch (error) {
      console.error("Error fetching king of the hill:", error);
      return null;
    }
  }

  async searchTokens(query: string): Promise<PumpFunToken[]> {
    try {
      const response = await fetch(
        `${this.baseUrl}/coins?searchTerm=${encodeURIComponent(query)}&limit=20`
      );
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return (await response.json()) as PumpFunToken[];
    } catch (error) {
      console.error(`Error searching tokens for "${query}":`, error);
      return [];
    }
  }

  async getTokensByCreator(creatorAddress: string): Promise<PumpFunToken[]> {
    try {
      const response = await fetch(
        `${this.baseUrl}/coins?creator=${creatorAddress}&limit=50`
      );
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return (await response.json()) as PumpFunToken[];
    } catch (error) {
      console.error(
        `Error fetching tokens by creator ${creatorAddress}:`,
        error
      );
      return [];
    }
  }

  async getGraduatedTokens(limit: number = 20): Promise<PumpFunToken[]> {
    try {
      const response = await fetch(
        `${this.baseUrl}/coins?complete=true&limit=${limit}&sort=usd_market_cap&order=DESC`
      );
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return (await response.json()) as PumpFunToken[];
    } catch (error) {
      console.error("Error fetching graduated tokens:", error);
      return [];
    }
  }

  calculatePrice(token: PumpFunToken): number {
    if (token.virtual_token_reserves === 0) return 0;
    return token.virtual_sol_reserves / token.virtual_token_reserves;
  }

  calculateMarketCapSol(token: PumpFunToken): number {
    const price = this.calculatePrice(token);
    return price * token.total_supply;
  }
}
