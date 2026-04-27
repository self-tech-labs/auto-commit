import Foundation

enum GoalKind: String, CaseIterable, Codable, Identifiable {
    case screenTime = "screen_time"
    case steps

    var id: String { rawValue }

    var title: String {
        switch self {
        case .screenTime:
            return "Screen time"
        case .steps:
            return "Steps"
        }
    }
}

enum ProofOutcome: String, Codable {
    case success
    case failure
}

struct CreateCommitmentRequest: Encodable {
    let userWallet: String
    let failureRecipient: String
    let tokenAddress: String
    let amount: String
    let goalKind: GoalKind
    let goalHash: String
    let targetValue: Int
    let startsAt: Date
    let endsAt: Date
    let timezone: String
}

struct CreateCommitmentResponse: Decodable {
    let commitmentId: String
    let proofDueAt: Date
    let status: String
}

struct FundingRequest: Encodable {
    let txHash: String
}

struct ProofRequest: Encodable {
    let commitmentId: String
    let outcome: ProofOutcome
    let observedValue: Int?
    let reason: String?
    let deviceId: String?
    let collectedAt: Date
}

struct CommitmentStatusResponse: Decodable {
    let commitment: CommitmentSnapshot
    let proof: ProofSnapshot?
}

struct CommitmentSnapshot: Decodable {
    let id: String
    let userWallet: String
    let failureRecipient: String
    let tokenAddress: String
    let amount: String
    let goalKind: GoalKind
    let goalHash: String
    let targetValue: Int
    let startsAt: Date
    let endsAt: Date
    let proofDueAt: Date
    let timezone: String
    let status: String
    let fundingTxHash: String?
    let contractAddress: String?
    let createdAt: Date
    let updatedAt: Date
}

struct ProofSnapshot: Decodable {
    let id: String
    let commitmentId: String
    let outcome: ProofOutcome
    let observedValue: Int?
    let reason: String?
    let payloadHash: String
    let submittedAt: Date
    let deviceId: String?
}
