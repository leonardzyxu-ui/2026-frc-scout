import Foundation

public enum PowerScoutSection: String, CaseIterable, Identifiable {
    case dashboard = "Dashboard"
    case liveOps = "Live Ops"
    case systemAudit = "System Audit"
    case preScout = "Pre Scout"
    case pitScout = "Pit Scout"
    case matchScout = "Match Scout"
    case allianceSelection = "Alliance Selection"
    case historyRewards = "History / Rewards"
    case reports = "Reports"
    case relay = "Relay"
    case commands = "Commands"

    public var id: String { rawValue }

    var symbolName: String {
        switch self {
        case .dashboard: "rectangle.3.group"
        case .liveOps: "bolt.horizontal.circle"
        case .systemAudit: "checklist.checked"
        case .preScout: "magnifyingglass"
        case .pitScout: "wrench.and.screwdriver"
        case .matchScout: "stopwatch"
        case .allianceSelection: "person.3.sequence"
        case .historyRewards: "clock.badge.checkmark"
        case .reports: "doc.text.magnifyingglass"
        case .relay: "antenna.radiowaves.left.and.right"
        case .commands: "terminal"
        }
    }
}

public enum ScoutLane: String, CaseIterable, Identifiable, Sendable {
    case preScout = "Pre Scout"
    case pitScout = "Pit Scout"
    case matchScout = "Match Scout"

    public var id: String { rawValue }

    var purpose: String {
        switch self {
        case .preScout:
            "Move every calm, public, slow-research question out of match day."
        case .pitScout:
            "Collect robot facts and separate objective observation from inflated claims."
        case .matchScout:
            "Capture live truth that public data, pit claims, and other teams usually miss."
        }
    }
}

public enum EvidenceTrust: String, Sendable {
    case objective = "Objective"
    case claimed = "Claimed"
    case liveObserved = "Live Observed"
    case derived = "Derived"

    var note: String {
        switch self {
        case .objective:
            "Trust when our scout can see or measure it."
        case .claimed:
            "Useful as a lead, but discount until match evidence confirms it."
        case .liveObserved:
            "High value because it reflects the robot under pressure."
        case .derived:
            "Good for priors; keep model assumptions visible."
        }
    }
}

public struct ScoutDataNeed: Identifiable, Hashable, Sendable {
    public let id: String
    public let lane: ScoutLane
    public let title: String
    public let detail: String
    public let trust: EvidenceTrust
    public let workload: String

    public init(lane: ScoutLane, title: String, detail: String, trust: EvidenceTrust, workload: String) {
        self.id = "\(lane.rawValue)-\(title)"
        self.lane = lane
        self.title = title
        self.detail = detail
        self.trust = trust
        self.workload = workload
    }
}

public struct ScoutSystemScore: Identifiable, Hashable, Sendable {
    public let id: String
    public let lane: ScoutLane
    public let score: Int
    public let verdict: String
    public let risk: String
    public let nextMove: String

    public init(lane: ScoutLane, score: Int, verdict: String, risk: String, nextMove: String) {
        self.id = lane.rawValue
        self.lane = lane
        self.score = score
        self.verdict = verdict
        self.risk = risk
        self.nextMove = nextMove
    }
}

public struct MatchScoutEdge: Identifiable, Hashable, Sendable {
    public let id: String
    public let title: String
    public let whyItMatters: String

    public init(_ title: String, _ whyItMatters: String) {
        self.id = title
        self.title = title
        self.whyItMatters = whyItMatters
    }
}

public struct StrategyMetricDefinition: Identifiable, Hashable, Sendable {
    public let id: String
    public let name: String
    public let meaning: String
    public let scoutSource: String

    public init(_ name: String, _ meaning: String, scoutSource: String) {
        self.id = name
        self.name = name
        self.meaning = meaning
        self.scoutSource = scoutSource
    }
}

public struct StrategySafetyRule: Identifiable, Hashable, Sendable {
    public let id: String
    public let title: String
    public let detail: String

    public init(_ title: String, _ detail: String) {
        self.id = title
        self.title = title
        self.detail = detail
    }
}

public struct CommandSpec: Identifiable, Hashable, Sendable {
    public let id: String
    public let title: String
    public let subtitle: String
    public let arguments: [String]
    public let usesProxy: Bool

