---
title: How to Contribute ?
sidebar_position: 1
---

Thank you for your interest in contributing to our project! We welcome contributions from everyone. To ensure a smooth and efficient process, please follow these guidelines when making changes and submitting your code.


## Getting Started

1. **Fork the Repository:**  
   Begin by forking the repository to your own GitHub account. This creates a personal copy of the codebase where you can make your changes.

2. **Clone Your Fork:**  
   Clone your fork locally to start working on your changes:
   ```bash
   git clone https://github.com/your-username/repository-name.git
   cd repository-name
   ```

3. **Create a Feature Branch:**  
   Create a new branch for your feature or bug fix:
   ```bash
   git checkout -b feature/your-feature-name
   ```

---

## Code Standards

### Linting and Formatting
Before committing your changes, please ensure that your code is properly linted and formatted. This helps maintain a clean and consistent codebase.

- **Lint your code:**  
  Run:
  ```bash
  pnpm lint
  ```
- **Fix formatting issues:**  
  Run:
  ```bash
  pnpm fix
  ```

### Documentation
- **Update Documentation:**  
  If your changes affect the functionality or add new features, update the documentation accordingly. Clear documentation helps others understand and use your code.
- **Code Comments:**  
  Add or update inline comments where necessary. This helps maintain readability and makes future maintenance easier.

### Tests
- **Run Existing Tests:**  
  Before submitting your PR, ensure that all existing tests pass.
- **Add or Update Tests:**  
  - If you are adding a new feature, include tests for that feature.
  - If you are fixing or updating an existing feature, modify or add tests as required.
- **Continuous Integration:**  
  Tests are rerun when you submit a PR. If any tests fail, your PR will not be accepted until you fix them.

---

# Commit and Pull Request Conventions

We follow specific commit and PR conventions to maintain a clear and consistent project history.

- **Commit Messages:** Refer to the [Commit Guide](./conventions/commit-guide) for details on our commit message format.
- **Pull Requests:** See the [PR Guide](./conventions/pr-guide) for how to structure pull request titles, descriptions, and dependencies.

Make sure to check out the [Naming Guide](./conventions/naming-guide) as well for file and class naming standards.

---

## Why We Enforce These Guidelines

- **Consistency:**  
  Following these standards helps maintain a consistent and high-quality codebase that is easier to read, review, and maintain.
- **Code Quality:**  
  Linting, formatting, and thorough testing reduce bugs and improve overall software reliability.
- **Efficient Collaboration:**  
  Clear commit messages, documentation, and PR descriptions facilitate smoother code reviews and faster integration of contributions.
- **Project Scalability:**  
  As the project grows, consistent practices ensure that new contributors can quickly understand the codebase and contribute effectively.

---

By adhering to these guidelines, you help us keep the codebase robust and maintainable while ensuring a positive collaborative experience for everyone. If you have any questions or need further clarification, please ask in our discussions.

Happy coding!
