import SwiftUI

struct HistoryRewardsView: View {
    let openURL: OpenURLAction
    @State private var eventKey = "2026MNUM"
    @State private var syncSnapshot: PowerScoutSyncSnapshot?
    @State private var syncLedgerError = ""

    private let syncLedgerStore = PowerScoutSyncLedgerStore()

    private var wallet: PowerCoinWalletSnapshot {
        PowerScoutKnowledgeBase.walletSnapshot
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            PSPageHeader(
                eyebrow: "local evidence",
                title: "History / Rewards",
                subtitle: "A head-scout command surface for reviewing scout history, PowerCoin wallet state, and the evidence exports that keep admin operations from losing data under match pressure."
            )

            PSCard {
                HStack(alignment: .center, spacing: 14) {
                    Image(systemName: "clock.badge.checkmark")
                        .font(.system(size: 34, weight: .bold))
                        .foregroundStyle(.yellow)
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Event mirror")
                            .font(.title3.weight(.bold))
                        Text("PowerScout keeps its own admin-side local sync ledger, mirrors the scout browser cache contract, and opens the exact web cache/Admin controls when deeper review is needed.")
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

            PSCard {
                VStack(alignment: .leading, spacing: 14) {
                    HStack(alignment: .top, spacing: 12) {
                        Image(systemName: "externaldrive.fill.badge.checkmark")
                            .font(.title2.weight(.bold))
                            .foregroundStyle(.green)
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Local-First Sync Ledger")
                                .font(.title3.weight(.bold))
                            Text(syncSnapshot?.summary ?? "Loading PowerScout local sync ledger...")
                                .font(.callout)
                                .foregroundStyle(.secondary)
                        }
                        Spacer()
                        Button {
                            refreshSyncLedger()
                        } label: {
                            Label("Refresh Ledger", systemImage: "arrow.clockwise")
                        }
                        .buttonStyle(.bordered)
                    }

                    if let syncSnapshot {
                        Text(syncSnapshot.ledgerURLPath)
                            .font(.caption)
                            .foregroundStyle(.tertiary)
                            .textSelection(.enabled)

                        LazyVGrid(columns: [GridItem(.adaptive(minimum: 220), spacing: 12)], spacing: 12) {
                            ForEach(syncSnapshot.entries) { entry in
                                VStack(alignment: .leading, spacing: 8) {
                                    HStack {
                                        Text(entry.surface)
                                            .font(.headline)
                                        Spacer()
                                        PSTag(text: entry.status, color: syncColor(for: entry.status))
                                    }
                                    Text(entry.role)
                                        .font(.caption.weight(.semibold))
                                        .foregroundStyle(.secondary)
                                    HStack(spacing: 10) {
                                        syncMetric("v", entry.currentVersion)
                                        syncMetric("kept", entry.preservedVersions)
                                        syncMetric("conflicts", entry.conflicts)
                                    }
                                    Text(entry.detail)
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                        .fixedSize(horizontal: false, vertical: true)
                                }
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .padding(12)
                                .background(.quaternary.opacity(0.55), in: RoundedRectangle(cornerRadius: 8, style: .continuous))
                            }
                        }

                        Text(syncSnapshot.nextAction)
                            .font(.callout.weight(.semibold))
                            .foregroundStyle(.green)
                    }

                    if !syncLedgerError.isEmpty {
                        Text(syncLedgerError)
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(.red)
                    }
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
                                .font(.headline)
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
                    Text("Promote the local sync ledger from status tracking into real imported scout-cache rows, Firebase pull snapshots, and conflict review actions inside PowerScout.")
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
        .task {
            loadSyncLedger()
        }
    }

    private func walletCard(_ title: String, _ value: String, _ detail: String, _ color: Color) -> some View {
        PSCard {
            VStack(alignment: .leading, spacing: 8) {
                Text(title.uppercased())
                    .font(.caption.weight(.bold))
                    .foregroundStyle(.secondary)
                Text(value)
                    .font(.largeTitle.weight(.bold))
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

    private func loadSyncLedger() {
        do {
            syncSnapshot = try syncLedgerStore.loadSnapshot()
            syncLedgerError = ""
        } catch {
            syncLedgerError = error.localizedDescription
        }
    }

    private func refreshSyncLedger() {
        do {
            syncSnapshot = try syncLedgerStore.refreshSnapshot()
            syncLedgerError = ""
        } catch {
            syncLedgerError = error.localizedDescription
        }
    }

    private func syncMetric(_ label: String, _ value: Int) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label.uppercased())
                .font(.caption2.weight(.bold))
                .foregroundStyle(.tertiary)
            Text("\(value)")
                .font(.headline)
        }
    }

    private func syncColor(for status: String) -> Color {
        let normalized = status.lowercased()
        if normalized.contains("ready") || normalized.contains("active") { return .green }
        if normalized.contains("conflict") { return .red }
        if normalized.contains("planned") { return .orange }
        return .blue
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
