# Contributing

AutoCommit is a testnet-first reference implementation. Contributions should keep
that boundary explicit and avoid presenting the project as production financial
infrastructure before the hardening checklist is complete.

## Development Setup

```sh
git submodule update --init --recursive
npm --prefix worker ci
npm --prefix contracts ci
```

Run checks before opening a pull request:

```sh
make test
make ios-build
```

## Pull Request Expectations

- Keep changes scoped to one concern.
- Update docs when behavior, setup, endpoints, or security assumptions change.
- Add or update tests for Worker validation, contract behavior, or settlement
  edge cases.
- Do not commit secrets, deployment broadcasts, local `.env` files, Xcode user
  state, build products, or generated dependency folders.

## Security-Sensitive Changes

Changes to proof validation, app attestation, oracle signing, settlement,
contract roles, token allowlisting, or emergency refund behavior should explain
the trust-boundary impact in the PR description.
