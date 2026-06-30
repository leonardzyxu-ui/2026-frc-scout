import Foundation
import Testing
@testable import PowerScoutCore

@Test
func pitScoutClaimsAreDiscountedUntilMatchEvidenceConfirmsThem() {
    let claimedItems = PowerScoutKnowledgeBase.dataNeeds.filter { $0.trust == .claimed }
    #expect(claimedItems.contains { $0.lane == .pitScout && $0.title.contains("Claimed") })
    #expect(claimedItems.allSatisfy { $0.detail.localizedCaseInsensitiveContains("claim") || $0.detail.localizedCaseInsensitiveContains("reported") })
}

@Test
func matchScoutLaneFocusesOnLiveInformationOthersCannotGet() {
    let edgeTitles = PowerScoutKnowledgeBase.matchScoutEdges.map(\.title)
    let matchScore = PowerScoutKnowledgeBase.systemScores.first { $0.lane == .matchScout }
    #expect(edgeTitles.contains("Traffic under pressure"))
    #expect(edgeTitles.contains("Pit-claim contradictions"))
    #expect(matchScore?.verdict.localizedCaseInsensitiveContains("overload") == true)
    #expect(matchScore?.nextMove.localizedCaseInsensitiveContains("minimal") == true)
}

@Test
func commandSpecsUseProxyForNetworkReadinessChecks() {
    let networkCommands = PowerScoutKnowledgeBase.commands.filter { $0.title != "PPT Background Capture" }
    #expect(networkCommands.allSatisfy { $0.usesProxy })
}

@Test
func strategyMetricContractUsesNewScoutingLanguage() {
    let metricNames = Set(PowerScoutKnowledgeBase.strategyMetrics.map(\.name))
    #expect(metricNames.contains("Contribution"))
    #expect(metricNames.contains("Floor Non Zero"))
    #expect(metricNames.contains("Contribution Deviation"))
    #expect(metricNames.contains("Defense Deviation"))
    #expect(PowerScoutKnowledgeBase.strategyMetrics.first { $0.name == "DPR" }?.meaning.localizedCaseInsensitiveContains("not causal") == true)
}

@Test
func strategySafetiesPreventStaticRoleAndOverDefenseLogic() {
    let safetyText = PowerScoutKnowledgeBase.strategySafeties.map { "\($0.title) \($0.detail)" }.joined(separator: " ")
    #expect(safetyText.localizedCaseInsensitiveContains("role combinations"))
    #expect(safetyText.localizedCaseInsensitiveContains("more points than the opponent has available"))
    #expect(safetyText.localizedCaseInsensitiveContains("normalize defender share"))
}

@Test
func liveOpsMakesPowerScoutTheLocalCommandCenter() {
    #expect(PowerScoutSection.allCases.contains(.liveOps))
    #expect(PowerScoutKnowledgeBase.liveOpsSteps.first?.title == "Scout evidence lands locally first")
    #expect(PowerScoutKnowledgeBase.liveOpsSteps.contains { $0.detail.localizedCaseInsensitiveContains("driver") })
    #expect(PowerScoutKnowledgeBase.postMatchRefreshCommand.title == "Post-Match Refresh")
    #expect(PowerScoutKnowledgeBase.postMatchRefreshCommand.usesProxy)
}

