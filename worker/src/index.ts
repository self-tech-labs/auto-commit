import { ZodError } from "zod";
import { sendSettlement, verifyFundingEvent } from "./chain";
import { HttpError, json, optionsResponse, readJson } from "./http";
import {
  commitmentIdFor,
  fundingSchema,
  normalizeCreateCommitment,
  normalizeProof,
  proofPayloadHash
} from "./validation";
import type { CommitmentRow, Env, ProofOutcome, ProofRow } from "./types";

const ACTIVE_STATUSES = [
  "draft",
  "funded",
  "proven_success",
  "proven_failure",
  "settling"
];

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") return optionsResponse();

    try {
      return await route(request, env);
    } catch (error) {
      return errorResponse(error);
    }
  },

  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(runSettlementCycle(env));
  }
} satisfies ExportedHandler<Env>;

async function route(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;

  if (request.method === "GET" && path === "/health") {
    return json({ ok: true });
  }

  if (request.method === "POST" && path === "/v1/commitments") {
    await requireAppAttestIfEnabled(request, env);
    return createCommitment(request, env);
  }

  const commitmentMatch = path.match(/^\/v1\/commitments\/(0x[a-fA-F0-9]{64})$/);
  if (request.method === "GET" && commitmentMatch) {
    return getCommitment(env, commitmentMatch[1] as `0x${string}`);
  }

  const fundingMatch = path.match(/^\/v1\/commitments\/(0x[a-fA-F0-9]{64})\/funding$/);
  if (request.method === "POST" && fundingMatch) {
    await requireAppAttestIfEnabled(request, env);
    return verifyFunding(request, env, fundingMatch[1] as `0x${string}`);
  }

  if (request.method === "POST" && path === "/v1/proofs") {
    await requireAppAttestIfEnabled(request, env);
    return submitProof(request, env);
  }

  const settleMatch = path.match(/^\/v1\/admin\/commitments\/(0x[a-fA-F0-9]{64})\/settle$/);
  if (request.method === "POST" && settleMatch) {
    requireAdminAuth(request, env);
    return settleOne(env, settleMatch[1] as `0x${string}`);
  }

  throw new HttpError(404, "Not found");
}

async function createCommitment(request: Request, env: Env): Promise<Response> {
  const input = normalizeCreateCommitment(await readJson(request));
  const now = new Date().toISOString();
  const active = await env.DB.prepare(
    `SELECT id FROM commitments
     WHERE user_wallet = ? AND status IN (${ACTIVE_STATUSES.map(() => "?").join(",")})
     LIMIT 1`
  )
    .bind(input.userWallet, ...ACTIVE_STATUSES)
    .first<{ id: string }>();

  if (active) {
    throw new HttpError(409, "User already has an active commitment", { commitmentId: active.id });
  }

  const id = commitmentIdFor(`${input.userWallet}:${input.startsAt}:${crypto.randomUUID()}`);

  await env.DB.batch([
    env.DB.prepare("INSERT OR IGNORE INTO users (wallet_address, created_at) VALUES (?, ?)").bind(
      input.userWallet,
      now
    ),
    env.DB.prepare(
      `INSERT INTO commitments (
        id, user_wallet, failure_recipient, token_address, amount, goal_kind, goal_hash,
        target_value, starts_at, ends_at, proof_due_at, timezone, status, contract_address,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?)`
    ).bind(
      id,
      input.userWallet,
      input.failureRecipient,
      input.tokenAddress,
      input.amount,
      input.goalKind,
      input.goalHash,
      input.targetValue,
      input.startsAt,
      input.endsAt,
      input.proofDueAt,
      input.timezone,
      env.ESCROW_CONTRACT_ADDRESS ?? null,
      now,
      now
    )
  ]);

  return json({ commitmentId: id, proofDueAt: input.proofDueAt, status: "draft" }, 201);
}

async function getCommitment(env: Env, commitmentId: `0x${string}`): Promise<Response> {
  const commitment = await loadCommitment(env, commitmentId);
  const proof = await env.DB.prepare("SELECT * FROM proof_events WHERE commitment_id = ?")
    .bind(commitmentId)
    .first<ProofRow>();

  return json({ commitment: toPublicCommitment(commitment), proof: proof ? toPublicProof(proof) : null });
}

