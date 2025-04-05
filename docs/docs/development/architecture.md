---
title: System Architecture
---

ViBe is a full-stack, serverless web application built for continuous active learning, designed to scale efficiently and support modular growth. It features a split frontend for students and admins, and a microservice-style backend using serverless Express functions deployed on Google Cloud.

## 🌐 Tech Stack Overview

| Layer       | Tech Used                      |
|-------------|--------------------------------|
| Frontend    | React (Vite)            |
| Backend     | Express.js                     |
| Database    | MongoDB (Atlas)                |
| Auth        | Google Firebase Authentication |
| Hosting     | Google Cloud Functions         |
| Storage     | Firebase Storage (or GCP Buckets) |

---

## ⚙️ Serverless Architecture

The ViBe backend is composed of several independent Express modules, each deployed as a **Google Cloud Function**. This allows:
- Independent scaling of services
- Faster cold starts per function
- Logical separation of business concerns

---

## 📦 Backend Modules

Each backend service is a standalone Express app deployed as a serverless function:

- `auth` – Authentication & user verification (via Firebase)
- `users` – Student/teacher data
- `courses` – Course structure, access control
- `quizzes` – Quiz content, question rotation
- `grader` – Scoring logic, bonus handling
- `activity` – Monitoring video/screen presence
- `ratings` – Feedback and engagement scoring
- `ai` – Question generation, hinting, proctoring checks
- `messenger` – Internal communication or alerting module

---

## 🎨 Frontend Layout

ViBe has **two separate frontend apps**:

- **Student Frontend**: The main learning interface
- **Admin Frontend**: Tools for teachers to add/edit content, track progress, review contributions
