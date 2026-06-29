import Charts
import SwiftUI

struct PredictionEvidenceGraphView: View {
    private let points = PredictionEvidencePoint.sample
    private let yAxisValues = [10, 105, 200, 295, 390, 480]
    private let xAxisValues = [1, 4, 7, 10, 13, 16, 19, 22]

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            VStack(alignment: .leading, spacing: 8) {
                Text("Winners Graph")
                    .font(.system(size: 28, weight: .black))
                    .foregroundStyle(.white)
                Text("Actual vs predicted winner scores across completed matches.")
                    .font(.title3.weight(.medium))
                    .foregroundStyle(Color.powerscoutGraphSecondary)
                Text("The dotted line is visually aligned to the event's scoring scale so the trend comparison is easier to read.")
                    .font(.callout.weight(.semibold))
                    .foregroundStyle(Color.powerscoutGraphMuted)
            }

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
            }
            .chartForegroundStyleScale([
                "Actual Winner": Color.powerscoutGraphActual,
                "Aligned Predicted Winner": Color.powerscoutGraphPredicted
            ])
            .chartYScale(domain: 0 ... 500)
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
            RoundedRectangle(cornerRadius: 8, style: .continuous)
                .fill(Color.powerscoutGraphBackground)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 8, style: .continuous)
                .stroke(Color.powerscoutGraphBorder, lineWidth: 1)
        )
    }

    private func label(for index: Int) -> String {
        points.first(where: { $0.index == index })?.label ?? ""
    }
}

private struct PredictionEvidencePoint: Identifiable {
    let index: Int
    let label: String
    let actualWinner: Double
    let alignedPredictedWinner: Double

    var id: Int { index }

    static let sample: [PredictionEvidencePoint] = [
        .init(index: 1, label: "QM 1", actualWinner: 92, alignedPredictedWinner: 118),
        .init(index: 2, label: "QM 5", actualWinner: 190, alignedPredictedWinner: 176),
        .init(index: 3, label: "QM 9", actualWinner: 145, alignedPredictedWinner: 158),
        .init(index: 4, label: "QM 13", actualWinner: 318, alignedPredictedWinner: 252),
        .init(index: 5, label: "QM 18", actualWinner: 118, alignedPredictedWinner: 132),
        .init(index: 6, label: "QM 22", actualWinner: 402, alignedPredictedWinner: 370),
        .init(index: 7, label: "QM 27", actualWinner: 65, alignedPredictedWinner: 104),
        .init(index: 8, label: "QM 31", actualWinner: 290, alignedPredictedWinner: 254),
        .init(index: 9, label: "QM 36", actualWinner: 84, alignedPredictedWinner: 198),
        .init(index: 10, label: "QM 40", actualWinner: 330, alignedPredictedWinner: 318),
        .init(index: 11, label: "QM 46", actualWinner: 150, alignedPredictedWinner: 171),
        .init(index: 12, label: "QM 50", actualWinner: 438, alignedPredictedWinner: 323),
        .init(index: 13, label: "QM 55", actualWinner: 128, alignedPredictedWinner: 205),
        .init(index: 14, label: "QM 59", actualWinner: 292, alignedPredictedWinner: 229),
        .init(index: 15, label: "QM 63", actualWinner: 72, alignedPredictedWinner: 66),
        .init(index: 16, label: "QM 68", actualWinner: 242, alignedPredictedWinner: 182),
        .init(index: 17, label: "QM 72", actualWinner: 108, alignedPredictedWinner: 126),
        .init(index: 18, label: "M1", actualWinner: 305, alignedPredictedWinner: 211),
        .init(index: 19, label: "M4", actualWinner: 176, alignedPredictedWinner: 386),
        .init(index: 20, label: "M7", actualWinner: 404, alignedPredictedWinner: 372),
        .init(index: 21, label: "M10", actualWinner: 212, alignedPredictedWinner: 225),
        .init(index: 22, label: "Finals 2", actualWinner: 398, alignedPredictedWinner: 335)
    ]
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
