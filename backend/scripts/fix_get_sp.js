const { sql, poolPromise } = require('../db');

async function fix() {
  const pool = await poolPromise;
  await pool.request().query(`
    ALTER PROCEDURE sp_GetEbookAccess
        @UserID INT,
        @OrderID INT,
        @BookID INT,
        @FormatID INT = NULL
    AS
    BEGIN
        SET NOCOUNT ON;
        
        DECLARE @PaymentStatusID INT;
        DECLARE @ActualFormatID INT;
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

        -- Get item info (Use FormatID if provided, otherwise fallback to finding the first match for backward compatibility)
        IF @FormatID IS NOT NULL
        BEGIN
            SELECT @ActualFormatID = FormatID, @DownloadCount = DownloadCount, @MaxDownloads = MaxDownloads
            FROM OrderItems WHERE OrderID = @OrderID AND BookID = @BookID AND FormatID = @FormatID;
        END
        ELSE
        BEGIN
            SELECT TOP 1 @ActualFormatID = FormatID, @DownloadCount = DownloadCount, @MaxDownloads = MaxDownloads
            FROM OrderItems WHERE OrderID = @OrderID AND BookID = @BookID;
        END

        IF @ActualFormatID IS NULL
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
        IF @ActualFormatID = 2 -- Permanent Download
        BEGIN
            IF @DownloadCount >= @MaxDownloads
            BEGIN
                THROW 50033, 'Maximum download limit reached for this ebook.', 1;
            END
            
            -- Increment count
            UPDATE OrderItems 
            SET DownloadCount = DownloadCount + 1 
            WHERE OrderID = @OrderID AND BookID = @BookID AND FormatID = 2;
            
            SELECT @SupabasePath AS SupabasePath, 'Download' AS AccessType, @DownloadCount + 1 AS DownloadCount;
        END
        ELSE IF @ActualFormatID = 3 -- Rental
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
  `);

  console.log('SP updated to handle FormatID.');
  process.exit(0);
}
fix();
