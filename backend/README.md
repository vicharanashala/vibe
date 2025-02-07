# CAL Backend

## Table of Contents

1. [Introduction](#introduction)
2. [Technologies Used](#technologies-used)
3. [Getting Started](#getting-started)
4. [Components](#components)
5. [Linting and Formatting](#linting-and-formatting)

## Introduction

This backend is part of the Continuous Active Learning (CAL) system, designed to support a wide range of educational activities from question generation to student tracking and assessment grading. It integrates multiple services, each built with a specific set of technologies tailored to its primary functions.

## Technologies Used

- **Django + Django REST Framework**: For robust back-end functionalities including authentication and data management.
- **FastAPI**: Used in the AI Engine and LMS for high performance and easy asynchronous tasks handling.
- **Node.js + TypeScript + Prisma**: For real-time and asynchronous operations, particularly in the Activity Engine.
- **Flask**: Utilized in the AI Engine for smaller microservices that need quick prototyping and lightweight processing.

## Getting Started

To begin using the CAL Backend, you will need to set up each component individually. Each service (LMS, AI Engine, Activity Engine) has its own set of requirements and setup instructions, detailed in their respective README files within their directories.

## Components

### LMS Engine
- **Built on**: Django
- **Main Functions**:
  - Manages user authentication and session management.
  - Handles core data interactions for courses, users, and institutions.
  - Integrates with other services to provide a comprehensive learning management system.
- **For more details**: Open the [LMS Engine folder](backend/lms_engine).

### AI Engine
- **Built on**: FastAPI
- **Main Functions**:
  - Generates questions for lectures using the Gemini API.
  - Supports question generation using LLMs and includes human validation processes to ensure quality and relevance.
- **For more details**: Open the [AI Engine folder](backend/ai_engine).

### Activity Engine
- **Built on**: Node.js, TypeScript and PostgreSQL
- **Main Functions**:
  - Tracks user progress and activities.
  - Handles the grading system, evaluating student submissions and providing real-time feedback.
  - Utilizes Prisma for efficient database management and operations.
- **For more details**: Open the [Activity Engine folder](backend/activity_engine).

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