@Test
func liveOpsShowsFreshnessAndDriverBriefingOutputs() {
    let freshnessSources = Set(PowerScoutKnowledgeBase.liveOpsFreshnessCards.map(\.source))
    #expect(freshnessSources.contains("PowerScout Local DB"))
    #expect(freshnessSources.contains("Firebase Scout Sync"))
    #expect(freshnessSources.contains("TBA Results"))
    #expect(freshnessSources.contains("FIRST Events"))
    #expect(freshnessSources.contains("Statbotics"))
    #expect(freshnessSources.contains("Model Rerun"))
    #expect(PowerScoutKnowledgeBase.liveOpsFreshnessCards.contains { $0.target.localizedCaseInsensitiveContains("queue") })

    let outputs = PowerScoutKnowledgeBase.driverBriefingOutputs
    #expect(outputs.contains { $0.title == "Win probability" })
    #expect(outputs.contains { $0.title == "Role plan" && $0.detail.localizedCaseInsensitiveContains("stockpile") })
    #expect(outputs.contains { $0.title == "RP upside" && $0.value.localizedCaseInsensitiveContains("Traversal") })
    #expect(outputs.contains { $0.title == "Data-quality flags" && $0.detail.localizedCaseInsensitiveContains("first-shift") })

    let reportPath = PowerScoutPaths.postMatchRefreshReportURL(repoRoot: URL(fileURLWithPath: "/tmp/powerscout")).path
    let jsonPath = PowerScoutPaths.postMatchRefreshJSONURL(repoRoot: URL(fileURLWithPath: "/tmp/powerscout")).path
    #expect(reportPath.hasSuffix("output/powerscout/post-match-refresh/latest.md"))
    #expect(jsonPath.hasSuffix("output/powerscout/post-match-refresh/latest.json"))
}

@Test
func relayDispatchCandidatesKeepCloudflareAsGlobalBackup() {
    let candidates = PowerScoutKnowledgeBase.relayDispatchCandidates
    let mainlandOrder = candidates.sorted { $0.order(in: .mainlandSanya) < $1.order(in: .mainlandSanya) }.map(\.label)
    let globalOrder = candidates.sorted { $0.order(in: .globalVpn) < $1.order(in: .globalVpn) }.map(\.label)

    #expect(mainlandOrder == ["The Button", "DirectChat", "Cloudflare DirectChat"])
    #expect(globalOrder == ["The Button", "Cloudflare DirectChat", "DirectChat"])
    #expect(RelayDispatchRegion.mainlandSanya.dispatchRule.localizedCaseInsensitiveContains("Sanya"))
    #expect(RelayDispatchRegion.globalVpn.dispatchRule.localizedCaseInsensitiveContains("Cloudflare DirectChat"))
    #expect(candidates.first { $0.label == "Cloudflare DirectChat" }?.caveat.localizedCaseInsensitiveContains("workers.dev") == true)
    #expect(candidates.first { $0.label == "Cloudflare DirectChat" }?.caveat.localizedCaseInsensitiveContains("Sanya") == true)
}

@Test
func nextMatchDashboardMirrorsStrategyPreview() {
    let dashboard = PowerScoutKnowledgeBase.nextMatchDashboard
    #expect(PowerScoutKnowledgeBase.nextMatchDashboardMetricLabels == ["Our Win Prob", "Our Margin"])
    #expect(dashboard.source == "fallback-demo")
    #expect(dashboard.sourceDetail.localizedCaseInsensitiveContains("fallback demo") == true)
    #expect(dashboard.ourAlliance == "Blue")
    #expect(dashboard.firstShiftAlliance == "Red")
    #expect(dashboard.projectedRedScore == 94)
    #expect(dashboard.projectedBlueScore == 78)
    #expect(dashboard.columns.count == 6)
    #expect(dashboard.columns.contains { $0.teamNumber == "254" && $0.instructions.contains { $0.instruction == "Score 82 Points" } })
    #expect(dashboard.columns.contains { $0.teamNumber == "971" && $0.instructions.contains { $0.instruction.localizedCaseInsensitiveContains("Defend Team 1323") } })
    #expect(dashboard.columns.contains { $0.teamNumber == "1323" && $0.instructions.contains { $0.instruction == "Stockpile Fuel" } })
}

