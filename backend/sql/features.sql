-- ============================================================
-- Read_Hub Bookstore – Feature Queries (Views & Stored Procedures)
-- Database : Read_Hub (SQL Server)
-- ============================================================
USE Read_Hub;
GO

-- ████████████████████████████████████████████████████████████
--  SECTION 0 :  VIEWS
-- ████████████████████████████████████████████████████████████

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

-- ████████████████████████████████████████████████████████████
--  SECTION 1 :  ADMIN FEATURES
-- ████████████████████████████████████████████████████████████

-- ────────────────────────────────────────────────────────────
-- 1.1  Admin Login
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
-- 1.2  Manage User Accounts
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
-- 1.3  Organize Books by Categories
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
-- 1.4  Add New Books
-- ────────────────────────────────────────────────────────────
IF OBJECT_ID('sp_AddNewBook', 'P') IS NOT NULL DROP PROCEDURE sp_AddNewBook;
GO
CREATE PROCEDURE sp_AddNewBook
    @ISBN NVARCHAR(20),
    @Title NVARCHAR(200),
    @Author NVARCHAR(100),
    @CategoryID INT,
    @Description NVARCHAR(MAX),
    @PhysicalPrice DECIMAL(10,2),
    @EbookPrice DECIMAL(10,2),
    @RentalPricePerDay DECIMAL(10,2),
    @LateFeePerDay DECIMAL(10,2),
    @ImageURL NVARCHAR(500),
    @PdfURL NVARCHAR(500),
    @StockLevel INT,
    @LowStockThreshold INT
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRANSACTION;
    BEGIN TRY
        INSERT INTO Books (ISBN, Title, Author, CategoryID, Description, PhysicalPrice, EbookPrice, RentalPricePerDay, LateFeePerDay, ImageURL, PdfURL)
        VALUES (@ISBN, @Title, @Author, @CategoryID, @Description, @PhysicalPrice, @EbookPrice, @RentalPricePerDay, @LateFeePerDay, @ImageURL, @PdfURL);

        DECLARE @NewBookID INT = SCOPE_IDENTITY();

        INSERT INTO Inventory (BookID, StockLevel, LowStockThreshold, LastRestockDate)
        VALUES (@NewBookID, @StockLevel, @LowStockThreshold, SYSUTCDATETIME());

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        ROLLBACK TRANSACTION;
        THROW;
    END CATCH
END;
GO

-- ────────────────────────────────────────────────────────────
-- 1.5  Edit / Update Book Information
-- ────────────────────────────────────────────────────────────
IF OBJECT_ID('sp_UpdateBook', 'P') IS NOT NULL DROP PROCEDURE sp_UpdateBook;
GO
CREATE PROCEDURE sp_UpdateBook
    @BookID INT,
    @Title NVARCHAR(200) = NULL,
    @Author NVARCHAR(100) = NULL,
    @ISBN NVARCHAR(20) = NULL,
    @CategoryID INT = NULL,
    @Description NVARCHAR(MAX) = NULL,
    @PhysicalPrice DECIMAL(10,2) = NULL,
    @EbookPrice DECIMAL(10,2) = NULL,
    @RentalPricePerDay DECIMAL(10,2) = NULL,
    @LateFeePerDay DECIMAL(10,2) = NULL,
    @ImageURL NVARCHAR(500) = NULL,
    @PdfURL NVARCHAR(500) = NULL
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
        PdfURL = ISNULL(@PdfURL, PdfURL)
    WHERE BookID = @BookID;
END;
GO

-- ────────────────────────────────────────────────────────────
-- 1.6  Delete Books
-- ────────────────────────────────────────────────────────────
IF OBJECT_ID('sp_DeleteBook', 'P') IS NOT NULL DROP PROCEDURE sp_DeleteBook;
GO
CREATE PROCEDURE sp_DeleteBook
    @BookID INT
AS
BEGIN
    SET NOCOUNT ON;
    DELETE FROM Books WHERE BookID = @BookID;
END;
GO

-- ────────────────────────────────────────────────────────────
-- 1.7  Inventory Management
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

-- ████████████████████████████████████████████████████████████
--  SECTION 2 :  USER FEATURES
-- ████████████████████████████████████████████████████████████

-- ────────────────────────────────────────────────────────────
-- 2.1  User Login
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
-- 2.2  View Available Books
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
-- 2.3  Search for Books
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
-- 2.4  Buy Books (Physical or Ebook)
-- ────────────────────────────────────────────────────────────
IF OBJECT_ID('sp_BuyBook', 'P') IS NOT NULL DROP PROCEDURE sp_BuyBook;
GO
CREATE PROCEDURE sp_BuyBook
    @UserID INT,
    @BookID INT,
    @IsPhysical BIT, -- 1 for Physical, 0 for Ebook
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
            (SELECT CASE WHEN @IsPhysical = 1 THEN PhysicalPrice ELSE EbookPrice END FROM Books WHERE BookID = @BookID);
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

        INSERT INTO OrderItems (OrderID, BookID, FormatID, Quantity, UnitPrice)
        VALUES (@NewOrderID, @BookID, @FormatID, @Quantity, @UnitPrice);

        IF @IsPhysical = 1
        BEGIN
            IF (SELECT StockLevel FROM Inventory WHERE BookID = @BookID) >= @Quantity
            BEGIN
                UPDATE Inventory
                SET StockLevel = StockLevel - @Quantity,
                    TotalPhysicalSold = TotalPhysicalSold + @Quantity,
                    UpdatedAt = SYSUTCDATETIME()
                WHERE BookID = @BookID;
            END
            ELSE
            BEGIN
                THROW 50002, 'Insufficient physical stock.', 1;
            END
        END
        ELSE
        BEGIN
            UPDATE Inventory
            SET TotalEbooksSold = TotalEbooksSold + @Quantity,
                UpdatedAt = SYSUTCDATETIME()
            WHERE BookID = @BookID;
        END

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        ROLLBACK TRANSACTION;
        THROW;
    END CATCH
END;
GO

-- ────────────────────────────────────────────────────────────
-- 2.5  Rent Ebook
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

        INSERT INTO EbookRentals (OrderID, UserID, BookID, DueDate)
        VALUES (@NewOrderID, @UserID, @BookID, DATEADD(DAY, @RentalDays, SYSUTCDATETIME()));

        UPDATE Inventory SET TotalEbooksRented = TotalEbooksRented + 1 WHERE BookID = @BookID;

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        ROLLBACK TRANSACTION;
        THROW;
    END CATCH
END;
GO

-- ────────────────────────────────────────────────────────────
-- 2.6  Download Ebook
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
-- 2.7  Request Books
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
-- 2.8  Rate Books (Star Rating Only)
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
-- 2.9  Register New User
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
-- 2.10 Get User By Email (for Login/Auth)
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
-- 2.11 Get Detailed User Info (Admin)
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
-- 2.12 Update User Details (Admin)
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
-- 2.13 Toggle User Status (Admin Soft Delete)
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
-- 2.14 Get Users with Filtering and Sorting (Admin)
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
-- 2.15 Check Email Exists (Forgot Password)
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
-- 2.16 Store Reset Token
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
-- 2.17 Validate Reset Token
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
-- 2.18 Update Password and Clear Token
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
-- END OF FEATURE PROCEDURES & VIEWS
-- ============================================================
