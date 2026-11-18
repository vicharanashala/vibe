---
title: Alternative Setup (python setup.py)
---

This guide explains how to set up the ViBe project using the Python-based `setup.py` script.

> 🚨 **Important:** This method is an alternative to the [Installation Scripts](./intro). It is recommended to use the shell/PowerShell scripts unless you specifically need the Python flow.

---

## 🛠 Prerequisites

Before running `setup.py`, ensure the following dependencies are installed:

- **Python 3.10+** (LTS recommended)
  - Check with: `python3 --version` or `python --version`
- **pip** (latest version recommended)  
  - If missing: `python -m ensurepip --upgrade && python -m pip install --upgrade pip`
- **virtualenv** (not mandatory but recommended)
  - To create: `python -m venv .venv`

---

## ⚙️ Steps

### macOS / Linux

1) **Clone the repository**:
   ```bash
   git clone https://github.com/vicharanashala/vibe.git
   cd vibe
   ```

2) **(Recommended)** Create and activate a virtualenv:
   ```bash
   python3 -m venv .venv
   source .venv/bin/activate
   ```

3) **Run the setup script**:
   ```bash
   python setup.py
   ```

### Windows PowerShell

1) **Clone the repository**:
   ```powershell
   git clone https://github.com/vicharanashala/vibe.git
   cd vibe
   ```

2) **(Recommended)** Create and activate a virtualenv:
   ```powershell
   python -m venv .venv
   .\.venv\Scripts\Activate.ps1
   ```

3) **Run the setup script**:
   ```powershell
   python setup.py
   ```

---

## 🚀 What `setup.py` Does

During the setup, the script will:
1. Prompts for environment selection (Development recommended).
2. Verifies and installs node, pnpm, and firebase-tools if missing.
3. Authenticates Firebase, initializes emulators, and sets up backend/.env.
4. Installs backend and frontend dependencies with pnpm.
5. Downloads MongoDB test binaries, runs backend tests, and tracks progress in .vibe.json with a final summary.
6. Track progress in `.vibe.json` to allow resuming.
7. Handle warnings for non-critical failures and display a summary at the end.

---

## 🧪 Testing and Running Services

Once the Python script finishes, you can manually start services using the CLI or fallback commands:

```bash
# Frontend:
vibe start frontend

# Backend:
vibe start backend

# Documentation:
vibe start docs
```

---

## 🔎 Common problems & solutions (Troubleshooting)

Here are specific troubleshooting tips for issues with `setup.py`:

1) **Error: `python: command not found`**
- Fix:
  - Ensure Python is installed:
    - macOS/Linux: Use `brew install python` or `sudo apt install python3`
    - Windows: Download from [python.org/downloads](https://www.python.org/downloads/)

2) **Error: `No module named pip`**
- Fix:
  - Install pip: `python -m ensurepip --upgrade`
  - Verify: `python -m pip --version`
  - Upgrade if necessary: `python -m pip install --upgrade pip`

3) **Error: `Activate.ps1 cannot be loaded...` (Windows PowerShell)**
- Cause: PowerShell execution policy prevents virtualenv activation.
- Fix:
  - Run:
    ```powershell
    Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
    ```
  - Then rerun: `. .\.venv\Scripts\Activate.ps1`

4) **Error: Failed to install Python dependencies**
- Cause: The script pip installs packages, but installation failed (network, permissions).
- Fix:
  - Run pip manually:
    ```bash
    python -m pip install -r requirements.txt
    ```

  - To retry package installs:
    ```bash
    python setup.py
    ```

5) **Error: MongoDB URI invalid or missing**
- Cause: The `.env` file has incomplete or invalid MongoDB credentials.
- Fix:
  - Open `backend/.env` and verify:
    - Ensure the `DB_URL` starts with `mongodb://` or `mongodb+srv://`.
    - Make sure your MongoDB password (if prompted) is URL-encoded.
  - Example:
    ```env
    DB_URL="mongodb://username:password@host:port/dbname"
    ```

6) **Warning: Test failed during setup**
- Cause: Backend or frontend tests did not pass.
- Fix:
  - Check logs printed during the script.
  - Run tests manually:
    ```bash
    pnpm -w test
    ```

7) **A step was skipped, but you want to re-run it.**
- Fix:
  - Inspect `.vibe.json` to remove the state for the failed/complete step:
    - macOS/Linux:
      ```bash
      rm .vibe.json
      ```
    - Windows:
      ```powershell
      Remove-Item .vibe.json
      ```
  - Then rerun the script:
    ```bash
    python setup.py
    ```

8) **Error: Step recorded as “Warning” in Summary**
- Fix:
  - Address the warning (e.g., fix `.env` or MongoDB), then rerun.
  - To debug individual steps:
    - Manually run the failing logic:
      ```bash
      python -m pip install missing-dependency # Example
      ```

---

## 🐛 Still Having Issues?

- Open an issue or ask in the [GitHub Discussions](https://github.com/vicharanashala/vibe/discussions)

---

## 📚 Related Guides
- [Installation Using Scripts](./installation)
- [Explore the Project Structure](./project-structure.md)
- [Understand the Architecture](../development/architecture.md)
