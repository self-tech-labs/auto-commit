import DeviceActivity
import FamilyControls
import Foundation

@MainActor
final class ScreenTimeGoalController: ObservableObject {
    @Published var selection = FamilyActivitySelection()
    @Published private(set) var authorizationStatus = AuthorizationCenter.shared.authorizationStatus

    private let center = DeviceActivityCenter()

    func requestAuthorization() async throws {
        try await AuthorizationCenter.shared.requestAuthorization(for: .individual)
        authorizationStatus = AuthorizationCenter.shared.authorizationStatus
    }

    func startMonitoring(commitmentId: String, limitMinutes: Int, from start: Date, to end: Date) throws {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = .current

        let intervalStart = calendar.dateComponents(
            [.year, .month, .day, .hour, .minute],
            from: start
        )
        let intervalEnd = calendar.dateComponents(
            [.year, .month, .day, .hour, .minute],
            from: end
        )
        let schedule = DeviceActivitySchedule(
            intervalStart: intervalStart,
            intervalEnd: intervalEnd,
            repeats: false
        )
        let event = DeviceActivityEvent(
            applications: selection.applicationTokens,
            categories: selection.categoryTokens,
            webDomains: selection.webDomainTokens,
            threshold: DateComponents(minute: limitMinutes)
        )

        UserDefaults(suiteName: AppConfiguration.appGroupIdentifier)?
            .set(commitmentId, forKey: "activeScreenTimeCommitmentId")

        try center.startMonitoring(
            .commitmentScreenTime,
            during: schedule,
            events: [.screenTimeLimit: event]
        )
    }

    func stopMonitoring() {
        center.stopMonitoring([.commitmentScreenTime])
    }
}
