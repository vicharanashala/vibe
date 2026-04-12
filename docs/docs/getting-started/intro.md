---
title: Installation
---

This guide will help you set up ViBe on your local machine for development.

---
You can clone the repository or directly download the setup file and run it to start the setup process.
## 🚀 Clone the Repository (Optional)

```bash
git clone https://github.com/continuousactivelearning/vibe.git
cd vibe
```

---

## ⚙️ Setup Using Installation Scripts

ViBe uses a custom `setup-unix.sh` and `setup-win.ps1` scripts to help initialize the development environment (both backend and frontend).

### 📦 Run the Setup

```bash
chmod +x scripts/setup-unix.sh
./scripts/setup-unix.sh
```

This script will:
- Check required dependencies
- Install backend dependencies
- Install frontend dependencies
- Set up `.env` files
- Installs the CLI

> 🛠️ The script is interactive and will guide you step-by-step.

---

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

## 🐛 Having Issues?

- Make sure all dependencies are installed correctly
- Open an issue or ask in the [GitHub Discussions](https://github.com/continuousactivelearning/vibe/discussions)

---

## 📚 What's Next?

- [Explore the Project Structure](./project-structure.md)
- [Understand the Architecture](../development/architecture.md)
