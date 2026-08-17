---
title: Installation
---

This guide will help you set up ViBe on your local machine for development.

---
You can clone the repository or directly download the setup file and run it to start the setup process.
## 🚀 Clone the Repository

```bash
git clone https://github.com/vicharanashala/vibe.git
cd vibe
```

---

## ⚙️ Setup Using Installation Scripts (Recommended)

ViBe uses a custom `setup-unix.sh` and `setup-win.ps1` scripts to help initialize the development environment (both backend and frontend).

### 📦 Run the Setup (Unix / macOS)

```bash
chmod +x scripts/setup-unix.sh
./scripts/setup-unix.sh
```

### 📦 Run the Setup (Windows PowerShell)

Open PowerShell as your normal user (not elevated unless prompted by an installer) and run:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned -Force   # if execution policy blocks scripts
.\scripts\setup-win.ps1
```

This script will:
- Check required dependencies
- Install backend dependencies
- Install frontend dependencies
- Set up `.env` files
- Installs the CLI

> 🛠️ The script is interactive and will guide you step-by-step.

> Prefer the Python-based installer instead? See: **[Alternative Setup Using the Python script (`setup.py`)](./setup-python.md)**

## 🧪 Run in Development Mode

If you want to run services manually:

### 🖥 Frontend

```bash
vibe start frontend
```

### ⚙️ Backend

```bash
vibe start backend
```

---

## 📦 Build Docusaurus (Docs)

If you're contributing to the documentation:

```bash
vibe start docs
```

Visit: `http://localhost:3000/docs`

---

## 🔎 Common problems & solutions (Troubleshooting)

This section covers issues you might run into **when using the installation scripts**: `scripts/setup-unix.sh` and `scripts/setup-win.ps1`.

1) **Error: `fatal: not a git repository (or any of the parent directories): .git`**
- Script can’t detect the repo / project root.
- **Fix:**
  - Install Git and verify: `git --version`
  - Clone and run from repo root:
    - `git clone https://github.com/vicharanashala/vibe.git`
    - `cd vibe`

2) **Error: `node: command not found` / `npm: command not found`**
- **Fix:**
  - Install Node.js (recommended LTS) and verify: `node -v` and `npm -v`
  - Restart the terminal and rerun the script.

3) **Error: `pnpm: command not found`**
- **Fix:**
  - Preferred (if available):  
    - `corepack enable`  
    - `corepack prepare pnpm@latest --activate`
  - Verify: `pnpm -v`
  - Restart the terminal if pnpm was just installed, then rerun the script.

4) **Error: `firebase: command not found`**
- **Fix:**
  - Install Firebase CLI: `npm i -g firebase-tools` (or `pnpm add -g firebase-tools`)
  - Verify: `firebase --version`
  - Rerun the setup script.

5) **Error: `No authorized accounts` (from `firebase login:list`) / Firebase login loop**
- **Fix:**
  - Run: `firebase login`
  - Then rerun the setup script.

6) **Error: `firebase init emulators` failed**
- **Fix:**
  - Run manually from backend:
    - `cd backend`
    - `firebase init emulators`
  - Select **Authentication** and **Functions** (and optionally Emulator UI), then rerun the setup script.

7) **Error: `vibe: command not found` (after running setup script)**
- **Fix:**
  - Restart your terminal (PATH may not refresh automatically).
  - Link manually:
    - `pnpm -C cli link --global`
  - Then try: `vibe help`

8) **Error (PowerShell): `running scripts is disabled on this system`**
- **Fix:**
  - Run:
    - `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`
  - Then rerun: `.\scripts\setup-win.ps1`

9) **Error: `EADDRINUSE` / `listen EADDRINUSE` (port already in use)**
- **Fix:**
  - Stop whatever is using the port (or reboot dev services), then retry:
    - `vibe start backend`
    - `vibe start frontend`
    - `vibe start docs`

10) **Still failing? Capture debug info**
- **Fix:**
  - Copy full terminal output from the setup script run.
  - Include versions:
    - `node -v`, `pnpm -v`, `firebase --version`, OS/version
  - Open an issue and mention whether you ran `setup-win.ps1` or `setup-unix.sh`.

---

## 🐛 Having Issues?

- Make sure all dependencies are installed correctly
- Open an issue or ask in the [GitHub Discussions](https://github.com/vicharanashala/vibe/discussions)

---
## 📚 What's Next?

- [Explore the Project Structure](./project-structure.md)
- [Understand the Architecture](../development/architecture.md)