    public init(title: String, subtitle: String, arguments: [String], usesProxy: Bool = false) {
        self.id = title
        self.title = title
        self.subtitle = subtitle
        self.arguments = arguments
        self.usesProxy = usesProxy
    }
}

public enum LiveOpsSourceRole: String, Sendable {
    case authoritative = "Authoritative"
    case syncSource = "Sync Source"
    case contextOnly = "Context Only"
    case localFallback = "Local Fallback"
}

public struct LiveOpsPipelineStep: Identifiable, Hashable, Sendable {
    public let id: String
    public let title: String
    public let detail: String
    public let owner: String
    public let urgency: String

    public init(_ title: String, detail: String, owner: String, urgency: String) {
        self.id = title
        self.title = title
        self.detail = detail
        self.owner = owner
        self.urgency = urgency
    }
}

public struct LiveOpsSourceRule: Identifiable, Hashable, Sendable {
    public let id: String
    public let source: String
    public let role: LiveOpsSourceRole
    public let givesUs: String
    public let limitation: String

    public init(_ source: String, role: LiveOpsSourceRole, givesUs: String, limitation: String) {
        self.id = source
        self.source = source
        self.role = role
        self.givesUs = givesUs
        self.limitation = limitation
    }
}

public enum LiveOpsFreshnessState: String, Sendable {
    case ready = "Ready"
    case syncing = "Syncing"
    case credentialGated = "Credential Gated"
    case fallback = "Fallback"
    case modelRerun = "Model Rerun"
}

public struct LiveOpsFreshnessCard: Identifiable, Hashable, Sendable {
    public let id: String
    public let source: String
    public let state: LiveOpsFreshnessState
    public let target: String
    public let detail: String
    public let action: String

    public init(_ source: String, state: LiveOpsFreshnessState, target: String, detail: String, action: String) {
        self.id = source
        self.source = source
        self.state = state
        self.target = target
        self.detail = detail
        self.action = action
    }
}

public struct DriverBriefingOutput: Identifiable, Hashable, Sendable {
    public let id: String
    public let title: String
    public let value: String
    public let detail: String
    public let decisionUse: String

    public init(_ title: String, value: String, detail: String, decisionUse: String) {
        self.id = title
        self.title = title
        self.value = value
        self.detail = detail
        self.decisionUse = decisionUse
    }
}

public struct CommandResult: Identifiable, Hashable, Sendable {
    public let id = UUID()
    public let title: String
    public let exitCode: Int32
    public let stdout: String
    public let stderr: String
    public let startedAt: Date
    public let finishedAt: Date

    public var succeeded: Bool { exitCode == 0 }
    public var duration: TimeInterval { finishedAt.timeIntervalSince(startedAt) }
}

public struct PowerScoutSyncLedgerEntry: Identifiable, Codable, Hashable, Sendable {
    public let id: String
    public let surface: String
    public let role: String
    public let status: String
    public let currentVersion: Int
    public let preservedVersions: Int
    public let conflicts: Int
    public let lastCheckedAt: Date
    public let detail: String

    public init(surface: String, role: String, status: String, currentVersion: Int, preservedVersions: Int, conflicts: Int, lastCheckedAt: Date, detail: String) {
        self.id = surface
        self.surface = surface
        self.role = role
        self.status = status
        self.currentVersion = currentVersion
        self.preservedVersions = preservedVersions
        self.conflicts = conflicts
        self.lastCheckedAt = lastCheckedAt
        self.detail = detail
    }
}

public struct PowerScoutSyncSnapshot: Codable, Hashable, Sendable {
    public let generatedAt: Date
    public let ledgerURLPath: String
    public let entries: [PowerScoutSyncLedgerEntry]
    public let summary: String
    public let nextAction: String

    public init(generatedAt: Date, ledgerURLPath: String, entries: [PowerScoutSyncLedgerEntry], summary: String, nextAction: String) {
        self.generatedAt = generatedAt
        self.ledgerURLPath = ledgerURLPath
        self.entries = entries
        self.summary = summary
        self.nextAction = nextAction
    }
}

public struct PowerCoinWalletSnapshot: Identifiable, Hashable, Sendable {
    public let id: String
    public let scoutName: String
    public let scoutNumber: Int?
    public let balance: Int
    public let openStake: Int
    public let openBets: Int
    public let lastResultDelta: Int?
    public let lastResultMatch: String
    public let note: String

