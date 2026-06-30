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
    var predictionEvidenceLoadResult: PredictionEvidenceLoadResult
    var notesBySection: [PowerScoutSection: PowerScoutSectionNote]
    var lastNotesExportURL: URL?
    var lastNotesSaveError: String?

    private let runner = CommandRunner()
    private let nextMatchDashboardStore: NextMatchDashboardStore
    private let predictionEvidenceStore: PredictionEvidenceStore
    private let notesStore: PowerScoutNotesStore

    init(
        repositoryRoot: URL = PowerScoutPaths.inferredRepositoryRoot(),
        nextMatchDashboardStore: NextMatchDashboardStore = NextMatchDashboardStore(),
        predictionEvidenceStore: PredictionEvidenceStore = PredictionEvidenceStore(),
        notesStore: PowerScoutNotesStore = PowerScoutNotesStore()
    ) {
        self.repositoryRoot = repositoryRoot
        self.nextMatchDashboardStore = nextMatchDashboardStore
        self.predictionEvidenceStore = predictionEvidenceStore
        self.notesStore = notesStore
        self.nextMatchDashboardLoadResult = nextMatchDashboardStore.loadSnapshotOrFallback(repoRoot: repositoryRoot)
        self.predictionEvidenceLoadResult = predictionEvidenceStore.loadSeriesOrFallback(repoRoot: repositoryRoot)
        self.notesBySection = notesStore.loadNotesOrEmpty()
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
            predictionEvidenceLoadResult = predictionEvidenceStore.loadSeriesOrFallback(repoRoot: repositoryRoot)
            runningCommandTitle = nil
        }
    }

    func refreshNextMatchDashboardSnapshot() {
        nextMatchDashboardLoadResult = nextMatchDashboardStore.loadSnapshotOrFallback(repoRoot: repositoryRoot)
        predictionEvidenceLoadResult = predictionEvidenceStore.loadSeriesOrFallback(repoRoot: repositoryRoot)
    }

    func noteText(for section: PowerScoutSection) -> String {
        notesBySection[section]?.text ?? ""
    }

    func updateNoteText(_ text: String, for section: PowerScoutSection) {
        let trimmed = String(text.prefix(PowerScoutNotesStore.maxNoteLength))
        let note = PowerScoutSectionNote(section: section, text: trimmed, updatedAt: Date())
        if trimmed.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            notesBySection.removeValue(forKey: section)
        } else {
            notesBySection[section] = note
        }
        do {
            try notesStore.saveNotes(notesBySection)
            lastNotesSaveError = nil
        } catch {
            lastNotesSaveError = error.localizedDescription
            let now = Date()
            commandResult = CommandResult(
                title: "Save PowerScout Notes",
                exitCode: 1,
                stdout: "",
                stderr: error.localizedDescription,
                startedAt: now,
                finishedAt: now
            )
        }
    }

    @discardableResult
    func exportAllNotes() -> URL? {
        do {
            let url = try notesStore.exportNotes(notesBySection)
            lastNotesExportURL = url
            return url
        } catch {
            let now = Date()
            commandResult = CommandResult(
                title: "Export PowerScout Notes",
                exitCode: 1,
                stdout: "",
                stderr: error.localizedDescription,
                startedAt: now,
                finishedAt: now
            )
            return nil
        }
    }
}
