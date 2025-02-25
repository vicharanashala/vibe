# CAL Frontend

## Table of Contents

1. [Introduction](#introduction)
2. [Technologies Used](#technologies-used)
3. [Getting Started](#getting-started)
4. [Linting and Formatting](#linting-and-formatting)

## Introduction

This is the frontend application for the project.

## Technologies Used

- React
- TypeScript
- Tailwind CSS
- Vite for build tooling
- ESLint and Prettier for code quality

## Getting Started

Please see the [contributing guide](../docs/CONTRIBUTING.md) for detailed instructions on setting up the project.

## Linting and Formatting

We use ESLint for linting and Prettier for code formatting. To run the linters, use the following commands:

```sh
npm run lint
```

To see formatting issues, run:
```sh
npm run format
```

## Window Structure

The window is divided into **two main parts**:  
1. **Layout**  
2. **Outlet**  

### 1. Layout

The Layout is further divided into **three parts**:  
- **Sidebar Left**  
- **Navbar**  
- **Sidebar Right**

#### **Sidebar Left**
**Location:** `\frontend-cal\src\components\sidebar-left.tsx`  
This section contains the following items:  
1. **Dashboard**  
   - Displays the progress of the student and course details.  
   - **Location:** `frontend-cal\src\pages\Students\StudentDashboard.tsx`
2. **Courses**
3. **Assignments**
4. **Announcements**
5. **Calendar**
6. **Settings**
7. **Logout**
8. **Trash**
9. **Help**

#### **Navbar**
**Location:** `frontend-cal\src\components\mode-toggle.tsx`  
The Navbar contains a **Toggle Button** to switch between light mode and dark mode.

#### **Sidebar Right**
This section includes:  
1. **User Profile**  
2. **My Schedules**  
3. **Announcements**  
4. **Updates**  
5. **Proctoring Components**  
   - **Location:** `frontend-cal\src\components\proctoring-components` 
   - The ParentComponent integrates all proctoring component files.  
   - To use proctoring components, import the **ParentComponent** file. 
   - ParentComponents consists all the proctoring components exists in     `frontend-cal\src\components\proctoring-components\ParentComponent`.  
6. **New Schedule**
 
---

### 2. Outlet

The **Outlet** serves as the main content area that dynamically changes according to route navigation.  
- **Powered by:** `react-router-dom`.  
- The **Outlet** acts as a placeholder for child routes and renders different components based on the current route. 

---

## Proctoring Components

The **Proctoring-components** directory contains all the files related to proctoring functionalities.  
- **ParentComponent File**: Acts as the central integration point for all proctoring components.  
- To utilize any proctoring feature, simply use the **ParentComponent** file.

---

## File Structure

Below is a summary of the file locations for quick reference:

| **Resources**          | **Location**                                     |
|-------------------------|-------------------------------------------------|
| components          | `\frontend-cal\src\components`|
|                    | ├── login-form|
|                    | ├── mode-toggle|
|                    | ├── sidebar-left|
|                    | ├── sidebar-right|
|                    | ├── signup-form|
|                    | ├── login-form|
|                    | ├── logout|
|                    | ├── mode-toggle|
|                    | ├── proctoring-components|
|                    | │   ├── BlurDetection.tsx|
|                    | │   ├── ParentComponent.tsx|
|                    | │   ├── FaceDetection.tsx|
|                    | │   ├── FullScreenDetection.tsx|
|                    | │   ├── KeyboardDetection.tsx|
|                    | │   ├── MouseDetection.tsx|
|                    | │   ├── TabSwitchDetection.tsx|
|                    | │   └── WindowResizeDetection.tsx|
|                    | └── ui|
|                    |     ├── breadcrumb.tsx|
|                    |     ├── button.tsx|
|                    |     ├── card.tsx|
|                    |     ├── dialog.tsx|
|                    |     ├── dropdown-menu.tsx|
|                    |     ├── form.tsx|
|                    |     ├── input.tsx|
|                    |     ├── label.tsx|
|                    |     ├── separator.tsx|
|                    |     ├── sidebar.tsx|
|                    |     ├── sonner.tsx|
|                    |     └── theme-provider.tsx|
| pages              | `\frontend-cal\src\pages`|
|                    | ├── Home.tsx|
|                    | ├── LoginPage.tsx|
|                    | └── Students|
|                    |     ├── ContentScrollView.tsx|
|                    |     ├── CourseView.tsx|
|                    |     ├── ModuleView.tsx|
|                    |     ├── SectionDetail.tsx|
|                    |     ├── SectionView.tsx|
|                    |     └── StudentDashboard.tsx|
| routes             | `\frontend-cal\src\routes`|
|                    | └── index.ts|
| store              | `\frontend-cal\src\store`|
|                    | ├── Slices|
|                    | ├── apiService.ts|
|                    | └── store.ts|
| App.tsx            | `\frontend-cal\src\App.tsx`|
| index.tsx          | `\frontend-cal\src\index.tsx`|
| main.tsx           | `\frontend-cal\src\main.tsx`|

---

This documentation provides a clear overview of the CAL system's layout and its key components, enabling efficient navigation and usage.

## Redux Store

The CAL system uses **Redux** for state management, structured as follows:  

### **Store Structure**  
1. **`store` Folder**  
   - **Location:** `frontend-cal\src\store`  
   - Contains all Redux-related files, including API services, slices, and the main store configuration.  

2. **`apiService.ts`**  
   - **Location:** `frontend-cal\src\store\apiService.ts`  
   - Centralizes all API calls for the application.  
   - Manages HTTP requests and integrates with Redux slices for data flow.

3. **`Slices` Folder**  
   - **Location:** `frontend-cal\src\store\Slices`  
   - Contains slice files corresponding to different API calls or features.  
   - Each slice defines actions, reducers, and initial states for specific features.  

4. **`store.ts`**  
   - **Location:** `frontend-cal\src\store\store.ts`  
   - Integrates all reducers created by slices into a single Redux store.  