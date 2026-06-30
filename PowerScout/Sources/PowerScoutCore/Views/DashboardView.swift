import SwiftUI

struct DashboardView: View {
    let store: PowerScoutStore

    var body: some View {
        VStack(alignment: .leading, spacing: 22) {
            CommandStatusStrip(loadResult: store.nextMatchDashboardLoadResult) {
                store.run(PowerScoutKnowledgeBase.postMatchRefreshCommand)
            } onReload: {
                store.refreshNextMatchDashboardSnapshot()
            }

            PredictionEvidenceGraphView(
                title: "Winner Prediction Evidence",
                subtitle: "Decision accuracy first; exact-score noise second. This tells the head scout whether the model deserves trust before the next match.",
                note: store.predictionEvidenceLoadResult.dashboardNote,
                loadResult: store.predictionEvidenceLoadResult
            )

            NextMatchDashboardView(loadResult: store.nextMatchDashboardLoadResult) {
                store.refreshNextMatchDashboardSnapshot()
            }

            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 16) {
                ForecastRangeShapeGraph()
                CalibrationTrustGraph()
            }

            PerformanceCurveGraph()

            DecisionGraphGrid(snapshot: store.nextMatchDashboardLoadResult.snapshot)

            DriverBriefingPanel()
        }
    }
}

private struct CommandStatusStrip: View {
    let loadResult: NextMatchDashboardLoadResult
    let onRefresh: () -> Void
    let onReload: () -> Void

    private var snapshot: NextMatchDashboardSnapshot { loadResult.snapshot }

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            HStack(alignment: .center, spacing: 18) {
                VStack(alignment: .leading, spacing: 10) {
                    Text("POWERHOUSE COMMAND ROOM")
                        .font(.caption.weight(.heavy))
                        .tracking(2.8)
                        .foregroundStyle(.cyan)
                    Text("What needs my decision right now?")
                        .font(.system(size: 30, weight: .black))
                    Text("Admin-only Mac cockpit for connection state, next-match demand, proof graphs, and drive-team instructions.")
                        .font(.callout.weight(.semibold))
                        .foregroundStyle(.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Spacer()
                VStack(alignment: .trailing, spacing: 10) {
                    PSTag(text: loadResult.loadedFromLocalJSON ? "Local Snapshot" : "Fallback Demo", color: loadResult.loadedFromLocalJSON ? .green : .yellow)
                    Text(statusMessage)
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.trailing)
                        .frame(maxWidth: 330, alignment: .trailing)
                }
            }

            HStack(alignment: .top, spacing: 12) {
                commandMetric(
                    title: "Question 1",
                    value: loadResult.loadedFromLocalJSON ? "Ready" : "Needs JSON",
                    detail: "Can I trust current data?",
                    color: loadResult.loadedFromLocalJSON ? .green : .yellow
                )
                commandMetric(
                    title: "Question 2",
                    value: "\(snapshot.winProbabilityPercent)%",
                    detail: "Can we win this match?",
                    color: snapshot.winProbabilityPercent >= 55 ? .green : .orange
                )
                commandMetric(
                    title: "Question 3",
                    value: signed(snapshot.expectedMargin),
                    detail: "Expected margin",
                    color: snapshot.expectedMargin >= 0 ? .green : .red
                )
                commandActions
            }
        }
        .padding(18)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 32, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 32, style: .continuous)
                .stroke(.separator.opacity(0.42), lineWidth: 1)
        )
    }

    private var commandActions: some View {
        VStack(spacing: 10) {
            Button(action: onRefresh) {
                Label("Post-Match Refresh", systemImage: "arrow.triangle.2.circlepath")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.large)

            Button(action: onReload) {
                Label("Reload Local Snapshot", systemImage: "doc.badge.arrow.up")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.bordered)
            .controlSize(.large)
        }
        .frame(minWidth: 190)
    }

    private var statusMessage: String {
        if loadResult.loadedFromLocalJSON {
            return "Using the local next-match strategy snapshot."
        }
        return "No local strategy JSON is loaded; the cockpit is showing demo data."
    }

    private func commandMetric(title: String, value: String, detail: String, color: Color) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title.uppercased())
                .font(.caption.weight(.heavy))
                .tracking(1.8)
                .foregroundStyle(.secondary)
            Text(value)
                .font(.system(size: 26, weight: .black))
                .monospacedDigit()
                .foregroundStyle(color)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
            Text(detail)
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .background(color.opacity(0.1), in: RoundedRectangle(cornerRadius: 24, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 24, style: .continuous)
                .stroke(color.opacity(0.26), lineWidth: 1)
        )
    }

    private func signed(_ value: Double) -> String {
        "\(value >= 0 ? "+" : "")\(String(format: "%.1f", value))"
    }
}

