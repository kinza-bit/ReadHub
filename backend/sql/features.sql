
-- Read_Hub Bookstore – Feature Queries (Views & Stored Procedures)
-- Database : Read_Hub (SQL Server)

USE Read_Hub;
GO

-- VIEWS

-- ────────────────────────────────────────────────────────────
-- View: vw_AllUsers
-- ────────────────────────────────────────────────────────────
IF OBJECT_ID('vw_AllUsers', 'V') IS NOT NULL DROP VIEW vw_AllUsers;
GO
CREATE VIEW vw_AllUsers AS
SELECT u.UserID, u.Username, u.Email, u.FullName, u.PhoneNumber,
       ISNULL(u.AddressLine1, 'N/A') AS AddressLine1,
       ISNULL(u.City, 'N/A') AS City,
       ISNULL(u.Country, 'N/A') AS Country, u.IsActive,
       (SELECT r.RoleName FROM Roles r WHERE r.RoleID = u.RoleID) AS RoleName,
       u.CreatedAt
FROM Users u;
GO

-- ────────────────────────────────────────────────────────────
-- View: vw_AvailableBooks
-- ────────────────────────────────────────────────────────────
IF OBJECT_ID('vw_AvailableBooks', 'V') IS NOT NULL DROP VIEW vw_AvailableBooks;
GO
CREATE VIEW vw_AvailableBooks AS
SELECT b.BookID, b.ISBN, b.Title, b.Author,
       (SELECT c.Name FROM Categories c WHERE c.CategoryID = b.CategoryID) AS CategoryName,
       b.CategoryID,
       ISNULL(b.Description, 'No description') AS Description,
       b.PhysicalPrice, b.EbookPrice, b.RentalPricePerDay, b.AverageRating, b.ImageURL,
       ISNULL((SELECT i.StockLevel FROM Inventory i WHERE i.BookID = b.BookID), 0) AS StockLevel,
       CASE
           WHEN (SELECT i.StockLevel FROM Inventory i WHERE i.BookID = b.BookID) > 0 THEN 'Available'
           ELSE 'Out of Stock'
       END AS PhysicalAvailability,
       CASE
           WHEN b.PdfURL IS NOT NULL THEN 'Available'
           ELSE 'Not Available'
       END AS EbookAvailability
FROM Books b;
GO

-- ────────────────────────────────────────────────────────────
-- View: vw_FullInventory
-- ────────────────────────────────────────────────────────────
IF OBJECT_ID('vw_FullInventory', 'V') IS NOT NULL DROP VIEW vw_FullInventory;
GO
CREATE VIEW vw_FullInventory AS
SELECT b.BookID, b.Title, b.Author,
       (SELECT c.Name FROM Categories c WHERE c.CategoryID = b.CategoryID) AS CategoryName,
       i.StockLevel, i.LowStockThreshold, i.TotalPhysicalSold,
       i.TotalEbooksSold, i.TotalEbooksRented, i.LastRestockDate, i.UpdatedAt,
       CASE
           WHEN i.StockLevel <= i.LowStockThreshold THEN 'Low Stock'
           ELSE 'In Stock'
       END AS StockStatus
FROM Inventory i
INNER JOIN Books b ON i.BookID = b.BookID;
GO

-- ────────────────────────────────────────────────────────────
-- View: vw_UserRequests
-- ────────────────────────────────────────────────────────────
IF OBJECT_ID('vw_UserRequests', 'V') IS NOT NULL DROP VIEW vw_UserRequests;
GO
CREATE VIEW vw_UserRequests AS
SELECT r.RequestID, u.Username, u.FullName, r.UserID, r.Title, 
       ISNULL(r.Author, 'Unknown') AS Author, r.Status, r.CreatedAt
FROM Requests r
INNER JOIN Users u ON r.UserID = u.UserID;
GO

-- ADMIN FEATURES

-- ────────────────────────────────────────────────────────────
--   Admin Login
-- ────────────────────────────────────────────────────────────
IF OBJECT_ID('sp_AdminLogin', 'P') IS NOT NULL DROP PROCEDURE sp_AdminLogin;
GO
CREATE PROCEDURE sp_AdminLogin
    @Username NVARCHAR(50),
    @PasswordHash NVARCHAR(256)
AS
BEGIN
    SET NOCOUNT ON;
    SELECT UserID, Username, Email, FullName, RoleName
    FROM vw_AllUsers
    WHERE Username = @Username
      AND (SELECT PasswordHash FROM Users WHERE Username = @Username) = @PasswordHash
      AND IsActive = 1
      AND RoleName = 'Admin';
END;
GO

-- ────────────────────────────────────────────────────────────
--   Manage User Accounts
-- ────────────────────────────────────────────────────────────
IF OBJECT_ID('sp_GetAllUsers', 'P') IS NOT NULL DROP PROCEDURE sp_GetAllUsers;
GO
CREATE PROCEDURE sp_GetAllUsers
AS
BEGIN
    SET NOCOUNT ON;
    SELECT * FROM vw_AllUsers ORDER BY CreatedAt DESC;
END;
GO

IF OBJECT_ID('sp_UpdateUserStatus', 'P') IS NOT NULL DROP PROCEDURE sp_UpdateUserStatus;
GO
CREATE PROCEDURE sp_UpdateUserStatus
    @UserID INT,
    @IsActive BIT
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE Users SET IsActive = @IsActive WHERE UserID = @UserID;
END;
GO

