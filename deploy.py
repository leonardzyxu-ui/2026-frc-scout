import os
import subprocess
import sys

# UPDATED: The exact path to your new V2 project
PROJECT_DIR = "/Users/leoxu/Library/CloudStorage/OneDrive-YKPaoSchool上海民办包玉刚实验学校/FRC2025-26/Scouting/2026-frc-scout"

def notify(title, message):
    """Sends a native macOS notification banner."""
    safe_title = title.replace("\\", "\\\\").replace('"', '\\"')
    safe_message = message.replace("\\", "\\\\").replace('"', '\\"')
    script = f'display notification "{safe_message}" with title "{safe_title}"'
    try:
        subprocess.run(m
            ["osascript", "-e", script],
            check=False,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
    except Exception:
        # Notifications are best-effort and should never break deployment flow.
        pass

def run_command(command, step_name, use_proxy=False):
    print(f"\n--- Running: {step_name} ---")
    print(f"Command: {command}")
    
    env = os.environ.copy()
    if use_proxy:
        print("Using proxy: http://127.0.0.1:7890")
        env["http_proxy"] = "http://127.0.0.1:7890"
        env["https_proxy"] = "http://127.0.0.1:7890"
        env["HTTP_PROXY"] = "http://127.0.0.1:7890"
        env["HTTPS_PROXY"] = "http://127.0.0.1:7890"
    
    process = subprocess.Popen(command, shell=True, env=env, cwd=PROJECT_DIR, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    
    output = ""
    for line in process.stdout:
        print(line, end="")
        output += line

    process.wait()

    if process.returncode != 0 and "Authentication Error" in output:
        print(f"\n[!] FIREBASE AUTHENTICATION ERROR")
        print("Your Firebase token has expired. Please do the following in your normal terminal:")
        print(f"1. cd {PROJECT_DIR}")
        print("2. Run: export https_proxy=http://127.0.0.1:7890")
        print("3. Run: firebase login --reauth")
        print("4. Follow the browser prompts to log in.")
        print("5. Run this python script again.")
        print("="*60 + "\n")
        sys.exit(1)

    firebase_internal_error = (
        step_name == "Firebase Deploy" and (
            "This tool has encountered an error." in output or
            "firebase deploy" in output and "Error:" in output
        )
    )

    if process.returncode != 0 or "ERR!" in output or firebase_internal_error:
        print(f"\n[!] ERROR DETECTED IN {step_name}")
        notify("Deployment Failed", f"Error during {step_name}. Check VS Code terminal.")
        sys.exit(1)
        
    print(f"[✓] {step_name} completed successfully.")
    return output

def main():
    print("Starting automated deployment for REBUILT 2026 V2...")
    
    if not os.path.exists(PROJECT_DIR):
        print(f"Error: Directory {PROJECT_DIR} does not exist.")
        notify("Deployment Failed", "Project directory not found. Did you name the folder correctly?")
        return

    # 1. Purge old ghosts (Clean up the trash files from V1)
    print("\n--- Cleaning up V1 legacy files ---")
    trash_files = [
        "src/views/SpeedScoutView.tsx",
        "src/views/GameView.tsx",
        "src/views/CheckoutView.tsx",
        "src/views/LocalVaultView.tsx"
    ]
    for f in trash_files:
        filepath = os.path.join(PROJECT_DIR, f)
        if os.path.exists(filepath):
            os.remove(filepath)
            print(f"Deleted legacy file: {f}")

    # 2. Install Dependencies
    run_command("npm install --ignore-scripts", "NPM Install")
    
    # 3. Build the React App (Vite)
    run_command("npm run build", "Vite Build")
    
    # 4. Deploy to Firebase
    run_command("firebase deploy --only hosting", "Firebase Deploy", use_proxy=True)

    notify("Deployment Successful", "REBUILT 2026 is live on scout-rebuilt-2026.web.app!")
    print("\n🚀 SUCCESS! The Powerhouse ecosystem is live.")

if __name__ == "__main__":
    main()