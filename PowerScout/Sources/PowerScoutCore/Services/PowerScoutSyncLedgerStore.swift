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
                    status: "Ready",
                    currentVersion: 1,
                    preservedVersions: 1,
                    conflicts: 0,
                    lastCheckedAt: now,
                    detail: "Durable local sync ledger stored on this Mac. This is the place native sync health can survive app restarts."
                ),
                PowerScoutSyncLedgerEntry(
                    surface: "Scout Browser Cache",
                    role: "Field capture cache",
                    status: "Bridge planned",
                    currentVersion: 0,
                    preservedVersions: 0,
                    conflicts: 0,
                    lastCheckedAt: now,
                    detail: "Browser IndexedDB already preserves Match V4 versions and content hashes; the native import bridge should consume those exports next."
                ),
                PowerScoutSyncLedgerEntry(
                    surface: "Firebase",
                    role: "Shared head-scout sync",
                    status: "V4 planner active",
                    currentVersion: 0,
                    preservedVersions: 0,
                    conflicts: 0,
                    lastCheckedAt: now,
                    detail: "Match Scout V4 archive sync now checks the remote row before replacing, pulling, or preserving a conflict."
                )
            ],
            summary: "PowerScout now owns a local sync ledger file and the web bridge has version-aware Match V4 conflict decisions.",
            nextAction: "Promote this ledger from status tracking to real imported scout-cache rows and Firebase pull snapshots."
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