IF OBJECT_ID('sp_DeleteUser', 'P') IS NOT NULL DROP PROCEDURE sp_DeleteUser;
GO
CREATE PROCEDURE sp_DeleteUser
    @UserID INT
AS
BEGIN
    SET NOCOUNT ON;
    DELETE FROM Users WHERE UserID = @UserID;
END;
GO

-- ────────────────────────────────────────────────────────────
--   Organize Books by Categories
-- ────────────────────────────────────────────────────────────
IF OBJECT_ID('sp_GetAllCategories', 'P') IS NOT NULL DROP PROCEDURE sp_GetAllCategories;
GO
CREATE PROCEDURE sp_GetAllCategories
AS
BEGIN
    SET NOCOUNT ON;
    SELECT CategoryID, Name, ISNULL(Description, 'No description') AS Description
    FROM Categories ORDER BY Name ASC;
END;
GO

IF OBJECT_ID('sp_AddCategory', 'P') IS NOT NULL DROP PROCEDURE sp_AddCategory;
GO
CREATE PROCEDURE sp_AddCategory
    @CategoryName NVARCHAR(100),
    @CategoryDescription NVARCHAR(MAX)
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO Categories (Name, Description) VALUES (@CategoryName, @CategoryDescription);
END;
GO

IF OBJECT_ID('sp_UpdateCategory', 'P') IS NOT NULL DROP PROCEDURE sp_UpdateCategory;
GO
CREATE PROCEDURE sp_UpdateCategory
    @CategoryID INT,
    @CategoryName NVARCHAR(100),
    @CategoryDescription NVARCHAR(MAX)
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE Categories SET Name = @CategoryName, Description = @CategoryDescription WHERE CategoryID = @CategoryID;
END;
GO

IF OBJECT_ID('sp_DeleteCategory', 'P') IS NOT NULL DROP PROCEDURE sp_DeleteCategory;
GO
CREATE PROCEDURE sp_DeleteCategory
    @CategoryID INT
AS
BEGIN
    SET NOCOUNT ON;
    IF NOT EXISTS (SELECT 1 FROM Books WHERE CategoryID = @CategoryID)
    BEGIN
        DELETE FROM Categories WHERE CategoryID = @CategoryID;
    END
    ELSE
    BEGIN
        THROW 50001, 'Cannot delete category containing books.', 1;
    END
END;
GO

-- ────────────────────────────────────────────────────────────
--   Add New Books
-- ────────────────────────────────────────────────────────────
IF OBJECT_ID('sp_AddNewBook', 'P') IS NOT NULL DROP PROCEDURE sp_AddNewBook;
GO
CREATE PROCEDURE sp_AddNewBook
    @ISBN NVARCHAR(50),
    @Title NVARCHAR(255),
    @Author NVARCHAR(255),
    @CategoryID INT,
    @Description NVARCHAR(MAX),
    @PhysicalPrice DECIMAL(10,2),
    @EbookPrice DECIMAL(10,2),
    @RentalPricePerDay DECIMAL(10,2),
    @LateFeePerDay DECIMAL(10,2),
    @ImageURL NVARCHAR(255),
    @PdfURL NVARCHAR(255),
    @SupabasePath NVARCHAR(255) = NULL,
    @StockLevel INT,
    @LowStockThreshold INT
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        BEGIN TRANSACTION;
        
        DECLARE @NewBookID INT;
        
        INSERT INTO Books (ISBN, Title, Author, CategoryID, Description, PhysicalPrice, EbookPrice, RentalPricePerDay, LateFeePerDay, ImageURL, PdfURL, SupabasePath)
        VALUES (@ISBN, @Title, @Author, @CategoryID, @Description, @PhysicalPrice, @EbookPrice, @RentalPricePerDay, @LateFeePerDay, @ImageURL, @PdfURL, @SupabasePath);
        
        SET @NewBookID = SCOPE_IDENTITY();
        
        -- Update the automatically created Inventory row (if a trigger exists)
        -- Or insert it if it doesn't exist
        IF EXISTS (SELECT 1 FROM Inventory WHERE BookID = @NewBookID)
        BEGIN
            UPDATE Inventory 
            SET StockLevel = @StockLevel, LowStockThreshold = @LowStockThreshold, LastRestockDate = GETDATE()
            WHERE BookID = @NewBookID;
        END
        ELSE
        BEGIN
            INSERT INTO Inventory (BookID, StockLevel, LowStockThreshold, LastRestockDate)
            VALUES (@NewBookID, @StockLevel, @LowStockThreshold, GETDATE());
        END
        
        COMMIT TRANSACTION;
        SELECT @NewBookID AS BookID;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH
END;
GO

