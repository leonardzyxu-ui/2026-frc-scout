import Foundation

public struct PredictionEvidenceLoadResult: Hashable, Sendable {
    public let series: PredictionEvidenceSeries
    public let loadedURL: URL?
    public let message: String
    public let sourceKind: PredictionEvidenceSourceKind

    public var loadedFromLedger: Bool {
        loadedURL != nil
    }

    public var dashboardNote: String {
        guard loadedFromLedger else { return "Bundled legacy evidence sample until a live prediction ledger is loaded." }
        return "Loaded \(series.points.count) matches for \(series.eventName) from \(sourceKind.displayName)."
    }

    public static let fallback = PredictionEvidenceLoadResult(
        series: .fallback,
        loadedURL: nil,
        message: "No prediction-ledger.json loaded; showing bundled visual sample.",
        sourceKind: .fallback
    )
}

public enum PredictionEvidenceSourceKind: String, Hashable, Sendable {
    case localApplicationSupport
    case repoOutput
    case finalReplayArtifact
    case replayArtifact
    case fallback

    var displayName: String {
        switch self {
        case .localApplicationSupport: "local Application Support ledger"
        case .repoOutput: "PowerScout output ledger"
        case .finalReplayArtifact: "final replay artifact"
        case .replayArtifact: "replay artifact"
        case .fallback: "bundled visual fallback"
        }
    }

    var badgeText: String {
        switch self {
        case .localApplicationSupport: "Local ledger"
        case .repoOutput: "Output ledger"
        case .finalReplayArtifact: "Final replay"
        case .replayArtifact: "Replay artifact"
        case .fallback: "Demo fallback"
        }
    }

    var priority: Int {
        switch self {
        case .localApplicationSupport: 40_000
        case .repoOutput: 30_000
        case .finalReplayArtifact: 20_000
        case .replayArtifact: 10_000
        case .fallback: 0
        }
    }
}

public struct PredictionEvidenceSeries: Hashable, Sendable {
    public let eventKey: String
    public let eventName: String
    public let points: [PredictionEvidencePoint]
    public let winnerAccuracy: Double?
    public let metrics: PredictionEvidenceMetrics?

    public static let fallback = PredictionEvidenceSeries(
        eventKey: "sample",
        eventName: "Bundled visual sample",
        points: PredictionEvidencePoint.sample,
        winnerAccuracy: nil,
        metrics: nil
    )
}

public struct PredictionEvidenceMetrics: Hashable, Sendable {
    public let matchesPredicted: Int?
    public let decisivePredictions: Int?
    public let winnerAccuracy: Double?
    public let qualificationWinnerAccuracy: Double?
    public let playoffWinnerAccuracy: Double?
    public let brierScore: Double?
    public let scoreMae: Double?
    public let marginMae: Double?
}

public struct PredictionEvidencePoint: Identifiable, Hashable, Sendable {
    public let index: Int
    public let label: String
    public let actualWinner: Double
    public let alignedPredictedWinner: Double
    public let winnerCorrect: Bool?

    public var id: Int { index }

