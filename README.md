# ReadHub - Online Bookstore

ReadHub is a modern, responsive web application designed for a seamless bookstore experience. It allows users to browse, search, and manage a collection of books through a professional interface, backed by a robust SQL Server database.

## 👥 Team Members & Roles

| Name | Roll Number | Role | Responsibilities |
| :--- | :--- | :--- | :--- |
| **Kinza Saeed** | 24l-2527 | Project Lead / Requirement Engineer | Gather system requirements, manage project progress, coordinate tasks, and prepare project documentation. |
| **Fajar Owaes** | 24l-2532 | System Architect / Developer | Design system architecture, design database schema, and implement core system modules. |
| **Syeda Urwa** | 24l-2561 | Developer / Tester | Implement system features, perform testing, identify bugs, and assist in system integration. |

## 🛠️ Technology Stack

- **Frontend**: Vanilla HTML5, CSS3 (Modern UI with glassmorphism), and JavaScript (ES6+).
- **Backend**: Node.js with Express.js framework.
- **Database**: Microsoft SQL Server (MSSQL).
- **Authentication**: JWT-based session management with `express-session` and `bcryptjs` for secure password hashing.
- **Utilities**: `dotenv` for environment management, `cors` for cross-origin requests.

## 📂 Project Structure

- `backend/`: Node.js Express server, database connection logic, and utility scripts.
  - `sql/`: Contains `.sql` scripts for database schema and feature implementation.
- `frontend/`: All static files (HTML, CSS, JS) served as the user interface.
- `docs/`: Project documentation and user stories.
- `final report/`: Submission-ready project reports.

## ⚙️ Setup & Installation

### 1. Prerequisites
- [Node.js](https://nodejs.org/) (LTS recommended)
- [Microsoft SQL Server](https://www.microsoft.com/en-us/sql-server/sql-server-downloads) (Express edition is sufficient)
- [SQL Server Management Studio (SSMS)](https://learn.microsoft.com/en-us/sql/ssms/download-sql-server-management-studio-ssms) (Optional, for database management)

### 2. Database Setup
1. Open SQL Server and create a new database named `Read_Hub`.
2. Navigate to `backend/sql/` and execute these scripts in order:
   - `ReadHubschema (2).sql`: Sets up the tables and relationships.
   - `features.sql`: Implements views, stored procedures, and triggers.

### 3. Application Configuration
1. Clone or download the project repository.
2. In the root directory, run:
   ```bash
   npm install
   ```
3. Navigate to the `backend/` folder and locate `.env.example`.
4. Rename `.env.example` to `.env` and fill in your SQL Server credentials:
   ```env
   DB_USER=your_username
   DB_PASSWORD=your_password
   DB_SERVER=localhost\SQLEXPRESS
   DB_DATABASE=Read_Hub
   SESSION_SECRET=a_secure_random_string
   ```

## 🚀 How to Run the Project

1. From the project **root directory**, start the server:
   ```bash
   npm start
   ```
2. Once the console shows `Server running on http://localhost:3000` and `--- Database Connected Successfully ---`, open your web browser.
3. Navigate to **`http://localhost:3000`** to access the ReadHub Bookstore.

---