-- ────────────────────────────────────────────────────────────
--   Edit / Update Book Information
-- ────────────────────────────────────────────────────────────
IF OBJECT_ID('sp_UpdateBook', 'P') IS NOT NULL DROP PROCEDURE sp_UpdateBook;
GO
CREATE PROCEDURE sp_UpdateBook
    @BookID INT,
    @Title NVARCHAR(255),
    @Author NVARCHAR(255),
    @ISBN NVARCHAR(50),
    @CategoryID INT,
    @Description NVARCHAR(MAX),
    @PhysicalPrice DECIMAL(10,2),
    @EbookPrice DECIMAL(10,2),
    @RentalPricePerDay DECIMAL(10,2),
    @LateFeePerDay DECIMAL(10,2),
    @ImageURL NVARCHAR(255),
    @PdfURL NVARCHAR(255),
    @SupabasePath NVARCHAR(255) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    
    UPDATE Books
    SET Title = ISNULL(@Title, Title),
        Author = ISNULL(@Author, Author),
        ISBN = ISNULL(@ISBN, ISBN),
        CategoryID = ISNULL(@CategoryID, CategoryID),
        Description = ISNULL(@Description, Description),
        PhysicalPrice = ISNULL(@PhysicalPrice, PhysicalPrice),
        EbookPrice = ISNULL(@EbookPrice, EbookPrice),
        RentalPricePerDay = ISNULL(@RentalPricePerDay, RentalPricePerDay),
        LateFeePerDay = ISNULL(@LateFeePerDay, LateFeePerDay),
        ImageURL = ISNULL(@ImageURL, ImageURL),
        PdfURL = ISNULL(@PdfURL, PdfURL),
        SupabasePath = ISNULL(@SupabasePath, SupabasePath)
    WHERE BookID = @BookID;
END;
GO

-- ────────────────────────────────────────────────────────────
--   Delete Books
-- ────────────────────────────────────────────────────────────
IF OBJECT_ID('sp_DeleteBook', 'P') IS NOT NULL DROP PROCEDURE sp_DeleteBook;
GO
CREATE PROCEDURE sp_DeleteBook
    @BookID INT
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        BEGIN TRANSACTION;
        
        -- Delete from related tables that do not have ON DELETE CASCADE
        DELETE FROM CartItems WHERE BookID = @BookID;
        DELETE FROM UserWishlist WHERE BookID = @BookID;
        DELETE FROM EbookRentals WHERE BookID = @BookID;
        DELETE FROM OrderItems WHERE BookID = @BookID;
        
        -- Although Inventory and BookRating may have CASCADE in the schema, 
        -- we handle them here for robustness and consistency.
        DELETE FROM Inventory WHERE BookID = @BookID;
        DELETE FROM BookRating WHERE BookID = @BookID;

        -- Finally, delete the book record
        DELETE FROM Books WHERE BookID = @BookID;

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH
END;
GO


-- ────────────────────────────────────────────────────────────
--   Inventory Management
-- ────────────────────────────────────────────────────────────
IF OBJECT_ID('sp_GetFullInventory', 'P') IS NOT NULL DROP PROCEDURE sp_GetFullInventory;
GO
CREATE PROCEDURE sp_GetFullInventory
AS
BEGIN
    SET NOCOUNT ON;
    SELECT * FROM vw_FullInventory ORDER BY StockLevel ASC;
END;
GO

IF OBJECT_ID('sp_UpdateStockLevel', 'P') IS NOT NULL DROP PROCEDURE sp_UpdateStockLevel;
GO
CREATE PROCEDURE sp_UpdateStockLevel
    @BookID INT,
    @QuantityToAdd INT
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE Inventory
    SET StockLevel = StockLevel + @QuantityToAdd,
        LastRestockDate = SYSUTCDATETIME(),
        UpdatedAt = SYSUTCDATETIME()
    WHERE BookID = @BookID;
END;
GO

--  USER FEATURES

-- ────────────────────────────────────────────────────────────
--   User Login
-- ────────────────────────────────────────────────────────────
IF OBJECT_ID('sp_UserLogin', 'P') IS NOT NULL DROP PROCEDURE sp_UserLogin;
GO
CREATE PROCEDURE sp_UserLogin
    @Username NVARCHAR(50),
    @PasswordHash NVARCHAR(256)
AS
BEGIN
    SET NOCOUNT ON;
    SELECT UserID, Username, Email, FullName, RoleName
    FROM vw_AllUsers
    WHERE Username = @Username
      AND (SELECT PasswordHash FROM Users WHERE Username = @Username) = @PasswordHash
      AND IsActive = 1
      AND RoleName = 'Customer';
END;
GO

-- ────────────────────────────────────────────────────────────
--   View Available Books
-- ────────────────────────────────────────────────────────────
IF OBJECT_ID('sp_ViewAvailableBooks', 'P') IS NOT NULL DROP PROCEDURE sp_ViewAvailableBooks;
GO
CREATE PROCEDURE sp_ViewAvailableBooks
AS
BEGIN
    SET NOCOUNT ON;
    SELECT * FROM vw_AvailableBooks ORDER BY CategoryName ASC, Title ASC;
END;
GO

-- ────────────────────────────────────────────────────────────
--  Search for Books
-- ────────────────────────────────────────────────────────────
IF OBJECT_ID('sp_SearchBooks', 'P') IS NOT NULL DROP PROCEDURE sp_SearchBooks;
GO
CREATE PROCEDURE sp_SearchBooks
    @SearchTerm NVARCHAR(100)
AS
BEGIN
    SET NOCOUNT ON;
    SELECT * FROM vw_AvailableBooks
    WHERE Title LIKE '%' + @SearchTerm + '%'
       OR Author LIKE '%' + @SearchTerm + '%'
       OR CategoryName LIKE '%' + @SearchTerm + '%'
    ORDER BY AverageRating DESC, Title ASC;
END;
GO



-- ────────────────────────────────────────────────────────────
--  Download Ebook
-- ────────────────────────────────────────────────────────────
IF OBJECT_ID('sp_DownloadEbook', 'P') IS NOT NULL DROP PROCEDURE sp_DownloadEbook;
GO
CREATE PROCEDURE sp_DownloadEbook
    @UserID INT,
    @BookID INT
