import Charts
import SwiftUI

struct ForecastRangeShapeGraph: View {
    private let rows = ForecastRangeRow.sample

    var body: some View {
        PSCard {
            VStack(alignment: .leading, spacing: 16) {
                graphHeader("Expected Range Shape", "Forecast as a band, not a single magic number.")
                Chart(rows) { row in
                    BarMark(
                        x: .value("Team", row.team),
                        yStart: .value("Floor", row.floor),
                        yEnd: .value("Ceiling", row.ceiling),
                        width: .ratio(0.55)
                    )
                    .foregroundStyle(row.color.opacity(0.2))
                    .cornerRadius(10)

                    BarMark(
                        x: .value("Team", row.team),
                        yStart: .value("Normal low", row.normalLow),
                        yEnd: .value("Normal high", row.normalHigh),
                        width: .ratio(0.42)
                    )
                    .foregroundStyle(row.color.opacity(0.55))
                    .cornerRadius(8)

                    PointMark(
                        x: .value("Team", row.team),
                        y: .value("Expected", row.expected)
                    )
                    .foregroundStyle(row.color)
                    .symbolSize(90)
                }
                .chartYAxis {
                    AxisMarks(position: .leading)
                }
                .chartXAxis {
                    AxisMarks { value in
                        AxisValueLabel {
                            if let team = value.as(String.self) {
                                Text(team)
                                    .font(.caption.weight(.bold))
                            }
                        }
                    }
                }
                .frame(height: 230)

                HStack(spacing: 10) {
                    rangeLegend("Floor-ceiling", opacity: 0.2)
                    rangeLegend("Normal band", opacity: 0.55)
                    rangeLegend("Expected", opacity: 1)
                }
            }
        }
    }

    private func rangeLegend(_ label: String, opacity: Double) -> some View {
        HStack(spacing: 6) {
            RoundedRectangle(cornerRadius: 4, style: .continuous)
                .fill(Color.cyan.opacity(opacity))
                .frame(width: 18, height: 8)
            Text(label)
                .font(.caption2.weight(.semibold))
                .foregroundStyle(.secondary)
        }
    }
}

struct CalibrationTrustGraph: View {
    private let rows = CalibrationBin.sample

    var body: some View {
        PSCard {
            VStack(alignment: .leading, spacing: 16) {
                graphHeader("Model Calibration", "Predicted confidence compared with actual win rate.")
                Chart {
                    ForEach(rows) { row in
                        BarMark(
                            x: .value("Bin", row.label),
                            y: .value("Predicted", row.predicted)
                        )
                        .position(by: .value("Series", "Predicted"))
                        .foregroundStyle(Color.cyan.opacity(0.72))

                        BarMark(
                            x: .value("Bin", row.label),
                            y: .value("Actual", row.actual)
                        )
                        .position(by: .value("Series", "Actual"))
                        .foregroundStyle(Color.green.opacity(0.82))
                    }
                }
                .chartYScale(domain: 0 ... 100)
                .chartYAxis {
                    AxisMarks(position: .leading) { value in
                        AxisGridLine()
                            .foregroundStyle(.secondary.opacity(0.18))
                        AxisValueLabel {
                            if let percent = value.as(Int.self) {
                                Text("\(percent)%")
                                    .font(.caption2.weight(.semibold))
                            }
                        }
                    }
                }
                .chartXAxis {
                    AxisMarks { value in
                        AxisValueLabel {
                            if let label = value.as(String.self) {
                                Text(label)
                                    .font(.caption2.weight(.bold))
                            }
                        }
                    }
                }
                .frame(height: 230)

                HStack {
                    calibrationLegend("Predicted", .cyan)
                    calibrationLegend("Actual", .green)
                    Spacer()
                    Text("Gap flags tell us when to trust, hedge, or demand more scout evidence.")
                        .font(.caption2.weight(.semibold))
                        .foregroundStyle(.secondary)
                }
            }
        }
    }

    private func calibrationLegend(_ label: String, _ color: Color) -> some View {
        HStack(spacing: 6) {
            Circle()
                .fill(color)
                .frame(width: 8, height: 8)
            Text(label)
                .font(.caption2.weight(.semibold))
                .foregroundStyle(.secondary)
        }
    }
}

struct PerformanceCurveGraph: View {
    private let rows = PerformanceCurvePoint.sample

