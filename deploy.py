import os
import shutil
import subprocess
import sys
from pathlib import Path


PROJECT_DIR = Path(__file__).resolve().parent
PROXY_URL = "http://127.0.0.1:7890"
NO_PROXY = "localhost,127.0.0.1,::1,169.254.169.254,metadata.google.internal"


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
        print(f"Using proxy: {PROXY_URL}")
        env.update({
            "http_proxy": PROXY_URL,
            "https_proxy": PROXY_URL,
            "HTTP_PROXY": PROXY_URL,
            "HTTPS_PROXY": PROXY_URL,
            "ALL_PROXY": PROXY_URL,
            "all_proxy": PROXY_URL,
            "NO_PROXY": NO_PROXY,
            "no_proxy": NO_PROXY,
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
        print("Then run: python3 deploy.py login")
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


def get_firebase_command() -> list[str]:
    firebase = shutil.which("firebase")
    if firebase:
        return [firebase]

    npx = shutil.which("npx")
    if npx:
        return [npx, "--yes", "firebase-tools"]

    print("\n[!] Firebase CLI was not found.")
    print("Install it with: npm install -g firebase-tools")
    print("Then run: firebase login")
    sys.exit(1)


def main() -> None:
    deploy_storage = "--with-storage" in sys.argv

    if len(sys.argv) > 1 and sys.argv[1] == "login":
        print("Starting Firebase login with proxy environment...")
        firebase_command = get_firebase_command()
        login_args = ["login", "--reauth"]
        if len(sys.argv) > 2 and sys.argv[2] == "--no-localhost":
            login_args.append("--no-localhost")
        run_command(firebase_command + login_args, "Firebase Login", use_proxy=True)
        return

    print("Starting deployment for REBUILT 2026 Scout...")

    if not (PROJECT_DIR / "package.json").exists():
        notify("Deployment Failed", "package.json was not found.")
        sys.exit(1)

    run_command(["npm", "ci"], "Install Dependencies")

    run_command(["npm", "run", "build"], "Vite Build")
    firebase_command = get_firebase_command()
    deploy_targets = "firestore:rules,hosting"
    if deploy_storage:
        deploy_targets = "firestore:rules,storage,hosting"
    else:
        print("\nSkipping Firebase Storage rules because this project has not initialized Firebase Storage.")
        print("After enabling Storage in the Firebase Console, run: python3 deploy.py --with-storage")

    run_command(firebase_command + ["deploy", "--only", deploy_targets], "Firebase Deploy", use_proxy=True)

    notify("Deployment Successful", "REBUILT 2026 Scout is live.")
    print("\nSUCCESS: deployment finished.")


if __name__ == "__main__":
    main()
