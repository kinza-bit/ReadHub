-- ============================================================
-- ReadHub — Ebook Supabase Storage & Rentals Migration
-- ============================================================

USE Read_Hub;
GO

-- 1. Add SupabasePath to Books table (to store 'ebooks/filename.pdf')
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Books]') AND name = 'SupabasePath')
BEGIN
    ALTER TABLE Books ADD SupabasePath NVARCHAR(255) NULL;
END
GO

-- 2. Add DownloadCount and MaxDownloads to OrderItems
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[OrderItems]') AND name = 'DownloadCount')
BEGIN
    ALTER TABLE OrderItems ADD DownloadCount INT NOT NULL DEFAULT 0;
END
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[OrderItems]') AND name = 'MaxDownloads')
BEGIN
    ALTER TABLE OrderItems ADD MaxDownloads INT NOT NULL DEFAULT 3;
END
GO

-- 3. Add IsNotified to EbookRentals
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[EbookRentals]') AND name = 'IsNotified')
BEGIN
    ALTER TABLE EbookRentals ADD IsNotified BIT NOT NULL DEFAULT 0;
END
GO

-- ────────────────────────────────────────────────────────────
-- SP: Verify Ebook Access (Rent/Download)
-- Returns SupabasePath and limits downloads
-- ────────────────────────────────────────────────────────────
IF OBJECT_ID('sp_GetEbookAccess', 'P') IS NOT NULL DROP PROCEDURE sp_GetEbookAccess;
GO
CREATE PROCEDURE sp_GetEbookAccess
    @UserID INT,
    @OrderID INT,
    @BookID INT
AS
BEGIN
    SET NOCOUNT ON;
    
    DECLARE @PaymentStatusID INT;
    DECLARE @FormatID INT;
    DECLARE @DownloadCount INT;
    DECLARE @MaxDownloads INT;
    DECLARE @DueDate DATETIME2;
    DECLARE @SupabasePath NVARCHAR(255);
    
    -- Check order payment status
    SELECT @PaymentStatusID = PaymentStatusID
    FROM Orders WHERE OrderID = @OrderID AND UserID = @UserID;
    
    IF @PaymentStatusID IS NULL OR @PaymentStatusID <> (SELECT StatusID FROM PaymentStatus WHERE StatusName = 'Completed')
    BEGIN
        THROW 50030, 'Payment not completed for this order.', 1;
    END

    -- Get item info
    SELECT @FormatID = FormatID, @DownloadCount = DownloadCount, @MaxDownloads = MaxDownloads
    FROM OrderItems WHERE OrderID = @OrderID AND BookID = @BookID;

    IF @FormatID IS NULL
    BEGIN
        THROW 50031, 'Book not found in this order.', 1;
    END
    
    -- Get book path
    SELECT @SupabasePath = SupabasePath FROM Books WHERE BookID = @BookID;
    IF @SupabasePath IS NULL
    BEGIN
        THROW 50032, 'Ebook file not available.', 1;
    END

    -- Download Logic
    IF @FormatID = 2 -- Permanent Download
    BEGIN
        IF @DownloadCount >= @MaxDownloads
        BEGIN
            THROW 50033, 'Maximum download limit reached for this ebook.', 1;
        END
        
        -- Increment count
        UPDATE OrderItems 
        SET DownloadCount = DownloadCount + 1 
        WHERE OrderID = @OrderID AND BookID = @BookID;
        
        SELECT @SupabasePath AS SupabasePath, 'Download' AS AccessType, @DownloadCount + 1 AS DownloadCount;
    END
    ELSE IF @FormatID = 3 -- Rental
    BEGIN
        SELECT @DueDate = DueDate FROM EbookRentals WHERE OrderID = @OrderID AND BookID = @BookID AND UserID = @UserID;
        
        IF @DueDate IS NULL OR @DueDate < SYSUTCDATETIME()
        BEGIN
            THROW 50034, 'Rental period has expired.', 1;
        END
        
        SELECT @SupabasePath AS SupabasePath, 'Rent' AS AccessType, @DueDate AS DueDate;
    END
    ELSE
    BEGIN
        THROW 50035, 'This book was not purchased as an ebook.', 1;
    END
END;
GO

-- ────────────────────────────────────────────────────────────
-- SP: Get Rentals expiring in next 48 hours for notification
-- ────────────────────────────────────────────────────────────
IF OBJECT_ID('sp_GetRentalsForNotification', 'P') IS NOT NULL DROP PROCEDURE sp_GetRentalsForNotification;
GO
CREATE PROCEDURE sp_GetRentalsForNotification
AS
BEGIN
    SET NOCOUNT ON;
    
    SELECT er.RentalID, er.UserID, er.BookID, er.DueDate,
           u.Email, u.FullName,
           b.Title
    FROM EbookRentals er
    INNER JOIN Users u ON er.UserID = u.UserID
    INNER JOIN Books b ON er.BookID = b.BookID
    WHERE er.IsNotified = 0
      AND er.DueDate <= DATEADD(HOUR, 48, SYSUTCDATETIME())
      AND er.DueDate > SYSUTCDATETIME(); -- Not already expired
END;
GO

-- ────────────────────────────────────────────────────────────
-- SP: Mark rental as notified
-- ────────────────────────────────────────────────────────────
IF OBJECT_ID('sp_MarkRentalNotified', 'P') IS NOT NULL DROP PROCEDURE sp_MarkRentalNotified;
GO
CREATE PROCEDURE sp_MarkRentalNotified
    @RentalID INT
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE EbookRentals SET IsNotified = 1 WHERE RentalID = @RentalID;
END;
GO

-- ────────────────────────────────────────────────────────────
-- SP: Revoke Expired Rentals (just mark them or cleanup if needed)
-- Access is already denied dynamically via sp_GetEbookAccess, 
-- but this can be used for reporting/cleanup.
-- ────────────────────────────────────────────────────────────
IF OBJECT_ID('sp_RevokeExpiredRentals', 'P') IS NOT NULL DROP PROCEDURE sp_RevokeExpiredRentals;
GO
CREATE PROCEDURE sp_RevokeExpiredRentals
AS
BEGIN
    SET NOCOUNT ON;
    -- Just returning count of expired rentals for admin tracking
    SELECT COUNT(*) AS ExpiredCount 
    FROM EbookRentals 
    WHERE DueDate < SYSUTCDATETIME();
END;
GO

PRINT '✅ Ebook & Supabase migration applied successfully.';
GO
