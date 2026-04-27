import Foundation

struct ScreenTimeFailure: Codable {
    let commitmentId: String
    let reachedAt: Date
}

enum SharedFailureStore {
    private static let key = "screenTimeFailures"

    static func markThresholdReached(commitmentId: String, at date: Date = Date()) {
        var failures = allFailures()
        failures[commitmentId] = ScreenTimeFailure(commitmentId: commitmentId, reachedAt: date)
        save(failures)
    }

    static func failure(for commitmentId: String) -> ScreenTimeFailure? {
        allFailures()[commitmentId]
    }

    static func clear(commitmentId: String) {
        var failures = allFailures()
        failures.removeValue(forKey: commitmentId)
        save(failures)
    }

    private static func allFailures() -> [String: ScreenTimeFailure] {
        guard
            let defaults = UserDefaults(suiteName: AppConfiguration.appGroupIdentifier),
            let data = defaults.data(forKey: key),
            let failures = try? JSONDecoder().decode([String: ScreenTimeFailure].self, from: data)
        else {
            return [:]
        }
        return failures
    }

    private static func save(_ failures: [String: ScreenTimeFailure]) {
        guard let defaults = UserDefaults(suiteName: AppConfiguration.appGroupIdentifier) else {
            return
        }
        let data = try? JSONEncoder().encode(failures)
        defaults.set(data, forKey: key)
    }
}
