import SwiftUI

struct LiveOpsView: View {
    @Bindable var store: PowerScoutStore

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            PSPageHeader(
                eyebrow: "match-day command",
                title: "Live Ops",
                subtitle: "PowerScout is the local command center: scout devices feed it, Firebase syncs with it, official APIs refresh it, and the driver team gets the next useful inference."
            )

            PSCard {
                HStack(alignment: .top, spacing: 14) {
                    Image(systemName: "bolt.horizontal.circle.fill")
                        .font(.system(size: 34, weight: .bold))
                        .foregroundStyle(.cyan)
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Post-match loop")
                            .font(.title3.weight(.bold))
                        Text("After a score is revealed, refresh official sources, sync scout evidence, rerun the models, and produce a next-match briefing before the driver team has to act.")
                            .font(.callout)
                            .foregroundStyle(.secondary)
                    }
                    Spacer()
                    Button {
                        store.run(PowerScoutKnowledgeBase.postMatchRefreshCommand)
                    } label: {
                        Label(store.runningCommandTitle == PowerScoutKnowledgeBase.postMatchRefreshCommand.title ? "Running" : "Run Refresh", systemImage: "arrow.clockwise")
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(store.isRunningCommand)
                }
            }

            LazyVGrid(columns: [GridItem(.adaptive(minimum: 310), spacing: 14)], spacing: 14) {
                ForEach(PowerScoutKnowledgeBase.liveOpsSteps) { step in
                    PSCard {
                        VStack(alignment: .leading, spacing: 10) {
                            HStack {
                                PSTag(text: step.urgency, color: .cyan)
                                Spacer()
                                Text(step.owner)
                                    .font(.caption.weight(.semibold))
                                    .foregroundStyle(.secondary)
                            }
                            Text(step.title)
                                .font(.headline)
                            Text(step.detail)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    }
                }
            }

            PSCard {
                VStack(alignment: .leading, spacing: 14) {
                    Text("Source Authority")
                        .font(.title3.weight(.bold))
                    ForEach(PowerScoutKnowledgeBase.liveOpsSourceRules) { rule in
                        HStack(alignment: .top, spacing: 12) {
                            sourceRoleIcon(rule.role)
                            VStack(alignment: .leading, spacing: 4) {
                                HStack {
                                    Text(rule.source)
                                        .font(.headline)
                                    PSTag(text: rule.role.rawValue, color: color(for: rule.role))
                                }
                                Text(rule.givesUs)
                                    .font(.subheadline)
                                Text(rule.limitation)
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                            Spacer()
                        }
                        if rule.id != PowerScoutKnowledgeBase.liveOpsSourceRules.last?.id {
                            Divider()
                        }
                    }
                }
            }

            if let result = store.commandResult {
                PSCard {
                    VStack(alignment: .leading, spacing: 10) {
                        HStack {
                            PSTag(text: result.succeeded ? "passed" : "failed", color: result.succeeded ? .green : .red)
                            Text(result.title)
                                .font(.headline)
                        }
                        Text(result.stdout.isEmpty ? result.stderr : result.stdout)
                            .font(.system(.caption, design: .monospaced))
                            .foregroundStyle(.secondary)
                            .textSelection(.enabled)
                    }
                }
            }
        }
    }

    private func sourceRoleIcon(_ role: LiveOpsSourceRole) -> some View {
        Image(systemName: symbol(for: role))
            .font(.title3.weight(.bold))
            .frame(width: 34, height: 34)
            .foregroundStyle(color(for: role))
    }

    private func symbol(for role: LiveOpsSourceRole) -> String {
        switch role {
        case .authoritative: "externaldrive.fill.badge.checkmark"
        case .syncSource: "arrow.triangle.2.circlepath"
        case .contextOnly: "chart.line.uptrend.xyaxis"
        case .localFallback: "person.crop.circle.badge.checkmark"
        }
    }

    private func color(for role: LiveOpsSourceRole) -> Color {
        switch role {
        case .authoritative: .green
        case .syncSource: .blue
        case .contextOnly: .orange
        case .localFallback: .purple
        }
    }
}
