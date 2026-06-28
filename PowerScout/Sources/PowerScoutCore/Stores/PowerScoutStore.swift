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

    private let runner = CommandRunner()

    init(repositoryRoot: URL = PowerScoutPaths.inferredRepositoryRoot()) {
        self.repositoryRoot = repositoryRoot
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
            runningCommandTitle = nil
        }
    }
}
