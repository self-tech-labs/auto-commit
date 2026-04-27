## Summary

-

## Verification

- [ ] `npm --prefix worker run typecheck`
- [ ] `npm --prefix worker test`
- [ ] `cd contracts && forge test`
- [ ] `xcodebuild -project ios/CommitApp.xcodeproj -scheme Commit -destination 'generic/platform=iOS Simulator' -configuration Debug CODE_SIGNING_ALLOWED=NO build`

## Security Notes

Describe any impact on proof validation, oracle behavior, contract settlement,
token allowlisting, app attestation, or deployment configuration.
