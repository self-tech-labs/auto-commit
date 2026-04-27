import { getAddress, isAddress, keccak256, toBytes } from "viem";
import { z } from "zod";
import { HttpError } from "./http";

const addressSchema = z.string().refine((value) => isAddress(value), "Invalid EVM address");
const bytes32Schema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{64}$/, "Expected bytes32 hex string");
const isoDateSchema = z.string().refine((value) => !Number.isNaN(Date.parse(value)), {
  message: "Expected ISO date string"
});

export const createCommitmentSchema = z.object({
  userWallet: addressSchema,
  failureRecipient: addressSchema,
  tokenAddress: addressSchema,
  amount: z.string().regex(/^[1-9][0-9]*$/, "Amount must be an integer token unit string"),
  goalKind: z.enum(["screen_time", "steps"]),
  goalHash: bytes32Schema,
  targetValue: z.number().int().positive(),
  startsAt: isoDateSchema,
  endsAt: isoDateSchema,
  timezone: z.string().min(1).max(64)
});

export const proofSchema = z.object({
  commitmentId: bytes32Schema,
  outcome: z.enum(["success", "failure"]),
  observedValue: z.number().int().nonnegative().optional(),
  reason: z.string().max(280).optional(),
  deviceId: z.string().min(1).max(128).optional(),
  collectedAt: isoDateSchema
});

export const fundingSchema = z.object({
  txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/, "Invalid transaction hash")
});

export function normalizeCreateCommitment(input: unknown) {
  const parsed = createCommitmentSchema.parse(input);
  const startsAt = new Date(parsed.startsAt);
  const endsAt = new Date(parsed.endsAt);
  const durationMs = endsAt.getTime() - startsAt.getTime();
  const minDurationMs = 23 * 60 * 60 * 1000;
  const maxDurationMs = 25 * 60 * 60 * 1000;

  if (durationMs < minDurationMs || durationMs > maxDurationMs) {
    throw new HttpError(400, "MVP commitments must be one-day windows");
  }

  const proofDueAt = new Date(endsAt.getTime() + 12 * 60 * 60 * 1000).toISOString();

  return {
    ...parsed,
    userWallet: getAddress(parsed.userWallet),
    failureRecipient: getAddress(parsed.failureRecipient),
    tokenAddress: getAddress(parsed.tokenAddress),
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
    proofDueAt
  };
}

export function normalizeProof(input: unknown) {
  const parsed = proofSchema.parse(input);
  return {
    ...parsed,
    collectedAt: new Date(parsed.collectedAt).toISOString()
  };
}

export function proofPayloadHash(input: unknown): `0x${string}` {
  return keccak256(toBytes(JSON.stringify(input)));
}

export function commitmentIdFor(seed: string): `0x${string}` {
  return keccak256(toBytes(seed));
}
