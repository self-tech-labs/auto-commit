# Operations

## Worker

Create the D1 database and apply migrations:

```sh
cd worker
npx wrangler d1 create autocommit-beta
npx wrangler d1 migrations apply autocommit-beta --local
npx wrangler d1 migrations apply autocommit-beta --remote
```

Set secrets before deploying:

```sh
npx wrangler secret put RPC_URL
npx wrangler secret put ESCROW_CONTRACT_ADDRESS
npx wrangler secret put ORACLE_PRIVATE_KEY
npx wrangler secret put ADMIN_API_TOKEN
```

`worker/wrangler.toml` ships with a placeholder D1 `database_id`. Replace it with the
ID returned by `wrangler d1 create` before deploying.

App attestation is disabled by default. For local or closed beta testing, set
`APP_ATTEST_MODE=mock` and configure `DEV_ATTEST_TOKEN`; clients must then send
`x-autocommit-dev-attestation`. The iOS app sends this header when
`AppConfiguration.devAttestationToken` is set. This is not Apple App Attest
verification and must be replaced with server-side App Attest validation before
handling real value.

Deploy:

```sh
npm run deploy
```

Manual admin settlement requests must include `Authorization: Bearer $ADMIN_API_TOKEN`.
The scheduled worker does not use this HTTP token.

## Contracts

Install Foundry and dependencies:

```sh
cd contracts
forge install foundry-rs/forge-std
npm install
forge test
```

Deploy to Base Sepolia:

```sh
ADMIN_ADDRESS=0x...
ORACLE_ADDRESS=0x...
EMERGENCY_REFUNDER_ADDRESS=0x...
forge script script/Deploy.s.sol --rpc-url "$BASE_SEPOLIA_RPC_URL" --broadcast --verify
```

After deployment:

1. Call `setTokenAllowed(testToken, true)`.
2. Set `ESCROW_CONTRACT_ADDRESS` in the worker.
3. Replace `AppConfiguration.defaultTokenAddress` and `escrowContractAddress` in the iOS app.

## iOS

Open `ios/CommitApp.xcodeproj` in Xcode and replace:

- bundle IDs;
- App Group;
- Associated Domain;
- development team;
- worker URL;
- token and contract addresses.

The current beta app uses manual wallet-address entry. Replace `WalletService` with Turnkey Swift before external testing with real value.