private struct DecisionGraphGrid: View {
    let snapshot: NextMatchDashboardSnapshot

    var body: some View {
        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 16) {
            PointDifferenceGraph(snapshot: snapshot)
            ScoutLaneReadinessGraph()
            RelayFreshnessGraph()
            EvidenceLedgerGraph()
        }
    }
}

private struct PointDifferenceGraph: View {
    let snapshot: NextMatchDashboardSnapshot

    private var maxContribution: Double {
        max(snapshot.ourContribution, snapshot.opponentContribution, 1)
    }

    var body: some View {
        PSCard {
            VStack(alignment: .leading, spacing: 16) {
                graphHeader("Point Difference Pressure", "Which side owns the current plan?")
                contributionBar("Our plan", value: snapshot.ourContribution, color: .cyan)
                contributionBar("Opponent plan", value: snapshot.opponentContribution, color: .red)
                Divider()
                HStack {
                    miniScore("Red", snapshot.projectedRedScore, .red)
                    Text("vs")
                        .font(.headline.weight(.black))
                        .foregroundStyle(.yellow)
                    miniScore("Blue", snapshot.projectedBlueScore, .cyan)
                }
            }
        }
    }

    private func contributionBar(_ label: String, value: Double, color: Color) -> some View {
        VStack(alignment: .leading, spacing: 7) {
            HStack {
                Text(label)
                    .font(.caption.weight(.bold))
                    .foregroundStyle(.secondary)
                Spacer()
                Text(String(format: "%.0f", value))
                    .font(.headline.weight(.black))
                    .monospacedDigit()
                    .foregroundStyle(color)
            }
            GeometryReader { proxy in
                ZStack(alignment: .leading) {
                    Capsule().fill(.secondary.opacity(0.13))
                    Capsule().fill(color.opacity(0.82))
                        .frame(width: max(8, proxy.size.width * CGFloat(value / maxContribution)))
                }
            }
            .frame(height: 16)
        }
    }

    private func miniScore(_ label: String, _ value: Int, _ color: Color) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label.uppercased())
                .font(.caption2.weight(.heavy))
                .tracking(1.4)
                .foregroundStyle(.secondary)
            Text("\(value)")
                .font(.system(size: 42, weight: .black))
                .monospacedDigit()
                .foregroundStyle(color)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

private struct ScoutLaneReadinessGraph: View {
    var body: some View {
        PSCard {
            VStack(alignment: .leading, spacing: 16) {
                graphHeader("Scouting Lane Readiness", "Where the system is strong or overloaded.")
                ForEach(PowerScoutKnowledgeBase.systemScores) { lane in
                    VStack(alignment: .leading, spacing: 7) {
                        HStack {
                            Text(lane.lane.rawValue)
                                .font(.caption.weight(.bold))
                            Spacer()
                            Text("\(lane.score)")
                                .font(.headline.weight(.black))
                                .monospacedDigit()
                                .foregroundStyle(color(for: lane.score))
                        }
                        GeometryReader { proxy in
                            ZStack(alignment: .leading) {
                                Capsule().fill(.secondary.opacity(0.12))
                                Capsule().fill(color(for: lane.score).opacity(0.9))
                                    .frame(width: proxy.size.width * CGFloat(lane.score) / 100)
                            }
                        }
                        .frame(height: 14)
                    }
                }
            }
        }
    }