    public init(scoutName: String, scoutNumber: Int?, balance: Int, openStake: Int, openBets: Int, lastResultDelta: Int?, lastResultMatch: String, note: String) {
        self.id = scoutNumber.map { "scout-\($0)" } ?? scoutName
        self.scoutName = scoutName
        self.scoutNumber = scoutNumber
        self.balance = balance
        self.openStake = openStake
        self.openBets = openBets
        self.lastResultDelta = lastResultDelta
        self.lastResultMatch = lastResultMatch
        self.note = note
    }
}

public struct PowerCoinHistoryRow: Identifiable, Hashable, Sendable {
    public let id: String
    public let matchKey: String
    public let side: String
    public let stake: Int
    public let status: String
    public let delta: Int?

    public init(matchKey: String, side: String, stake: Int, status: String, delta: Int?) {
        self.id = "\(matchKey)-\(side)-\(stake)-\(status)"
        self.matchKey = matchKey
        self.side = side
        self.stake = stake
        self.status = status
        self.delta = delta
    }
}

public struct EvidenceLedgerSummary: Identifiable, Hashable, Sendable {
    public let id: String
    public let label: String
    public let value: String
    public let detail: String
    public let tone: String

    public init(_ label: String, value: String, detail: String, tone: String) {
        self.id = label
        self.label = label
        self.value = value
        self.detail = detail
        self.tone = tone
    }
}

public enum PowerScoutKnowledgeBase {
    public static let startingPowerCoinBalance = 1000

    public static let walletSnapshot = PowerCoinWalletSnapshot(
        scoutName: "Test Scout QA",
        scoutNumber: 7,
        balance: 880,
        openStake: 120,
        openBets: 1,
        lastResultDelta: nil,
        lastResultMatch: "No settled bets",
        note: "Native wallet readout follows the same scout-number-first contract as the web cache."
    )

    public static let powerCoinHistoryRows: [PowerCoinHistoryRow] = [
        PowerCoinHistoryRow(matchKey: "QM1", side: "Red", stake: 120, status: "open", delta: -120)
    ]

    public static let evidenceLedgerSummaries: [EvidenceLedgerSummary] = [
        EvidenceLedgerSummary("Evidence Rows", value: "local", detail: "Match, pit, pre-scout, and deleted/tombstoned rows stay auditable in browser cache exports.", tone: "cyan"),
        EvidenceLedgerSummary("Submitted State", value: "versioned", detail: "Every Match Scout V4 row carries version and submitted-state metadata for recovery.", tone: "green"),
        EvidenceLedgerSummary("PowerCoins", value: "number-first", detail: "Wallet identity is Scout Number first; display names can change without splitting balances.", tone: "yellow"),
        EvidenceLedgerSummary("Admin Controls", value: "guarded", detail: "Head scout can settle, adjust, disqualify, and restore reward predictions with audit confirmation.", tone: "orange")
    ]

    public static let systemScores: [ScoutSystemScore] = [
        ScoutSystemScore(
            lane: .preScout,
            score: 72,
            verdict: "Present, but not yet dominant enough.",
            risk: "The app can pull TBA profiles and missing-info sheets, but too much event pressure still lands on match scouts.",
            nextMove: "Make pre-scout generate team priors, pit priorities, and match-scout watch questions before practice starts."
        ),
        ScoutSystemScore(
            lane: .pitScout,
            score: 76,
            verdict: "Operational, with trust labeling needed.",
            risk: "Objective robot facts are useful; subjective self-reported scoring and defense values can be inflated.",
            nextMove: "Separate observed specs from claimed performance and send questionable claims to match scouts for verification."
        ),
        ScoutSystemScore(
            lane: .matchScout,
            score: 86,
            verdict: "Strongest current lane, but at overload risk.",
            risk: "One scout can see enormous detail in one match, but asking for everything lowers data quality.",
            nextMove: "Keep match scout minimal: live behavior, pressure, function confidence, role, defense, fouls, and contradiction checks."
        )
    ]

