# Compliance Checklist

This is not legal advice. Treat it as an engineering launch gate.

## Apple

- Apple Developer account is enrolled as an organization before crypto wallet functionality ships.
- Family Controls distribution entitlement is approved for:
  - `com.autocommit.beta`
  - `com.autocommit.beta.CommitActivityMonitor`
- App Review notes explain:
  - commitments return the user's own escrow on success;
  - forfeits go to a user-selected recipient;
  - the app does not pay crypto rewards for completing tasks;
  - Screen Time and HealthKit data are used only for user-facing goal verification.
- Privacy policy lists HealthKit, Screen Time, wallet address, transaction hash, and proof metadata.
- HealthKit data is not used for marketing, advertising, or third-party data mining.

## Crypto / Payments

- Mainnet is blocked until counsel reviews whether the product creates custody, payment-service, gambling, prize, donation, or AML obligations.
- The app does not custody private keys in v1; Turnkey should be configured user-controlled.
- The app does not retain failed stakes.
- Token allowlist is limited to test tokens during beta and USDC-like assets only after review.
- Admin, oracle, and emergency refund roles are separated.

## Switzerland / TWINT

- TWINT is out of scope for MVP.
- TWINT should be revisited only after deciding whether the product is a merchant payment, escrow, donation, or regulated financial service.
- Stripe TWINT is unsuitable for true escrow because TWINT is single-use and does not support manual capture through Stripe.