@Test
func powerScoutFallsBackWhenNextMatchDashboardSnapshotIsMissing() {
    let root = URL(fileURLWithPath: NSTemporaryDirectory(), isDirectory: true)
        .appendingPathComponent("powerscout-next-match-missing-\(UUID().uuidString)", isDirectory: true)
    let repoRoot = root.appendingPathComponent("repo", isDirectory: true)
    let store = NextMatchDashboardStore(applicationSupportRoot: root)

    let result = store.loadSnapshotOrFallback(repoRoot: repoRoot)

    #expect(result.loadedFromLocalJSON == false)
    #expect(result.snapshot.source == "fallback-demo")
    #expect(result.message.localizedCaseInsensitiveContains("No local next-match dashboard JSON exists yet") == true)
}

@Test
func powerScoutLoadsLocalNextMatchDashboardSnapshot() throws {
    let root = URL(fileURLWithPath: NSTemporaryDirectory(), isDirectory: true)
        .appendingPathComponent("powerscout-next-match-local-\(UUID().uuidString)", isDirectory: true)
    let repoRoot = root.appendingPathComponent("repo", isDirectory: true)
    let store = NextMatchDashboardStore(applicationSupportRoot: root)
    let snapshot = NextMatchDashboardSnapshot(
        ourAlliance: "Red",
        firstShiftAlliance: "Blue",
        winProbabilityPercent: 67,
        expectedMargin: 18,
        projectedRedScore: 142,
        projectedBlueScore: 124,
        redTeamNumbers: ["254", "971", "604"],
        blueTeamNumbers: ["1678", "1323", "4414"],
        ourContribution: 215,
        opponentContribution: 197,
        columns: [
            NextMatchTeamShiftColumn(
                teamNumber: "254",
                alliance: "Red",
                planLabel: "Score plan",
                instructions: [
                    NextMatchShiftInstruction(shift: 1, shiftAlliance: "Blue", state: "Other", instruction: "Stockpile Fuel"),
                    NextMatchShiftInstruction(shift: 2, shiftAlliance: "Red", state: "Active", instruction: "Score 82 Points")
                ]
            )
        ],
        source: "admin-v4-local-plan",
        sourceDetail: "Loaded from Admin V4 local strategy snapshot.",
        savedAt: Date(timeIntervalSince1970: 2_000)
    )

    try store.saveSnapshot(snapshot)
    let result = try store.loadSnapshot(repoRoot: repoRoot)

    #expect(result.loadedFromLocalJSON)
    #expect(result.loadedURL == store.applicationSupportURL)
    #expect(result.snapshot.source == "admin-v4-local-plan")
    #expect(result.snapshot.projectedRedScore == 142)
    #expect(result.snapshot.columns.first?.instructions.last?.instruction == "Score 82 Points")
}

@Test
func powerScoutSkipsCorruptApplicationSupportSnapshotAndLoadsRepoSnapshot() throws {
    let root = URL(fileURLWithPath: NSTemporaryDirectory(), isDirectory: true)
        .appendingPathComponent("powerscout-next-match-corrupt-\(UUID().uuidString)", isDirectory: true)
    let repoRoot = root.appendingPathComponent("repo", isDirectory: true)
    let store = NextMatchDashboardStore(applicationSupportRoot: root)
    let repoURL = PowerScoutPaths.nextMatchDashboardSnapshotURL(repoRoot: repoRoot)
    try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
    try FileManager.default.createDirectory(at: repoURL.deletingLastPathComponent(), withIntermediateDirectories: true)
    try Data("{ definitely-not-json".utf8).write(to: store.applicationSupportURL)
    try encodeDashboardSnapshot(makeNextMatchDashboardSnapshot(projectedRedScore: 166, savedAt: Date(timeIntervalSince1970: 3_000))).write(to: repoURL)

    let result = try store.loadSnapshot(repoRoot: repoRoot)

    #expect(result.loadedURL == repoURL)
    #expect(result.snapshot.projectedRedScore == 166)
    #expect(result.message.localizedCaseInsensitiveContains("Ignored unreadable") == true)
}

