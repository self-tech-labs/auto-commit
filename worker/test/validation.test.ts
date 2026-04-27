import { describe, expect, it } from "vitest";
import { normalizeCreateCommitment, normalizeProof, proofPayloadHash } from "../src/validation";

const wallet = "0x0000000000000000000000000000000000000001";
const recipient = "0x0000000000000000000000000000000000000002";
const token = "0x0000000000000000000000000000000000000003";
const goalHash = "0x1111111111111111111111111111111111111111111111111111111111111111";

describe("validation", () => {
  it("normalizes a one-day commitment and computes proof deadline", () => {
    const result = normalizeCreateCommitment({
      userWallet: wallet,
      failureRecipient: recipient,
      tokenAddress: token,
      amount: "1000000",
      goalKind: "steps",
      goalHash,
      targetValue: 10000,
      startsAt: "2026-04-24T00:00:00.000Z",
      endsAt: "2026-04-25T00:00:00.000Z",
      timezone: "Europe/Zurich"
    });

    expect(result.userWallet).toBe(wallet);
    expect(result.proofDueAt).toBe("2026-04-25T12:00:00.000Z");
  });

  it("rejects non one-day commitment windows", () => {
    expect(() =>
      normalizeCreateCommitment({
        userWallet: wallet,
        failureRecipient: recipient,
        tokenAddress: token,
        amount: "1000000",
        goalKind: "screen_time",
        goalHash,
        targetValue: 60,
        startsAt: "2026-04-24T00:00:00.000Z",
        endsAt: "2026-04-24T01:00:00.000Z",
        timezone: "Europe/Zurich"
      })
    ).toThrow("one-day windows");
  });

  it("normalizes proofs and hashes payloads", () => {
    const proof = normalizeProof({
      commitmentId: goalHash,
      outcome: "success",
      observedValue: 12000,
      collectedAt: "2026-04-25T01:00:00+01:00"
    });

    expect(proof.collectedAt).toBe("2026-04-25T00:00:00.000Z");
    expect(proofPayloadHash(proof)).toMatch(/^0x[a-f0-9]{64}$/);
  });
});
