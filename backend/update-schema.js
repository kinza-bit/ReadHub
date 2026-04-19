const { sql, poolPromise } = require('./db');

async function updateSchema() {
    try {
        const pool = await poolPromise;
        if (!pool) {
            console.error('No connection to DB');
            process.exit(1);
        }
        
        console.log('Adding ProfileImageURL to Users...');
        try {
            await pool.request().query(`
                IF COL_LENGTH('Users', 'ProfileImageURL') IS NULL
                BEGIN
                    ALTER TABLE Users ADD ProfileImageURL NVARCHAR(500) NULL;
                END
            `);
            console.log('ProfileImageURL added (or already exists).');
        } catch(e) { console.error('Error adding ProfileImageURL:', e.message); }

        console.log('Creating UserWishlist table...');
        try {
            await pool.request().query(`
                IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='UserWishlist' AND xtype='U')
                BEGIN
                    CREATE TABLE UserWishlist (
                        WishlistID INT IDENTITY(1,1) PRIMARY KEY,
                        UserID INT NOT NULL,
                        BookID INT NOT NULL,
                        CreatedAt DATETIME2 DEFAULT SYSUTCDATETIME(),
                        CONSTRAINT FK_Wishlist_User FOREIGN KEY (UserID) REFERENCES Users(UserID) ON DELETE CASCADE,
                        CONSTRAINT FK_Wishlist_Book FOREIGN KEY (BookID) REFERENCES Books(BookID) ON DELETE CASCADE,
                        CONSTRAINT UQ_User_Wishlist UNIQUE (UserID, BookID)
                    );
                END
            `);
            console.log('UserWishlist created (or already exists).');
        } catch(e) { console.error('Error creating UserWishlist:', e.message); }

        console.log('Done!');
        process.exit(0);
    } catch (err) {
        console.error('Update failed:', err);
        process.exit(1);
    }
}

updateSchema();
