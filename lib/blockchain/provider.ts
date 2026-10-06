export type DepositVerification = {
  matched: boolean;
  confirmations: number;
  network: string;
  amount: string;
};

export interface BlockchainProvider {
  getTransaction(hash: string): Promise<unknown>;
  verifyDeposit(input: { hash: string; expectedAmount: string; network: string; toAddress: string }): Promise<DepositVerification>;
  getConfirmationStatus(hash: string): Promise<{ confirmations: number; confirmed: boolean }>;
}

export class UnconfiguredBlockchainProvider implements BlockchainProvider {
  async getTransaction(): Promise<unknown> {
    throw new Error("Blockchain provider is not configured");
  }
  async verifyDeposit(): Promise<DepositVerification> {
    throw new Error("Blockchain provider is not configured");
  }
  async getConfirmationStatus(): Promise<{ confirmations: number; confirmed: boolean }> {
    throw new Error("Blockchain provider is not configured");
  }
}
