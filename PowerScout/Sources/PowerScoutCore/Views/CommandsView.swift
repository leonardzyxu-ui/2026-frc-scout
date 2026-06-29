import SwiftUI

struct CommandsView: View {
    let store: PowerScoutStore

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            PSPageHeader(
                eyebrow: "Local tools",
                title: "Readiness commands",
                subtitle: "Run the same local scouting checks from a native app. Proxy variables are applied automatically for network checks."
            )

            LazyVGrid(columns: [GridItem(.adaptive(minimum: 280), spacing: 14)], spacing: 14) {
                ForEach(PowerScoutKnowledgeBase.commands) { command in
                    PSCard {
                        VStack(alignment: .leading, spacing: 12) {
                            HStack {
                                Text(command.title)
                                    .font(.headline)
                                Spacer()
                                if command.usesProxy {
                                    PSTag(text: "Proxy", color: .purple)
                                }
                            }
                            Text(command.subtitle)
                                .font(.callout)
                                .foregroundStyle(.secondary)
                            Button {
                                store.run(command)
                            } label: {
                                Label(
                                    store.runningCommandTitle == command.title ? "Running" : "Run",
                                    systemImage: store.runningCommandTitle == command.title ? "hourglass" : "play.fill"
                                )
                            }
                            .buttonStyle(.borderedProminent)
                            .disabled(store.isRunningCommand)
                        }
                    }
                }
            }

            CommandOutputView(result: store.commandResult, runningTitle: store.runningCommandTitle)
        }
    }
}

struct CommandOutputView: View {
    let result: CommandResult?
    let runningTitle: String?

    var body: some View {
        PSCard {
            VStack(alignment: .leading, spacing: 12) {
                Text("Output")
                    .font(.title3.weight(.bold))

                if let runningTitle {
                    HStack {
                        ProgressView()
                            .controlSize(.small)
                        Text("\(runningTitle) is running...")
                            .foregroundStyle(.secondary)
                    }
                } else if let result {
                    HStack {
                        PSTag(text: result.succeeded ? "Passed" : "Failed", color: result.succeeded ? .green : .red)
                        Text("\(String(format: "%.1f", result.duration))s")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(.secondary)
                    }

                    if !result.stdout.isEmpty {
                        outputBlock("stdout", result.stdout)
                    }
                    if !result.stderr.isEmpty {
                        outputBlock("stderr", result.stderr)
                    }
                } else {
                    PSEmptyState(
                        systemImage: "terminal",
                        title: "No command has run yet",
                        detail: "Use the cards above to run scouting readiness checks without leaving PowerScout."
                    )
                }
            }
        }
    }

    private func outputBlock(_ title: String, _ text: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title.uppercased())
                .font(.caption.weight(.bold))
                .foregroundStyle(.secondary)
            ScrollView(.horizontal) {
                Text(text)
                    .font(.caption)
                    .textSelection(.enabled)
                    .padding(10)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .background(Color(nsColor: .textBackgroundColor), in: RoundedRectangle(cornerRadius: 6, style: .continuous))
        }
    }
}
