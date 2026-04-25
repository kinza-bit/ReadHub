const { sql, poolPromise } = require('./backend/db');

async function fixSP() {
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
  `);

  console.log('SP updated.');
  process.exit(0);
}
fixSP();
