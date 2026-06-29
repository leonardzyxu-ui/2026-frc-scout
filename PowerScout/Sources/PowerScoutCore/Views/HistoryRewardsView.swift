import SwiftUI

struct HistoryRewardsView: View {
    let openURL: OpenURLAction
    @State private var eventKey = "2026MNUM"

    private var wallet: PowerCoinWalletSnapshot {
        PowerScoutKnowledgeBase.walletSnapshot
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            PSPageHeader(
                eyebrow: "local evidence",
                title: "History / Rewards",
                subtitle: "A native command surface for scout history, PowerCoin wallet state, and the evidence exports that keep the head scout from losing data under match pressure."
            )

            PSCard {
                HStack(alignment: .center, spacing: 14) {
                    Image(systemName: "clock.badge.checkmark")
                        .font(.system(size: 34, weight: .bold))
                        .foregroundStyle(.yellow)
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Event mirror")
                            .font(.title3.weight(.bold))
                        Text("PowerScout shows the native readout first, then opens the exact web cache and Admin controls while the local database bridge is being built.")
                            .font(.callout)
                            .foregroundStyle(.secondary)
                    }
                    Spacer()
                    TextField("Event", text: Binding(
                        get: { eventKey },
                        set: { eventKey = $0.uppercased() }
                    ))
                        .textFieldStyle(.roundedBorder)
                        .frame(width: 140)
                }
            }

            LazyVGrid(columns: [GridItem(.adaptive(minimum: 210), spacing: 14)], spacing: 14) {
                walletCard("Balance", "\(wallet.balance)", "Starts at \(PowerScoutKnowledgeBase.startingPowerCoinBalance)", .yellow)
                walletCard("Open Stake", "\(wallet.openStake)", "\(wallet.openBets) open bet\(wallet.openBets == 1 ? "" : "s")", .orange)
                walletCard("Last Result", wallet.lastResultDelta.map(formatDelta) ?? "-", wallet.lastResultMatch, wallet.lastResultDelta ?? 0 >= 0 ? .green : .red)
                walletCard("Identity", wallet.scoutNumber.map { "#\($0)" } ?? "unlocked", wallet.scoutName, .cyan)
            }

            PSCard {
                VStack(alignment: .leading, spacing: 14) {
                    HStack {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("PowerCoin Wallet")
                                .font(.title3.weight(.bold))
                            Text(wallet.note)
                                .font(.callout)
                                .foregroundStyle(.secondary)
                        }
                        Spacer()
                        PSSecondaryButton(title: "Open History", systemImage: "clock.arrow.circlepath") {
                            openURL(PowerScoutPaths.scoutHistoryURL)
                        }
                    }

                    Divider()

                    ForEach(PowerScoutKnowledgeBase.powerCoinHistoryRows) { row in
                        HStack(alignment: .center, spacing: 12) {
                            VStack(alignment: .leading, spacing: 4) {
                                Text("\(row.matchKey) - \(row.side)")
                                    .font(.headline)
                                Text("\(row.status.capitalized) - stake \(row.stake)")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                            Spacer()
                            Text(row.delta.map(formatDelta) ?? "-")
                                .font(.headline.monospacedDigit())
                                .foregroundStyle((row.delta ?? 0) < 0 ? .red : .green)
                        }
                    }
                }
            }

            LazyVGrid(columns: [GridItem(.adaptive(minimum: 260), spacing: 14)], spacing: 14) {
                ForEach(PowerScoutKnowledgeBase.evidenceLedgerSummaries) { summary in
                    PSCard {
                        VStack(alignment: .leading, spacing: 10) {
                            PSTag(text: summary.label, color: color(for: summary.tone))
                            Text(summary.value)
                                .font(.title3.weight(.bold))
                            Text(summary.detail)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    }
                }
            }

            PSCard {
                VStack(alignment: .leading, spacing: 12) {
                    Text("Next Native Slice")
                        .font(.title3.weight(.bold))
                    Text("Replace this read-only mirror with the local-first database bridge: PowerScout local storage, Firebase, and scout browser caches preserving every version of every match row.")
                        .font(.callout)
                        .foregroundStyle(.secondary)
                    HStack(spacing: 12) {
                        PSActionButton(title: "Open Admin V4", systemImage: "rectangle.3.group") {
                            openURL(PowerScoutPaths.adminV4URL)
                        }
                        PSSecondaryButton(title: "Open Match Scout", systemImage: "stopwatch") {
                            openURL(PowerScoutPaths.scoutFormURL)
                        }
                    }
                }
            }
        }
    }

    private func walletCard(_ title: String, _ value: String, _ detail: String, _ color: Color) -> some View {
        PSCard {
            VStack(alignment: .leading, spacing: 8) {
                Text(title.uppercased())
                    .font(.caption.weight(.bold))
                    .foregroundStyle(.secondary)
                Text(value)
                    .font(.largeTitle.weight(.bold).monospacedDigit())
                    .foregroundStyle(color)
                Text(detail)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
    }

    private func formatDelta(_ value: Int) -> String {
        value > 0 ? "+\(value)" : "\(value)"
    }

    private func color(for tone: String) -> Color {
        switch tone {
        case "green": .green
        case "yellow": .yellow
        case "orange": .orange
        case "red": .red
        case "cyan": .cyan
        default: .blue
        }
    }
}
