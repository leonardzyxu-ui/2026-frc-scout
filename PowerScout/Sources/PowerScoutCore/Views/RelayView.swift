import SwiftUI

struct RelayView: View {
    let openURL: OpenURLAction

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            PSPageHeader(
                eyebrow: "Low-latency alerts",
                title: "Relay strategy",
                subtitle: "Relay is useful for urgent scouting nudges, but it must not become the only record of predictions or evidence."
            )

            LazyVGrid(columns: [GridItem(.adaptive(minimum: 300), spacing: 14)], spacing: 14) {
                PSCard {
                    relayBlock(
                        title: "Primary: The Button",
                        status: "Design target, needs hostname repair",
                        detail: "Use as the primary relay when the Render hostname and receiver path are confirmed. It should handle scout-head alerts and fast field signals.",
                        color: .orange
                    )
                }

                PSCard {
                    relayBlock(
                        title: "Backup: DirectChat",
                        status: "Verified backup lane",
                        detail: "Use when The Button is unavailable or too risky. It has more traffic, but the path is already known and useful for backup relay behavior.",
                        color: .green
                    )
                }
            }

            PSCard {
                VStack(alignment: .leading, spacing: 12) {
                    Text("Relay safety rule")
                        .font(.title3.weight(.bold))
                    Text("Relays are for speed. The Forecast Ledger, Firebase data, local exports, and reports remain the durable record.")
                        .font(.body)
                        .foregroundStyle(.secondary)
                    Button {
                        openURL(URL(string: "https://directchat-relay.onrender.com/health")!)
                    } label: {
                        Label("Check DirectChat Health", systemImage: "heart.text.square")
                    }
                    .buttonStyle(.bordered)
                }
            }
        }
    }

    private func relayBlock(title: String, status: String, detail: String, color: Color) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            PSTag(text: status, color: color)
            Text(title)
                .font(.title3.weight(.bold))
            Text(detail)
                .font(.callout)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
        }
    }
}
