import Foundation

public struct NextMatchDashboardLoadResult: Hashable, Sendable {
    public let snapshot: NextMatchDashboardSnapshot
    public let loadedURL: URL?
    public let message: String

    public var loadedFromLocalJSON: Bool {
        loadedURL != nil
    }
}

public struct NextMatchDashboardStore: Sendable {
    public let applicationSupportRoot: URL

    public enum DashboardError: LocalizedError, Equatable {
        case missingSnapshot([String])

        public var errorDescription: String? {
            switch self {
            case .missingSnapshot(let paths):
                "No local next-match dashboard JSON exists yet. Checked: \(paths.joined(separator: ", "))."
            }
        }
    }

    public init(applicationSupportRoot: URL = PowerScoutSyncLedgerStore.defaultStorageRoot()) {
        self.applicationSupportRoot = applicationSupportRoot
    }

    public var applicationSupportURL: URL {
        applicationSupportRoot.appendingPathComponent("next-match-dashboard.json")
    }

    public func candidateURLs(repoRoot: URL) -> [URL] {
        [
            applicationSupportURL,
            PowerScoutPaths.nextMatchDashboardSnapshotURL(repoRoot: repoRoot)
        ]
    }

    public func loadSnapshot(repoRoot: URL) throws -> NextMatchDashboardLoadResult {
        let urls = candidateURLs(repoRoot: repoRoot)
        var decodedCandidates: [NextMatchDashboardLoadResult] = []
        var unreadablePaths: [String] = []
        for url in urls where FileManager.default.fileExists(atPath: url.path) {
            do {
                let data = try Data(contentsOf: url)
                let snapshot = try decoder.decode(NextMatchDashboardSnapshot.self, from: data)
                decodedCandidates.append(NextMatchDashboardLoadResult(
                    snapshot: snapshot,
                    loadedURL: url,
                    message: "Loaded local next-match dashboard from \(url.path)."
                ))
            } catch {
                unreadablePaths.append("\(url.path): \(error.localizedDescription)")
            }
        }
        if let freshest = decodedCandidates.max(by: { lhs, rhs in
            (lhs.snapshot.savedAt ?? .distantPast) < (rhs.snapshot.savedAt ?? .distantPast)
        }) {
            if unreadablePaths.isEmpty {
                return freshest
            }
            return NextMatchDashboardLoadResult(
                snapshot: freshest.snapshot,
                loadedURL: freshest.loadedURL,
                message: "\(freshest.message) Ignored unreadable candidate(s): \(unreadablePaths.joined(separator: "; "))."
            )
        }
        throw DashboardError.missingSnapshot(urls.map(\.path) + unreadablePaths)
    }

    public func loadSnapshotOrFallback(repoRoot: URL) -> NextMatchDashboardLoadResult {
        do {
            return try loadSnapshot(repoRoot: repoRoot)
        } catch {
            return NextMatchDashboardLoadResult(
                snapshot: PowerScoutKnowledgeBase.nextMatchDashboard,
                loadedURL: nil,
                message: error.localizedDescription
            )
        }
    }

    public func saveSnapshot(_ snapshot: NextMatchDashboardSnapshot) throws {
        try FileManager.default.createDirectory(at: applicationSupportRoot, withIntermediateDirectories: true)
        let data = try encoder.encode(snapshot)
        try data.write(to: applicationSupportURL, options: [.atomic])
    }

    private var encoder: JSONEncoder {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        encoder.dateEncodingStrategy = .iso8601
        return encoder
    }

    private var decoder: JSONDecoder {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return decoder
    }
}
