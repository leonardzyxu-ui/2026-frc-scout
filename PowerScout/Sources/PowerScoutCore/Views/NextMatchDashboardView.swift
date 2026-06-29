import SwiftUI

struct NextMatchDashboardView: View {
    let loadResult: NextMatchDashboardLoadResult
    let onRefresh: () -> Void
    @State private var showsShifts = true
    private let shiftInstructionCardHeight: CGFloat = 108
    private var snapshot: NextMatchDashboardSnapshot { loadResult.snapshot }

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack(alignment: .top, spacing: 14) {
                VStack(alignment: .leading, spacing: 8) {
                    Text("SHIFT STRATEGY PREVIEW")
                        .font(.caption.weight(.heavy))
                        .tracking(2.2)
                        .foregroundStyle(.cyan)
                    Text("Next match dashboard")
                        .font(.system(size: 30, weight: .black))
                    Text(loadResult.loadedFromLocalJSON ? "Loaded from local PowerScout strategy JSON. Scouts still correct reality in match scout; the driver team gets the current best plan." : "Showing bundled fallback data until a local next-match-dashboard.json is available.")
                        .font(.callout.weight(.semibold))
                        .foregroundStyle(.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Spacer()
                Button(action: onRefresh) {
                    Label("Reload Local JSON", systemImage: "arrow.clockwise")
                        .font(.callout.weight(.bold))
                }
                .buttonStyle(.bordered)
                .controlSize(.large)
                .clipShape(Capsule())
                Button {
                    withAnimation(.snappy(duration: 0.22)) {
                        showsShifts.toggle()
                    }
                } label: {
                    Label("Explore Shifts", systemImage: showsShifts ? "chevron.up" : "chevron.down")
                        .font(.callout.weight(.bold))
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)
                .clipShape(Capsule())
            }

            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                metricTile("Our Win Prob", "\(snapshot.winProbabilityPercent)%", .green)
                metricTile("Our Margin", signed(snapshot.expectedMargin), .cyan)
            }

            projectedScoreFaceoff
            sourceNotice

            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                allianceReadout(
                    title: "Our Alliance",
                    active: snapshot.ourAlliance,
                    left: "Red",
                    right: "Blue",
                    detail: loadResult.loadedFromLocalJSON ? snapshot.sourceDetail : "Fallback demo. Load local JSON for the actual next match."
                )
                allianceReadout(
                    title: "First Alliance Shift",
                    active: snapshot.firstShiftAlliance,
                    left: "Red first",
                    right: "Blue first",
                    detail: loadResult.loadedFromLocalJSON ? "Projected by the loaded local strategy snapshot." : "Fallback fixture uses Red as the first shift."
                )
            }

