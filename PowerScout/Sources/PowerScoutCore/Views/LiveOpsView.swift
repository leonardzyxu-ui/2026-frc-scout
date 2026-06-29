import SwiftUI

struct LiveOpsView: View {
    @Bindable var store: PowerScoutStore
    let openURL: OpenURLAction

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
                    Button {
                        openURL(PowerScoutPaths.postMatchRefreshReportURL(repoRoot: store.repositoryRoot))
                    } label: {
                        Label("Latest Report", systemImage: "doc.text.magnifyingglass")
                    }
                    .buttonStyle(.bordered)
                }
            }

            LazyVGrid(columns: [GridItem(.adaptive(minimum: 250), spacing: 14)], spacing: 14) {
                ForEach(PowerScoutKnowledgeBase.liveOpsFreshnessCards) { card in
                    PSCard {
                        VStack(alignment: .leading, spacing: 10) {
                            HStack(alignment: .center) {
                                sourceFreshnessIcon(card.state)
                                Spacer()
                                PSTag(text: card.target, color: freshnessColor(card.state))
                            }
                            Text(card.source)
                                .font(.headline)
                            PSTag(text: card.state.rawValue, color: freshnessColor(card.state))
                            Text(card.detail)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                                .fixedSize(horizontal: false, vertical: true)
                            Divider()
                            Text(card.action)
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(.primary)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    }
                }
            }

            PSCard {
                VStack(alignment: .leading, spacing: 14) {
                    HStack(alignment: .top, spacing: 12) {
                        Image(systemName: "steeringwheel")
                            .font(.title2.weight(.bold))
                            .foregroundStyle(.green)
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Driver-Team Briefing")
                                .font(.title3.weight(.bold))
                            Text("This is the output that matters after a refresh: what to do next, how confident we are, and what data is stale or risky.")
                                .font(.callout)
                                .foregroundStyle(.secondary)
                        }
                        Spacer()
                        Button {
                            openURL(PowerScoutPaths.postMatchRefreshJSONURL(repoRoot: store.repositoryRoot))
                        } label: {
                            Label("Raw JSON", systemImage: "curlybraces")
                        }
                        .buttonStyle(.bordered)
                    }

                    LazyVGrid(columns: [GridItem(.adaptive(minimum: 220), spacing: 12)], spacing: 12) {
                        ForEach(PowerScoutKnowledgeBase.driverBriefingOutputs) { output in
                            VStack(alignment: .leading, spacing: 8) {
                                Text(output.title)
                                    .font(.headline)
                                Text(output.value)
                                    .font(.title3.weight(.bold))
                                    .foregroundStyle(.primary)
                                Text(output.detail)
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                                    .fixedSize(horizontal: false, vertical: true)
                                Text(output.decisionUse)
                                    .font(.caption.weight(.semibold))
                                    .foregroundStyle(.green)
                                    .fixedSize(horizontal: false, vertical: true)
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(12)
                            .background(.quaternary.opacity(0.55), in: RoundedRectangle(cornerRadius: 8, style: .continuous))
                        }
                    }
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

    private func sourceFreshnessIcon(_ state: LiveOpsFreshnessState) -> some View {
        Image(systemName: symbol(for: state))
            .font(.title2.weight(.bold))
            .frame(width: 36, height: 36)
            .foregroundStyle(freshnessColor(state))
    }

    private func symbol(for state: LiveOpsFreshnessState) -> String {
        switch state {
        case .ready: "checkmark.seal.fill"
        case .syncing: "arrow.triangle.2.circlepath"
        case .credentialGated: "key.horizontal.fill"
        case .fallback: "lifepreserver.fill"
        case .modelRerun: "cpu.fill"
        }
    }

    private func freshnessColor(_ state: LiveOpsFreshnessState) -> Color {
        switch state {
        case .ready: .green
        case .syncing: .blue
        case .credentialGated: .orange
        case .fallback: .purple
        case .modelRerun: .cyan
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
