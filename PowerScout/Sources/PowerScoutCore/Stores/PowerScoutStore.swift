import Foundation
import Observation

@MainActor
@Observable
final class PowerScoutStore {
    var selection: PowerScoutSection = .dashboard
    var repositoryRoot: URL
    var commandResult: CommandResult?
    var runningCommandTitle: String?
    var lastOpenedURL: URL?
    var nextMatchDashboardLoadResult: NextMatchDashboardLoadResult

    private let runner = CommandRunner()
    private let nextMatchDashboardStore = NextMatchDashboardStore()

    init(repositoryRoot: URL = PowerScoutPaths.inferredRepositoryRoot()) {
        self.repositoryRoot = repositoryRoot
        self.nextMatchDashboardLoadResult = nextMatchDashboardStore.loadSnapshotOrFallback(repoRoot: repositoryRoot)
    }

    var isRunningCommand: Bool {
        runningCommandTitle != nil
    }

    func run(_ command: CommandSpec) {
        guard runningCommandTitle == nil else { return }
        runningCommandTitle = command.title

        Task {
            let result = await runner.run(command, in: repositoryRoot)
            commandResult = result
            nextMatchDashboardLoadResult = nextMatchDashboardStore.loadSnapshotOrFallback(repoRoot: repositoryRoot)
            runningCommandTitle = nil
        }
    }

    func refreshNextMatchDashboardSnapshot() {
        nextMatchDashboardLoadResult = nextMatchDashboardStore.loadSnapshotOrFallback(repoRoot: repositoryRoot)
    }
}
