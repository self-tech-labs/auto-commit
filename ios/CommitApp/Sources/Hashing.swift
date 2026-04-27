import CryptoKit
import Foundation

enum Hashing {
    static func bytes32Hex(_ text: String) -> String {
        let digest = SHA256.hash(data: Data(text.utf8))
        return "0x" + digest.map { String(format: "%02x", $0) }.joined()
    }
}
