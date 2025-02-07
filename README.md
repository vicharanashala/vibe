# Continuous Active Learning (CAL)

**Continuous Active Learning (CAL)** is a revolutionary, minimalist and scalable educational platform designed to promote cheat-free, active learning. It ensures that students genuinely engage with course material, validating their understanding and discouraging dishonest practices through AI-driven proctoring and progressive content unlocking.

---

## Features
### Core Functionalities
- **Active Participation**: Tracks student presence and activity during learning sessions.
- **Contextual Assessments**: Injects questions during video playback to validate understanding.
- **AI-Enhanced Features**:
  - AI-based proctoring to monitor activity and ensure integrity.
  - Question generation using LLMs and human validation.
- **Cheat-Free Progression**:
  - Sequential unlocking of content based on mastery.
  - Strict anti-cheating measures during assignments and exams.

### AI Proctoring Capabilities
1. **Multiple People Detection**: Ensures only one student is present and prevents external interference or help.
2. **Focus Detection**: Verifies if the student is paying attention to the screen.
3. **Background Blur Detection**: Detects software-based background replacement to ensure an authentic environment.
4. **Voice Activity Detection**: Monitors audio to ensure students are not speaking to others during study sessions. (Language agnostic.)
5. **Hand Raise Detection**: Randomly prompts students to raise their hand, ensuring they are not using a virtual camera or other deceptive tools.

---

## Installation and Setup

### Prerequisites
To set up the development environment, the following tools are required:
- **Docker**: For containerized development and deployment.
- **VSCode**: For IDE-based development and DevContainer support.
- **Git**: For version control and repository management.

### Steps
1. **Clone the Repository**
   ```bash
   git clone https://github.com/sudarshansudarshan/cal.git
   cd cal
   ```

2. **Set Up Dev Containers**
   - Open the repository in VSCode with Docker enabled.
   - Select the relevant DevContainer configuration based on the `.devcontainer` folder.

3. **Run Backend Services by opening the Dev Containers**
   - For LMS Engine:
     ```bash
     cd backend/lms_engine
     ```
     
   - For Activity Engine:
     ```bash
     cd backend/activity_engine
     ```
     
   - For AI Engine:
     ```bash
     cd backend/ai_engine
     ```

4. **Run the Frontend**
   - Navigate to `frontend-cal` and start the React app:
     ```bash
     cd frontend-cal
     npm install
     npm run dev
     ```

---

## Repository Structure

```
.
├── .github/                           # GitHub-specific configuration
│   ├── ISSUE_TEMPLATE/                # Issue templates for GitHub
│   └── workflows/                     # CI/CD workflows for linting, testing, etc.
├── backend/                            
│   ├── ai_engine/                     # AI Engine: Handles AI-related tasks (e.g., question generation, proctoring)
│   │   ├── app/                       # Application configuration and entry points
│   │   │   ├── routers/               # Router files for API endpoints
│   │   │   ├── templates/             # Jinja2 templates for HTML views (if used)
│   │   │   ├── __init__.py            # Initializes Python package
│   │   │   ├── main.py                # FastAPI app initialization
│   │   │   ├── models.py              # Database models
│   │   │   ├── rag.py                 # Specific module, possibly for RAG (Retrieval-Augmented Generation)
│   │   │   ├── schemas.py             # Pydantic schemas for request and response models
│   │   │   └── services.py            # Business logic and interaction with the database
│   │   └── faiss_index/               # Directory for storing FAISS indices for efficient similarity search
│   ├── activity_engine/               # Handles activity tracking and analytics      
│   │   ├── prisma/                    # Prisma ORM configurations
│   │   │   ├── migrations/            # Contains all database migrations
│   │   │   └── schema.prisma          # Contains the Prisma schema for data storage
│   │   ├── src/                        
│   │   │   ├── config/                # Configurations for the engine
│   │   │   ├── constant.ts            # Constants like URL of the LM engine
│   │   │   ├── controller/            # Controllers for API functionalities
│   │   │   ├── middleware/            # Middleware, including auth verification
│   │   │   ├── repositories/          # Database interaction files
│   │   │   ├── routes/                # API routes
│   │   │   ├── server.ts              # Express server setup
│   │   │   ├── services/              # Business logic services
│   │   │   └── types/                 # TypeScript types definitions
│   │   ├── README.md                  # Documentation for the activity engine
│   ├── lms_engine/                    # Core LMS engine
│   │   └── core/                      # Core functionalities of the LMS engine
│   │       ├── assessment/            # Assessment-related functionalities
│   │       ├── authentication/        # Authentication system
│   │       ├── course/                # Course management functionalities
│   │       ├── institution/           # Institution-related functionalities
│   │       └── users/                 # User management functionalities
├── docs/                              # Documentation files
├── frontend/                          # Frontend system
│   ├── public/                        # Static assets for the frontend
│   └── src/                           # React source code
│       ├── assets/                    # Images and static assets
│       ├── components/                # Reusable UI components
│       │   ├── proctoring-components/ # Proctoring-specific components
│       │   └── ui/                    # General UI components
│       └── pages/                     # Page components
│           ├── Students/              # Student-specific pages
│           ├── Home.tsx               # Home pages
│           └── LoginPage.tsx          # Login components
├── LICENSE                            # Project License
└── README.md                          # Project documentation

```

---

## Documentation
For more detailed documentation and guides, refer to the **[Wiki](https://github.com/sudarshansudarshan/cal/wiki)**.

---

## Contributions
We welcome contributions to CAL! To contribute:
1. Fork the repository.
2. Create a feature branch.
3. Push your changes and submit a pull request.

---

## License
This project is licensed under the **MIT License**. See `LICENSE` for more information.

---

For any inquiries, feedback, or suggestions, feel free to:

- Open an issue on the repository.
- Reach out to the maintainers at staff.aditya.bmv@iitrpr.ac.in or at sidrao2006@gmail.com.
