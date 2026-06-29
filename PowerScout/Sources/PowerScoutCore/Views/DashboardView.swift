import SwiftUI

struct DashboardView: View {
    let store: PowerScoutStore
    let openURL: OpenURLAction

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            PSPageHeader(
                eyebrow: "Powerhouse scouting",
                title: "PowerScout",
                subtitle: "A native command center for match-day readiness, prediction evidence, and the uncomfortable but important question: are our scouting lanes actually prepared?"
            )

            NextMatchDashboardView(snapshot: PowerScoutKnowledgeBase.nextMatchDashboard)

            LazyVGrid(columns: [GridItem(.adaptive(minimum: 260), spacing: 14)], spacing: 14) {
                statusCard("Mac Command", "PowerScout first", "Local database, official refreshes, and model reruns belong here before the website.", .cyan)
                statusCard("Official Site", "Firebase live", "Admin V4 and legacy Admin V2 graph are the official surfaces.", .green)
                statusCard("Relay Strategy", "3-lane backup", "Use The Button, DirectChat for mainland backup, and Cloudflare for VPN/global fallback.", .orange)
                statusCard("Prediction Evidence", "Forecast Ledger", "Snapshot exports preserve what the model knew before matches.", .blue)
                statusCard("Scout System", "Needs rebalance", "Move quiet research earlier; keep match scout feasible.", .purple)
            }

            PSCard {
                VStack(alignment: .leading, spacing: 14) {
                    Text("Do This First")
                        .font(.title3.weight(.bold))
                    HStack(spacing: 12) {
                        PSActionButton(title: "Post-Match Refresh", systemImage: "bolt.horizontal.circle") {
                            store.run(PowerScoutKnowledgeBase.postMatchRefreshCommand)
                        }
                        PSActionButton(title: "Open Admin V4", systemImage: "rectangle.3.group") {
                            openURL(PowerScoutPaths.adminV4URL)
                        }
                        PSSecondaryButton(title: "Prediction Graph", systemImage: "chart.xyaxis.line") {
                            openURL(PowerScoutPaths.adminV2PredictionURL)
                        }
                    }
                    Text("Then choose the competition phase, save forecast checkpoints before match blocks, and keep the scout lanes honest: pre-scout reduces unknowns, pit scout labels claim confidence, match scout verifies reality.")
                        .font(.callout)
                        .foregroundStyle(.secondary)
                }
            }

            PSCard {
                VStack(alignment: .leading, spacing: 12) {
                    Text("Readiness")
                        .font(.title3.weight(.bold))
                    ForEach(PowerScoutKnowledgeBase.systemScores) { score in
                        HStack(alignment: .top, spacing: 14) {
                            PSScoreRing(score: score.score)
                            VStack(alignment: .leading, spacing: 4) {
                                Text(score.lane.rawValue)
                                    .font(.headline)
                                Text(score.verdict)
                                    .font(.subheadline.weight(.semibold))
                                Text(score.nextMove)
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                            Spacer()
                        }
                        if score.id != PowerScoutKnowledgeBase.systemScores.last?.id {
                            Divider()
                        }
                    }
                }
            }
        }
    }

    private func statusCard(_ title: String, _ value: String, _ detail: String, _ color: Color) -> some View {
        PSCard {
            VStack(alignment: .leading, spacing: 10) {
                PSTag(text: title, color: color)
                Text(value)
                    .font(.title3.weight(.bold))
                Text(detail)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }
}
