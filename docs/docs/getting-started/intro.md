---
title: Installation
---

This guide will help you set up ViBe on your local machine for development.

---

## 🧰 Requirements

Before you begin, make sure you have the following installed:

| Tool       | Required Version | Notes |
|------------|------------------|-------|
| **Git**    | any              | For cloning the repository |
| **Python** | 3.8+             | Used to bootstrap both frontend and backend |


---

## 🚀 Clone the Repository

```bash
git clone https://github.com/continuousactivelearning/vibe.git
cd vibe
```

---

## ⚙️ Setup Using Python

ViBe uses a custom `setup.py` script to help initialize the development environment (both backend and frontend).

### 📦 Run the Setup

```bash
python setup.py
```

This script will:
- Check required dependencies
- Install backend dependencies
- Install frontend dependencies
- Set up `.env` files
- Start both servers (or give you options)

> 🛠️ The script is interactive and will guide you step-by-step.

---

## 🧪 Run in Development Mode

If you want to run services manually:

### 🖥 Frontend

```bash
cd frontend
pnpm run dev
```

### ⚙️ Backend

```bash
cd backend
pnpm run dev
```

---

## 📦 Build Docusaurus (Docs)

If you're contributing to the documentation:

```bash
cd docs
pnpm install
pnpm run start
```

Visit: `http://localhost:3000/docs`

---

## 🐛 Having Issues?

- Make sure all dependencies are installed correctly
- Use `python --version`, `node -v`, `pnpm -v` to verify versions
- Open an issue or ask in the [GitHub Discussions](https://github.com/continuousactivelearning/vibe/discussions)

---

## 📚 What's Next?

- [Explore the Project Structure](./project-structure.md)
- [Understand the Architecture](../development/architecture.md)
