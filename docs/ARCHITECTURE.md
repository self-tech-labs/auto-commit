# Architecture

AutoCommit has three trust domains:

1. iOS app and Screen Time extension collect local goal evidence.
2. Cloudflare Worker validates beta proofs, tracks commitment state, and acts as the settlement oracle.
3. Base escrow contract holds ERC20 funds and only accepts settlement calls from the oracle role.

The design is intentionally not fully trustless. Apple device data is private and not available to smart contracts, so the onchain contract stores the financial state while the backend oracle bridges verified device-side goal outcomes.

## Flow

1. User enters a wallet address, failure recipient, stake amount, token, and one-day goal.
2. iOS computes a `goalHash` from local goal parameters and creates a backend draft.
3. User approves and funds `CommitmentEscrow.fund(...)` with the backend-provided commitment ID and matching goal hash.
4. Backend verifies the `CommitmentFunded` event from the submitted transaction hash.
   It rejects funding where the creator, recipients, token, amount, goal hash, or timing fields
   differ from the backend draft.
5. iOS submits a proof after the goal window:
   - Steps: aggregate `HealthKit.stepCount` over the fixed window, excluding manually entered samples where HealthKit metadata permits.
   - Screen time: `DeviceActivityMonitor` records threshold failure in the App Group store; absence of that failure after the window is treated as success.
6. Backend marks the commitment proven and the scheduled worker calls `settleSuccess` or `settleFailure`.
7. If no proof arrives by `endsAt + 12 hours`, the scheduled worker marks the commitment as failure.

## Production Hardening Before Mainnet

- Replace manual wallet entry with the Turnkey Swift embedded wallet flow.
- Replace mock app attestation with server-side Apple App Attest verification and require it for proof and funding endpoints.
- Move oracle key custody to a managed signer or HSM-backed relayer.
- Add an explicit Safe multisig for admin and emergency refund roles.
- Run an external smart contract review.
- Complete legal review for Swiss/EU financial, AML, and consumer-protection obligations.
- Replace placeholder bundle IDs, App Group, Associated Domain, worker URL, token address, and contract address.