AS
BEGIN
    SET NOCOUNT ON;
    -- Returns PdfURL only if user actually purchased it or is actively renting it
    SELECT PdfURL 
    FROM Books 
    WHERE BookID = @BookID
      AND (
          EXISTS (
              SELECT 1 FROM OrderItems oi
              INNER JOIN Orders o ON oi.OrderID = o.OrderID
              WHERE oi.BookID = @BookID AND o.UserID = @UserID AND oi.FormatID = 2
                AND o.PaymentStatusID = (SELECT StatusID FROM PaymentStatus WHERE StatusName = 'Completed')
          )
          OR
          EXISTS (
              SELECT 1 FROM EbookRentals er
              WHERE er.BookID = @BookID AND er.UserID = @UserID
                AND SYSUTCDATETIME() <= er.DueDate AND er.ActualReturnDate IS NULL
          )
      );
END;
GO

-- ────────────────────────────────────────────────────────────
--  Request Books
-- ────────────────────────────────────────────────────────────
IF OBJECT_ID('sp_RequestBook', 'P') IS NOT NULL DROP PROCEDURE sp_RequestBook;
GO
CREATE PROCEDURE sp_RequestBook
    @UserID INT,
    @RequestedTitle NVARCHAR(200),
    @RequestedAuthor NVARCHAR(100)
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO Requests (UserID, Title, Author)
    VALUES (@UserID, @RequestedTitle, @RequestedAuthor);
END;
GO

IF OBJECT_ID('sp_GetUserRequests', 'P') IS NOT NULL DROP PROCEDURE sp_GetUserRequests;
GO
CREATE PROCEDURE sp_GetUserRequests
    @UserID INT
AS
BEGIN
    SET NOCOUNT ON;
    -- Using the vw_UserRequests view
    SELECT RequestID, Title, Author, Status, CreatedAt
    FROM vw_UserRequests
    WHERE UserID = @UserID
    ORDER BY CreatedAt DESC;
END;
GO

IF OBJECT_ID('sp_GetAllUserRequests_Admin', 'P') IS NOT NULL DROP PROCEDURE sp_GetAllUserRequests_Admin;
GO
CREATE PROCEDURE sp_GetAllUserRequests_Admin
AS
BEGIN
    SET NOCOUNT ON;
    SELECT *
    FROM vw_UserRequests
    ORDER BY CreatedAt DESC;
END;
GO

-- ────────────────────────────────────────────────────────────
--   Rate Books (Star Rating Only)
-- ────────────────────────────────────────────────────────────
IF OBJECT_ID('sp_RateBook', 'P') IS NOT NULL DROP PROCEDURE sp_RateBook;
GO
CREATE PROCEDURE sp_RateBook
    @UserID INT,
    @BookID INT,
    @Rating INT
AS
BEGIN
    SET NOCOUNT ON;
    IF @Rating < 1 OR @Rating > 5
    BEGIN
        THROW 50003, 'Rating must be between 1 and 5.', 1;
    END

    IF EXISTS (SELECT 1 FROM BookRating WHERE UserID = @UserID AND BookID = @BookID)
    BEGIN
        UPDATE BookRating
        SET Rating = @Rating, CreatedAt = SYSUTCDATETIME()
        WHERE UserID = @UserID AND BookID = @BookID;
    END
    ELSE
    BEGIN
        INSERT INTO BookRating (BookID, UserID, Rating)
        VALUES (@BookID, @UserID, @Rating);
    END

    UPDATE Books
    SET AverageRating = (
        SELECT ISNULL(AVG(CAST(Rating AS DECIMAL(3,2))), 0.00)
        FROM BookRating
        WHERE BookID = @BookID
    )
    WHERE BookID = @BookID;
END;
GO

-- ────────────────────────────────────────────────────────────
--   Register New User
-- ────────────────────────────────────────────────────────────
IF OBJECT_ID('sp_RegisterUser', 'P') IS NOT NULL DROP PROCEDURE sp_RegisterUser;
GO
CREATE PROCEDURE sp_RegisterUser
    @Username NVARCHAR(50),
    @PasswordHash NVARCHAR(256),
    @Email NVARCHAR(100),
    @FullName NVARCHAR(100),
    @RoleName NVARCHAR(50) = 'Customer'
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @RoleID INT = (SELECT RoleID FROM Roles WHERE RoleName = @RoleName);
    
    IF EXISTS (SELECT 1 FROM Users WHERE Email = @Email)
    BEGIN
        THROW 50004, 'Email already registered.', 1;
    END

    INSERT INTO Users (Username, PasswordHash, Email, FullName, RoleID, IsActive)
    VALUES (@Username, @PasswordHash, @Email, @FullName, @RoleID, 1);
END;
GO

-- ────────────────────────────────────────────────────────────
--  Get User By Email (for Login/Auth)
-- ────────────────────────────────────────────────────────────
IF OBJECT_ID('sp_GetUserByEmail', 'P') IS NOT NULL DROP PROCEDURE sp_GetUserByEmail;
GO
CREATE PROCEDURE sp_GetUserByEmail
    @Email NVARCHAR(100)
AS
BEGIN
    SET NOCOUNT ON;
    SELECT v.*, u.PasswordHash, u.RoleID
    FROM vw_AllUsers v
    INNER JOIN Users u ON v.UserID = u.UserID
    WHERE v.Email = @Email;
END;
GO