    public static let dataNeeds: [ScoutDataNeed] = [
        ScoutDataNeed(
            lane: .preScout,
            title: "Team history and event priors",
            detail: "Past event strength, ranking behavior, playoff roles, public robot media, awards, and trend lines.",
            trust: .derived,
            workload: "Before event, calm research"
        ),
        ScoutDataNeed(
            lane: .preScout,
            title: "Expected robot role",
            detail: "Predicted offense, defense, support, endgame, or specialist role before local evidence exists.",
            trust: .derived,
            workload: "Before event, model assisted"
        ),
        ScoutDataNeed(
            lane: .preScout,
            title: "Pit priority list",
            detail: "Which teams need a photo, mechanism check, function-confidence question, auto question, or claim verification first.",
            trust: .derived,
            workload: "Before pit opens"
        ),
        ScoutDataNeed(
            lane: .pitScout,
            title: "Objective robot specs",
            detail: "Drivetrain, chassis, mechanisms, turret count, physical constraints, endgame hardware, spare readiness, and photos.",
            trust: .objective,
            workload: "Pit interview, observable"
        ),
        ScoutDataNeed(
            lane: .pitScout,
            title: "Claimed scoring and defense",
            detail: "Self-reported points contributed, denied points, flow claims, auto modes, and preferred role.",
            trust: .claimed,
            workload: "Pit interview, discounted"
        ),
        ScoutDataNeed(
            lane: .pitScout,
            title: "Verification tasks",
            detail: "Specific questions match scouts must confirm: claimed auto, claimed defense value, claimed ceiling, or function confidence.",
            trust: .claimed,
            workload: "Pit-to-match handoff"
        ),
        ScoutDataNeed(
            lane: .matchScout,
            title: "Live role under pressure",
            detail: "What role they actually play against defense, traffic, partner mistakes, and real match pacing.",
            trust: .liveObserved,
            workload: "During match, minimal taps plus notes"
        ),
        ScoutDataNeed(
            lane: .matchScout,
            title: "Reliability and recovery",
            detail: "Robot death, comms loss, mechanism damage, tipping, slow reset, recovery behavior, and driver reaction.",
            trust: .liveObserved,
            workload: "During match, high value"
        ),
        ScoutDataNeed(
            lane: .matchScout,
            title: "Contradiction detection",
            detail: "Whether pit claims and pre-scout priors are confirmed or disproven by actual matches.",
            trust: .liveObserved,
            workload: "After match, fast review"
        )
    ]

    public static let matchScoutEdges: [MatchScoutEdge] = [
        MatchScoutEdge("Traffic under pressure", "Public box scores do not explain how a robot moves through real congestion."),
        MatchScoutEdge("Driver decision quality", "A good driver changes the value of the same mechanism under playoff pressure."),
        MatchScoutEdge("Defense value and damage", "Denied points are hard to infer from official scores; a live scout can see who caused the miss."),
        MatchScoutEdge("Failure modes", "The exact way a robot fails matters for pick risk and is rarely visible in clean stat tables."),
        MatchScoutEdge("Partner compatibility", "A robot can be good alone and still conflict with our preferred routes or roles."),
        MatchScoutEdge("Pit-claim contradictions", "Inflated claims become useful only when we can prove whether they hold up in matches.")
    ]

    public static let strategyMetrics: [StrategyMetricDefinition] = [
        StrategyMetricDefinition("Contribution", "How much the robot can add when deployed to score.", scoutSource: "Match scout scoring, reconciled to official alliance totals."),
        StrategyMetricDefinition("Floor", "The lowest scouted point count, including dead or broken matches.", scoutSource: "Match scout rows plus failure context."),
        StrategyMetricDefinition("Floor Non Zero", "The lowest non-zero contribution, used when the robot is functioning.", scoutSource: "Match scout rows with zero failures separated."),
        StrategyMetricDefinition("Ceiling", "The highest scouted contribution, useful for upside plans.", scoutSource: "Match scout rows and range shape."),
        StrategyMetricDefinition("Defense", "How many points the robot can deny from opponents.", scoutSource: "Shift defense assignments, target rows, and official-score reconciliation."),
        StrategyMetricDefinition("Contribution Deviation", "How volatile the robot's scoring contribution is.", scoutSource: "Standard deviation of contribution samples."),
        StrategyMetricDefinition("Defense Deviation", "How volatile the robot's defensive value is.", scoutSource: "Standard deviation of defense-denial samples."),
        StrategyMetricDefinition("DPR", "Official-score opponent scoring context, useful but not causal defense truth.", scoutSource: "TBA OPR/DPR-style official-score regression.")
    ]

