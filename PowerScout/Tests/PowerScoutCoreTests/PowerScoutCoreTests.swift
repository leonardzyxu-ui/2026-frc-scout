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
    #expect(edgeTitles.contains("Traffic cycle time"))
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
