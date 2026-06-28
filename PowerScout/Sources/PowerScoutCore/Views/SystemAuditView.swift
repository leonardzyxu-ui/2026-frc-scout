import SwiftUI

struct SystemAuditView: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            PSPageHeader(
                eyebrow: "Honest audit",
                title: "Pre, pit, match: are we ready?",
                subtitle: "The current scouting system has real coverage in all three lanes. The weakness is not absence; it is workload balance and trust labeling."
            )

            LazyVGrid(columns: [GridItem(.adaptive(minimum: 300), spacing: 14)], spacing: 14) {
                ForEach(PowerScoutKnowledgeBase.systemScores) { item in
                    PSCard {
                        VStack(alignment: .leading, spacing: 12) {
                            HStack {
                                PSScoreRing(score: item.score)
                                VStack(alignment: .leading, spacing: 4) {
                                    Text(item.lane.rawValue)
                                        .font(.title3.weight(.bold))
                                    Text(item.verdict)
                                        .font(.subheadline.weight(.semibold))
                                        .foregroundStyle(.secondary)
                                }
                            }
                            Divider()
                            labeled("Risk", item.risk)
                            labeled("Next move", item.nextMove)
                        }
                    }
                }
            }

            PSCard {
                VStack(alignment: .leading, spacing: 12) {
                    Text("System Philosophy")
                        .font(.title3.weight(.bold))
                    Text("Do not cram everything into match scout. That is where the best live truth lives, but overloaded scouts create weaker data.")
                        .font(.headline)
                    Divider()
                    labeled("Pre Scout", "Move public research, priors, team history, video notes, and pit priorities before the event because that is when we have time.")
                    labeled("Pit Scout", "Trust objective observations like mechanisms and turret count. Discount subjective claims like points contributed or denied until match evidence proves them.")
                    labeled("Match Scout", "Collect only feasible in-action truth: actual role, real cycle behavior, pressure response, reliability, defense effect, fouls, and contradictions.")
                }
            }
        }
    }

    private func labeled(_ label: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label.uppercased())
                .font(.caption.weight(.bold))
                .foregroundStyle(.secondary)
            Text(value)
                .font(.callout)
                .fixedSize(horizontal: false, vertical: true)
        }
    }
}
