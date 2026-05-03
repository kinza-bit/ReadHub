USE Read_Hub;
GO

-- 1. Add Review column to BookRating if it doesn't exist
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('BookRating') AND name = 'Review')
BEGIN
    ALTER TABLE BookRating ADD Review NVARCHAR(MAX) NULL;
END
GO

-- 2. Update sp_RateBook to accept @Review
IF OBJECT_ID('sp_RateBook', 'P') IS NOT NULL DROP PROCEDURE sp_RateBook;
GO
CREATE PROCEDURE sp_RateBook
    @UserID INT,
    @BookID INT,
    @Rating INT,
    @Review NVARCHAR(MAX) = NULL
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
        SET Rating = @Rating, Review = @Review, CreatedAt = SYSUTCDATETIME()
        WHERE UserID = @UserID AND BookID = @BookID;
    END
    ELSE
    BEGIN
        INSERT INTO BookRating (BookID, UserID, Rating, Review)
        VALUES (@BookID, @UserID, @Rating, @Review);
    END

    -- Update AverageRating in Books table
    UPDATE Books
    SET AverageRating = (
        SELECT ISNULL(AVG(CAST(Rating AS DECIMAL(3,2))), 0.00)
        FROM BookRating
        WHERE BookID = @BookID
    )
    WHERE BookID = @BookID;
END;
GO

-- 3. Create sp_GetBookReviews
IF OBJECT_ID('sp_GetBookReviews', 'P') IS NOT NULL DROP PROCEDURE sp_GetBookReviews;
GO
CREATE PROCEDURE sp_GetBookReviews
    @BookID INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT br.RatingID, br.Rating, br.Review, br.CreatedAt, u.FullName as UserFullName
    FROM BookRating br
    JOIN Users u ON br.UserID = u.UserID
    WHERE br.BookID = @BookID
    ORDER BY br.CreatedAt DESC;
END;
GO
