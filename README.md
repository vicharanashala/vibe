# ViBe

ViBe is an innovative educational platform that enhances learning through continuous assessment and interactive challenges. Designed to ensure that every student fully masters the material before progressing, ViBe uses smart question generation and adaptive reviews to reinforce understanding and foster deeper learning.

[![Watch the video](https://img.youtube.com/vi/Qc0FY260A98/maxresdefault.jpg)](https://youtu.be/Qc0FY260A98)

### [Click here to Watch](https://youtu.be/Qc0FY260A98)

## Key Features

- **Active Learning Through Adaptive Challenges:**  
  ViBe continuously assesses student comprehension and prompts a review of the material when needed, ensuring robust mastery before advancement.

- **AI-Enhanced Question Generation:**  
  Advanced algorithms generate contextually relevant questions that are both challenging and informative, helping to solidify knowledge.

- **Secure and Integrity-Assured Assessments:**  
  ViBe incorporates positive, AI-driven monitoring features that promote a fair and secure testing environment. These integrity safeguards include:
  - **Smart Proctoring:** AI-powered monitoring ensures that assessments are conducted honestly, providing a supportive framework that maintains academic integrity.
  - **Engagement Verification:** The system checks that students are actively engaged, reinforcing a positive learning atmosphere.

## Inspiration

ViBe draws inspiration from the classical Indian tale of Vikram and Betaal. In the story, Betaal challenges King Vikramaditya with riddles, and any incorrect answer prompts a review of the challenge. Similarly, ViBe reinforces learning by requiring students to revisit content if their responses do not meet the mark, ensuring a deep and lasting understanding of the material.

## Quick Start

For detailed setup instructions and comprehensive guides for both developers and end users, please refer to our [Documentation(In Progress)](https://continuousactivelearning.github.io/vibe/).

## Planning changes with OpenSpec

Larger changes are planned with [OpenSpec](https://openspec.dev/docs) before code is written: the AI coding assistant drafts a short proposal, spec and task list under `openspec/changes/`, you review it, and it then builds from that plan. When the change ships, its spec merges into `openspec/specs/`, which describes how ViBe behaves today.

1. Install the CLI once per machine (Node.js 20.19+): `npm install -g @fission-ai/openspec@latest`. The assistant runs it at every step, so it must be on your `PATH`.
2. In Claude Code's chat (restart it once after pulling):

   | Command | What it does |
   |---|---|
   | `/opsx:explore` | Think an idea through with the assistant; writes no code |
   | `/opsx:propose <name>` | Draft `proposal.md`, delta specs, `design.md` and `tasks.md`; stops before code |
   | `/opsx:apply` | Implement the tasks, checking them off in `tasks.md` |
   | `/opsx:archive` | Merge the change's specs into `openspec/specs/` and move it to `openspec/changes/archive/` |

Project context and rules for every plan live in `openspec/config.yaml`. Other tools: run `openspec init --tools <id>` ([supported tools](https://openspec.dev/docs)).



ViBe is licensed under the [MIT License](LICENSE).

## Feedback and Contributions

We welcome your feedback, contributions, and suggestions. Please:

- **Report Issues:** Open an issue on the repository.
- **Contribute:** Fork the repository, create a feature branch, and submit a pull request.
- **Contact:** Reach out to us at [dled@iitrpr.ac.in](mailto:dled@iitrpr.ac.in).

---

Explore our [Documentation](https://vicharanashala.github.io/vibe/) for further details on usage, setup, and development.

