# CAL Backend

## Table of Contents

1. [Introduction](#introduction)
2. [Technologies Used](#technologies-used)
3. [Getting Started](#getting-started)
4. [Linting and Formatting](#linting-and-formatting)

## Introduction

This is the backend service for the project, built using Django. It provides RESTful APIs for various functionalities required by the frontend application.

## Technologies Used

- Django + Django REST Framework
- PostgreSQL

## Getting Started

Please see the [contributing guide](../docs/CONTRIBUTING.md) for detailed instructions on setting up the project.


________________________________________________________________________________________

# AI Engine - Dockerized Setup 🚀

This repository contains the AI Engine, which has been fully containerized using Docker.

---

## Prerequisites
Before you begin, ensure you have the following installed:
- **Docker**: [Download Here](https://www.docker.com/get-started)
- **Docker Compose** (If using multiple services)

---

## How to Build and Run the Docker Container

### 1**Build the Docker Image**
Run this command inside the `ai_engine/` directory:
```sh
docker build -t ai-engine .
