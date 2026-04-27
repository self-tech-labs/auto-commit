import DeviceActivity
import Foundation

final class CommitActivityMonitorExtension: DeviceActivityMonitor {
    override func eventDidReachThreshold(
        _ event: DeviceActivityEvent.Name,
        activity: DeviceActivityName
    ) {
        guard
            activity == .commitmentScreenTime,
            event == .screenTimeLimit,
            let commitmentId = UserDefaults(suiteName: AppConfiguration.appGroupIdentifier)?
                .string(forKey: "activeScreenTimeCommitmentId")
        else {
            return
        }

        SharedFailureStore.markThresholdReached(commitmentId: commitmentId)
    }
}