-- ────────────────────────────────────────────────────────────
--  Get Detailed User Info (Admin)
-- ────────────────────────────────────────────────────────────
IF OBJECT_ID('sp_GetUserDetails', 'P') IS NOT NULL DROP PROCEDURE sp_GetUserDetails;
GO
CREATE PROCEDURE sp_GetUserDetails
    @UserID INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT UserID, Username, Email, FullName, PhoneNumber, AddressLine1, City, Country, IsActive, RoleID, CreatedAt 
    FROM Users 
    WHERE UserID = @UserID;
END;
GO

-- ────────────────────────────────────────────────────────────
-- Update User Details (Admin)
-- ────────────────────────────────────────────────────────────
IF OBJECT_ID('sp_UpdateUserDetails', 'P') IS NOT NULL DROP PROCEDURE sp_UpdateUserDetails;
GO
CREATE PROCEDURE sp_UpdateUserDetails
    @UserID INT,
    @FullName NVARCHAR(100),
    @Email NVARCHAR(100),
    @PhoneNumber NVARCHAR(20),
    @City NVARCHAR(100),
    @RoleID INT,
    @IsActive BIT
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE Users 
    SET FullName = @FullName, 
        Email = @Email, 
        PhoneNumber = @PhoneNumber, 
        City = @City, 
        RoleID = @RoleID, 
        IsActive = @IsActive
    WHERE UserID = @UserID;
END;
GO

-- ────────────────────────────────────────────────────────────
--  Toggle User Status (Admin Soft Delete)
-- ────────────────────────────────────────────────────────────
IF OBJECT_ID('sp_ToggleUserStatus', 'P') IS NOT NULL DROP PROCEDURE sp_ToggleUserStatus;
GO
CREATE PROCEDURE sp_ToggleUserStatus
    @UserID INT
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE Users SET IsActive = CASE WHEN IsActive = 1 THEN 0 ELSE 1 END WHERE UserID = @UserID;
END;
GO

-- ────────────────────────────────────────────────────────────
--  Get Users with Filtering and Sorting (Admin)
-- ────────────────────────────────────────────────────────────
IF OBJECT_ID('sp_GetUsersFiltered', 'P') IS NOT NULL DROP PROCEDURE sp_GetUsersFiltered;
GO
CREATE PROCEDURE sp_GetUsersFiltered
    @Search NVARCHAR(100) = NULL,
    @Role NVARCHAR(50) = NULL,
    @SortBy NVARCHAR(50) = 'UserID',
    @SortOrder NVARCHAR(4) = 'ASC'
AS
BEGIN
    SET NOCOUNT ON;
    -- Note: Handling sorting in SP to avoid dynamic SQL where possible
    SELECT v.UserID, v.FullName, v.Email, v.RoleName, u.Username, u.PhoneNumber, u.City, v.IsActive, u.CreatedAt
    FROM vw_AllUsers v
    INNER JOIN Users u ON v.UserID = u.UserID
    WHERE (@Search IS NULL OR v.FullName LIKE '%' + @Search + '%' OR v.Email LIKE '%' + @Search + '%' OR u.Username LIKE '%' + @Search + '%')
      AND (@Role IS NULL OR v.RoleName = @Role)
    ORDER BY 
        CASE WHEN @SortOrder = 'ASC' THEN
            CASE @SortBy 
                WHEN 'UserID' THEN CAST(v.UserID AS NVARCHAR(50))
                WHEN 'FullName' THEN v.FullName
                WHEN 'Email' THEN v.Email
                WHEN 'RoleName' THEN v.RoleName
                WHEN 'CreatedAt' THEN CONVERT(NVARCHAR(50), u.CreatedAt, 126)
                ELSE CAST(v.UserID AS NVARCHAR(50))
            END
        END ASC,
        CASE WHEN @SortOrder = 'DESC' THEN
            CASE @SortBy 
                WHEN 'UserID' THEN CAST(v.UserID AS NVARCHAR(50))
                WHEN 'FullName' THEN v.FullName
                WHEN 'Email' THEN v.Email
                WHEN 'RoleName' THEN v.RoleName
                WHEN 'CreatedAt' THEN CONVERT(NVARCHAR(50), u.CreatedAt, 126)
                ELSE CAST(v.UserID AS NVARCHAR(50))
            END
        END DESC;
END;
GO

-- ────────────────────────────────────────────────────────────
--  Check Email Exists (Forgot Password)
-- ────────────────────────────────────────────────────────────
IF OBJECT_ID('sp_CheckEmailExists', 'P') IS NOT NULL DROP PROCEDURE sp_CheckEmailExists;
GO
CREATE PROCEDURE sp_CheckEmailExists
    @Email NVARCHAR(200)
AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (SELECT 1 FROM Users WHERE Email = @Email)
        SELECT 1 AS EmailExists;
    ELSE
        SELECT 0 AS EmailExists;
END;
GO

-- ────────────────────────────────────────────────────────────
--  Store Reset Token
-- ────────────────────────────────────────────────────────────
IF OBJECT_ID('sp_StoreResetToken', 'P') IS NOT NULL DROP PROCEDURE sp_StoreResetToken;
GO
CREATE PROCEDURE sp_StoreResetToken
    @Email NVARCHAR(200),
    @Token NVARCHAR(64),
    @Expiry DATETIME2
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE Users 
    SET ResetToken = @Token, TokenExpiry = @Expiry 
    WHERE Email = @Email;
END;
GO