    public static let sample: [PredictionEvidencePoint] = [
        .init(index: 1, label: "QM 1", actualWinner: 92, alignedPredictedWinner: 118, winnerCorrect: false),
        .init(index: 2, label: "QM 5", actualWinner: 190, alignedPredictedWinner: 176, winnerCorrect: true),
        .init(index: 3, label: "QM 9", actualWinner: 145, alignedPredictedWinner: 158, winnerCorrect: true),
        .init(index: 4, label: "QM 13", actualWinner: 318, alignedPredictedWinner: 252, winnerCorrect: false),
        .init(index: 5, label: "QM 18", actualWinner: 118, alignedPredictedWinner: 132, winnerCorrect: true),
        .init(index: 6, label: "QM 22", actualWinner: 402, alignedPredictedWinner: 370, winnerCorrect: true),
        .init(index: 7, label: "QM 27", actualWinner: 65, alignedPredictedWinner: 104, winnerCorrect: false),
        .init(index: 8, label: "QM 31", actualWinner: 290, alignedPredictedWinner: 254, winnerCorrect: true),
        .init(index: 9, label: "QM 36", actualWinner: 84, alignedPredictedWinner: 198, winnerCorrect: false),
        .init(index: 10, label: "QM 40", actualWinner: 330, alignedPredictedWinner: 318, winnerCorrect: true),
        .init(index: 11, label: "QM 46", actualWinner: 150, alignedPredictedWinner: 171, winnerCorrect: true),
        .init(index: 12, label: "QM 50", actualWinner: 438, alignedPredictedWinner: 323, winnerCorrect: false),
        .init(index: 13, label: "QM 55", actualWinner: 128, alignedPredictedWinner: 205, winnerCorrect: false),
        .init(index: 14, label: "QM 59", actualWinner: 292, alignedPredictedWinner: 229, winnerCorrect: true),
        .init(index: 15, label: "QM 63", actualWinner: 72, alignedPredictedWinner: 66, winnerCorrect: true),
        .init(index: 16, label: "QM 68", actualWinner: 242, alignedPredictedWinner: 182, winnerCorrect: true),
        .init(index: 17, label: "QM 72", actualWinner: 108, alignedPredictedWinner: 126, winnerCorrect: true),
        .init(index: 18, label: "M1", actualWinner: 305, alignedPredictedWinner: 211, winnerCorrect: false),
        .init(index: 19, label: "M4", actualWinner: 176, alignedPredictedWinner: 386, winnerCorrect: false),
        .init(index: 20, label: "M7", actualWinner: 404, alignedPredictedWinner: 372, winnerCorrect: true),
        .init(index: 21, label: "M10", actualWinner: 212, alignedPredictedWinner: 225, winnerCorrect: true),
        .init(index: 22, label: "Finals 2", actualWinner: 398, alignedPredictedWinner: 335, winnerCorrect: true)
    ]
}

public struct PredictionEvidenceStore: Sendable {
    public let applicationSupportRoot: URL

    public enum PredictionEvidenceError: LocalizedError, Equatable {
        case missingLedger([String])

        public var errorDescription: String? {
            switch self {
            case .missingLedger(let paths):
                "No prediction-ledger.json exists yet. Checked: \(paths.joined(separator: ", "))."
            }
        }
    }

    public init(applicationSupportRoot: URL = PowerScoutSyncLedgerStore.defaultStorageRoot()) {
        self.applicationSupportRoot = applicationSupportRoot
    }

    public var applicationSupportURL: URL {
        applicationSupportRoot.appendingPathComponent("prediction-ledger.json")
    }

    public func candidateURLs(repoRoot: URL) -> [URL] {
        var urls = [
            applicationSupportURL,
            PowerScoutPaths.predictionLedgerURL(repoRoot: repoRoot)
        ]
        urls.append(contentsOf: syntheticReplayLedgerURLs(repoRoot: repoRoot))
        return urls
    }

    public func loadSeries(repoRoot: URL) throws -> PredictionEvidenceLoadResult {
        let urls = candidateURLs(repoRoot: repoRoot)
        var decodedCandidates: [PredictionEvidenceLoadResult] = []
        var unreadablePaths: [String] = []
        for url in urls where FileManager.default.fileExists(atPath: url.path) {
            do {
                let series = try decodeSeries(from: url)
                let sourceKind = sourceKind(for: url, repoRoot: repoRoot)
                decodedCandidates.append(PredictionEvidenceLoadResult(
                    series: series,
                    loadedURL: url,
                    message: "Loaded \(series.points.count) prediction matches for \(series.eventName) from \(sourceKind.displayName).",
                    sourceKind: sourceKind
                ))
            } catch {
                unreadablePaths.append("\(url.path): \(error.localizedDescription)")
            }
        }
        if let best = decodedCandidates.max(by: { lhs, rhs in
            score(lhs) < score(rhs)
        }) {
            if unreadablePaths.isEmpty {
                return best
            }
            return PredictionEvidenceLoadResult(
                series: best.series,
                loadedURL: best.loadedURL,
                message: "\(best.message) Ignored unreadable candidate(s): \(unreadablePaths.joined(separator: "; ")).",
                sourceKind: best.sourceKind
            )
        }
        throw PredictionEvidenceError.missingLedger(urls.map(\.path) + unreadablePaths)
    }

    public func loadSeriesOrFallback(repoRoot: URL) -> PredictionEvidenceLoadResult {
        do {
            return try loadSeries(repoRoot: repoRoot)
        } catch {
            return PredictionEvidenceLoadResult(
                series: .fallback,
                loadedURL: nil,
                message: error.localizedDescription,
                sourceKind: .fallback
            )
        }
    }

