---
title: Pull Request Convention
---

## Convention

We follow a structured format for writing pull request titles and descriptions to keep our change history consistent and clear. Use the following format when creating a PR.

**Format**  
*(Note: "Title:" and "Description:" are only for explanation purposes and should not be included in your actual PR.)*

```
Title:
<type>(<optional-scope>): <subject>

Description:
<body>

<footer>

<dependencies>
```

- **`<type>`** is one of:
  - `feat` (feature)
  - `fix` (bug fix)
  - `doc` (documentation)
  - `style` (formatting, missing semicolons, etc.)
  - `refactor` (code refactoring)
  - `test` (adding or updating tests)
  - `chore` (maintenance tasks)
  - `perf` (performance improvement)

- **`<optional-scope>`** is the name of the module or directory affected by the change. For example:
  - `auth` for authentication-related changes.
  - `courses` for course management.
  - `item` for item/section functionalities.
  
  This part is optional but helps to quickly identify the context of the change.

- **`<subject>`** should:
  - Use imperative, present tense (e.g., "implement", "fix", "update").
  - Not be capitalized.
  - Not end with a dot.

- **`<body>`** should:
  - Provide the motivation for the change.
  - Describe the previous behavior and how the change improves or fixes it.
  - Use imperative, present tense.

- **`<footer>`** is optional and may contain:
  - **Breaking changes:** All breaking changes must be listed with a description, justification, and migration notes.
  - **Referencing issues:** Closed bugs should be referenced on separate lines, prefixed with "Closes" (e.g., `Closes #123, #456`).

- **`<dependencies>`** lists other PRs this change depends on. Use a checklist format:
  - `- [ ] depends on: #XXXX`

---

## Examples

### Example 1: Basic Feature PR without Scope

**Title:**

```
feat: implement signup endpoint with input validation
```

**Description:**

```
Implement a new signup endpoint for user registration. The endpoint validates email format, password strength, and prevents duplicate registrations.

Closes #101
```

### Example 2: Feature PR with Scope

**Title:**

```
feat(auth): implement change password functionality
```

**Description:**

```
Add a change password endpoint to allow authenticated users to update their passwords securely. This feature checks the current password, ensures the new password meets strength requirements, and updates the user record.

Closes #105
```

### Example 3: Test PR for an Existing Feature

**Title:**

```
test(item): write tests for update item endpoint
```

**Description:**

```
Create unit and integration tests for the update item endpoint in the Item Controller. The tests cover partial updates, invalid payloads, and ensure that the section, module, and version update timestamps are correctly set.

Closes #112
```

### Example 4: Feature PR with Dependencies

**Title:**

```
feat(item): implement delete item endpoint
```

**Description:**

```
Add an endpoint to allow deletion of an item. The endpoint validates the request, removes the item from the items group, updates the related section/module/version timestamps, and returns the updated records.

- [ ] depends on: #110
- [ ] depends on: #111

Closes #120
```

---

By following these conventions, we ensure that pull request titles and descriptions are consistent, descriptive, and useful for tracking the changes and their impact across the CAL project.