    public static let strategySafeties: [StrategySafetyRule] = [
        StrategySafetyRule("Search role combinations", "Plan offense, defense, and stockpile combinations dynamically for each alliance instead of pre-labeling a team forever."),
        StrategySafetyRule("Cap defense", "Never let defense deny more points than the opponent has available to lose."),
        StrategySafetyRule("Use variance deliberately", "If behind, consider higher-deviation plans as smart gambles; if ahead, prefer stable plans that protect RP paths."),
        StrategySafetyRule("Normalize evidence", "Scale scout scoring to official totals and normalize defender share sliders when scouts do not sum to 100%."),
        StrategySafetyRule("Keep DPR separate", "Use DPR as context only; live scout-observed Defense remains the decision metric.")
    ]

    public static let liveOpsSteps: [LiveOpsPipelineStep] = [
        LiveOpsPipelineStep(
            "Scout evidence lands locally first",
            detail: "Match Scout browsers, offline JSON, and Firebase writes all preserve versions so a bad connection does not erase the newest scout truth.",
            owner: "Scout devices + PowerScout",
            urgency: "during match"
        ),
        LiveOpsPipelineStep(
            "PowerScout reconciles local and Firebase",
            detail: "The Mac app should compare scout cache versions, Firebase records, and imported JSON, then keep every version while promoting the newest usable record.",
            owner: "PowerScout local database",
            urgency: "immediate"
        ),
        LiveOpsPipelineStep(
            "Official sources refresh after each match",
            detail: "TBA, FIRST Events, Statbotics, and scout data are refreshed after the score is revealed. FIRST is the practice-day sync source when available.",
            owner: "PowerScout refresh runner",
            urgency: "under one minute"
        ),
        LiveOpsPipelineStep(
            "Models rerun from the refreshed cache",
            detail: "Contribution, Defense, floor, ceiling, deviations, and next-match strategy should be recomputed from the local cache instead of waiting for a deployed website.",
            owner: "PowerScout model runner",
            urgency: "under one minute"
        ),
        LiveOpsPipelineStep(
            "Driver-team inference is the output",
            detail: "The useful product is a driver team next-match plan: offense/defense roles, expected margin, win probability, RP upside, gamble warning, and data-quality flags.",
            owner: "Head scout",
            urgency: "before queueing"
        )
    ]

    public static let liveOpsSourceRules: [LiveOpsSourceRule] = [
        LiveOpsSourceRule(
            "PowerScout Local Database",
            role: .authoritative,
            givesUs: "Fast local storage, conflict history, model-ready cache, and offline survivability on Leo's Mac.",
            limitation: "Must sync outward to Firebase and imports so it does not become a private island."
        ),
        LiveOpsSourceRule(
            "Firebase",
            role: .syncSource,
            givesUs: "Shared field data from scout devices and the hosted website.",
            limitation: "Network timing can lag; never block driver-team decisions on one slow write."
        ),
        LiveOpsSourceRule(
            "FIRST Events API",
            role: .syncSource,
            givesUs: "Official FMS schedules, results, and practice-match data when credentials and event sync are healthy.",
            limitation: "Authenticated and venue-sync dependent; use local practice scorekeeping as the fallback."
        ),
        LiveOpsSourceRule(
            "The Blue Alliance",
            role: .contextOnly,
            givesUs: "Public official quals/playoffs, alliances, winners, and score breakdowns.",
            limitation: "No documented practice-match level in the public match schema."
        ),
        LiveOpsSourceRule(
            "Statbotics",
            role: .contextOnly,
            givesUs: "EPA-style public ratings and prediction context.",
            limitation: "No documented practice-match score feed; do not treat it as practice truth."
        ),
        LiveOpsSourceRule(
            "Practice Scorekeeper",
            role: .localFallback,
            givesUs: "Red/blue practice totals, threshold notes, and scorekeeper observations when APIs lag or omit practice.",
            limitation: "Needs a simple local entry surface and post-match reconciliation."
        )
    ]