    private func score(_ result: PredictionEvidenceLoadResult) -> Int {
        result.sourceKind.priority + result.series.points.count
    }

    private func sourceKind(for url: URL, repoRoot: URL) -> PredictionEvidenceSourceKind {
        if url == applicationSupportURL { return .localApplicationSupport }
        if url == PowerScoutPaths.predictionLedgerURL(repoRoot: repoRoot) { return .repoOutput }
        let parentName = url.deletingLastPathComponent().lastPathComponent
        if parentName.hasSuffix("-final") { return .finalReplayArtifact }
        return .replayArtifact
    }

    private func syntheticReplayLedgerURLs(repoRoot: URL) -> [URL] {
        let artifactsRoot = repoRoot.appendingPathComponent("SyntheticFullSystemTest/artifacts", isDirectory: true)
        guard let enumerator = FileManager.default.enumerator(
            at: artifactsRoot,
            includingPropertiesForKeys: [.isRegularFileKey],
            options: [.skipsHiddenFiles]
        ) else {
            return []
        }

        var urls: [URL] = []
        for case let url as URL in enumerator where url.lastPathComponent == "prediction-ledger.json" {
            let parentName = url.deletingLastPathComponent().lastPathComponent
            if parentName.hasPrefix("sft-real-") || parentName.hasSuffix("-final") {
                urls.append(url)
            }
        }
        return urls
    }

    private func decodeSeries(from url: URL) throws -> PredictionEvidenceSeries {
        let data = try Data(contentsOf: url)
        let ledger = try decoder.decode(PredictionLedger.self, from: data)
        let points = ledger.entries
            .sorted { $0.matchIndex < $1.matchIndex }
            .enumerated()
            .map { offset, entry -> PredictionEvidencePoint in
                return PredictionEvidencePoint(
                    index: offset + 1,
                    label: entry.title,
                    actualWinner: Double(entry.actualWinnerScore),
                    alignedPredictedWinner: Double(entry.predictedWinnerScore),
                    winnerCorrect: entry.winnerCorrect
                )
            }
        guard !points.isEmpty else {
            throw DecodingError.dataCorrupted(.init(codingPath: [], debugDescription: "Prediction ledger contains no plottable match entries."))
        }
        return PredictionEvidenceSeries(
            eventKey: ledger.eventKey,
            eventName: ledger.eventName,
            points: points,
            winnerAccuracy: ledger.metrics?.winnerAccuracy,
            metrics: ledger.metrics?.evidenceMetrics
        )
    }

    private var decoder: JSONDecoder {
        JSONDecoder()
    }
}

private struct PredictionLedger: Decodable {
    let eventKey: String
    let eventName: String
    let entries: [PredictionLedgerEntry]
    let metrics: PredictionLedgerMetrics?
}

private struct PredictionLedgerMetrics: Decodable {
    let matchesPredicted: Int?
    let decisivePredictions: Int?
    let winnerAccuracy: Double?
    let qualificationWinnerAccuracy: Double?
    let playoffWinnerAccuracy: Double?
    let brierScore: Double?
    let scoreMae: Double?
    let marginMae: Double?

    var evidenceMetrics: PredictionEvidenceMetrics {
        PredictionEvidenceMetrics(
            matchesPredicted: matchesPredicted,
            decisivePredictions: decisivePredictions,
            winnerAccuracy: winnerAccuracy,
            qualificationWinnerAccuracy: qualificationWinnerAccuracy,
            playoffWinnerAccuracy: playoffWinnerAccuracy,
            brierScore: brierScore,
            scoreMae: scoreMae,
            marginMae: marginMae
        )
    }
}

private struct PredictionLedgerEntry: Decodable {
    let matchIndex: Int
    let title: String
    let predictedWinner: String
    let actualWinner: String
    let predictedRedScore: Int
    let predictedBlueScore: Int
    let actualRedScore: Int
    let actualBlueScore: Int
    let winnerCorrect: Bool?

    var actualWinnerScore: Int {
        switch actualWinner.lowercased() {
        case "red":
            actualRedScore
        case "blue":
            actualBlueScore
        default:
            max(actualRedScore, actualBlueScore)
        }
    }

    var predictedWinnerScore: Int {
        switch predictedWinner.lowercased() {
        case "red":
            predictedRedScore
        case "blue":
            predictedBlueScore
        default:
            max(predictedRedScore, predictedBlueScore)
        }
    }
}