@Test
func powerScoutLoadsFreshestValidNextMatchDashboardSnapshot() throws {
    let root = URL(fileURLWithPath: NSTemporaryDirectory(), isDirectory: true)
        .appendingPathComponent("powerscout-next-match-freshest-\(UUID().uuidString)", isDirectory: true)
    let repoRoot = root.appendingPathComponent("repo", isDirectory: true)
    let store = NextMatchDashboardStore(applicationSupportRoot: root)
    let repoURL = PowerScoutPaths.nextMatchDashboardSnapshotURL(repoRoot: repoRoot)
    try store.saveSnapshot(makeNextMatchDashboardSnapshot(projectedRedScore: 111, savedAt: Date(timeIntervalSince1970: 1_000)))
    try FileManager.default.createDirectory(at: repoURL.deletingLastPathComponent(), withIntermediateDirectories: true)
    try encodeDashboardSnapshot(makeNextMatchDashboardSnapshot(projectedRedScore: 188, savedAt: Date(timeIntervalSince1970: 4_000))).write(to: repoURL)

    let result = try store.loadSnapshot(repoRoot: repoRoot)

    #expect(result.loadedURL == repoURL)
    #expect(result.snapshot.projectedRedScore == 188)
}

@Test
func historyRewardsSurfaceMirrorsPowerCoinsAndEvidence() {
    #expect(PowerScoutSection.allCases.contains(.historyRewards))
    #expect(PowerScoutKnowledgeBase.startingPowerCoinBalance == 1000)
    #expect(PowerScoutKnowledgeBase.walletSnapshot.scoutNumber == 7)
    #expect(PowerScoutKnowledgeBase.walletSnapshot.balance == 880)
    #expect(PowerScoutKnowledgeBase.walletSnapshot.openStake == 120)
    #expect(PowerScoutKnowledgeBase.powerCoinHistoryRows.contains { $0.matchKey == "QM1" && $0.status == "open" })
    #expect(PowerScoutKnowledgeBase.evidenceLedgerSummaries.contains { $0.detail.localizedCaseInsensitiveContains("Scout Number first") })
}

private func makeNextMatchDashboardSnapshot(
    projectedRedScore: Int = 142,
    savedAt: Date = Date(timeIntervalSince1970: 2_000)
) -> NextMatchDashboardSnapshot {
    NextMatchDashboardSnapshot(
        ourAlliance: "Red",
        firstShiftAlliance: "Blue",
        winProbabilityPercent: 67,
        expectedMargin: 18,
        projectedRedScore: projectedRedScore,
        projectedBlueScore: 124,
        redTeamNumbers: ["254", "971", "604"],
        blueTeamNumbers: ["1678", "1323", "4414"],
        ourContribution: 215,
        opponentContribution: 197,
        columns: [
            NextMatchTeamShiftColumn(
                teamNumber: "254",
                alliance: "Red",
                planLabel: "Score plan",
                instructions: [
                    NextMatchShiftInstruction(shift: 1, shiftAlliance: "Blue", state: "Other", instruction: "Stockpile Fuel"),
                    NextMatchShiftInstruction(shift: 2, shiftAlliance: "Red", state: "Active", instruction: "Score 82 Points")
                ]
            )
        ],
        source: "admin-v4-local-plan",
        sourceDetail: "Loaded from Admin V4 local strategy snapshot.",
        savedAt: savedAt
    )
}

private func encodeDashboardSnapshot(_ snapshot: NextMatchDashboardSnapshot) throws -> Data {
    let encoder = JSONEncoder()
    encoder.dateEncodingStrategy = .iso8601
    encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
    return try encoder.encode(snapshot)
}

