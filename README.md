# AutoCommit

AutoCommit is a testnet commitment-contract prototype. A user escrows an
allowlisted ERC20 token, picks a one-day iOS goal, and a Cloudflare Worker oracle
settles the escrow from device-side goal evidence.

The repository is public so others can inspect, build on, and adapt the design.
It is not mainnet-ready financial software. Keep it on testnets until the
production hardening items in [Architecture](docs/ARCHITECTURE.md) and
[Compliance Checklist](docs/COMPLIANCE_CHECKLIST.md) are resolved.

## What Is Included

- `ios/CommitApp`: SwiftUI iOS app, HealthKit step proof flow, and Screen Time
  DeviceActivity extension.
- `contracts`: Foundry project for the escrow contract and contract tests.
- `worker`: Cloudflare Worker API, D1 schema, funding verification, proof intake,
  and settlement scheduler.
- `docs`: architecture, operations, and launch/compliance guardrails.

## Current Status

- Chain default: Base Sepolia.
- Token default: allowlisted ERC20 test token.
- Goal types: `screen_time` and `steps`.
- Goal window: one local day.
- Settlement grace: 12 hours after the goal deadline.
- Oracle model: backend-controlled settlement key.
- App attestation: disabled by default, with a mock beta gate available for local
  or closed-beta testing.

## Prerequisites

- Node.js 20 or newer.
- Foundry.
- Xcode with iOS 17+ SDK support.
- A Cloudflare account for Worker and D1 deployment.
- For real iOS devices: Apple organization developer account, Family Controls
  distribution entitlement approval, HealthKit capability, App Groups, and
  Associated Domains.

## Quickstart

Clone with the Foundry submodule:

```sh
git clone --recurse-submodules https://github.com/self-tech-labs/auto-commit.git
cd auto-commit
```

Install dependencies:

```sh
npm --prefix worker ci
npm --prefix contracts ci
git submodule update --init --recursive
```

Run the default verification suite:

```sh
make test
make ios-build
```

Equivalent direct commands:

```sh
npm --prefix worker test
npm --prefix worker run typecheck
cd contracts && forge test
xcodebuild -project ios/CommitApp.xcodeproj -scheme Commit \
  -destination 'generic/platform=iOS Simulator' \
  -configuration Debug CODE_SIGNING_ALLOWED=NO build
```

## Configuration

`worker/wrangler.toml` intentionally contains placeholder Cloudflare values. For
deployment, create your own D1 database, replace the placeholder `database_id`,
and set Worker secrets:

```sh
cd worker
npx wrangler d1 create autocommit-beta
npx wrangler secret put RPC_URL
npx wrangler secret put ESCROW_CONTRACT_ADDRESS
npx wrangler secret put ORACLE_PRIVATE_KEY
npx wrangler secret put ADMIN_API_TOKEN
```

The iOS app also contains placeholder bundle IDs, App Group, Associated Domain,
Worker URL, token address, and contract address. Replace them in Xcode and
`AppConfiguration.swift` before running on a device.

See [Operations](docs/OPERATIONS.md) for deployment steps and beta attestation
mode.

## Security Model

AutoCommit is intentionally hybrid rather than fully trustless. The smart
contract holds funds, while the backend oracle bridges private iOS goal evidence
to onchain settlement. The contract enforces token custody and role separation;
the Worker verifies funding event fields before treating a draft as funded.

Before any mainnet or real-value use, replace mock app attestation with real
server-side Apple App Attest verification, move oracle signing to managed key
custody, use multisig admin roles, and run an external smart contract/security
review.

## License

MIT. See [LICENSE](LICENSE).
