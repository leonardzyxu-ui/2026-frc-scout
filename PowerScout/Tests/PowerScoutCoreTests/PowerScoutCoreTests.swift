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
func historyRewardsSurfaceMirrorsPowerCoinsAndEvidence() {
    #expect(PowerScoutSection.allCases.contains(.historyRewards))
    #expect(PowerScoutKnowledgeBase.startingPowerCoinBalance == 1000)
    #expect(PowerScoutKnowledgeBase.walletSnapshot.scoutNumber == 7)
    #expect(PowerScoutKnowledgeBase.walletSnapshot.balance == 880)
    #expect(PowerScoutKnowledgeBase.walletSnapshot.openStake == 120)
    #expect(PowerScoutKnowledgeBase.powerCoinHistoryRows.contains { $0.matchKey == "QM1" && $0.status == "open" })
    #expect(PowerScoutKnowledgeBase.evidenceLedgerSummaries.contains { $0.detail.localizedCaseInsensitiveContains("Scout Number first") })
}

@Test
func powerScoutCreatesAndLoadsLocalSyncLedger() throws {
    let root = URL(fileURLWithPath: NSTemporaryDirectory(), isDirectory: true)
        .appendingPathComponent("powerscout-sync-ledger-\(UUID().uuidString)", isDirectory: true)
    let store = PowerScoutSyncLedgerStore(storageRoot: root)
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
