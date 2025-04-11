---
title: Tech Stack Overview
sidebar_position: 1
---

# Tech Stack Overview

Welcome to ViBe! This guide provides a comprehensive overview of the technologies we use and how they fit together. Each section includes resources to help you quickly get up to speed.

## Frontend Technologies

### React

**What it is:** A JavaScript library for building user interfaces.

**How we use it:** Our frontend is built with React, leveraging functional components and hooks.

**Learning Resources:**
- [Official React Documentation](https://reactjs.org/docs/getting-started.html)
- [React Hooks Cheatsheet](https://react-hooks-cheatsheet.com/)

**Quick Start:**
```jsx
// Basic function component
function Welcome() {
  const [count, setCount] = React.useState(0);
  
  return (
    <div>
      <h1>Hello, Intern!</h1>
      <button onClick={() => setCount(count + 1)}>
        Clicked {count} times
      </button>
    </div>
  );
}
```

### Vite

**What it is:** A build tool that provides faster and leaner development experience for modern web projects.

**How we use it:** We use Vite for our development server and build processes, replacing traditional webpack setups.

**Learning Resources:**
- [Vite Documentation](https://vitejs.dev/guide/)
- [Why Vite](https://vitejs.dev/guide/why.html)

**Quick Start:**
```bash
# Start development server
pnpm run dev

# Build for production
pnpm run build
```

### TypeScript

**What it is:** A strongly typed programming language that builds on JavaScript.

**How we use it:** All our code is written in TypeScript to ensure type safety and better developer experience.

**Learning Resources:**
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [TypeScript in 5 minutes](https://www.typescriptlang.org/docs/handbook/typescript-in-5-minutes.html)

**Quick Start:**
```typescript
// Basic types
const name: string = "ViBe";
const isActive: boolean = true;
const count: number = 42;

// Interface example
interface User {
  id: number;
  name: string;
  email: string;
}

// Function with typed parameters and return value
function getUser(id: number): User | undefined {
  // Implementation
}
```

### Tailwind CSS

**What it is:** A utility-first CSS framework for rapidly building custom designs.

**How we use it:** We use Tailwind for styling our components, favoring utility classes over custom CSS.

**Learning Resources:**
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Tailwind CSS Cheat Sheet](https://nerdcave.com/tailwind-cheat-sheet)

**Quick Start:**
```jsx
// Using Tailwind utility classes
<div className="flex items-center justify-between p-4 bg-white rounded shadow">
  <h2 className="text-xl font-bold text-gray-800">Welcome!</h2>
  <button className="px-4 py-2 text-white bg-blue-500 rounded hover:bg-blue-600">
    Get Started
  </button>
</div>
```

### shadcn/ui

**What it is:** A collection of reusable components built with Radix UI and Tailwind CSS.

**How we use it:** We use shadcn/ui components as a foundation for our UI, customizing as needed.

**Learning Resources:**
- [shadcn/ui Documentation](https://ui.shadcn.com/docs)
- [shadcn/ui Components](https://ui.shadcn.com/docs/components/accordion)

**Quick Start:**
```jsx
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function LoginForm() {
  return (
    <form>
      <Input placeholder="Email" type="email" />
      <Input placeholder="Password" type="password" />
      <Button>Log in</Button>
    </form>
  );
}
```

## Backend Technologies

### Node.js & TypeScript

**What it is:** A JavaScript runtime built on Chrome's V8 JavaScript engine with TypeScript for type safety.

**How we use it:** Our backend API is built with Node.js and TypeScript, using a modular domain-based architecture.

**Learning Resources:**
- [Node.js Documentation](https://nodejs.org/en/docs/)
- [TypeScript Node.js Guide](https://www.typescriptlang.org/docs/handbook/typescript-in-5-minutes.html)

### TypeDI & routing-controllers

**What it is:** TypeDI is a dependency injection library, and routing-controllers is a library for creating controllers with decorators.

**How we use it:** We use these libraries to structure our backend code with controllers and services.

**Learning Resources:**
- [TypeDI GitHub](https://github.com/typestack/typedi)
- [routing-controllers GitHub](https://github.com/typestack/routing-controllers)

**Quick Start:**
```typescript
import { Service } from 'typedi';
import { Controller, Post, Body } from 'routing-controllers';

@Service()
class UserService {
  async createUser(userData: any) {
    // Implementation
  }
}

@Controller('/users')
class UserController {
  constructor(private userService: UserService) {}
  
  @Post('/')
  async create(@Body() userData: any) {
    return this.userService.createUser(userData);
  }
}
```

### Express.js

**What it is:** A minimal and flexible Node.js web application framework that provides robust features for web and mobile applications.

**How we use it:** We build our serverless microservices with Express, deployed as Google Cloud Functions.

**Learning Resources:**
- [Express.js Documentation](https://expressjs.com/)
- [Express.js Guide](https://expressjs.com/en/guide/routing.html)

**Quick Start:**
```typescript
import express from 'express';
const app = express();

app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
```

### MongoDB & MongoDB Atlas

**What it is:** MongoDB is a NoSQL document database, and MongoDB Atlas is its fully-managed cloud database service.

**How we use it:** We use MongoDB for our database needs, hosted on MongoDB Atlas for scalability and reliability.

**Learning Resources:**
- [MongoDB Documentation](https://docs.mongodb.com/)
- [MongoDB Atlas Documentation](https://docs.atlas.mongodb.com/)
- [MongoDB Node.js Driver](https://docs.mongodb.com/drivers/node/)

**Quick Start:**
```typescript
import { MongoClient } from 'mongodb';

async function connectToDatabase() {
  const client = new MongoClient(process.env.MONGODB_URI as string);
  await client.connect();
  const db = client.db('vibe-db');
  return { client, db };
}
```

### Firebase

**What it is:** A platform developed by Google for creating mobile and web applications.

**How we use it:** We use Firebase for authentication, hosting, and cloud storage.

**Learning Resources:**
- [Firebase Documentation](https://firebase.google.com/docs)
- [Firebase Admin SDK](https://firebase.google.com/docs/admin/setup)

**Quick Start:**
```typescript
import * as admin from 'firebase-admin';

admin.initializeApp();

async function verifyToken(token: string) {
  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    return decodedToken;
  } catch (error) {
    throw new Error('Invalid auth token');
  }
}
```

## Documentation

### Docusaurus

**What it is:** A modern static website generator that builds optimized websites quickly.

**How we use it:** We use Docusaurus for our project documentation, including this onboarding guide.

**Learning Resources:**
- [Docusaurus Documentation](https://docusaurus.io/docs)
- [Markdown Features](https://docusaurus.io/docs/markdown-features)

**Quick Start:**
```bash
# Navigate to docs directory
cd docs

# Install dependencies
pnpm install

# Start development server
pnpm start
```

## Development Tools

### pnpm

**What it is:** A fast, disk space efficient package manager.

**How we use it:** We use pnpm instead of npm or yarn for all package management.

**Learning Resources:**
- [pnpm Documentation](https://pnpm.io/motivation)
- [pnpm vs npm/yarn](https://pnpm.io/pnpm-vs-npm)

**Quick Start:**
```bash
# Install dependencies
pnpm install

# Add a package
pnpm add package-name

# Run a script
pnpm run script-name
```

### ESLint & Prettier

**What it is:** ESLint is a tool for identifying and reporting on patterns in JavaScript, while Prettier is a code formatter.

**How we use it:** We use ESLint and Prettier to maintain code quality and consistent style.

**Learning Resources:**
- [ESLint Documentation](https://eslint.org/docs/user-guide/getting-started)
- [Prettier Documentation](https://prettier.io/docs/en/index.html)

**Quick Start:**
```bash
# Lint code
pnpm lint

# Fix formatting issues
pnpm fix
```

## Version Control & CI/CD

### Git

**What it is:** A distributed version control system for tracking changes in source code.

**How we use it:** We use Git for version control and collaborative development.

**Learning Resources:**
- [Git Documentation](https://git-scm.com/doc)
- [Learn Git Branching](https://learngitbranching.js.org/)

**Quick Start:**
```bash
# Clone the repository
git clone https://github.com/your-org/vibe.git

# Create a new branch
git checkout -b feature/new-feature

# Commit changes
git add .
git commit -m "feat: add new feature"

# Push to remote
git push origin feature/new-feature
```

### GitHub

**What it is:** A platform and cloud-based service for software development and version control using Git.

**How we use it:** We host our repositories on GitHub and use its features for code reviews, issue tracking, and project management.

**Learning Resources:**
- [GitHub Documentation](https://docs.github.com/en)
- [GitHub Flow](https://guides.github.com/introduction/flow/)

**Quick Start:**
```bash
# Create a pull request from your branch
# Navigate to: https://github.com/your-org/vibe/pull/new/feature/new-feature
```

### GitHub Actions

**What it is:** GitHub's CI/CD platform that automates workflows based on GitHub events.

**How we use it:** We use GitHub Actions for automated testing, linting, and deployment.

**Learning Resources:**
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Workflow Syntax](https://docs.github.com/en/actions/reference/workflow-syntax-for-github-actions)

**Quick Start:**
```yaml
# Example workflow file
name: CI

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'pnpm'
      - run: pnpm install
      - run: pnpm test
```

### Husky

**What it is:** A tool that makes Git hooks easy and allows running scripts before commits and pushes.

**How we use it:** We use Husky to enforce code quality by running linters and tests before commits.

**Learning Resources:**
- [Husky Documentation](https://typicode.github.io/husky/)

**Quick Start:**
```bash
# Husky is already configured in the project
# It will automatically run lint-staged on commit

# To manually trigger the pre-commit hook
npx husky run .husky/pre-commit
```

## Next Steps

Now that you're familiar with our tech stack, here are some recommended next steps:

1. Set up your development environment by following our [Installation Guide](../getting-started/intro.md)
2. Explore our [Project Structure](../getting-started/project-structure.md) to understand how everything fits together
3. Review our [Contribution Guidelines](../contributing/how-to-contribute.md) to learn about our development workflow
4. Check out our [Naming Conventions](../contributing/conventions/naming-guide.md), [PR Guide](../contributing/conventions/pr-guide.md), and [Commit Guide](../contributing/conventions/commit-guide.md)

If you have any questions, don't hesitate to ask your mentor or team lead!