-- ────────────────────────────────────────────────────────────
--  Validate Reset Token
-- ────────────────────────────────────────────────────────────
IF OBJECT_ID('sp_ValidateResetToken', 'P') IS NOT NULL DROP PROCEDURE sp_ValidateResetToken;
GO
CREATE PROCEDURE sp_ValidateResetToken
    @Token NVARCHAR(64)
AS
BEGIN
    SET NOCOUNT ON;
    SELECT UserID 
    FROM Users 
    WHERE ResetToken = @Token AND TokenExpiry > SYSUTCDATETIME();
END;
GO

-- ────────────────────────────────────────────────────────────
-- Update Password and Clear Token
-- ────────────────────────────────────────────────────────────
IF OBJECT_ID('sp_UpdatePasswordAndClearToken', 'P') IS NOT NULL DROP PROCEDURE sp_UpdatePasswordAndClearToken;
GO
CREATE PROCEDURE sp_UpdatePasswordAndClearToken
    @UserID INT,
    @NewPasswordHash NVARCHAR(256)
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE Users 
    SET PasswordHash = @NewPasswordHash, 
        ResetToken = NULL, 
        TokenExpiry = NULL 
    WHERE UserID = @UserID;
END;
GO


-- ============================================================
-- TRIGGERS
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- Trigger 1: trg_AfterInsertBook
-- Automatically create an Inventory row whenever a new Book is
-- inserted (Admin: Add New Books).
-- Guarantees every book always has inventory tracking even if
-- sp_AddNewBook is bypassed by a direct INSERT.
-- ────────────────────────────────────────────────────────────
IF OBJECT_ID('trg_AfterInsertBook', 'TR') IS NOT NULL DROP TRIGGER trg_AfterInsertBook;
GO
CREATE TRIGGER trg_AfterInsertBook
ON Books
AFTER INSERT
AS
BEGIN
    SET NOCOUNT ON;
    -- Insert Inventory row only if one does not already exist
    -- (sp_AddNewBook inserts it explicitly; this is a safety net)
    INSERT INTO Inventory (BookID, StockLevel, LowStockThreshold,
                           TotalPhysicalSold, TotalEbooksSold, TotalEbooksRented, LastRestockDate)
    SELECT i.BookID, 0, 5, 0, 0, 0, SYSUTCDATETIME()
    FROM inserted i
    WHERE NOT EXISTS (SELECT 1 FROM Inventory inv WHERE inv.BookID = i.BookID);
END;
GO

-- ────────────────────────────────────────────────────────────
-- Trigger 2: trg_AfterInsertOrderItem
-- When an OrderItem is inserted:
--   Physical (FormatID=1) : decrement StockLevel, increment TotalPhysicalSold
--   Ebook Buy (FormatID=2): increment TotalEbooksSold
-- Raises error 50010 if physical stock is insufficient.
-- (Admin: Inventory Management | User: Buy Books)
-- NOTE: sp_BuyBook manual inventory UPDATE is removed; this
--       trigger handles inventory automatically.
-- ────────────────────────────────────────────────────────────
IF OBJECT_ID('trg_AfterInsertOrderItem', 'TR') IS NOT NULL DROP TRIGGER trg_AfterInsertOrderItem;
GO
CREATE TRIGGER trg_AfterInsertOrderItem
ON OrderItems
AFTER INSERT
AS
BEGIN
    SET NOCOUNT ON;

    -- Guard: abort if any physical item would cause negative stock
    IF EXISTS (
        SELECT 1
        FROM inserted i
        INNER JOIN Inventory inv ON inv.BookID = i.BookID
        WHERE i.FormatID = 1
          AND inv.StockLevel - i.Quantity < 0
    )
    BEGIN
        THROW 50010, 'Insufficient physical stock for one or more items.', 1;
    END

    -- Physical purchases: decrement stock and increment TotalPhysicalSold
    UPDATE inv
    SET inv.StockLevel        = inv.StockLevel - i.Quantity,
        inv.TotalPhysicalSold = inv.TotalPhysicalSold + i.Quantity,
        inv.UpdatedAt         = SYSUTCDATETIME()
    FROM Inventory inv
    INNER JOIN inserted i ON inv.BookID = i.BookID
    WHERE i.FormatID = 1;

    -- Ebook purchases: only increment TotalEbooksSold
    UPDATE inv
    SET inv.TotalEbooksSold = inv.TotalEbooksSold + i.Quantity,
        inv.UpdatedAt       = SYSUTCDATETIME()
    FROM Inventory inv
    INNER JOIN inserted i ON inv.BookID = i.BookID
    WHERE i.FormatID = 2;
END;
GO

-- ────────────────────────────────────────────────────────────
-- Trigger 3: trg_AfterUpdateOrderStatus_Cancelled
-- When an Order's StatusID changes TO Cancelled, restore
-- the physical stock consumed by that order's physical items.
-- (Admin: Inventory Management | Order cancellation flow)
-- ────────────────────────────────────────────────────────────
IF OBJECT_ID('trg_AfterUpdateOrderStatus_Cancelled', 'TR') IS NOT NULL DROP TRIGGER trg_AfterUpdateOrderStatus_Cancelled;
GO
CREATE TRIGGER trg_AfterUpdateOrderStatus_Cancelled
ON Orders
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    IF UPDATE(StatusID)
    BEGIN
        DECLARE @CancelledStatusID INT = (SELECT StatusID FROM OrderStatus WHERE StatusName = 'Cancelled');

        -- Restore stock only for orders that JUST became Cancelled
        UPDATE inv
        SET inv.StockLevel        = inv.StockLevel + oi.Quantity,
            inv.TotalPhysicalSold = inv.TotalPhysicalSold - oi.Quantity,
            inv.UpdatedAt         = SYSUTCDATETIME()
        FROM Inventory inv
        INNER JOIN OrderItems oi ON oi.BookID = inv.BookID
        INNER JOIN inserted ins  ON ins.OrderID = oi.OrderID
        INNER JOIN deleted del   ON del.OrderID = ins.OrderID
        WHERE oi.FormatID = 1
          AND ins.StatusID = @CancelledStatusID
          AND del.StatusID <> @CancelledStatusID;
    END
