# /// script
# requires-python = ">=3.11"
# dependencies = [
# ]
# ///

import os
import subprocess
import json
import sys

def run_cmd(cmd, cwd=None):
    print(f"Running: {cmd}")
    try:
        subprocess.run(cmd, shell=True, check=True, cwd=cwd)
    except subprocess.CalledProcessError as e:
        print(f"Command '{cmd}' failed with code {e.returncode}.")
        sys.exit(e.returncode)

def main():
    repo_dir = "/Users/Shared/antigravity/abentertainment/repo"
    project_id = "abentertainment-mel"
    app_id = "1:1034441279871:web:d2e9645b842ab1fd5bf24a"

    print("--- 1. Commit and push to GitHub ---")
    try:
        subprocess.run("git add .", shell=True, check=True, cwd=repo_dir)
        subprocess.run("git commit -m 'chore: deploy to firebase'", shell=True, check=True, cwd=repo_dir)
    except subprocess.CalledProcessError:
        print("Nothing new to commit or committing failed, continuing to deploy...")
    
    try:
        subprocess.run("git push origin main", shell=True, check=True, cwd=repo_dir)
    except subprocess.CalledProcessError:
        print("Push failed or already up to date, continuing to deploy...")

    print("\n--- 2. Setting up Firebase Configuration ---")
    
    # Ensure there's a basic firebase.json for Next.js web frameworks support
    firebase_json_path = os.path.join(repo_dir, "firebase.json")
    if not os.path.exists(firebase_json_path):
        firebase_config = {
          "hosting": {
            "source": ".",
            "ignore": [
              "firebase.json",
              "**/.*",
              "**/node_modules/**"
            ],
            "frameworksBackend": {
              "region": "us-central1"
            }
          }
        }
        with open(firebase_json_path, 'w') as f:
            json.dump(firebase_config, f, indent=2)
            print("Created firebase.json for Next.js web frameworks.")

    # Ensure .firebaserc exists and targets the requested project
    firebaserc_path = os.path.join(repo_dir, ".firebaserc")
    firebaserc_content = {
      "projects": {
        "default": project_id
      }
    }
    with open(firebaserc_path, 'w') as f:
        json.dump(firebaserc_content, f, indent=2)
        print(f"Created .firebaserc pointing to {project_id}.")

    print("\n--- 3. Running npm install ---")
    run_cmd("rm -rf node_modules", cwd=repo_dir)
    run_cmd("npm install --cache=./.npm-cache", cwd=repo_dir)

    print("\n--- 4. Deploying to Firebase ---")
    print(f"Deploying to Firebase project ID: {project_id}")
    run_cmd(f"firebase deploy --project {project_id} --non-interactive", cwd=repo_dir)

    print("\n--- DEPLOYMENT FINISHED ---")
    print("Website Link: https://abentertainment.web.com")

if __name__ == "__main__":
    main()
