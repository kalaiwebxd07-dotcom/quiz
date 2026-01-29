# Java MCQ Quiz Portal

A comprehensive web-based Quiz Management System featuring separate Admin and Student portals, real-time quiz taking, and dashboard analytics.

## Features

### � Student Portal
- **Secure Login**: Access using Username, Roll Number, and Password.
- **Dashboard**: View upcoming quizzes, calendar, and recent activity (timeline).
- **Interactive Quiz Interface**: Timed quizzes with progress tracking.
- **Results**: Immediate score display with review capability.
- **Profile Management**: View personal details (Roll Number, Name).
- **Profile Customization**: Upload custom profile picture (Avatar).
- **Dark Mode**: Toggle between Light and Dark themes for visual comfort.

### �️ Admin Portal
- **Dashboard**: Overview of system statistics (active quizzes, total students).
- **Test Manager**: Create, edit, and schedule tests (start/end times).
- **Question Manager**: Add, edit, and delete questions for specific tests.
- **Student Manager**: View and manage registered students.
- **Results Manager**: View student performance, filter by highest/lowest scores, and export data.

## Tech Stack
- **Frontend**: HTML5, CSS3 (Custom Design System), JavaScript (Vanilla).
- **Backend**: Node.js (Built-in `http` module), File System (`fs`) for data persistence.
- **Data Storage**: JSON files (`students.json`, `questions.json`, `tests.json`, `results.json`).

## Setup & Run

1.  **Prerequisites**: Ensure [Node.js](https://nodejs.org/) is installed.
2.  **Install Dependencies** (if any extra modules are added later):
    ```bash
    npm install
    ```
3.  **Start the Server**:
    ```bash
    node server.js
    ```
4.  **Access the Application**:
    -   **Student Login**: `http://localhost:8080/index.html`
    -   **Admin Login**: `http://localhost:8080/login.html`

## Default Credentials

### Admin Login
- **Username**: `kalai`
- **Password**: `kalai@100`

### Student Login (Example)
- **Username**: `kalai`
- **Roll Number**: `24CS100`
- **Password**: `kalai@100`

*(See `students.json` for more student accounts)*

## File Structure
- `server.js`: Main backend server logic and API endpoints.
- `index.html`: Student login page.
- `student.html`: Student dashboard.
- `admin.html`: Admin dashboard.
- `login.html`: Admin login page.
- `script.js`: Core frontend logic (quiz engine, state management).
- `config.js`: Configuration constants.
- `color.css`: Global styles and variables.