END;
GO

-- ────────────────────────────────────────────────────────────
-- Trigger 4: trg_AfterInsertBookRating
-- Recalculate Books.AverageRating after a new rating is added.
-- (User: Rate Books)
-- ────────────────────────────────────────────────────────────
IF OBJECT_ID('trg_AfterInsertBookRating', 'TR') IS NOT NULL DROP TRIGGER trg_AfterInsertBookRating;
GO
CREATE TRIGGER trg_AfterInsertBookRating
ON BookRating
AFTER INSERT
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE b
    SET b.AverageRating = (
        SELECT ISNULL(AVG(CAST(br.Rating AS DECIMAL(3,2))), 0.00)
        FROM BookRating br
        WHERE br.BookID = i.BookID
    )
    FROM Books b
    INNER JOIN inserted i ON b.BookID = i.BookID;
END;
GO

-- ────────────────────────────────────────────────────────────
-- Trigger 5: trg_AfterUpdateBookRating
-- Recalculate Books.AverageRating after an existing rating
-- is changed by the user.
-- (User: Rate Books - update existing rating)
-- ────────────────────────────────────────────────────────────
IF OBJECT_ID('trg_AfterUpdateBookRating', 'TR') IS NOT NULL DROP TRIGGER trg_AfterUpdateBookRating;
GO
CREATE TRIGGER trg_AfterUpdateBookRating
ON BookRating
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE b
    SET b.AverageRating = (
        SELECT ISNULL(AVG(CAST(br.Rating AS DECIMAL(3,2))), 0.00)
        FROM BookRating br
        WHERE br.BookID = i.BookID
    )
    FROM Books b
    INNER JOIN inserted i ON b.BookID = i.BookID;
END;
GO

-- ────────────────────────────────────────────────────────────
-- Trigger 6: trg_AfterDeleteBookRating
-- Recalculate Books.AverageRating when a rating is deleted.
-- ────────────────────────────────────────────────────────────
IF OBJECT_ID('trg_AfterDeleteBookRating', 'TR') IS NOT NULL DROP TRIGGER trg_AfterDeleteBookRating;
GO
CREATE TRIGGER trg_AfterDeleteBookRating
ON BookRating
AFTER DELETE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE b
    SET b.AverageRating = (
        SELECT ISNULL(AVG(CAST(br.Rating AS DECIMAL(3,2))), 0.00)
        FROM BookRating br
        WHERE br.BookID = d.BookID
    )
    FROM Books b
    INNER JOIN deleted d ON b.BookID = d.BookID;
END;
GO

-- ────────────────────────────────────────────────────────────
-- Trigger 7: trg_AfterInsertEbookRental
-- Increment Inventory.TotalEbooksRented when a new rental is
-- created in EbookRentals.
-- (User: Rent Ebook)
-- NOTE: sp_RentEbook currently also updates TotalEbooksRented
--       manually. Remove that UPDATE from sp_RentEbook to avoid
--       double-counting, OR keep this trigger as the authoritative
--       source and remove the manual update from the SP.
-- ────────────────────────────────────────────────────────────
IF OBJECT_ID('trg_AfterInsertEbookRental', 'TR') IS NOT NULL DROP TRIGGER trg_AfterInsertEbookRental;
GO
CREATE TRIGGER trg_AfterInsertEbookRental
ON EbookRentals
AFTER INSERT
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE inv
    SET inv.TotalEbooksRented = inv.TotalEbooksRented + 1,
        inv.UpdatedAt         = SYSUTCDATETIME()
    FROM Inventory inv
    INNER JOIN inserted i ON inv.BookID = i.BookID;
END;
GO

-- ────────────────────────────────────────────────────────────
-- Trigger 8: trg_AfterUpdateInventory_LowStock
-- Raise a non-terminating informational warning (severity 10)
-- when StockLevel drops to or below LowStockThreshold after
-- an inventory update.
-- (Admin: Inventory Management - low stock awareness)
-- ────────────────────────────────────────────────────────────
IF OBJECT_ID('trg_AfterUpdateInventory_LowStock', 'TR') IS NOT NULL DROP TRIGGER trg_AfterUpdateInventory_LowStock;
GO
CREATE TRIGGER trg_AfterUpdateInventory_LowStock
ON Inventory
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    IF UPDATE(StockLevel)
    BEGIN
        DECLARE @BookTitle  NVARCHAR(300);
        DECLARE @StockLevel INT;
        DECLARE @Threshold  INT;

        DECLARE low_stock_cursor CURSOR FOR
            SELECT b.Title, i.StockLevel, i.LowStockThreshold
            FROM inserted i
            INNER JOIN Books b ON b.BookID = i.BookID
            WHERE i.StockLevel <= i.LowStockThreshold;

        OPEN low_stock_cursor;
        FETCH NEXT FROM low_stock_cursor INTO @BookTitle, @StockLevel, @Threshold;

        WHILE @@FETCH_STATUS = 0
        BEGIN
            RAISERROR(
                'LOW STOCK ALERT: "%s" has only %d unit(s) remaining (threshold: %d).',
                10, 1, @BookTitle, @StockLevel, @Threshold
            ) WITH NOWAIT;
            FETCH NEXT FROM low_stock_cursor INTO @BookTitle, @StockLevel, @Threshold;
        END

        CLOSE low_stock_cursor;
        DEALLOCATE low_stock_cursor;
    END
