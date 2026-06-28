import Foundation

public enum PowerScoutSection: String, CaseIterable, Identifiable {
    case dashboard = "Dashboard"
    case systemAudit = "System Audit"
    case preScout = "Pre Scout"
    case pitScout = "Pit Scout"
    case matchScout = "Match Scout"
    case allianceSelection = "Alliance Selection"
    case reports = "Reports"
    case relay = "Relay"
    case commands = "Commands"

    public var id: String { rawValue }

    var symbolName: String {
        switch self {
        case .dashboard: "rectangle.3.group"
        case .systemAudit: "checklist.checked"
        case .preScout: "magnifyingglass"
        case .pitScout: "wrench.and.screwdriver"
        case .matchScout: "stopwatch"
        case .allianceSelection: "person.3.sequence"
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

public enum PowerScoutKnowledgeBase {
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
            nextMove: "Keep match scout minimal: live behavior, pressure, reliability, role, defense, fouls, and contradiction checks."
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
            detail: "Which teams need a photo, mechanism check, reliability question, auto question, or claim verification first.",
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
            detail: "Self-reported points contributed, denied points, cycle claims, auto modes, and preferred role.",
            trust: .claimed,
            workload: "Pit interview, discounted"
        ),
        ScoutDataNeed(
            lane: .pitScout,
            title: "Verification tasks",
            detail: "Specific questions match scouts must confirm: claimed auto, claimed defense value, claimed cycle ceiling, or reliability.",
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
        MatchScoutEdge("Traffic cycle time", "Public box scores do not explain how a robot moves through real congestion."),
        MatchScoutEdge("Driver decision quality", "A good driver changes the value of the same mechanism under playoff pressure."),
        MatchScoutEdge("Defense value and damage", "Denied points are hard to infer from official scores; a live scout can see who caused the miss."),
        MatchScoutEdge("Failure modes", "The exact way a robot fails matters for pick risk and is rarely visible in clean stat tables."),
        MatchScoutEdge("Partner compatibility", "A robot can be good alone and still conflict with our preferred routes or roles."),
        MatchScoutEdge("Pit-claim contradictions", "Inflated claims become useful only when we can prove whether they hold up in matches.")
    ]

    public static let commands: [CommandSpec] = [
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
