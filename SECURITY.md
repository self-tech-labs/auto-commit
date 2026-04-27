# Security Policy

## Supported Status

This repository is a testnet prototype. Do not use it with mainnet funds or real
value until the production hardening items in `docs/ARCHITECTURE.md` are
complete and independently reviewed.

## Reporting Vulnerabilities

Please report vulnerabilities privately through GitHub Security Advisories for
this repository. If advisories are unavailable, contact the maintainers through
the Self Tech Labs GitHub organization.

Include:

- affected component: iOS, Worker, contracts, or deployment;
- impact and preconditions;
- reproduction steps or proof of concept;
- suggested mitigation, if known.

## High-Risk Areas

- App proof validation and App Attest integration.
- Worker oracle authorization and key custody.
- Funding event verification.
- Smart contract settlement, roles, pausing, and emergency refunds.
- Token allowlisting and deployment configuration.
