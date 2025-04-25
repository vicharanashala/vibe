# Using the CLI

This guide provides an overview of how to use the ViBe Command Line Interface (CLI) effectively.

---

## ⚙️ Installation

The CLI is installed automatically when you run the initial setup scripts. No additional steps are required.

---

## 🚀 Available Commands

Use the following commands to interact with the CLI. For a complete list of available commands, run:

``` bash
vibe help
```

### `vibe setup`

Initializes the project by configuring Firebase and MongoDB.

### `vibe start <service1> <service2> ...`

Starts one or more services. For example: `vibe start backend` starts the backend server. You can also pass multiple arguments: `vibe start frontend backend`


If no arguments are provided, both the frontend and backend services will be started by default.

### `vibe test`

Runs the test suite for both the frontend and backend services.

---