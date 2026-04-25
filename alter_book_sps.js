const { sql, poolPromise } = require('./backend/db');

async function updateBookSPs() {
  const pool = await poolPromise;
  await pool.request().query(`
    ALTER PROCEDURE sp_AddNewBook
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
            
            INSERT INTO Inventory (BookID, StockLevel, LowStockThreshold, LastRestockDate)
            VALUES (@NewBookID, @StockLevel, @LowStockThreshold, GETDATE());
            
            COMMIT TRANSACTION;
            SELECT @NewBookID AS BookID;
        END TRY
        BEGIN CATCH
            IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
            THROW;
        END CATCH
    END;
  `);

  await pool.request().query(`
    ALTER PROCEDURE sp_UpdateBook
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
  `);

  console.log('Stored procedures updated with SupabasePath.');
  process.exit(0);
}
updateBookSPs().catch(console.error);