    private func color(for score: Int) -> Color {
        if score >= 85 { return .green }
        if score >= 72 { return .yellow }
        return .orange
    }
}

private struct RelayFreshnessGraph: View {
    var body: some View {
        PSCard {
            VStack(alignment: .leading, spacing: 16) {
                graphHeader("Live Data Pipeline", "Whether each source is decision-ready.")
                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                    ForEach(PowerScoutKnowledgeBase.liveOpsFreshnessCards) { source in
                        VStack(alignment: .leading, spacing: 8) {
                            HStack {
                                Circle()
                                    .fill(color(for: source.state))
                                    .frame(width: 10, height: 10)
                                Text(source.source)
                                    .font(.caption.weight(.heavy))
                                    .lineLimit(1)
                            }
                            Text(source.target)
                                .font(.title3.weight(.black))
                                .monospacedDigit()
                            Text(source.state.rawValue)
                                .font(.caption2.weight(.bold))
                                .foregroundStyle(.secondary)
                        }
                        .padding(12)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(color(for: source.state).opacity(0.1), in: RoundedRectangle(cornerRadius: 18, style: .continuous))
                    }
                }
            }
        }
    }

    private func color(for state: LiveOpsFreshnessState) -> Color {
        switch state {
        case .ready: .green
        case .syncing: .cyan
        case .credentialGated: .yellow
        case .fallback: .orange
        case .modelRerun: .blue
        }
    }
}

private struct EvidenceLedgerGraph: View {
    var body: some View {
        PSCard {
            VStack(alignment: .leading, spacing: 16) {
                graphHeader("Evidence Ledger", "What stays auditable after match pressure.")
                ForEach(PowerScoutKnowledgeBase.evidenceLedgerSummaries, id: \.id) { item in
                    HStack(spacing: 12) {
                        RoundedRectangle(cornerRadius: 6, style: .continuous)
                            .fill(color(for: item.tone))
                            .frame(width: 10, height: 42)
                        VStack(alignment: .leading, spacing: 3) {
                            Text(item.label)
                                .font(.caption.weight(.heavy))
                            Text(item.detail)
                                .font(.caption2.weight(.semibold))
                                .foregroundStyle(.secondary)
                                .lineLimit(2)
                        }
                        Spacer()
                        Text(item.value)
                            .font(.caption.weight(.black))
                            .foregroundStyle(color(for: item.tone))
                    }
                    .padding(10)
                    .background(.quaternary.opacity(0.32), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                }
            }
        }
    }

    private func color(for tone: String) -> Color {
        switch tone {
        case "green": .green
        case "yellow": .yellow
        case "orange": .orange
        default: .cyan
        }
    }
}

private struct DriverBriefingPanel: View {
    var body: some View {
        PSCard {
            VStack(alignment: .leading, spacing: 16) {
                graphHeader("Drive-Team Brief", "The final product is an instruction, not a pile of stats.")
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 210), spacing: 12)], spacing: 12) {
                    ForEach(PowerScoutKnowledgeBase.driverBriefingOutputs) { output in
                        VStack(alignment: .leading, spacing: 8) {
                            Text(output.title)
                                .font(.headline.weight(.black))
                            Text(output.value)
                                .font(.caption.weight(.heavy))
                                .foregroundStyle(.cyan)
                            Text(output.decisionUse)
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(.secondary)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                        .padding(14)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(.quaternary.opacity(0.38), in: RoundedRectangle(cornerRadius: 18, style: .continuous))
                    }
                }
            }
        }
    }
}
