import Charts
import SwiftUI

struct PredictionEvidenceGraphView: View {
    let title: String
    let subtitle: String
    let note: String
    let loadResult: PredictionEvidenceLoadResult

    private var points: [PredictionEvidencePoint] {
        loadResult.series.points
    }

    private var yAxisValues: [Int] {
        let maxValue = max(points.map(\.actualWinner).max() ?? 500, points.map(\.alignedPredictedWinner).max() ?? 500)
        let top = max(500, Int(ceil(maxValue / 100) * 100))
        return stride(from: 0, through: top, by: max(100, top / 5)).map { max($0, 10) }
    }

    private var xAxisValues: [Int] {
        guard points.count > 8 else { return points.map(\.index) }
        let strideSize = max(1, Int(ceil(Double(points.count) / 8.0)))
        return points.map(\.index).filter { ($0 - 1) % strideSize == 0 || $0 == points.count }
    }

    private var metricColumns: [GridItem] {
        [GridItem(.adaptive(minimum: 132), spacing: 10)]
    }

    init(
        title: String = "Winners Graph",
        subtitle: String = "Actual vs predicted winner scores across completed matches.",
        note: String = "The dotted line is visually aligned to the event's scoring scale so the trend comparison is easier to read.",
        loadResult: PredictionEvidenceLoadResult = .fallback
    ) {
        self.title = title
        self.subtitle = subtitle
        self.note = note
        self.loadResult = loadResult
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            VStack(alignment: .leading, spacing: 8) {
                Text(title)
                    .font(.system(size: 28, weight: .black))
                    .foregroundStyle(.white)
                Text(subtitle)
                    .font(.title3.weight(.medium))
                    .foregroundStyle(Color.powerscoutGraphSecondary)
                Text(note)
                    .font(.callout.weight(.semibold))
                    .foregroundStyle(Color.powerscoutGraphMuted)
                HStack(spacing: 8) {
                    PSTag(text: loadResult.sourceKind.badgeText, color: loadResult.loadedFromLedger ? .green : .yellow)
                    Text("\(loadResult.series.eventName) · \(points.count) matches\(accuracyLabel)")
                        .font(.caption.weight(.heavy))
                        .foregroundStyle(Color.powerscoutGraphSecondary)
                        .lineLimit(1)
                        .minimumScaleFactor(0.72)
                }
            }

            LazyVGrid(columns: metricColumns, alignment: .leading, spacing: 10) {
                EvidenceMetricCard(
                    title: "Decision Calls",
                    value: decisionAccuracyValue,
                    detail: decisionAccuracyDetail,
                    tint: .green
                )
                EvidenceMetricCard(
                    title: "Brier",
                    value: formattedNumber(loadResult.series.metrics?.brierScore, digits: 3),
                    detail: "Lower is better",
                    tint: .cyan
                )
                EvidenceMetricCard(
                    title: "Score MAE",
                    value: formattedNumber(loadResult.series.metrics?.scoreMae, digits: 1),
                    detail: "Exact-score error",
                    tint: .orange
                )
                EvidenceMetricCard(
                    title: "Margin MAE",
                    value: formattedNumber(loadResult.series.metrics?.marginMae, digits: 1),
                    detail: "Spread error",
                    tint: .red
                )
            }

            Text("Read this as a trust audit: the top row grades winner calls; the line chart below shows score calibration noise and highlights missed calls.")
                .font(.caption.weight(.bold))
                .foregroundStyle(Color.powerscoutGraphMuted)

            Chart {
                ForEach(points) { point in
                    LineMark(
                        x: .value("Match", point.index),
                        y: .value("Score", point.actualWinner)
                    )
                    .foregroundStyle(by: .value("Series", "Actual Winner"))
                    .lineStyle(StrokeStyle(lineWidth: 4, lineCap: .round, lineJoin: .round))
                    .interpolationMethod(.catmullRom)
                }

                ForEach(points) { point in
                    LineMark(
                        x: .value("Match", point.index),
                        y: .value("Score", point.alignedPredictedWinner)
                    )
                    .foregroundStyle(by: .value("Series", "Aligned Predicted Winner"))
                    .lineStyle(StrokeStyle(lineWidth: 3, lineCap: .round, lineJoin: .round, dash: [8, 6]))
                    .interpolationMethod(.catmullRom)
                }

                ForEach(points.filter { $0.winnerCorrect == false }) { point in
                    PointMark(
                        x: .value("Missed Match", point.index),
                        y: .value("Actual Winner Score", point.actualWinner)
                    )
                    .foregroundStyle(Color.red.opacity(0.88))
                    .symbolSize(70)
                }
            }
            .chartForegroundStyleScale([
                "Actual Winner": Color.powerscoutGraphActual,
                "Aligned Predicted Winner": Color.powerscoutGraphPredicted
            ])
            .chartYScale(domain: 0 ... yDomainTop)
            .chartXAxis {
                AxisMarks(values: xAxisValues) { value in
                    AxisGridLine()
                        .foregroundStyle(.clear)
                    AxisTick()
                        .foregroundStyle(.clear)
                    AxisValueLabel {
                        if let index = value.as(Int.self) {
                            Text(label(for: index))
                                .font(.system(size: 13, weight: .semibold))
                                .foregroundStyle(Color.powerscoutGraphMuted)
                        }
                    }
                }
            }
            .chartYAxis {
                AxisMarks(position: .leading, values: yAxisValues) { value in
                    AxisGridLine(stroke: StrokeStyle(lineWidth: 1, dash: [5, 7]))
                        .foregroundStyle(Color.powerscoutGraphGrid)
                    AxisTick()
                        .foregroundStyle(.clear)
                    AxisValueLabel {
                        if let score = value.as(Int.self) {
                            Text("\(score)")
                                .font(.system(size: 13, weight: .semibold))
                                .foregroundStyle(Color.powerscoutGraphMuted)
                        }
                    }
                }
            }
            .chartLegend(position: .bottom, alignment: .center)
            .frame(height: 360)
        }
        .padding(28)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 30, style: .continuous)
                .fill(Color.powerscoutGraphBackground)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 30, style: .continuous)
                .stroke(Color.powerscoutGraphBorder, lineWidth: 1)
        )
    }

    private var yDomainTop: Double {
        max(Double(yAxisValues.last ?? 500), 500)
    }

    private var accuracyLabel: String {
        guard let accuracy = loadResult.series.winnerAccuracy else { return "" }
        return " · \(Int(round(accuracy * 100)))% winner accuracy"
    }

    private var decisionAccuracyValue: String {
        guard let accuracy = loadResult.series.metrics?.winnerAccuracy ?? loadResult.series.winnerAccuracy else { return "Demo" }
        return "\(Int(round(accuracy * 100)))%"
    }

    private var decisionAccuracyDetail: String {
        guard let metrics = loadResult.series.metrics else { return "Sample only" }
        if let decisive = metrics.decisivePredictions, let accuracy = metrics.winnerAccuracy {
            let correct = Int(round(accuracy * Double(decisive)))
            return "\(correct)/\(decisive) decisive"
        }
        if let matches = metrics.matchesPredicted {
            return "\(matches) matches"
        }
        return "Loaded ledger"
    }

    private func formattedNumber(_ value: Double?, digits: Int) -> String {
        guard let value else { return "--" }
        return value.formatted(.number.precision(.fractionLength(digits)))
    }

    private func label(for index: Int) -> String {
        points.first(where: { $0.index == index })?.label ?? ""
    }
}

