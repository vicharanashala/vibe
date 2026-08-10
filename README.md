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

## VibeCode (New Coding Module)

We recently introduced **VibeCode**, a full-featured integrated coding environment built directly into ViBe. VibeCode allows students to solve algorithmic coding problems with real-time feedback, similar to LeetCode, and provides teachers with a powerful dashboard to track student progress.

### Teacher Module Features
- **Problem Creation UI:** Teachers can easily create custom coding problems with descriptions, difficulty levels, and time/memory limits.
- **Language Support Dropdown:** Seamlessly switch between languages (JavaScript/TypeScript) to define starting Boilerplate code and hidden Execution Wrappers.
- **Test Case Management:** Upload thousands of test cases via CSV files in a single click, and easily toggle which test cases are hidden from students.
- **Submissions Dashboard:** A comprehensive view of all student submissions, automatically grouping multiple attempts by student name. Teachers can instantly see exact error details, runtime metrics, and test case pass ratios (e.g. `Wrong Answer (2/4)`).

### Student Module Features
- **In-Browser IDE:** A split-pane code editor layout allowing students to read problem descriptions, view test cases, and write code all on one screen.
- **Real-Time Execution Engine:** Powered by a lightweight, highly secure `isolated-vm` (Node.js worker_threads) backend that intercepts stdout/stderr, prevents infinite loops (Time Limit Exceeded), and blocks memory leaks (Memory Limit Exceeded).
- **Instant Feedback:**
  - **Run Code:** Evaluates code against visible test cases and automatically autosaves progress to the database without cluttering the teacher's dashboard.
  - **Submit Code:** Evaluates code against all test cases (including hidden ones) and logs the submission.
- **Detailed Metrics:** Students can instantly see their test case pass ratio (e.g., `4 / 4 test cases passed`), execution runtime in milliseconds, and diffs highlighting differences between their output and the expected output.

## Inspiration

ViBe draws inspiration from the classical Indian tale of Vikram and Betaal. In the story, Betaal challenges King Vikramaditya with riddles, and any incorrect answer prompts a review of the challenge. Similarly, ViBe reinforces learning by requiring students to revisit content if their responses do not meet the mark, ensuring a deep and lasting understanding of the material.

## Quick Start

For detailed setup instructions and comprehensive guides for both developers and end users, please refer to our [Documentation(In Progress)](https://continuousactivelearning.github.io/vibe/).

## License

ViBe is licensed under the [MIT License](LICENSE).

## Feedback and Contributions

We welcome your feedback, contributions, and suggestions. Please:

- **Report Issues:** Open an issue on the repository.
- **Contribute:** Fork the repository, create a feature branch, and submit a pull request.
- **Contact:** Reach out to us at [dled@iitrpr.ac.in](mailto:dled@iitrpr.ac.in).

---

Explore our [Documentation](https://vicharanashala.github.io/vibe/) for further details on usage, setup, and development.