@Test
func powerScoutCreatesAndLoadsLocalSyncLedger() throws {
    let root = URL(fileURLWithPath: NSTemporaryDirectory(), isDirectory: true)
        .appendingPathComponent("powerscout-sync-ledger-\(UUID().uuidString)", isDirectory: true)
    let store = PowerScoutSyncLedgerStore(storageRoot: root)

    do {
        _ = try store.loadSnapshot()
        Issue.record("Passive ledger load should not create a synthetic snapshot.")
    } catch let error as PowerScoutSyncLedgerStore.LedgerError {
        #expect(error.errorDescription?.localizedCaseInsensitiveContains("No local sync ledger exists yet") == true)
    }
    #expect(!FileManager.default.fileExists(atPath: store.ledgerURL.path))

    let snapshot = try store.refreshSnapshot(now: Date(timeIntervalSince1970: 1_000))
    let loaded = try store.loadSnapshot()

    #expect(FileManager.default.fileExists(atPath: store.ledgerURL.path))
    #expect(loaded.ledgerURLPath == store.ledgerURL.path)
    #expect(loaded.entries.count == snapshot.entries.count)
    #expect(loaded.entries.contains { $0.surface == "PowerScout Mac" && $0.status == "Contract ready" })
    #expect(loaded.entries.contains { $0.surface == "Firebase" && $0.detail.localizedCaseInsensitiveContains("cross-surface planner") })
    #expect(loaded.nextAction.localizedCaseInsensitiveContains("cross-surface planner"))
}

@Test
func practiceMatchDataUsesFirstAndLocalScorekeeperFallback() {
    let rules = PowerScoutKnowledgeBase.liveOpsSourceRules
    #expect(rules.contains { $0.source == "FIRST Events API" && $0.givesUs.localizedCaseInsensitiveContains("practice") })
    #expect(rules.contains { $0.source == "The Blue Alliance" && $0.limitation.localizedCaseInsensitiveContains("No documented practice") })
    #expect(rules.contains { $0.source == "Statbotics" && $0.limitation.localizedCaseInsensitiveContains("No documented practice") })
    #expect(rules.contains { $0.source == "Practice Scorekeeper" && $0.role == .localFallback })
}

@Test
func predictionEvidenceLoadsFullEventLedgerForRenderedWinnerGraph() throws {
    let root = URL(fileURLWithPath: NSTemporaryDirectory(), isDirectory: true)
        .appendingPathComponent("powerscout-prediction-ledger-\(UUID().uuidString)", isDirectory: true)
    let repoRoot = root.appendingPathComponent("repo", isDirectory: true)
    let store = PredictionEvidenceStore(applicationSupportRoot: root)
    try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
    try Data(predictionLedgerFixture.utf8).write(to: store.applicationSupportURL)

    let result = try store.loadSeries(repoRoot: repoRoot)

    #expect(result.loadedFromLedger)
    #expect(result.loadedURL == store.applicationSupportURL)
    #expect(result.series.eventKey == "2026test")
    #expect(result.series.points.count == 4)
    #expect(result.series.points.first?.label == "Quals 1")
    #expect(result.series.points.last?.label == "Finals 1")
    #expect(result.series.points.last?.actualWinner == 511)
    #expect(result.series.points.last?.alignedPredictedWinner == 423)
    #expect(result.series.winnerAccuracy == 0.75)
    #expect(result.series.metrics?.decisivePredictions == 4)
    #expect(result.series.metrics?.brierScore == 0.22)
    #expect(result.series.metrics?.scoreMae == 42.5)
    #expect(result.series.metrics?.marginMae == 58)
}

