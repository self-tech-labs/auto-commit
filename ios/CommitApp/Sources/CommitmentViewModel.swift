import Foundation
import UIKit

@MainActor
final class CommitmentViewModel: ObservableObject {
    @Published var walletAddress = ""
    @Published var failureRecipient = ""
    @Published var tokenAddress = AppConfiguration.defaultTokenAddress
    @Published var amount = "1000000"
    @Published var goalKind: GoalKind = .screenTime
    @Published var screenTimeLimitMinutes = 60
    @Published var stepTarget = 10_000
    @Published var fundingTxHash = ""
    @Published private(set) var activeCommitment: CommitmentSnapshot?
    @Published private(set) var message = ""
    @Published private(set) var isWorking = false

    private let apiClient: APIClient
    private let healthKit: HealthKitGoalVerifier
    private let screenTimeController: ScreenTimeGoalController

    init(
        apiClient: APIClient = APIClient(),
        healthKit: HealthKitGoalVerifier = HealthKitGoalVerifier(),
        screenTimeController: ScreenTimeGoalController
    ) {
        self.apiClient = apiClient
        self.healthKit = healthKit
        self.screenTimeController = screenTimeController
    }

    func createDraft() async {
        await run {
            let start = Calendar.current.startOfDay(for: Date())
            let end = Calendar.current.date(byAdding: .day, value: 1, to: start)!
            let target = goalKind == .steps ? stepTarget : screenTimeLimitMinutes
            let goalHash = Hashing.bytes32Hex(
                "\(goalKind.rawValue):\(target):\(start.timeIntervalSince1970):\(end.timeIntervalSince1970)"
            )
            let request = CreateCommitmentRequest(
                userWallet: walletAddress,
                failureRecipient: failureRecipient,
                tokenAddress: tokenAddress,
                amount: amount,
                goalKind: goalKind,
                goalHash: goalHash,
                targetValue: target,
                startsAt: start,
                endsAt: end,
                timezone: TimeZone.current.identifier
            )

            let response = try await apiClient.createCommitment(request)
            let status = try await apiClient.fetchCommitment(id: response.commitmentId)
            activeCommitment = status.commitment

            if goalKind == .screenTime {
                try screenTimeController.startMonitoring(
                    commitmentId: response.commitmentId,
                    limitMinutes: screenTimeLimitMinutes,
                    from: start,
                    to: end
                )
            }

            message = "Draft created. Approve and fund the escrow contract, then paste the funding transaction hash."
        }
    }

    func verifyFunding() async {
        guard let activeCommitment else {
            message = "Create a draft first."
            return
        }

        await run {
            let response = try await apiClient.verifyFunding(
                commitmentId: activeCommitment.id,
                txHash: fundingTxHash
            )
            self.activeCommitment = response.commitment
            message = "Funding verified."
        }
    }

    func submitProof() async {
        guard let commitment = activeCommitment else {
            message = "No active commitment."
            return
        }

        await run {
            let proof: ProofRequest
            switch commitment.goalKind {
            case .steps:
                try await healthKit.requestAuthorization()
                let steps = try await healthKit.stepCount(from: commitment.startsAt, to: commitment.endsAt)
                proof = ProofRequest(
                    commitmentId: commitment.id,
                    outcome: steps >= commitment.targetValue ? .success : .failure,
                    observedValue: steps,
                    reason: steps >= commitment.targetValue ? nil : "steps_below_target",
                    deviceId: UIDevice.current.identifierForVendor?.uuidString,
                    collectedAt: Date()
                )
            case .screenTime:
                if let failure = SharedFailureStore.failure(for: commitment.id) {
                    proof = ProofRequest(
                        commitmentId: commitment.id,
                        outcome: .failure,
                        observedValue: commitment.targetValue,
                        reason: "screen_time_threshold_reached_at_\(failure.reachedAt.ISO8601Format())",
                        deviceId: UIDevice.current.identifierForVendor?.uuidString,
                        collectedAt: Date()
                    )
                } else {
                    proof = ProofRequest(
                        commitmentId: commitment.id,
                        outcome: .success,
                        observedValue: nil,
                        reason: nil,
                        deviceId: UIDevice.current.identifierForVendor?.uuidString,
                        collectedAt: Date()
                    )
                }
            }

            try await apiClient.submitProof(proof)
            let response = try await apiClient.fetchCommitment(id: commitment.id)
            activeCommitment = response.commitment
            message = "Proof submitted."
        }
    }

    private func run(_ operation: () async throws -> Void) async {
        isWorking = true
        defer { isWorking = false }
        do {
            try await operation()
        } catch {
            message = error.localizedDescription
        }
    }
}