async function verifyFunding(
  request: Request,
  env: Env,
  commitmentId: `0x${string}`
): Promise<Response> {
  const input = fundingSchema.parse(await readJson(request));
  const commitment = await loadCommitment(env, commitmentId);
  if (commitment.status !== "draft") {
    const proof = await loadProof(env, commitmentId);
    return json({ commitment: toPublicCommitment(commitment), proof: proof ? toPublicProof(proof) : null });
  }

  const funding = await verifyFundingEvent(env, commitmentId, input.txHash as `0x${string}`);
  if (funding.creator.toLowerCase() !== commitment.user_wallet.toLowerCase()) {
    throw new HttpError(422, "Funding creator does not match commitment draft");
  }
  if (funding.token.toLowerCase() !== commitment.token_address.toLowerCase()) {
    throw new HttpError(422, "Funding token does not match commitment draft");
  }
  if (funding.amount !== commitment.amount) {
    throw new HttpError(422, "Funding amount does not match commitment draft");
  }
  if (funding.successRecipient.toLowerCase() !== commitment.user_wallet.toLowerCase()) {
    throw new HttpError(422, "Funding success recipient does not match commitment draft");
  }
  if (funding.failureRecipient.toLowerCase() !== commitment.failure_recipient.toLowerCase()) {
    throw new HttpError(422, "Funding failure recipient does not match commitment draft");
  }
  if (funding.goalHash.toLowerCase() !== commitment.goal_hash.toLowerCase()) {
    throw new HttpError(422, "Funding goal hash does not match commitment draft");
  }
  if (funding.startsAt !== unixSeconds(commitment.starts_at)) {
    throw new HttpError(422, "Funding start time does not match commitment draft");
  }
  if (funding.endsAt !== unixSeconds(commitment.ends_at)) {
    throw new HttpError(422, "Funding end time does not match commitment draft");
  }
  if (funding.proofDueAt !== unixSeconds(commitment.proof_due_at)) {
    throw new HttpError(422, "Funding proof deadline does not match commitment draft");
  }

  const now = new Date().toISOString();
  await env.DB.prepare(
    `UPDATE commitments
     SET status = 'funded', funding_tx_hash = ?, updated_at = ?
     WHERE id = ?`
  )
    .bind(input.txHash, now, commitmentId)
    .run();

  const updated = await loadCommitment(env, commitmentId);
  return json({ commitment: toPublicCommitment(updated), proof: null, funding });
}

async function submitProof(request: Request, env: Env): Promise<Response> {
  const raw = await readJson(request);
  const input = normalizeProof(raw);
  const commitment = await loadCommitment(env, input.commitmentId as `0x${string}`);

  if (!["funded", "proven_success", "proven_failure"].includes(commitment.status)) {
    throw new HttpError(409, "Commitment is not ready for proof submission", {
      status: commitment.status
    });
  }

  const existing = await env.DB.prepare("SELECT * FROM proof_events WHERE commitment_id = ?")
    .bind(input.commitmentId)
    .first<ProofRow>();
  if (existing) {
    if (existing.outcome === input.outcome) {
      return json({ commitmentId: input.commitmentId, status: commitment.status, proof: existing });
    }
    throw new HttpError(409, "A conflicting proof already exists");
  }

  if (input.outcome === "success" && new Date(input.collectedAt) < new Date(commitment.ends_at)) {
    throw new HttpError(422, "Success proofs can only be submitted after the goal window ends");
  }

  const proofId = crypto.randomUUID();
  const submittedAt = new Date().toISOString();
  const payloadHash = proofPayloadHash(raw);
  const nextStatus = input.outcome === "success" ? "proven_success" : "proven_failure";

  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO proof_events (
        id, commitment_id, outcome, observed_value, reason, payload_hash, submitted_at, device_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      proofId,
      input.commitmentId,
      input.outcome,
      input.observedValue ?? null,
      input.reason ?? null,
      payloadHash,
      submittedAt,
      input.deviceId ?? null
    ),
    env.DB.prepare("UPDATE commitments SET status = ?, updated_at = ? WHERE id = ?").bind(
      nextStatus,
      submittedAt,
      input.commitmentId
    )
  ]);

  return json({
    commitmentId: input.commitmentId,
    status: nextStatus,
    proof: { id: proofId, outcome: input.outcome, payloadHash, submittedAt }
  });
}

async function settleOne(env: Env, commitmentId: `0x${string}`): Promise<Response> {
  const result = await settleCommitment(env, commitmentId);
  return json(result);
}

async function runSettlementCycle(env: Env): Promise<void> {
  await markMissingProofsAsFailures(env);

  const pending = await env.DB.prepare(
    `SELECT * FROM commitments
     WHERE status IN ('proven_success', 'proven_failure')
     ORDER BY updated_at ASC
     LIMIT 25`
  ).all<CommitmentRow>();

  await Promise.allSettled(pending.results.map((row) => settleCommitment(env, row.id as `0x${string}`)));
}

async function markMissingProofsAsFailures(env: Env): Promise<void> {
  const now = new Date().toISOString();
  const due = await env.DB.prepare(
    `SELECT * FROM commitments
     WHERE status = 'funded' AND proof_due_at <= ?
     LIMIT 50`
  )
    .bind(now)
    .all<CommitmentRow>();

  for (const commitment of due.results) {
    const proofId = crypto.randomUUID();
    await env.DB.batch([
      env.DB.prepare(
        `INSERT OR IGNORE INTO proof_events (
          id, commitment_id, outcome, observed_value, reason, payload_hash, submitted_at, device_id
        ) VALUES (?, ?, 'failure', NULL, 'missing_proof_after_grace', ?, ?, NULL)`
      ).bind(proofId, commitment.id, proofPayloadHash({ commitmentId: commitment.id, missing: true }), now),
      env.DB.prepare("UPDATE commitments SET status = 'proven_failure', updated_at = ? WHERE id = ?").bind(
        now,
        commitment.id
      )
    ]);
  }
}

