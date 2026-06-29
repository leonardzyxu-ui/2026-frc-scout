import Foundation

public struct PowerScoutSyncLedgerStore: Sendable {
    public let storageRoot: URL

    public init(storageRoot: URL = PowerScoutSyncLedgerStore.defaultStorageRoot()) {
        self.storageRoot = storageRoot
    }

    public var ledgerURL: URL {
        storageRoot.appendingPathComponent("local-sync-ledger.json")
    }

    public func loadSnapshot() throws -> PowerScoutSyncSnapshot {
        if FileManager.default.fileExists(atPath: ledgerURL.path) {
            let data = try Data(contentsOf: ledgerURL)
            return try decoder.decode(PowerScoutSyncSnapshot.self, from: data)
        }
        return try refreshSnapshot()
    }

    @discardableResult
    public func refreshSnapshot(now: Date = Date()) throws -> PowerScoutSyncSnapshot {
        let snapshot = Self.defaultSnapshot(ledgerURL: ledgerURL, now: now)
        try saveSnapshot(snapshot)
        return snapshot
    }

    public func saveSnapshot(_ snapshot: PowerScoutSyncSnapshot) throws {
        try FileManager.default.createDirectory(at: storageRoot, withIntermediateDirectories: true)
        let data = try encoder.encode(snapshot)
        try data.write(to: ledgerURL, options: [.atomic])
    }

    public static func defaultStorageRoot() -> URL {
        let root = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first
            ?? URL(fileURLWithPath: NSTemporaryDirectory(), isDirectory: true)
        return root.appendingPathComponent("PowerScout", isDirectory: true)
    }

    public static func defaultSnapshot(ledgerURL: URL, now: Date = Date()) -> PowerScoutSyncSnapshot {
        PowerScoutSyncSnapshot(
            generatedAt: now,
            ledgerURLPath: ledgerURL.path,
            entries: [
                PowerScoutSyncLedgerEntry(
                    surface: "PowerScout Mac",
                    role: "Local command ledger",
                    status: "Contract ready",
                    currentVersion: 1,
                    preservedVersions: 1,
                    conflicts: 0,
                    lastCheckedAt: now,
                    detail: "Durable local sync ledger stored on this Mac. It is one of the three local-first surfaces in the scout-browser, Firebase, and PowerScout contract."
                ),
                PowerScoutSyncLedgerEntry(
                    surface: "Scout Browser Cache",
                    role: "Field capture cache",
                    status: "Cross-surface planned",
                    currentVersion: 0,
                    preservedVersions: 0,
                    conflicts: 0,
                    lastCheckedAt: now,
                    detail: "Browser IndexedDB preserves Match V4 versions, content hashes, submitted-state metadata, and ScoutArchiveBundle v8 version chains."
                ),
                PowerScoutSyncLedgerEntry(
                    surface: "Firebase",
                    role: "Shared head-scout sync",
                    status: "Three-way planner active",
                    currentVersion: 0,
                    preservedVersions: 0,
                    conflicts: 0,
                    lastCheckedAt: now,
                    detail: "Match Scout V4 archive sync checks remote rows before replacing, pulling, or preserving conflicts, and the cross-surface planner now includes PowerScout."
                )
            ],
            summary: "PowerScout now has an explicit local-first sync contract with scout browser cache and Firebase: preserve every version, write newest safe copies, and freeze same-version content conflicts.",
            nextAction: "Connect real imported scout-cache rows and Firebase pull snapshots to the cross-surface planner."
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
