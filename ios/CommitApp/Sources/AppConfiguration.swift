import Foundation

enum AppConfiguration {
    static let apiBaseURL = URL(string: "https://autocommit-worker.example.workers.dev")!
    static let appGroupIdentifier = "group.com.autocommit.beta"
    static let defaultTokenAddress = "0x0000000000000000000000000000000000000000"
    static let escrowContractAddress = "0x0000000000000000000000000000000000000000"
    static let devAttestationToken = ""
}
