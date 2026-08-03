# 🏛️ ViBe Mythology Student Experience Documentation

Welcome to the **Mythology Student Experience**, an interactive, narrative-driven gamification module designed for the **ViBe Platform** (IIT Ropar Vicharanashala Lab).

Inspired by the legendary Indian folklore of **King Vikramaditya and Betaal**, this experience transforms daily student learning consistency into an immersive quest with milestone rewards, karmic challenges, AI riddles, and peer duels.

---

## 🌟 Key Features

### 1. 🧭 Vikram-Betaal Quest Astrolabe
- Interactive progress tracker mapping student study streaks and active quest tracks.
- Dynamic visual feedback for learning vows and streak milestones.

### 2. 🤖 Betaal AI Chatbot (Cohere AI Powered)
- Real-time interactive AI mentor powered by Cohere `command-r-plus-08-2024`.
- Answers student technical questions regarding Git, TypeScript, React, Express, and MongoDB in Betaal's legendary character voice.

### 3. 🧩 Betaal Technical Riddles
- Generates context-aware technical riddles based on course content.
- Reward students with **Karma Points** for correct answers and explanations.

### 4. ⚖️ Karmic Rewards & Sovereign Vow Altar
- Earn Karma Points through daily streak logs, riddle challenges, and peer duels.
- Unlock mythological avatars, badges, and sovereign vow achievements.

### 5. ⚔️ Peer Challenge & Karmic Duel Board
- Peer-to-peer duel mechanics allowing students to challenge classmates on local devices or global leaderboards.
- Shareable achievement cards and LinkedIn streak badges.

### 6. 🔒 End-to-End Security & Encrypted Local Storage
- AES-256 client-side state encryption with secure passcode authentication.
- JWT-authenticated backend endpoints for leaderboard updates and offline sync.

---

## 🏗️ Architecture & File Structure

```
frontend/src/app/pages/student/mythology/
├── MythologyExperience.tsx          # Main student dashboard page
├── components/
│   ├── VikramBetaalQuestAstrolabe.tsx # Interactive quest astrolabe
│   ├── BetaalRiddlesPanel.tsx         # Technical riddle challenges
│   ├── OfflineAccessibilityLayer.tsx # Offline chat & PouchSync layer
│   ├── AstroKarmicDuelBoard.tsx     # Peer challenge duel board
│   ├── StudentLoginPage.tsx          # Secure student passcode login
│   ├── HallOfRecords.tsx             # Achievement badge showcase
│   ├── KarmicRewards.tsx             # Reward redemption altar
│   └── MythologicalForest.tsx        # Ambient forest soundscape & UI
├── utils/
│   ├── crypto.ts                     # AES-256 state encryption
│   ├── audioSynthesizer.ts           # Web Audio API soundscapes
│   ├── pdfGenerator.ts              # Monthly streak certificate export
│   └── pouchSync.ts                  # PouchDB / IndexedDB offline sync
└── types.ts                          # TypeScript types & interfaces

backend/src/modules/mythology/
├── controllers/MythologyController.ts # REST endpoints (/mythology/*)
├── services/MythologyService.ts       # Cohere AI integration & leaderboard
├── classes/validators/               # Class-validator DTOs
└── tests/MythologyController.test.ts # Vitest backend test suite
```

---

## 📡 Backend Endpoints

| Method | Endpoint | Description |
| shadow | -------- | ----------- |
| `POST` | `/mythology/chat` | Interacts with Betaal AI via Cohere API |
| `POST` | `/mythology/riddle` | Generates technical riddles for course lessons |
| `GET`  | `/mythology/leaderboard` | Fetches live student rankings |
| `POST` | `/mythology/sync-score` | Updates student streak & karma points |
| `POST` | `/mythology/pouch-sync` | Synchronizes offline study session logs |

---

## 🧪 Testing & Verification

- **Frontend Build**: Verified with Vite production build (`npm run build`).
- **Backend Tests**: Vitest suite covering leaderboard sync, PouchSync, and chat controller logic (`npx vitest run`).
- **Security Check**: Verified AES encryption and JWT token headers across all API requests.

---

## 🚀 Live Preview

🔗 **[vibe-mythology-streak-badges.vercel.app](https://vibe-mythology-streak-badges.vercel.app/)**
