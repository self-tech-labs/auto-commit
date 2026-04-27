import Foundation

enum APIClientError: Error, LocalizedError {
    case badResponse(Int, String)

    var errorDescription: String? {
        switch self {
        case .badResponse(let status, let body):
            return "Server returned \(status): \(body)"
        }
    }
}

@MainActor
final class APIClient {
    private let baseURL: URL
    private let session: URLSession
    private let encoder: JSONEncoder
    private let decoder: JSONDecoder

    init(baseURL: URL = AppConfiguration.apiBaseURL, session: URLSession = .shared) {
        self.baseURL = baseURL
        self.session = session
        self.encoder = JSONEncoder()
        self.encoder.dateEncodingStrategy = .iso8601
        self.decoder = JSONDecoder()
        self.decoder.dateDecodingStrategy = .iso8601
    }

    func createCommitment(_ request: CreateCommitmentRequest) async throws -> CreateCommitmentResponse {
        try await send(path: "/v1/commitments", method: "POST", body: request)
    }

    func verifyFunding(commitmentId: String, txHash: String) async throws -> CommitmentStatusResponse {
        try await send(
            path: "/v1/commitments/\(commitmentId)/funding",
            method: "POST",
            body: FundingRequest(txHash: txHash)
        )
    }

    func submitProof(_ request: ProofRequest) async throws {
        let _: EmptyResponse = try await send(path: "/v1/proofs", method: "POST", body: request)
    }

    func fetchCommitment(id: String) async throws -> CommitmentStatusResponse {
        try await send(path: "/v1/commitments/\(id)", method: "GET", body: Optional<String>.none)
    }

    private func send<RequestBody: Encodable, ResponseBody: Decodable>(
        path: String,
        method: String,
        body: RequestBody?
    ) async throws -> ResponseBody {
        var urlRequest = URLRequest(url: baseURL.appending(path: path))
        urlRequest.httpMethod = method
        urlRequest.setValue("application/json", forHTTPHeaderField: "content-type")
        if !AppConfiguration.devAttestationToken.isEmpty {
            urlRequest.setValue(
                AppConfiguration.devAttestationToken,
                forHTTPHeaderField: "x-autocommit-dev-attestation"
            )
        }

        if let body {
            urlRequest.httpBody = try encoder.encode(body)
        }

        let (data, response) = try await session.data(for: urlRequest)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIClientError.badResponse(-1, "Missing HTTP response")
        }
        guard (200..<300).contains(httpResponse.statusCode) else {
            throw APIClientError.badResponse(
                httpResponse.statusCode,
                String(decoding: data, as: UTF8.self)
            )
        }

        if ResponseBody.self == EmptyResponse.self {
            return EmptyResponse() as! ResponseBody
        }

        return try decoder.decode(ResponseBody.self, from: data)
    }
}

struct EmptyResponse: Decodable {}
