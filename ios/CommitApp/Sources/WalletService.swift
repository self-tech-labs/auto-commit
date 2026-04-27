import Foundation

struct WalletSession: Codable, Equatable {
    let address: String
}

@MainActor
final class WalletService: ObservableObject {
    @Published private(set) var session: WalletSession?

    private let defaults = UserDefaults.standard
    private let key = "walletSession"

    init() {
        if let data = defaults.data(forKey: key) {
            session = try? JSONDecoder().decode(WalletSession.self, from: data)
        }
    }

    func configureManualWallet(address: String) {
        let session = WalletSession(address: address.trimmingCharacters(in: .whitespacesAndNewlines))
        self.session = session
        if let data = try? JSONEncoder().encode(session) {
            defaults.set(data, forKey: key)
        }
    }

    func signOut() {
        session = nil
        defaults.removeObject(forKey: key)
    }
}