async function settleCommitment(env: Env, commitmentId: `0x${string}`) {
  const commitment = await loadCommitment(env, commitmentId);
  if (!["proven_success", "proven_failure"].includes(commitment.status)) {
    throw new HttpError(409, "Commitment is not settleable", { status: commitment.status });
  }

  const outcome: ProofOutcome = commitment.status === "proven_success" ? "success" : "failure";
  const attemptId = crypto.randomUUID();
  const now = new Date().toISOString();

  await env.DB.prepare("UPDATE commitments SET status = 'settling', updated_at = ? WHERE id = ?")
    .bind(now, commitmentId)
    .run();

  try {
    const txHash = await sendSettlement(env, commitmentId, outcome);
    const settledStatus = outcome === "success" ? "settled_success" : "settled_failure";
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO settlement_attempts (
          id, commitment_id, outcome, tx_hash, error, status, created_at
        ) VALUES (?, ?, ?, ?, NULL, 'submitted', ?)`
      ).bind(attemptId, commitmentId, outcome, txHash, now),
      env.DB.prepare("UPDATE commitments SET status = ?, updated_at = ? WHERE id = ?").bind(
        settledStatus,
        new Date().toISOString(),
        commitmentId
      )
    ]);
    return { commitmentId, outcome, txHash, status: settledStatus };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown settlement error";
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO settlement_attempts (
          id, commitment_id, outcome, tx_hash, error, status, created_at
        ) VALUES (?, ?, ?, NULL, ?, 'failed', ?)`
      ).bind(attemptId, commitmentId, outcome, message, now),
      env.DB.prepare("UPDATE commitments SET status = ?, updated_at = ? WHERE id = ?").bind(
        commitment.status,
        new Date().toISOString(),
        commitmentId
      )
    ]);
    throw error;
  }
}

async function loadCommitment(env: Env, commitmentId: `0x${string}`): Promise<CommitmentRow> {
  const commitment = await env.DB.prepare("SELECT * FROM commitments WHERE id = ?")
    .bind(commitmentId)
    .first<CommitmentRow>();
  if (!commitment) throw new HttpError(404, "Commitment not found");
  return commitment;
}

async function loadProof(env: Env, commitmentId: `0x${string}`): Promise<ProofRow | null> {
  return env.DB.prepare("SELECT * FROM proof_events WHERE commitment_id = ?")
    .bind(commitmentId)
    .first<ProofRow>();
}

function requireAdminAuth(request: Request, env: Env): void {
  const expected = env.ADMIN_API_TOKEN;
  if (!expected) {
    throw new HttpError(503, "Admin API token is not configured");
  }

  const authorization = request.headers.get("authorization") ?? "";
  const bearer = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
  const token = bearer ?? request.headers.get("x-admin-token");

  if (token !== expected) {
    throw new HttpError(401, "Unauthorized");
  }
}

async function requireAppAttestIfEnabled(request: Request, env: Env): Promise<void> {
  const mode = env.APP_ATTEST_MODE ?? "disabled";
  if (mode === "disabled") return;

  if (mode !== "mock") {
    throw new HttpError(503, "Unsupported app attestation mode");
  }

  const expected = env.DEV_ATTEST_TOKEN;
  if (!expected) {
    throw new HttpError(503, "Mock app attestation token is not configured");
  }

  const token = request.headers.get("x-autocommit-dev-attestation");
  if (token !== expected) {
    throw new HttpError(401, "Invalid mock app attestation token");
  }
}

function unixSeconds(isoDate: string): string {
  return Math.floor(new Date(isoDate).getTime() / 1000).toString();
}

function toPublicCommitment(commitment: CommitmentRow) {
  return {
    id: commitment.id,
    userWallet: commitment.user_wallet,
    failureRecipient: commitment.failure_recipient,
    tokenAddress: commitment.token_address,
    amount: commitment.amount,
    goalKind: commitment.goal_kind,
    goalHash: commitment.goal_hash,
    targetValue: commitment.target_value,
    startsAt: commitment.starts_at,
    endsAt: commitment.ends_at,
    proofDueAt: commitment.proof_due_at,
    timezone: commitment.timezone,
    status: commitment.status,
    fundingTxHash: commitment.funding_tx_hash,
    contractAddress: commitment.contract_address,
    createdAt: commitment.created_at,
    updatedAt: commitment.updated_at
  };
}

function toPublicProof(proof: ProofRow) {
  return {
    id: proof.id,
    commitmentId: proof.commitment_id,
    outcome: proof.outcome,
    observedValue: proof.observed_value,
    reason: proof.reason,
    payloadHash: proof.payload_hash,
    submittedAt: proof.submitted_at,
    deviceId: proof.device_id
  };
}

function errorResponse(error: unknown): Response {
  if (error instanceof HttpError) {
    return json({ error: error.message, details: error.details }, error.status);
  }
  if (error instanceof ZodError) {
    return json({ error: "Validation failed", details: error.flatten() }, 400);
  }
  const message = error instanceof Error ? error.message : "Unknown error";
  return json({ error: message }, 500);
}
