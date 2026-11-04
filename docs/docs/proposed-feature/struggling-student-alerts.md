---
title: Struggling Student Alerts
sidebar_position: 1
---

# Struggling Student Alerts

- **Author:** Anil Suthar S (internship project, Vicharanashala Lab)
- **Issue:** [#1109 Feature Request: Real-Time Struggling Student Alerts](https://github.com/vicharanashala/vibe/issues/1109)
- **Code:** branch [`feat/struggling-student-alerts`](https://github.com/anilsutharr/vibe/tree/feat/struggling-student-alerts) on [anilsutharr/vibe](https://github.com/anilsutharr/vibe)
- **Status:** built and tested locally, behind the `ENABLE_STRUGGLE_ALERTS` flag (off by default)

---

## What the feature is

When a student answers the **same quiz question wrongly three times in a row**, ViBe now:

1. **Alerts the course's instructors** with an in-app notification (and an email when mail is configured) that names the student, the question, where it is in the course and how many times in a row they missed it. A **View progress** button opens that student's progress straight away.
2. **Encourages the student** with a supportive message on the quiz result screen, suggesting they review the lesson before trying again.

Only one alert is sent per run of failures. A correct answer ends the run, so if the student starts struggling again later, the instructor hears about it again.

## Why it matters

- **Struggling students go unnoticed today.** Students get instant quiz results, but instructors only find out who is stuck by digging through dashboards, often too late to help.
- **It closes the feedback loop.** ViBe's continuous active learning model promises immediate feedback; this extends it to the instructor, so support can come while the concept is still fresh.
- **It is targeted.** Alerts are about one specific question, not a low overall score, so the instructor knows exactly which concept to help with.
- **It is supportive, not punitive.** The student sees encouragement and a nudge to review, not a warning.
- **It is quiet.** One alert per failure streak means instructors are not flooded by a student retrying the same quiz.
- **It is safe.** It never affects quiz scores, progress or submissions, and the whole feature is behind a switch that is off by default.

## Demo video

A one-minute walkthrough on a local setup (no audio): a student fails the same question for the third time and sees the supportive message. The instructor then gets the alert and opens that student's progress with **View progress**.

<video controls width="100%" src={require('./struggling-student-alerts-demo.mp4').default} />

[Download the demo video](./struggling-student-alerts-demo.mp4)

## How it works

```text
 Student submits a quiz
          │
          ▼
 Existing grader marks each question CORRECT / PARTIAL / INCORRECT
          │
          ▼
 For each question, update this student's failure streak:
   CORRECT            → streak back to 0
   INCORRECT/PARTIAL  → streak + 1
          │
          ▼
 Streak reached 3 and no alert yet in this streak?
   yes → mark it alerted (atomically, so it happens once)
         → in-app notification to every instructor of the course
         → email to every instructor (if mail is configured)
          │
          ▼
 Any question at 3 or more?  → supportive nudge in the quiz result
```

### The alert rules from the issue

| Sequence | Result |
|---|---|
| Fail → Fail → Fail | Alert sent, student nudged |
| Fail → Fail → Fail → Fail → Fail | Still only one alert (the student is still nudged) |
| Fail → Fail → Pass | Streak reset, no alert |
| … → Pass → Fail → Fail → Fail | New streak, a new alert |

A streak counts the attempts in which that question appeared, so it works even though quizzes draw questions from banks in a random order. A partly correct answer counts as a failure.

### What the instructor sees

> **Test Student may need help**
> Test Student has answered "What is Machine Learning?" wrongly 3 times in a row (Introduction to Machine Learning › New Section › Introduction to Machine learning).
> \[View progress\]

**View progress** opens the course's Enrollments page and shows that student's progress dialog. The email contains the same message with a link to the same place.

### What the student sees

> You've attempted this question several times. That's okay, some concepts take time to master. Consider reviewing the lesson before trying again.

It appears on the quiz result screen, right above the existing **Rewatch Video** button.

## What I changed in the code

### Backend: new files in `backend/src/modules/quizzes/`

| File | What it does |
|---|---|
| `services/StruggleDetectionService.ts` | Updates the student's failure streaks after a quiz is graded, alerts instructors when a streak reaches three, and returns the nudge for the student. Never throws, so it cannot affect a submission |
| `repositories/providers/mongodb/StruggleStreakRepository.ts` | Stores one streak per student, question and course version in a new `question_struggle_streaks` collection. Every change is a single atomic update, and an alert can be claimed only once per streak |
| `interfaces/struggle.ts` | The streak data type and the threshold of three |
| `tests/StruggleDetectionService.test.ts` | The alert rules, partial answers, several questions at once, never alerting the student themselves, email failures and error handling |
| `tests/StruggleStreakRepository.test.ts` | Streak counting, reset and "only one alert" against a real (in-memory) MongoDB, including two alerts claimed at the same moment |

### Backend: changes to existing files

| File | Change |
|---|---|
| `modules/quizzes/services/AttemptService.ts` | After a submission is graded and saved, calls the service and adds an optional `supportNudge` to the response. The dependency is optional, so nothing breaks where it is not available |
| `modules/quizzes/container.ts`, `types.ts` | Registers the new repository and service |
| `shared/database/interfaces/INotification.ts` | Adds the `student_struggling` notification type |
| `config/app.ts` | Adds the `ENABLE_STRUGGLE_ALERTS` switch, off by default |

### Frontend

| File | Change |
|---|---|
| `components/quiz.tsx` | Shows the supportive message on the quiz result screen |
| `types/quiz.types.ts` | Adds the optional `supportNudge` to the quiz submission response |
| `app/pages/teacher/components/ejection-policies/SystemNotificationItem.tsx` | Gives struggling-student notifications their own icon and a **View progress** button |
| `types/notification.types.ts` | Adds the new notification type and its details |
| `app/pages/teacher/course-enrollments.tsx` | Opening the page with `?student=<id>` (and the course from an email link) selects the course, finds the student and opens their progress. The progress details are now built by one shared helper used by both the table and the alert link |
| `hooks/use-focus-student.ts` (new) | Looks up the student from the alert so the page can find them |

## Design decisions

- **A streak per question, not a re-scan of old attempts.** The issue suggested reading recent attempts. Keeping a small counter per student and question is cheaper on every submission and makes "only one alert per streak" safe even when two submissions arrive at once.
- **Never breaks a quiz.** All the work happens after the submission is saved, every error is caught, and email failures do not stop the in-app alert.
- **Recipients.** Alerts go to the active instructors of the course version. Whether managers, TAs or cohort-scoped instructors should also be included is one of the questions asked on the issue.
- **Switched off by default.** `ENABLE_STRUGGLE_ALERTS=true` turns the feature on.

## Testing

- **18 new automated tests**, all passing. The quizzes test suite and the frontend type check have exactly the same pre-existing failures with and without this work.
- **Tested end to end on a local setup** through the real quiz API. A student failed the same question in three attempts (each time in a different position, while still passing the quiz overall). The third attempt returned the nudge and created exactly one notification for the instructor. A fourth failure created no new alert. A correct answer reset the streak, and three more failures alerted again.
- **Email** was confirmed to fail gracefully when mail is not configured: a warning is logged and the in-app alert is still sent.

## How to try it

1. Run ViBe locally (see *Local Setup on Windows* under Getting Started) with `ENABLE_STRUGGLE_ALERTS=true` in `backend/.env`.
2. As a student, take a quiz three times and get the same question wrong each time. The third result shows the supportive message.
3. As the course's instructor, open the notification bell, find "… may need help" and click **View progress**.

## Limitations and future work

- **Email needs mail configured** (`SMTP_USER`, `SMTP_PASS`); without it only the in-app alert is sent.
- **One email per alert.** At scale, emails could be batched while in-app alerts stay immediate; this is asked on the issue.
- **Who is alerted** may be extended to managers, TAs or cohort-scoped instructors, depending on the answer on the issue.
- **Practice after struggling.** A natural next step is to add the struggled-with question to the student's spaced repetition reviews, once a review system is merged (see #1047).
