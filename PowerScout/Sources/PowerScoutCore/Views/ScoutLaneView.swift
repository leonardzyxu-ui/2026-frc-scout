import SwiftUI

struct ScoutLaneView: View {
    let lane: ScoutLane

    private var needs: [ScoutDataNeed] {
        PowerScoutKnowledgeBase.dataNeeds.filter { $0.lane == lane }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            PSPageHeader(
                eyebrow: "Scout lane",
                title: lane.rawValue,
                subtitle: lane.purpose
            )

            PSCard {
                VStack(alignment: .leading, spacing: 12) {
                    Text(primaryRuleTitle)
                        .font(.title3.weight(.bold))
                    Text(primaryRuleDetail)
                        .font(.body)
                        .foregroundStyle(.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }

            LazyVGrid(columns: [GridItem(.adaptive(minimum: 280), spacing: 14)], spacing: 14) {
                ForEach(needs) { item in
                    PSCard {
                        VStack(alignment: .leading, spacing: 10) {
                            HStack {
                                PSTag(text: item.trust.rawValue, color: color(for: item.trust))
                                Spacer()
                                Text(item.workload)
                                    .font(.caption.weight(.semibold))
                                    .foregroundStyle(.secondary)
                            }
                            Text(item.title)
                                .font(.headline)
                            Text(item.detail)
                                .font(.callout)
                                .foregroundStyle(.secondary)
                                .fixedSize(horizontal: false, vertical: true)
                            Text(item.trust.note)
                                .font(.caption)
                                .foregroundStyle(.tertiary)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    }
                }
            }

            if lane == .matchScout {
                PSCard {
                    VStack(alignment: .leading, spacing: 12) {
                        Text("What match scout can get that others usually cannot")
                            .font(.title3.weight(.bold))
                        ForEach(PowerScoutKnowledgeBase.matchScoutEdges) { edge in
                            HStack(alignment: .top, spacing: 12) {
                                Image(systemName: "scope")
                                    .foregroundStyle(.blue)
                                    .frame(width: 22)
                                VStack(alignment: .leading, spacing: 3) {
                                    Text(edge.title)
                                        .font(.headline)
                                    Text(edge.whyItMatters)
                                        .font(.callout)
                                        .foregroundStyle(.secondary)
                                }
                            }
                            if edge.id != PowerScoutKnowledgeBase.matchScoutEdges.last?.id {
                                Divider()
                            }
                        }
                    }
                }
            }
        }
    }

    private var primaryRuleTitle: String {
        switch lane {
        case .preScout:
            "Push information here whenever possible."
        case .pitScout:
            "Separate facts from claims."
        case .matchScout:
            "Only ask for feasible live truth."
        }
    }

    private var primaryRuleDetail: String {
        switch lane {
        case .preScout:
            "If a question can be answered from public records, video, historical event data, or model priors, do it before competition pressure starts."
        case .pitScout:
            "Objective robot facts are valuable. Self-reported scoring and defense value are leads, not truth, until real match evidence confirms them."
        case .matchScout:
            "One scout in one match can see a lot, but cannot capture everything well. Match scout should verify real capability, behavior under pressure, reliability, and contradictions."
        }
    }

    private func color(for trust: EvidenceTrust) -> Color {
        switch trust {
        case .objective: .green
        case .claimed: .orange
        case .liveObserved: .blue
        case .derived: .purple
        }
    }
}
