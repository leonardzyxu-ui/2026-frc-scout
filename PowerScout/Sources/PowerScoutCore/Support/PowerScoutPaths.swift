import Foundation

public enum PowerScoutPaths {
    public static let siteBaseURL = URL(string: "https://scout-rebuilt-2026.web.app")!

    public static func inferredRepositoryRoot(bundleURL: URL = Bundle.main.bundleURL) -> URL {
        if bundleURL.pathExtension == "app" {
            return bundleURL
                .deletingLastPathComponent()
                .deletingLastPathComponent()
                .deletingLastPathComponent()
        }

        let cwd = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
        if cwd.lastPathComponent == "PowerScout" {
            return cwd.deletingLastPathComponent()
        }
        return cwd
    }

    public static func reportURL(repoRoot: URL) -> URL {
        repoRoot.appendingPathComponent("docs/scouting-overnight-report-2026-06-28.html")
    }

    public static func operatorCardURL(repoRoot: URL) -> URL {
        repoRoot.appendingPathComponent("docs/scouting-matchday-operator-card.md")
    }

    public static func relayPlanURL(repoRoot: URL) -> URL {
        repoRoot.appendingPathComponent("docs/scouting-relay-engine-plan.md")
    }

    public static func postMatchRefreshReportURL(repoRoot: URL) -> URL {
        repoRoot.appendingPathComponent("output/powerscout/post-match-refresh/latest.md")
    }

    public static func postMatchRefreshJSONURL(repoRoot: URL) -> URL {
        repoRoot.appendingPathComponent("output/powerscout/post-match-refresh/latest.json")
    }

    public static func pptScreenshotURL(repoRoot: URL) -> URL {
        repoRoot.appendingPathComponent("output/playwright/scouting-ppt-background-analytics.png")
    }

    public static var adminV4URL: URL {
        siteBaseURL.appendingPathComponent("adminv4")
    }

    public static var scoutHistoryURL: URL {
        siteBaseURL.appendingPathComponent("history")
    }

    public static var scoutFormURL: URL {
        siteBaseURL.appendingPathComponent("scout")
    }

    public static var adminV2PredictionURL: URL {
        siteBaseURL.appendingPathComponent("adminv2/prediction-vs-actual")
    }
}
