import Foundation

public actor CommandRunner {
    public init() {}

    public func run(_ spec: CommandSpec, in repositoryRoot: URL) async -> CommandResult {
        let startedAt = Date()
        let process = Process()
        let stdoutPipe = Pipe()
        let stderrPipe = Pipe()

        process.executableURL = URL(fileURLWithPath: "/usr/bin/env")
        process.arguments = spec.arguments
        process.currentDirectoryURL = repositoryRoot
        process.standardOutput = stdoutPipe
        process.standardError = stderrPipe
        process.environment = environment(usesProxy: spec.usesProxy)

        do {
            try process.run()
            process.waitUntilExit()
        } catch {
            return CommandResult(
                title: spec.title,
                exitCode: 127,
                stdout: "",
                stderr: error.localizedDescription,
                startedAt: startedAt,
                finishedAt: Date()
            )
        }

        let stdout = String(data: stdoutPipe.fileHandleForReading.readDataToEndOfFile(), encoding: .utf8) ?? ""
        let stderr = String(data: stderrPipe.fileHandleForReading.readDataToEndOfFile(), encoding: .utf8) ?? ""

        return CommandResult(
            title: spec.title,
            exitCode: process.terminationStatus,
            stdout: stdout,
            stderr: stderr,
            startedAt: startedAt,
            finishedAt: Date()
        )
    }

    private func environment(usesProxy: Bool) -> [String: String] {
        var env = ProcessInfo.processInfo.environment
        env["PATH"] = [
            "/opt/homebrew/bin",
            "/usr/local/bin",
            "/usr/bin",
            "/bin",
            "/usr/sbin",
            "/sbin"
        ].joined(separator: ":")

        if usesProxy {
            env["https_proxy"] = "http://127.0.0.1:7890"
            env["http_proxy"] = "http://127.0.0.1:7890"
            env["all_proxy"] = "socks5://127.0.0.1:7890"
        }

        return env
    }
}