private struct EvidenceMetricCard: View {
    let title: String
    let value: String
    let detail: String
    let tint: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 7) {
            Text(title.uppercased())
                .font(.caption2.weight(.heavy))
                .tracking(1.8)
                .foregroundStyle(Color.powerscoutGraphMuted)
            Text(value)
                .font(.system(size: 24, weight: .black))
                .foregroundStyle(tint)
                .monospacedDigit()
            Text(detail)
                .font(.caption.weight(.bold))
                .foregroundStyle(Color.powerscoutGraphSecondary)
                .lineLimit(1)
                .minimumScaleFactor(0.72)
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.white.opacity(0.045), in: RoundedRectangle(cornerRadius: 18, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .stroke(tint.opacity(0.28), lineWidth: 1)
        )
    }
}

private extension Color {
    static let powerscoutGraphBackground = Color(red: 0.035, green: 0.055, blue: 0.105)
    static let powerscoutGraphBorder = Color(red: 0.12, green: 0.18, blue: 0.31)
    static let powerscoutGraphGrid = Color(red: 0.13, green: 0.21, blue: 0.33).opacity(0.72)
    static let powerscoutGraphActual = Color(red: 1.0, green: 0.61, blue: 0.04)
    static let powerscoutGraphPredicted = Color(red: 1.0, green: 0.78, blue: 0.18)
    static let powerscoutGraphSecondary = Color(red: 0.63, green: 0.70, blue: 0.82)
    static let powerscoutGraphMuted = Color(red: 0.45, green: 0.52, blue: 0.64)
}
