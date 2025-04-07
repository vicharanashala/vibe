---

title: Naming Conventions

---

# Naming Conventions

This document outlines the naming conventions for our TypeScript codebase, as enforced by [gts](https://github.com/google/gts) and our project guidelines.

---

## Files

- **Files Containing a Single Class or Function:**  
  - **Class File:** If a file contains a single class, the file name should exactly match the class name (using PascalCase).  
    _Example:_ A file containing the `UserService` class should be named `UserService.ts`.
  - **Function File:** If a file contains a single function, the file name should exactly match the function name (using camelCase).  
    _Example:_ A file containing the function `getUser` should be named `getUser.ts`.

- **Other Files:**  
  For files containing multiple classes or functions, use PascalCase with context relavent name.  
  _Example:_ `UtilsHelper.ts`

---

## Variables and Functions

- **Variables & Function Names:**  
  Use **camelCase**.  
  _Examples:_ `getUser`, `calculateTotal`, `userName`

---

## Classes

- **Class Names:**  
  Use **PascalCase**.  
  _Example:_ `UserService`

---

## Interfaces

- **Interface Names:**  
  Prefix interface names with an **I** and use **PascalCase**.  
  _Examples:_ `IUser`, `IAuthConfig`

---

## Enums

- **Enum Names:**  
  Use **PascalCase** for enum names.  
  _Examples:_ `UserRole`
- **Enum Values:**  
  Use **UPPER_SNAKE_CASE** for enum values.  
  _Examples:_ `ADMIN`, `USER`

---

## Generics

- **Generic Type Parameters:**  
  Use a single uppercase letter or a descriptive name if necessary.  
  _Examples:_ `T`, `K`, `V`

---

## Additional Guidelines

- **Remove Module Name Prefixes:**  
  Do not include module names in file or type names.
- **Consistency:**  
  Use these conventions consistently across the codebase for clarity and maintainability.

For more details, please refer to the [gts documentation](https://github.com/google/gts) and ask in discussions if you have any questions.