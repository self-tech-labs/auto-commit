import Foundation
import HealthKit

enum HealthKitGoalError: Error, LocalizedError {
    case stepTypeUnavailable

    var errorDescription: String? {
        switch self {
        case .stepTypeUnavailable:
            return "Step count is unavailable on this device."
        }
    }
}

@MainActor
final class HealthKitGoalVerifier {
    private let store = HKHealthStore()

    func requestAuthorization() async throws {
        guard let stepType = HKObjectType.quantityType(forIdentifier: .stepCount) else {
            throw HealthKitGoalError.stepTypeUnavailable
        }

        try await store.requestAuthorization(toShare: [], read: [stepType])
    }

    func stepCount(from start: Date, to end: Date) async throws -> Int {
        guard let stepType = HKObjectType.quantityType(forIdentifier: .stepCount) else {
            throw HealthKitGoalError.stepTypeUnavailable
        }

        let datePredicate = HKQuery.predicateForSamples(
            withStart: start,
            end: end,
            options: [.strictStartDate]
        )
        let manualPredicate = HKQuery.predicateForObjects(
            withMetadataKey: HKMetadataKeyWasUserEntered,
            operatorType: .equalTo,
            value: true
        )
        let predicate = NSCompoundPredicate(andPredicateWithSubpredicates: [
            datePredicate,
            NSCompoundPredicate(notPredicateWithSubpredicate: manualPredicate)
        ])

        return try await withCheckedThrowingContinuation { continuation in
            let query = HKStatisticsQuery(
                quantityType: stepType,
                quantitySamplePredicate: predicate,
                options: [.cumulativeSum]
            ) { _, statistics, error in
                if let error {
                    continuation.resume(throwing: error)
                    return
                }

                let steps = statistics?
                    .sumQuantity()?
                    .doubleValue(for: HKUnit.count()) ?? 0
                continuation.resume(returning: Int(steps.rounded(.down)))
            }

            store.execute(query)
        }
    }
}
