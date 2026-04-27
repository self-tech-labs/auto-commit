import {
  createPublicClient,
  createWalletClient,
  http,
  parseEventLogs,
  type Hash
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base, baseSepolia } from "viem/chains";
import { commitmentEscrowAbi } from "./abi";
import { HttpError } from "./http";
import type { Env, ProofOutcome } from "./types";

function chainFor(env: Env) {
  return env.CHAIN_ID === "8453" ? base : baseSepolia;
}

function requireChainConfig(env: Env) {
  if (!env.RPC_URL || !env.ESCROW_CONTRACT_ADDRESS) {
    throw new HttpError(503, "Chain configuration is missing");
  }
}

export async function verifyFundingEvent(env: Env, commitmentId: `0x${string}`, txHash: Hash) {
  requireChainConfig(env);
  const publicClient = createPublicClient({ chain: chainFor(env), transport: http(env.RPC_URL) });
  const receipt = await publicClient.getTransactionReceipt({ hash: txHash });

  if (receipt.status !== "success") {
    throw new HttpError(422, "Funding transaction did not succeed");
  }

  const logs = parseEventLogs({
    abi: commitmentEscrowAbi,
    logs: receipt.logs,
    eventName: "CommitmentFunded"
  });

  const match = logs.find((log) => {
    return (
      log.address.toLowerCase() === env.ESCROW_CONTRACT_ADDRESS!.toLowerCase() &&
      log.args.commitmentId?.toLowerCase() === commitmentId.toLowerCase()
    );
  });

  if (!match) {
    throw new HttpError(422, "Funding transaction does not contain the expected escrow event");
  }

  return {
    blockNumber: receipt.blockNumber.toString(),
    creator: match.args.creator,
    token: match.args.token,
    amount: match.args.amount.toString(),
    successRecipient: match.args.successRecipient,
    failureRecipient: match.args.failureRecipient,
    goalHash: match.args.goalHash,
    startsAt: match.args.startsAt.toString(),
    endsAt: match.args.endsAt.toString(),
    proofDueAt: match.args.proofDueAt.toString()
  };
}

export async function sendSettlement(
  env: Env,
  commitmentId: `0x${string}`,
  outcome: ProofOutcome
): Promise<Hash> {
  requireChainConfig(env);
  const address = env.ESCROW_CONTRACT_ADDRESS;
  const privateKey = env.ORACLE_PRIVATE_KEY;

  if (!address) {
    throw new HttpError(503, "Escrow contract address is missing");
  }
  if (!privateKey) {
    throw new HttpError(503, "Oracle private key is missing");
  }

  const account = privateKeyToAccount(privateKey);
  const walletClient = createWalletClient({
    account,
    chain: chainFor(env),
    transport: http(env.RPC_URL)
  });

  return walletClient.writeContract({
    address,
    abi: commitmentEscrowAbi,
    functionName: outcome === "success" ? "settleSuccess" : "settleFailure",
    args: [commitmentId]
  });
}