    var body: some View {
        PSCard {
            VStack(alignment: .leading, spacing: 16) {
                graphHeader("Robot Trend Curve", "Recent robot value, fitted trend, and uncertainty band.")
                Chart {
                    ForEach(rows) { row in
                        AreaMark(
                            x: .value("Match", row.match),
                            yStart: .value("Low", row.lowerBand),
                            yEnd: .value("High", row.upperBand)
                        )
                        .foregroundStyle(Color.cyan.opacity(0.16))

                        LineMark(
                            x: .value("Match", row.match),
                            y: .value("Observed", row.score)
                        )
                        .foregroundStyle(Color.yellow)
                        .lineStyle(StrokeStyle(lineWidth: 3, lineCap: .round, lineJoin: .round))
                        .interpolationMethod(.catmullRom)

                        LineMark(
                            x: .value("Match", row.match),
                            y: .value("Fitted", row.fitted)
                        )
                        .foregroundStyle(Color.cyan)
                        .lineStyle(StrokeStyle(lineWidth: 2, lineCap: .round, lineJoin: .round, dash: [7, 5]))
                        .interpolationMethod(.catmullRom)
                    }
                }
                .chartYAxis {
                    AxisMarks(position: .leading)
                }
                .frame(height: 230)
            }
        }
    }
}

func graphHeader(_ title: String, _ subtitle: String) -> some View {
    VStack(alignment: .leading, spacing: 5) {
        Text(title)
            .font(.title3.weight(.black))
        Text(subtitle)
            .font(.caption.weight(.semibold))
            .foregroundStyle(.secondary)
            .fixedSize(horizontal: false, vertical: true)
    }
}

private struct ForecastRangeRow: Identifiable {
    let team: String
    let role: String
    let floor: Double
    let normalLow: Double
    let expected: Double
    let normalHigh: Double
    let ceiling: Double
    let color: Color

    var id: String { team }

    static let sample: [ForecastRangeRow] = [
        ForecastRangeRow(team: "254", role: "score", floor: 54, normalLow: 70, expected: 82, normalHigh: 92, ceiling: 104, color: .red),
        ForecastRangeRow(team: "1678", role: "score", floor: 42, normalLow: 55, expected: 64, normalHigh: 75, ceiling: 88, color: .red),
        ForecastRangeRow(team: "971", role: "defend", floor: 30, normalLow: 44, expected: 58, normalHigh: 69, ceiling: 82, color: .orange),
        ForecastRangeRow(team: "1323", role: "score", floor: 48, normalLow: 66, expected: 78, normalHigh: 90, ceiling: 110, color: .cyan),
        ForecastRangeRow(team: "4414", role: "score", floor: 36, normalLow: 48, expected: 58, normalHigh: 68, ceiling: 80, color: .cyan),
        ForecastRangeRow(team: "5940", role: "defend", floor: 26, normalLow: 38, expected: 52, normalHigh: 63, ceiling: 76, color: .blue)
    ]
}

private struct CalibrationBin: Identifiable {
    let label: String
    let predicted: Double
    let actual: Double

    var id: String { label }

    static let sample: [CalibrationBin] = [
        CalibrationBin(label: "50-60", predicted: 55, actual: 58),
        CalibrationBin(label: "60-70", predicted: 65, actual: 62),
        CalibrationBin(label: "70-80", predicted: 75, actual: 78),
        CalibrationBin(label: "80-90", predicted: 85, actual: 82)
    ]
}

private struct PerformanceCurvePoint: Identifiable {
    let match: Int
    let score: Double
    let fitted: Double
    let lowerBand: Double
    let upperBand: Double

    var id: Int { match }

    static let sample: [PerformanceCurvePoint] = [
        PerformanceCurvePoint(match: 1, score: 44, fitted: 48, lowerBand: 34, upperBand: 62),
        PerformanceCurvePoint(match: 2, score: 58, fitted: 55, lowerBand: 41, upperBand: 70),
        PerformanceCurvePoint(match: 3, score: 52, fitted: 59, lowerBand: 44, upperBand: 75),
        PerformanceCurvePoint(match: 4, score: 76, fitted: 68, lowerBand: 51, upperBand: 84),
        PerformanceCurvePoint(match: 5, score: 72, fitted: 73, lowerBand: 56, upperBand: 91),
        PerformanceCurvePoint(match: 6, score: 86, fitted: 79, lowerBand: 61, upperBand: 98)
    ]
}
