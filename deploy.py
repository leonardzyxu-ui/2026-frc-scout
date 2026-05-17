import os
import subprocess
import sys
from pathlib import Path


PROJECT_DIR = Path(__file__).resolve().parent


def notify(title: str, message: str) -> None:
    """Best-effort native macOS notification."""
    safe_title = title.replace("\\", "\\\\").replace('"', '\\"')
    safe_message = message.replace("\\", "\\\\").replace('"', '\\"')
    script = f'display notification "{safe_message}" with title "{safe_title}"'
    try:
        subprocess.run(
            ["osascript", "-e", script],
            check=False,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
    except Exception:
        pass


def run_command(command: list[str], step_name: str, use_proxy: bool = False) -> str:
    print(f"\n--- Running: {step_name} ---")
    print("Command:", " ".join(command))

    env = os.environ.copy()
    if use_proxy:
        proxy = "http://127.0.0.1:7890"
        print(f"Using proxy: {proxy}")
        env.update({
            "http_proxy": proxy,
            "https_proxy": proxy,
            "HTTP_PROXY": proxy,
            "HTTPS_PROXY": proxy,
        })

    process = subprocess.Popen(
        command,
        cwd=PROJECT_DIR,
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
    )

    output = ""
    assert process.stdout is not None
    for line in process.stdout:
        print(line, end="")
        output += line

    process.wait()

    if process.returncode != 0 and "Authentication Error" in output:
        print("\n[!] Firebase authentication error.")
        print(f"Run: cd {PROJECT_DIR}")
        print("Then run: firebase login --reauth")
        sys.exit(1)

    firebase_internal_error = (
        step_name == "Firebase Deploy"
        and ("This tool has encountered an error." in output or ("firebase deploy" in output and "Error:" in output))
    )

    if process.returncode != 0 or "ERR!" in output or firebase_internal_error:
        notify("Deployment Failed", f"Error during {step_name}. Check the terminal.")
        sys.exit(1)

    print(f"[OK] {step_name} completed successfully.")
    return output


def main() -> None:
    print("Starting deployment for REBUILT 2026 Scout...")

    if not (PROJECT_DIR / "package.json").exists():
        notify("Deployment Failed", "package.json was not found.")
        sys.exit(1)

    if not (PROJECT_DIR / "node_modules").exists():
        run_command(["npm", "ci"], "Install Dependencies")

    run_command(["npm", "run", "build"], "Vite Build")
    run_command(
        ["firebase", "deploy", "--only", "firestore:rules,storage,hosting"],
        "Firebase Deploy",
        use_proxy=True,
    )

    notify("Deployment Successful", "REBUILT 2026 Scout is live.")
    print("\nSUCCESS: deployment finished.")


if __name__ == "__main__":
    main()
