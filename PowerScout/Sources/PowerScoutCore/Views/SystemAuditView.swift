import SwiftUI

struct SystemAuditView: View {
    private let auditColumns = [
        GridItem(.flexible(minimum: 230), spacing: 12),
        GridItem(.flexible(minimum: 230), spacing: 12),
        GridItem(.flexible(minimum: 230), spacing: 12)
    ]

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            PSPageHeader(
                eyebrow: "Honest audit",
                title: "Pre, pit, match: are we ready?",
                subtitle: "The current scouting system has real coverage in all three lanes. The weakness is not absence; it is workload balance and trust labeling."
            )

            HStack(alignment: .top, spacing: 12) {
                quickFact("System score", "78", "Good base, not finished")
                quickFact("Main risk", "Load", "Match scouts still carry too much")
                quickFact("Next focus", "Before event", "Move slow work into pre-scout")
            }

            LazyVGrid(columns: auditColumns, spacing: 12) {
                ForEach(PowerScoutKnowledgeBase.systemScores) { item in
                    auditCard(item)
                }
            }

            PSCard {
                VStack(alignment: .leading, spacing: 14) {
                    HStack(alignment: .firstTextBaseline) {
                        Text("System Philosophy")
                            .font(.title3.weight(.bold))
                        Spacer()
                        PSTag(text: "Not perfect yet", color: .yellow)
                    }
                    Text("Do not cram everything into match scout. The best live truth lives there, but overloaded scouts create weaker data.")
                        .font(.headline.weight(.semibold))
                    Divider()
                    LazyVGrid(columns: auditColumns, spacing: 12) {
                        laneRule("Pre Scout", "Move public research, priors, team history, video notes, and pit priorities before the event.")
                        laneRule("Pit Scout", "Trust observed mechanisms and specs. Discount claimed points contributed or denied until match proof exists.")
                        laneRule("Match Scout", "Collect feasible live truth: role, cycle behavior, pressure, reliability, defense, fouls, and contradictions.")
                    }
                }
            }
        }
    }

    private func auditCard(_ item: ScoutSystemScore) -> some View {
        PSCard {
            VStack(alignment: .leading, spacing: 10) {
                HStack(alignment: .center, spacing: 10) {
                    PSScoreRing(score: item.score, diameter: 50, lineWidth: 7)
                    VStack(alignment: .leading, spacing: 3) {
                        Text(item.lane.rawValue)
                            .font(.headline.weight(.bold))
                        Text(item.verdict)
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(.secondary)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
                Divider()
                labeled("Risk", item.risk)
                labeled("Next", item.nextMove)
            }
            .frame(minHeight: 218, alignment: .top)
        }
    }

    private func quickFact(_ label: String, _ value: String, _ detail: String) -> some View {
        PSCard {
            VStack(alignment: .leading, spacing: 4) {
                Text(label.uppercased())
                    .font(.caption2.weight(.bold))
                    .foregroundStyle(.secondary)
                Text(value)
                    .font(.title2.weight(.bold))
                    .monospacedDigit()
                Text(detail)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    private func laneRule(_ label: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 5) {
            Text(label.uppercased())
                .font(.caption.weight(.bold))
                .foregroundStyle(.secondary)
            Text(value)
                .font(.callout)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func labeled(_ label: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label.uppercased())
                .font(.caption2.weight(.bold))
                .foregroundStyle(.secondary)
            Text(value)
                .font(.caption)
                .fixedSize(horizontal: false, vertical: true)
        }
    }
}
