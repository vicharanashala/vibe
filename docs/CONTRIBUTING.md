# Contributing to the Project

Thank you for considering contributing to our project! We welcome contributions from the community and are grateful for your support. To ensure a smooth and efficient collaboration, please follow these guidelines.

## Table of Contents

1. [Getting Started](#getting-started)
2. [How to Contribute](#how-to-contribute)
3. [Coding Standards](#coding-standards)
4. [Commit Messages](#commit-messages)
5. [Pull Request Process](#pull-request-process)
6. [Issue Reporting](#issue-reporting)

## Getting Started

Please refer to the [installation guide](./INSTALLATION.md) for detailed instructions on setting up the project. `README.md` files are available in the `frontend-cal` and `backend` directories for domain-specific instructions.

## How to Contribute

### Documentation

- Update the documentation to reflect your changes.
- Ensure your documentation is clear and concise.

### Coding Standards

- **Frontend**:

This project uses ESLint for linting JavaScript and TypeScript code.

- ES 2020 features are enabled, however, ES 2021 features are disabled for now to maintain compatibility with older browsers.
- Accessibility best practices in JSX are enforced.

#### Linting Rules

  - [ESLint Rules](https://eslint.org/docs/rules/)
  - [React Rules](https://github.com/yannickcr/eslint-plugin-react#recommended)
  - [React Hooks Rules](https://react.dev/reference/rules/rules-of-hooks)
  - [TypeScript Rules](https://typescript-eslint.io/rules/?=recommended)
  - [Accessibility Rules](https://github.com/jsx-eslint/eslint-plugin-jsx-a11y?tab=readme-ov-file#supported-rules)
  - [Tailwind CSS Rules](https://github.com/francoismassart/eslint-plugin-tailwindcss?tab=readme-ov-file#supported-rules)

Apart from the recommended rules, some additional rules have been added to ensure consistency and maintainability. Please refer to the `frontend-cal/eslint.config.js` file for the complete list of rules.

Please see `frontend-cal/.prettierrc` for the Prettier configuration. To sum up, the following rules are enforced:

- Use single quotes for strings.
- Use semicolons at the end of statements.
- Use 2 spaces for indentation.
- Limit the line length to 80 characters.

- **Backend**:

  - Use [Flake8](https://flake8.pycqa.org/en/latest/) for Python linting.
  - Use [Black](https://black.readthedocs.io/en/stable/) for Python code formatting.
  - Follow the PEP 8 style guide.

Some custom rules have been enforced, inspired by [Django's Style Guide](https://docs.djangoproject.com/en/5.1/internals/contributing/writing-code/coding-style/#python-style). Please refer to the `backend/.flake8` file for the complete list of rules.

## Commit Messages

- Use clear and descriptive commit messages.
- This project uses a style of commit messages which has been adopted from the [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) specification.
- Commit messages should be structured as follows:
  ```
  <type>: <description>

  [optional body]

  [optional footer]
  ```
- `<type>` may be one of
    - `frontend`: for changes to the frontend codebase.
    - `backend`: for changes to the backend codebase.
    - `repo`: for changes related to docs, CI/CD, etc.
- Enforcement of this commit message style is done only on the `master` branch.

## Pull Request Process

1. Ensure your code follows the coding standards and passes all linting and testing checks.
2. Push your branch to your forked repository:
   ```sh
   git push origin feature/your-feature-name
   ```
3. Open a pull request against the `master` branch of the original repository.
4. Use and promptly fill out the provided PR templates.
5. Ensure your pull request passes all CI checks.

**For Repository Collaborators**

- All changes to the master branch must be made through pull requests only.
- Create a branch from the `master` branch (eg. `add-gaze-tracking`).
- Create a pull request with the `master` branch as the base branch.
- Pull requests may only be merged after the designated code owners have reviewed and approved them.
- After merging, delete the branch.

> Note: Before opening a pull request, ensure your branch is up-to-date with the `master` branch of the original repository.

## Issue Reporting

- Search for existing issues before creating a new one.
- Provide a clear and detailed description of the issue.
- Include steps to reproduce the issue, if applicable.
- Provide any relevant screenshots or logs.

Thank you for your contributions!