@Test
func predictionEvidencePrefersFinalReplayOverLongerRawReplayArtifact() throws {
    let root = URL(fileURLWithPath: NSTemporaryDirectory(), isDirectory: true)
        .appendingPathComponent("powerscout-prediction-priority-\(UUID().uuidString)", isDirectory: true)
    let repoRoot = root.appendingPathComponent("repo", isDirectory: true)
    let store = PredictionEvidenceStore(applicationSupportRoot: root.appendingPathComponent("app-support", isDirectory: true))
    let realURL = repoRoot.appendingPathComponent("SyntheticFullSystemTest/artifacts/sft-real-2026long/prediction-ledger.json")
    let finalURL = repoRoot.appendingPathComponent("SyntheticFullSystemTest/artifacts/tune-2026short-final/prediction-ledger.json")
    try FileManager.default.createDirectory(at: realURL.deletingLastPathComponent(), withIntermediateDirectories: true)
    try FileManager.default.createDirectory(at: finalURL.deletingLastPathComponent(), withIntermediateDirectories: true)
    try Data(makePredictionLedgerFixture(eventKey: "2026long", eventName: "Long Raw Replay", matchCount: 6).utf8).write(to: realURL)
    try Data(makePredictionLedgerFixture(eventKey: "2026short", eventName: "Short Final Replay", matchCount: 4).utf8).write(to: finalURL)

    let result = try store.loadSeries(repoRoot: repoRoot)

    #expect(result.loadedURL?.standardizedFileURL == finalURL.standardizedFileURL)
    #expect(result.sourceKind == .finalReplayArtifact)
    #expect(result.series.eventName == "Short Final Replay")
    #expect(result.series.points.count == 4)
}

@Test
func powerScoutNotesRoundTripAndExportByStableSectionID() throws {
    let root = URL(fileURLWithPath: NSTemporaryDirectory(), isDirectory: true)
        .appendingPathComponent("powerscout-section-notes-\(UUID().uuidString)", isDirectory: true)
    let store = PowerScoutNotesStore(storageRoot: root)
    let notes: [PowerScoutSection: PowerScoutSectionNote] = [
        .dashboard: PowerScoutSectionNote(section: .dashboard, text: "Graph should load full event.", updatedAt: Date(timeIntervalSince1970: 10)),
        .allianceSelection: PowerScoutSectionNote(section: .allianceSelection, text: "Pick list needs decline states.", updatedAt: Date(timeIntervalSince1970: 20))
    ]

    try store.saveNotes(notes)
    let loaded = store.loadNotesOrEmpty()
    let exportedURL = try store.exportNotes(loaded)
    let exported = try JSONDecoder.powerScoutISO8601.decode(PowerScoutNotesExport.self, from: Data(contentsOf: exportedURL))

    #expect(loaded[.dashboard]?.text == "Graph should load full event.")
    #expect(loaded[.allianceSelection]?.sectionID == PowerScoutSection.allianceSelection.id)
    #expect(exported.noteCount == 2)
    #expect(exported.notes.map(\.sectionID).contains(PowerScoutSection.dashboard.id))
}

@Test
func powerScoutNotesLoaderSurvivesDuplicateSectionEntries() throws {
    let root = URL(fileURLWithPath: NSTemporaryDirectory(), isDirectory: true)
        .appendingPathComponent("powerscout-section-notes-duplicates-\(UUID().uuidString)", isDirectory: true)
    let store = PowerScoutNotesStore(storageRoot: root)
    try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
    let duplicateJSON = """
    {
      "app": "PowerScout",
      "schemaVersion": 1,
      "exportedAt": "2026-06-30T00:00:00Z",
      "noteCount": 2,
      "notes": [
        { "sectionID": "Dashboard", "sectionTitle": "Dashboard", "text": "old", "updatedAt": "2026-06-30T00:00:00Z" },
        { "sectionID": "Dashboard", "sectionTitle": "Dashboard", "text": "new", "updatedAt": "2026-06-30T00:01:00Z" }
      ]
    }
    """
    try Data(duplicateJSON.utf8).write(to: store.notesURL)

    let loaded = store.loadNotesOrEmpty()

    #expect(loaded[.dashboard]?.text == "new")
}

