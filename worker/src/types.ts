export interface Env {
  DB: D1Database;
  RPC_URL?: string;
  ESCROW_CONTRACT_ADDRESS?: `0x${string}`;
  ORACLE_PRIVATE_KEY?: `0x${string}`;
  ADMIN_API_TOKEN?: string;
  APP_ATTEST_MODE?: string;
  DEV_ATTEST_TOKEN?: string;
  CHAIN_ID?: string;
}

export type GoalKind = "screen_time" | "steps";
export type ProofOutcome = "success" | "failure";

export interface CommitmentRow {
  id: string;
  user_wallet: string;
  failure_recipient: string;
  token_address: string;
  amount: string;
  goal_kind: GoalKind;
  goal_hash: string;
  target_value: number;
  starts_at: string;
  ends_at: string;
  proof_due_at: string;
  timezone: string;
  status: string;
  funding_tx_hash: string | null;
  contract_address: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProofRow {
  id: string;
  commitment_id: string;
  outcome: ProofOutcome;
  observed_value: number | null;
  reason: string | null;
  payload_hash: string;
  submitted_at: string;
  device_id: string | null;
}
