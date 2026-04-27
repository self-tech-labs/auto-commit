.PHONY: test worker-install worker-test worker-typecheck contracts-install contracts-test contracts-build ios-build

test: worker-test worker-typecheck contracts-test

worker-install:
	npm --prefix worker ci

worker-test:
	npm --prefix worker test

worker-typecheck:
	npm --prefix worker run typecheck

contracts-install:
	npm --prefix contracts ci
	git submodule update --init --recursive

contracts-test:
	cd contracts && forge test

contracts-build:
	cd contracts && forge build

ios-build:
	xcodebuild -project ios/CommitApp.xcodeproj -scheme Commit -destination 'generic/platform=iOS Simulator' -configuration Debug CODE_SIGNING_ALLOWED=NO build