@Test
@MainActor
func powerScoutNotesWhitespaceRemovesSectionEntryAndLengthIsCapped() {
    let root = URL(fileURLWithPath: NSTemporaryDirectory(), isDirectory: true)
        .appendingPathComponent("powerscout-section-notes-store-\(UUID().uuidString)", isDirectory: true)
    let store = PowerScoutStore(
        repositoryRoot: root.appendingPathComponent("repo", isDirectory: true),
        notesStore: PowerScoutNotesStore(storageRoot: root)
    )
    let longText = String(repeating: "x", count: PowerScoutNotesStore.maxNoteLength + 50)

    store.updateNoteText(longText, for: .dashboard)
    #expect(store.noteText(for: .dashboard).count == PowerScoutNotesStore.maxNoteLength)

    store.updateNoteText("   \n\t", for: .dashboard)
    #expect(store.noteText(for: .dashboard).isEmpty)
    #expect(store.notesBySection[.dashboard] == nil)
}

private let predictionLedgerFixture = """
{
  "runId": "test-run",
  "eventKey": "2026test",
  "eventName": "Test Regional",
  "entries": [
    {
      "checkpoint": "QM1_POSTED",
      "matchIndex": 0,
      "matchKey": "qm1",
      "title": "Quals 1",
      "predictedWinner": "red",
      "actualWinner": "blue",
      "predictedRedScore": 181,
      "predictedBlueScore": 168,
      "actualRedScore": 66,
      "actualBlueScore": 183,
      "winnerCorrect": false
    },
    {
      "checkpoint": "QM2_POSTED",
      "matchIndex": 1,
      "matchKey": "qm2",
      "title": "Quals 2",
      "predictedWinner": "blue",
      "actualWinner": "blue",
      "predictedRedScore": 201,
      "predictedBlueScore": 229,
      "actualRedScore": 111,
      "actualBlueScore": 258,
      "winnerCorrect": true
    },
    {
      "checkpoint": "QM3_POSTED",
      "matchIndex": 2,
      "matchKey": "qm3",
      "title": "Quals 3",
      "predictedWinner": "blue",
      "actualWinner": "blue",
      "predictedRedScore": 120,
      "predictedBlueScore": 180,
      "actualRedScore": 80,
      "actualBlueScore": 84,
      "winnerCorrect": true
    },
    {
      "checkpoint": "F1M1_POSTED",
      "matchIndex": 3,
      "matchKey": "f1m1",
      "title": "Finals 1",
      "predictedWinner": "blue",
      "actualWinner": "blue",
      "predictedRedScore": 370,
      "predictedBlueScore": 423,
      "actualRedScore": 401,
      "actualBlueScore": 511,
      "winnerCorrect": true
    }
  ],
  "metrics": {
    "matchesPredicted": 4,
    "decisivePredictions": 4,
    "winnerAccuracy": 0.75,
    "qualificationWinnerAccuracy": 0.667,
    "playoffWinnerAccuracy": 1,
    "brierScore": 0.22,
    "scoreMae": 42.5,
    "marginMae": 58
  }
}
"""

private func makePredictionLedgerFixture(eventKey: String, eventName: String, matchCount: Int) -> String {
    let entries = (0..<matchCount).map { index in
        """
        {
          "checkpoint": "QM\(index + 1)_POSTED",
          "matchIndex": \(index),
          "matchKey": "qm\(index + 1)",
          "title": "Quals \(index + 1)",
          "predictedWinner": "blue",
          "actualWinner": "blue",
          "predictedRedScore": \(120 + index),
          "predictedBlueScore": \(160 + index),
          "actualRedScore": \(100 + index),
          "actualBlueScore": \(170 + index),
          "winnerCorrect": true
        }
        """
    }.joined(separator: ",")

    return """
    {
      "runId": "test-run",
      "eventKey": "\(eventKey)",
      "eventName": "\(eventName)",
      "entries": [\(entries)],
      "metrics": {
        "matchesPredicted": \(matchCount),
        "decisivePredictions": \(matchCount),
        "winnerAccuracy": 1
      }
    }
    """
}

private extension JSONDecoder {
    static var powerScoutISO8601: JSONDecoder {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return decoder
    }
}