    public static let liveOpsFreshnessCards: [LiveOpsFreshnessCard] = [
        LiveOpsFreshnessCard(
            "PowerScout Local DB",
            state: .ready,
            target: "instant",
            detail: "Version-preserving local truth for scout forms, imported JSON, evidence ledgers, and PowerCoin records.",
            action: "Promote newest usable versions, never erase older versions."
        ),
        LiveOpsFreshnessCard(
            "Firebase Scout Sync",
            state: .syncing,
            target: "5-10 sec",
            detail: "Receives scout-device submissions and gives the website/admin side shared field state.",
            action: "Pull after every match and mark slow devices as local-first, not lost."
        ),
        LiveOpsFreshnessCard(
            "TBA Results",
            state: .credentialGated,
            target: "under 1 min",
            detail: "Official public match schedule, winners, alliances, and score breakdown context.",
            action: "Use local env keys on the Mac; skip cleanly if the key is unavailable."
        ),
        LiveOpsFreshnessCard(
            "FIRST Events",
            state: .credentialGated,
            target: "under 1 min",
            detail: "Authenticated official schedule/results source, including practice-match path when available at the venue.",
            action: "Use practice scorekeeper fallback when credentials or venue sync are unavailable."
        ),
        LiveOpsFreshnessCard(
            "Statbotics",
            state: .ready,
            target: "under 1 min",
            detail: "EPA context and public predictive baseline for cross-checking our local model.",
            action: "Refresh as context only; scout-observed Contribution and Defense remain decision truth."
        ),
        LiveOpsFreshnessCard(
            "Model Rerun",
            state: .modelRerun,
            target: "before queueing",
            detail: "Recomputes Contribution, Defense, floors, ceilings, deviations, and next-match strategy from refreshed cache.",
            action: "Return driver-team outputs instead of a raw stats dump."
        )
    ]

    public static let driverBriefingOutputs: [DriverBriefingOutput] = [
        DriverBriefingOutput(
            "Win probability",
            value: "Red/Blue probability",
            detail: "Uses expected point-difference contribution and combined alliance variance after role search.",
            decisionUse: "Tell drive team whether the base plan is favored or needs a gamble."
        ),
        DriverBriefingOutput(
            "Role plan",
            value: "Offense / Defense / Stockpile",
            detail: "Searches each alliance's offense, defense, and stockpile role combination, caps over-defense, and keeps RP incentives separate from playoffs.",
            decisionUse: "Assign who scores, who denies, and who supports ball flow."
        ),
        DriverBriefingOutput(
            "Expected margin",
            value: "Mean plus deviation",
            detail: "Shows predicted margin with uncertainty so a smaller mean can still be chosen if variance creates a smart upset path.",
            decisionUse: "Decide whether to protect a stable win or take a calculated risk."
        ),
        DriverBriefingOutput(
            "RP upside",
            value: "Energized / Supercharged / Traversal",
            detail: "Qualification mode weighs extra ranking-point paths without letting them corrupt playoff pick logic.",
            decisionUse: "Avoid over-defending when score thresholds are more valuable than margin."
        ),
        DriverBriefingOutput(
            "Data-quality flags",
            value: "Freshness and conflicts",
            detail: "Calls out stale scout devices, missing official totals, first-shift disagreement, and unresolved version conflicts.",
            decisionUse: "Know what to trust before the robot is already in queue."
        )
    ]

    public static let postMatchRefreshCommand = CommandSpec(
        title: "Post-Match Refresh",
        subtitle: "Refresh TBA, FIRST, Statbotics, Firebase/scout data, then rerun model inferences.",
        arguments: ["npm", "run", "powerscout:post-match-refresh"],
        usesProxy: true
    )

    public static let commands: [CommandSpec] = [
        postMatchRefreshCommand,
        CommandSpec(
            title: "Head Scout Status",
            subtitle: "Official site, Admin V2 graph link, relay summary, and morning cues.",
            arguments: ["npm", "run", "check:head-scout"],
            usesProxy: true
        ),
        CommandSpec(
            title: "Competition Readiness",
            subtitle: "Route markers, deploy proof, forecast ledger, and relay markers.",
            arguments: ["npm", "run", "check:competition"],
            usesProxy: true
        ),
        CommandSpec(
            title: "Morning Report",
            subtitle: "Product-style scouting progress readout.",
            arguments: ["npm", "run", "report:morning"],
            usesProxy: true
        ),
        CommandSpec(
            title: "PPT Background Capture",
            subtitle: "Regenerate the scouting website screenshot for decks.",
            arguments: ["npm", "run", "capture:ppt-background"],
            usesProxy: true
        )
    ]
}
