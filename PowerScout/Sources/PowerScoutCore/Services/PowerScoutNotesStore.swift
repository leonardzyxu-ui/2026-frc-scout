import Foundation

public struct PowerScoutSectionNote: Identifiable, Codable, Hashable, Sendable {
    public let sectionID: String
    public let sectionTitle: String
    public var text: String
    public var updatedAt: Date

    public var id: String { sectionID }

    public init(section: PowerScoutSection, text: String, updatedAt: Date = Date()) {
        self.sectionID = section.id
        self.sectionTitle = section.rawValue
        self.text = text
        self.updatedAt = updatedAt
    }
}

public struct PowerScoutNotesExport: Codable, Hashable, Sendable {
    public let app: String
    public let schemaVersion: Int
    public let exportedAt: Date
    public let noteCount: Int
    public let notes: [PowerScoutSectionNote]
}

public struct PowerScoutNotesStore: Sendable {
    public static let maxNoteLength = 8_000

    public let storageRoot: URL

    public init(storageRoot: URL = PowerScoutSyncLedgerStore.defaultStorageRoot()) {
        self.storageRoot = storageRoot
    }

    public var notesURL: URL {
        storageRoot.appendingPathComponent("section-notes.json")
    }

    public var exportURL: URL {
        storageRoot.appendingPathComponent("powerscout-section-notes-export.json")
    }

    public func loadNotesOrEmpty() -> [PowerScoutSection: PowerScoutSectionNote] {
        do {
            guard FileManager.default.fileExists(atPath: notesURL.path) else { return [:] }
            let data = try Data(contentsOf: notesURL)
            let export = try decoder.decode(PowerScoutNotesExport.self, from: data)
            var notesBySection: [PowerScoutSection: PowerScoutSectionNote] = [:]
            for note in export.notes {
                guard let section = PowerScoutSection.allCases.first(where: { $0.id == note.sectionID }) ?? PowerScoutSection(rawValue: note.sectionTitle) else {
                    continue
                }
                notesBySection[section] = note
            }
            return notesBySection
        } catch {
            return [:]
        }
    }

    public func saveNotes(_ notesBySection: [PowerScoutSection: PowerScoutSectionNote]) throws {
        try FileManager.default.createDirectory(at: storageRoot, withIntermediateDirectories: true)
        let export = makeExport(notesBySection: notesBySection)
        let data = try encoder.encode(export)
        try data.write(to: notesURL, options: [.atomic])
    }

    @discardableResult
    public func exportNotes(_ notesBySection: [PowerScoutSection: PowerScoutSectionNote]) throws -> URL {
        try FileManager.default.createDirectory(at: storageRoot, withIntermediateDirectories: true)
        let export = makeExport(notesBySection: notesBySection)
        let data = try encoder.encode(export)
        try data.write(to: exportURL, options: [.atomic])
        return exportURL
    }

    private func makeExport(notesBySection: [PowerScoutSection: PowerScoutSectionNote]) -> PowerScoutNotesExport {
        let notes = PowerScoutSection.allCases.compactMap { notesBySection[$0] }
        return PowerScoutNotesExport(
            app: "PowerScout",
            schemaVersion: 1,
            exportedAt: Date(),
            noteCount: notes.count,
            notes: notes
        )
    }

    private var encoder: JSONEncoder {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        encoder.dateEncodingStrategy = .iso8601
        return encoder
    }

    private var decoder: JSONDecoder {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return decoder
    }
}
