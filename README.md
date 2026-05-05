

# ReadHub - Online Bookstore

ReadHub is a premium, full-stack web application designed for a modern bookstore experience. It features a stunning "Diamond/Prism" aesthetic with a soft minimalist UI, providing a seamless journey for readers to browse, rent, and purchase books.

## 👥 Team Members & Roles

| Name | Roll Number | Role | Responsibilities |
| :--- | :--- | :--- | :--- |
| **Kinza Saeed** | 24l-2527 | Project Lead | Requirements engineering, documentation, and coordination. |
| **Fajar Owaes** | 24l-2532 | System Architect | Backend architecture, database design, and core logic. |
| **Syeda Urwa** | 24l-2561 | Developer | Frontend implementation, feature development, and testing. |

## ✨ Key Features

### 📖 For Customers
- **Advanced Book Discovery**: Browse by category, search with real-time filters, and view detailed book descriptions.
- **E-Book Rental System**: Flexible rental options with automatic expiry tracking and secure digital access.
- **Shopping Cart & Checkout**: A fluid, glassmorphism-based cart experience with secure order processing.
- **Digital Library**: Instant access to purchased and rented eBooks in a dedicated reader section.
- **Book Requests**: Request books not currently in the catalog and track their approval status.
- **User Dashboard**: Personalized dashboard to track orders, manage profiles, and view reading history.

### 🛡️ For Administrators
- **Real-time Analytics**: A comprehensive dashboard showing sales stats, user growth, and inventory alerts.
- **Inventory Management**: Full CRUD operations for books, categories, and stock tracking.
- **Order Tracking**: Manage customer orders, track rental statuses, and handle book requests.
- **User Moderation**: Manage user accounts and view detailed activity logs.
- **Automated Operations**: Built-in cron jobs for managing rental expirations and system maintenance.

## 🛠️ Technology Stack

- **Frontend**: Vanilla HTML5, CSS3 (Modern UI with Glassmorphism/Prism design), JavaScript (ES6+).
- **Backend**: Node.js, Express.js.
- **Database**: Microsoft SQL Server (MSSQL) for core data; Supabase for secure cloud storage and e-book hosting.
- **Authentication**: session management with `express-session` and `bcryptjs`.
- **Automation**: `node-cron` for scheduled rental checks and system cleanup.
- **File Handling**: `multer` for local uploads and Supabase SDK for cloud-based e-book storage.

## 📂 Project Structure

- `backend/`: Core server logic, routes, controllers, and middleware.
  - `controllers/`: Business logic for all API endpoints.
  - `routes/`: Express route definitions.
  - `cron/`: Scheduled tasks for rental expiry checking.
  - `sql/`: Database schema, migrations, and stored procedures.
- `frontend/public/`: Static files serving the UI (HTML, CSS, JS).
  - `css/`: Themed styling including `cart_styles.css` and global prism variables.
  - `js/`: Modular frontend logic and API integration.

## ⚙️ Setup & Installation

### 1. Prerequisites
- [Node.js](https://nodejs.org/) (LTS)
- [Microsoft SQL Server](https://www.microsoft.com/en-us/sql-server/sql-server-downloads)
- [Supabase Account](https://supabase.com/) (For storage buckets)

### 2. Database Setup
1. Create a database named `Read_Hub` in SQL Server.
2. Execute the scripts in `backend/sql/` in the following order:
   - `ReadHub_schema.sql` (Core tables)
   - `features.sql` (Stored procedures & views)
   - `orders_cart_migration.sql` (Cart & Order logic)
   - `ebook_supabase_migration.sql` (Cloud storage integration)
   - `book_requests_migration.sql` & `fix_ratings.sql` (Additional features)

### 3. Environment Configuration
Create a `.env` file in the `backend/` directory:
```env
# MSSQL Configuration
DB_USER=sa
DB_PASSWORD=your_password
DB_SERVER=localhost
DB_DATABASE=Read_Hub

# Server Configuration
PORT=3000
SESSION_SECRET=your_long_random_secret

# Supabase Configuration (Storage)
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

## 🚀 Running the Application

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the server:
   ```bash
   npm run dev
   ```
3. Access the app at `http://localhost:3000`.

---

### 🔑 Access Credentials
**Admin Access**:
- Email: `admin@gmail.com`
- Password: `password`

**Customer Access**:
- Register a new account via the Signup page to explore all features.

