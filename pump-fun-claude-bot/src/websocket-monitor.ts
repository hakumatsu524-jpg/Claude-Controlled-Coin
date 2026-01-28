import WebSocket from "ws";
import { config } from "./config.js";
import type { NewTokenEvent, TradeEvent } from "./types.js";

type EventCallback<T> = (event: T) => void;

export class PumpFunWebSocket {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private onNewToken: EventCallback<NewTokenEvent> | null = null;
  private onTrade: EventCallback<TradeEvent> | null = null;
  private subscribedTokens: Set<string> = new Set();
  private isConnected = false;

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(config.pumpfunWsUrl);

        this.ws.on("open", () => {
          console.log("Connected to pump.fun WebSocket");
          this.isConnected = true;
          this.reconnectAttempts = 0;
          resolve();
        });

        this.ws.on("message", (data: WebSocket.Data) => {
          try {
            const message = JSON.parse(data.toString());
            this.handleMessage(message);
          } catch (error) {
            console.error("Error parsing WebSocket message:", error);
          }
        });

        this.ws.on("close", () => {
          console.log("WebSocket connection closed");
          this.isConnected = false;
          this.attemptReconnect();
        });

        this.ws.on("error", (error) => {
          console.error("WebSocket error:", error);
          if (!this.isConnected) {
            reject(error);
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  private handleMessage(message: { txType?: string } & Record<string, unknown>): void {
    if (message.txType === "create" && this.onNewToken) {
      this.onNewToken(message as unknown as NewTokenEvent);
    } else if (
      (message.txType === "buy" || message.txType === "sell") &&
      this.onTrade
    ) {
      this.onTrade(message as unknown as TradeEvent);
    }
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error("Max reconnection attempts reached");
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    console.log(`Attempting to reconnect in ${delay / 1000}s...`);

    setTimeout(() => {
      this.connect().catch((error) => {
        console.error("Reconnection failed:", error);
      });
    }, delay);
  }

  subscribeToNewTokens(callback: EventCallback<NewTokenEvent>): void {
    this.onNewToken = callback;
    if (this.ws && this.isConnected) {
      this.ws.send(
        JSON.stringify({
          method: "subscribeNewToken",
        })
      );
      console.log("Subscribed to new token events");
    }
  }

  subscribeToToken(mintAddress: string, callback?: EventCallback<TradeEvent>): void {
    if (callback) {
      this.onTrade = callback;
    }
    this.subscribedTokens.add(mintAddress);
    if (this.ws && this.isConnected) {
      this.ws.send(
        JSON.stringify({
          method: "subscribeTokenTrade",
          keys: [mintAddress],
        })
      );
      console.log(`Subscribed to trades for token: ${mintAddress}`);
    }
  }

  unsubscribeFromToken(mintAddress: string): void {
    this.subscribedTokens.delete(mintAddress);
    if (this.ws && this.isConnected) {
      this.ws.send(
        JSON.stringify({
          method: "unsubscribeTokenTrade",
          keys: [mintAddress],
        })
      );
      console.log(`Unsubscribed from token: ${mintAddress}`);
    }
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
      this.isConnected = false;
      console.log("Disconnected from WebSocket");
    }
  }
}