END;
GO

-- Patch: Remove manual inventory updates from sp_BuyBook and sp_RentEbook
-- since trg_AfterInsertOrderItem and trg_AfterInsertEbookRental now handle this.

USE Read_Hub;
GO

-- ────────────────────────────────────────────────────────────
-- sp_BuyBook (patched): removes manual Inventory UPDATE.
-- The trigger trg_AfterInsertOrderItem fires after OrderItems
-- INSERT and handles stock decrement / sold count updates.
-- ────────────────────────────────────────────────────────────
IF OBJECT_ID('sp_BuyBook', 'P') IS NOT NULL DROP PROCEDURE sp_BuyBook;
GO
CREATE PROCEDURE sp_BuyBook
    @UserID INT,
    @BookID INT,
    @IsPhysical BIT,
    @Quantity INT,
    @PaymentMethodID INT,
    @ShippingAddress NVARCHAR(MAX)
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRANSACTION;
    BEGIN TRY
        DECLARE @FormatID INT = CASE WHEN @IsPhysical = 1 THEN 1 ELSE 2 END;
        DECLARE @UnitPrice DECIMAL(10,2) =
            (SELECT CASE WHEN @IsPhysical = 1 THEN PhysicalPrice ELSE EbookPrice END
             FROM Books WHERE BookID = @BookID);
        DECLARE @TotalAmount DECIMAL(10,2) = @UnitPrice * @Quantity;
        DECLARE @OrderNumber NVARCHAR(50) = 'ORD-' + CAST(NEWID() AS NVARCHAR(50));

        INSERT INTO Orders (OrderNumber, UserID, TotalAmount, StatusID, PaymentMethodID, PaymentStatusID, ShippingAddress)
        VALUES (
            @OrderNumber, @UserID, @TotalAmount,
            (SELECT StatusID FROM OrderStatus WHERE StatusName = 'Pending'),
            @PaymentMethodID,
            (SELECT StatusID FROM PaymentStatus WHERE StatusName = 'Pending'),
            @ShippingAddress
        );

        DECLARE @NewOrderID INT = SCOPE_IDENTITY();

        -- Inserting into OrderItems fires trg_AfterInsertOrderItem,
        -- which handles stock decrement and sold-count updates automatically.
        INSERT INTO OrderItems (OrderID, BookID, FormatID, Quantity, UnitPrice)
        VALUES (@NewOrderID, @BookID, @FormatID, @Quantity, @UnitPrice);

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        ROLLBACK TRANSACTION;
        THROW;
    END CATCH
END;
GO

-- ────────────────────────────────────────────────────────────
-- sp_RentEbook (patched): removes manual TotalEbooksRented UPDATE.
-- The trigger trg_AfterInsertEbookRental fires after EbookRentals
-- INSERT and increments TotalEbooksRented automatically.
-- ────────────────────────────────────────────────────────────
IF OBJECT_ID('sp_RentEbook', 'P') IS NOT NULL DROP PROCEDURE sp_RentEbook;
GO
CREATE PROCEDURE sp_RentEbook
    @UserID INT,
    @BookID INT,
    @RentalDays INT,
    @PaymentMethodID INT
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRANSACTION;
    BEGIN TRY
        DECLARE @UnitPrice DECIMAL(10,2) = (SELECT RentalPricePerDay FROM Books WHERE BookID = @BookID);
        DECLARE @TotalAmount DECIMAL(10,2) = @UnitPrice * @RentalDays;
        DECLARE @OrderNumber NVARCHAR(50) = 'RNT-' + CAST(NEWID() AS NVARCHAR(50));

        INSERT INTO Orders (OrderNumber, UserID, TotalAmount, StatusID, PaymentMethodID, PaymentStatusID, ShippingAddress)
        VALUES (
            @OrderNumber, @UserID, @TotalAmount,
            (SELECT StatusID FROM OrderStatus WHERE StatusName = 'Completed'),
            @PaymentMethodID,
            (SELECT StatusID FROM PaymentStatus WHERE StatusName = 'Completed'),
            'N/A (Digital)'
        );

        DECLARE @NewOrderID INT = SCOPE_IDENTITY();

        INSERT INTO OrderItems (OrderID, BookID, FormatID, Quantity, UnitPrice, RentalDays)
        VALUES (@NewOrderID, @BookID, 3, 1, @TotalAmount, @RentalDays);

        -- Inserting into EbookRentals fires trg_AfterInsertEbookRental,
        -- which increments TotalEbooksRented in Inventory automatically.
        INSERT INTO EbookRentals (OrderID, UserID, BookID, DueDate)
        VALUES (@NewOrderID, @UserID, @BookID, DATEADD(DAY, @RentalDays, SYSUTCDATETIME()));

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        ROLLBACK TRANSACTION;
        THROW;
    END CATCH
END;
GO
