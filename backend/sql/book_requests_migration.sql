/*
  backend/sql/book_requests_migration.sql
  ─────────────────────────────────────────────────────────────────────────────
  Migration to create the book_requests table for US-3.4.
*/

USE Read_Hub;
GO

IF OBJECT_ID('book_requests', 'U') IS NOT NULL DROP TABLE book_requests;
GO

CREATE TABLE book_requests (
    id INT IDENTITY(1,1) PRIMARY KEY,
    user_id INT NOT NULL,
    title NVARCHAR(300) NOT NULL,
    author NVARCHAR(300) NOT NULL,
    notes NVARCHAR(MAX) NULL,
    status NVARCHAR(50) DEFAULT 'Pending',
    created_at DATETIME2 DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_BookRequests_User FOREIGN KEY (user_id) REFERENCES Users(UserID) ON DELETE CASCADE
);
GO

-- Optional: If you want to keep the old Requests table, you can. 
-- But for this task, we will use book_requests.