            if showsShifts {
                VStack(alignment: .leading, spacing: 14) {
                    HStack {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("EXPLORE SHIFTS")
                                .font(.caption.weight(.heavy))
                                .tracking(2.2)
                                .foregroundStyle(.cyan)
                            Text("Per-team shift plan")
                                .font(.title2.weight(.black))
                        }
                        Spacer()
                        PSTag(text: "First shift: \(snapshot.firstShiftAlliance)", color: .cyan)
                    }

                    ScrollView(.horizontal) {
                        HStack(alignment: .top, spacing: 12) {
                            ForEach(snapshot.columns) { column in
                                shiftColumn(column)
                            }
                        }
                        .padding(.bottom, 2)
                    }
                }
                .padding(16)
                .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 28, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 28, style: .continuous)
                        .stroke(.separator.opacity(0.35), lineWidth: 1)
                )
                .transition(.opacity.combined(with: .move(edge: .top)))
            }
        }
        .padding(18)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 30, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 30, style: .continuous)
                .stroke(.separator.opacity(0.45), lineWidth: 1)
        )
    }

    private var sourceNotice: some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: loadResult.loadedFromLocalJSON ? "checkmark.seal.fill" : "exclamationmark.triangle.fill")
                .font(.title3.weight(.bold))
            VStack(alignment: .leading, spacing: 3) {
                Text(loadResult.loadedFromLocalJSON ? "Local strategy snapshot" : "Fallback demo data")
                    .font(.callout.weight(.black))
                Text(loadResult.loadedFromLocalJSON ? loadResult.message : "\(snapshot.sourceDetail) \(loadResult.message)")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer()
        }
        .foregroundStyle(loadResult.loadedFromLocalJSON ? .green : .yellow)
        .padding(14)
        .background((loadResult.loadedFromLocalJSON ? Color.green : Color.yellow).opacity(0.12), in: RoundedRectangle(cornerRadius: 22, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 22, style: .continuous)
                .stroke((loadResult.loadedFromLocalJSON ? Color.green : Color.yellow).opacity(0.28), lineWidth: 1)
        )
    }

    private func metricTile(_ title: String, _ value: String, _ color: Color) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title.uppercased())
                .font(.caption.weight(.heavy))
                .tracking(2)
                .foregroundStyle(.secondary)
            Text(value)
                .font(.system(size: 34, weight: .heavy, design: .default))
                .monospacedDigit()
                .foregroundStyle(color)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .background(.quaternary.opacity(0.5), in: RoundedRectangle(cornerRadius: 22, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 22, style: .continuous)
                .stroke(.separator.opacity(0.28), lineWidth: 1)
        )
    }

    private var projectedScoreFaceoff: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("PROJECTED SCORE")
                .font(.caption.weight(.heavy))
                .tracking(2)
                .foregroundStyle(.secondary)
            VStack(spacing: 8) {
                HStack(alignment: .lastTextBaseline, spacing: 10) {
                    VStack(alignment: .trailing, spacing: 0) {
                        Text("RED")
                            .font(.caption.weight(.heavy))
                            .tracking(2)
                            .foregroundStyle(.red.opacity(0.72))
                        Text("\(snapshot.projectedRedScore)")
                            .font(scoreFont)
                            .monospacedDigit()
                            .foregroundStyle(.red)
                            .minimumScaleFactor(0.5)
                            .lineLimit(1)
                    }
                    Text("vs")
                        .font(.title3.weight(.black))
                        .tracking(2)
                        .foregroundStyle(.yellow)
                        .padding(.bottom, 15)
                    VStack(alignment: .leading, spacing: 0) {
                        Text("BLUE")
                            .font(.caption.weight(.heavy))
                            .tracking(2)
                            .foregroundStyle(.cyan.opacity(0.72))
                        Text("\(snapshot.projectedBlueScore)")
                            .font(scoreFont)
                            .monospacedDigit()
                            .foregroundStyle(.cyan)
                            .minimumScaleFactor(0.5)
                            .lineLimit(1)
                    }
                }
                HStack(spacing: 10) {
                    HStack(spacing: 6) {
                        ForEach(snapshot.redTeamNumbers, id: \.self) { teamNumber in
                            teamPill(teamNumber)
                        }
                    }
                    Rectangle()
                        .fill(.yellow.opacity(0.28))
                        .frame(width: 28, height: 1)
                    HStack(spacing: 6) {
                        ForEach(snapshot.blueTeamNumbers, id: \.self) { teamNumber in
                            teamPill(teamNumber)
                        }
                    }
                }
            }
            .frame(maxWidth: .infinity)
        }
        .padding(16)
        .background(.quaternary.opacity(0.5), in: RoundedRectangle(cornerRadius: 26, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 26, style: .continuous)
                .stroke(.separator.opacity(0.28), lineWidth: 1)
        )
    }

    private var scoreFont: Font {
        .system(size: 90, weight: .heavy, design: .default)
    }

    private func teamPill(_ teamNumber: String) -> some View {
        Text(teamNumber)
            .font(.caption.weight(.black))
            .tracking(1.3)
            .padding(.horizontal, 9)
            .padding(.vertical, 4)
            .background(Color.black.opacity(0.28), in: Capsule())
            .overlay(Capsule().stroke(.separator.opacity(0.3), lineWidth: 1))
    }

    private func allianceReadout(title: String, active: String, left: String, right: String, detail: String) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text(title.uppercased())
                    .font(.caption.weight(.heavy))
                    .tracking(2)
                    .foregroundStyle(.secondary)
                Spacer()
                PSTag(text: "Guessed", color: .cyan)
            }
            HStack(spacing: 0) {
                readoutHalf(label: left, active: active == "Red", color: .red)
                readoutHalf(label: right, active: active == "Blue", color: .cyan)
            }
            .padding(4)
            .background(Color.black.opacity(0.26), in: Capsule())
            .overlay(Capsule().stroke(.separator.opacity(0.28), lineWidth: 1))
            Text(detail)
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .background(.quaternary.opacity(0.5), in: RoundedRectangle(cornerRadius: 22, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 22, style: .continuous)
                .stroke(.separator.opacity(0.28), lineWidth: 1)
        )
    }

    private func readoutHalf(label: String, active: Bool, color: Color) -> some View {
        Text(label)
            .font(.callout.weight(.black))
            .frame(maxWidth: .infinity)
            .padding(.vertical, 12)
            .background(active ? color : .clear, in: Capsule())
            .foregroundStyle(active ? Color.white : Color.secondary)
    }

    private func shiftColumn(_ column: NextMatchTeamShiftColumn) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                Text(column.alliance.uppercased())
                    .font(.caption.weight(.heavy))
                    .tracking(1.8)
                    .foregroundStyle(.secondary)
                Text("Team \(column.teamNumber)")
                    .font(.title3.weight(.black))
                Text(column.planLabel)
                    .font(.caption.weight(.bold))
                    .foregroundStyle(.secondary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(14)
            .background(.quaternary.opacity(0.45), in: RoundedRectangle(cornerRadius: 22, style: .continuous))

            ForEach(column.instructions) { instruction in
                VStack(alignment: .leading, spacing: 7) {
                    HStack {
                        Text("Shift \(instruction.shift) · \(instruction.shiftAlliance)")
                            .font(.caption2.weight(.heavy))
                            .tracking(1.2)
                            .lineLimit(1)
                            .truncationMode(.tail)
                        Spacer()
                        Text(instruction.state.uppercased())
                            .font(.caption2.weight(.heavy))
                            .padding(.horizontal, 7)
                            .padding(.vertical, 3)
                            .background(Color.black.opacity(0.25), in: Capsule())
                            .lineLimit(1)
                    }
                    .foregroundStyle(.secondary)
                    Text(instruction.instruction)
                        .font((instruction.instruction.count > 24 ? Font.subheadline : Font.callout).weight(.heavy))
                        .lineLimit(2)
                        .minimumScaleFactor(0.78)
                        .frame(height: 42, alignment: .center)
                }
                .padding(12)
                .frame(maxWidth: .infinity, minHeight: shiftInstructionCardHeight, maxHeight: shiftInstructionCardHeight, alignment: .topLeading)
                .background(cardFill(for: instruction, column: column), in: RoundedRectangle(cornerRadius: 18, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 18, style: .continuous)
                        .stroke(cardStroke(for: instruction), lineWidth: 1)
                )
            }
        }
        .frame(width: 220, alignment: .top)
        .padding(12)
        .background(Color.black.opacity(0.16), in: RoundedRectangle(cornerRadius: 26, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 26, style: .continuous)
                .stroke(.separator.opacity(0.32), lineWidth: 1)
        )
    }

    private func cardFill(for instruction: NextMatchShiftInstruction, column: NextMatchTeamShiftColumn) -> Color {
        let base: Color = instruction.shiftAlliance == "Red" ? .red : .cyan
        return base.opacity(instruction.shiftAlliance == column.alliance ? 0.22 : 0.08)
    }

    private func cardStroke(for instruction: NextMatchShiftInstruction) -> Color {
        instruction.shiftAlliance == "Red" ? .red.opacity(0.45) : .cyan.opacity(0.45)
    }

    private func signed(_ value: Double) -> String {
        "\(value >= 0 ? "+" : "")\(String(format: "%.1f", value))"
    }
}
