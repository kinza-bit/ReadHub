-- ============================================================
-- ReadHub 
-- ============================================================

CREATE DATABASE Read_Hub;
GO
USE Read_Hub;
GO

-- ────────────────────────────────────────────────────────────
-- 1. LOOKUP TABLES (Setup First)
-- ────────────────────────────────────────────────────────────

-- Roles
CREATE TABLE Roles (
    RoleID INT IDENTITY(1,1) PRIMARY KEY,
    RoleName NVARCHAR(50) NOT NULL UNIQUE
);

INSERT INTO Roles (RoleName) VALUES ('Admin'), ('Customer');

-- Payment Methods
CREATE TABLE PaymentMethods (
    PaymentMethodID INT IDENTITY(1,1) PRIMARY KEY,
    MethodName NVARCHAR(50) NOT NULL UNIQUE,
    Description NVARCHAR(200) NULL,
    IsActive BIT DEFAULT 1
);

INSERT INTO PaymentMethods (MethodName, Description, IsActive) VALUES
('Cash on Delivery', 'Pay with cash upon receiving the physical book', 1),
('Card', 'Pay using credit/debit card online', 1);

-- Payment Status
CREATE TABLE PaymentStatus (
    StatusID INT IDENTITY(1,1) PRIMARY KEY,
    StatusName NVARCHAR(50) NOT NULL UNIQUE,
    Description NVARCHAR(200) NULL
);

INSERT INTO PaymentStatus (StatusName, Description) VALUES
('Pending', 'Payment not yet completed'),
('Completed', 'Payment successfully done'),
('Failed', 'Payment failed');

-- Order Status
CREATE TABLE OrderStatus (
    StatusID INT IDENTITY(1,1) PRIMARY KEY,
    StatusName NVARCHAR(50) NOT NULL UNIQUE,
    Description NVARCHAR(200) NULL,
    DisplayOrder INT DEFAULT 0,
    IsActive BIT DEFAULT 1,
    CONSTRAINT CHK_OrderStatus_Name CHECK (StatusName IN ('Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Refunded'))
);

INSERT INTO OrderStatus (StatusName, Description, DisplayOrder, IsActive) VALUES
('Pending', 'Order placed but not yet processed', 1, 1),
('Processing', 'Order is being processed', 2, 1),
('Shipped', 'Order has been shipped', 3, 1),
('Delivered', 'Order has been delivered to customer', 4, 1),
('Cancelled', 'Order has been cancelled', 5, 1),
('Refunded', 'Order amount refunded to customer', 6, 1);

-- Purchase Formats
CREATE TABLE PurchaseFormat (
    FormatID INT PRIMARY KEY,
    FormatName NVARCHAR(50) NOT NULL 
);

INSERT INTO PurchaseFormat (FormatID, FormatName) VALUES 
(1, 'Physical'), 
(2, 'Ebook Buy'), 
(3, 'Ebook Rent');

-- Categories
CREATE TABLE Categories (
    CategoryID INT IDENTITY(1,1) PRIMARY KEY,
    Name NVARCHAR(150) NOT NULL UNIQUE,
    Description NVARCHAR(500) NULL
);

-- ────────────────────────────────────────────────────────────
-- 2. CORE ENTITY TABLES
-- ────────────────────────────────────────────────────────────

-- Users
CREATE TABLE Users (
    UserID INT IDENTITY(1,1) PRIMARY KEY,
    Username NVARCHAR(100) NOT NULL UNIQUE,
    PasswordHash NVARCHAR(256) NOT NULL,
    Email NVARCHAR(200) NOT NULL UNIQUE,
    FullName NVARCHAR(200) NOT NULL,
    PhoneNumber NVARCHAR(20) NULL,
    AddressLine1 NVARCHAR(200) NULL,
    City NVARCHAR(100) NULL,
    Country NVARCHAR(100) NULL,
    ProfileImageURL NVARCHAR(500) NULL, 
    IsActive BIT DEFAULT 1,
    RoleID INT NOT NULL,
    CreatedAt DATETIME2 DEFAULT SYSUTCDATETIME(),
    ResetToken NVARCHAR(64) NULL,
    TokenExpiry DATETIME2 NULL,
    CONSTRAINT FK_Users_Role FOREIGN KEY (RoleID) REFERENCES Roles(RoleID)
);

-- Books
CREATE TABLE Books (
    BookID INT IDENTITY(1,1) PRIMARY KEY,
    ISBN NVARCHAR(20) NULL,
    Title NVARCHAR(300) NOT NULL,
    Author NVARCHAR(300) NOT NULL,
    CategoryID INT NOT NULL,
    Description NVARCHAR(MAX) NULL,
    PhysicalPrice DECIMAL(10,2) NULL, 
    EbookPrice DECIMAL(10,2) NULL,    
    RentalPricePerDay DECIMAL(10,2) NULL, 
    LateFeePerDay DECIMAL(10,2) DEFAULT 1.00, 
    AverageRating DECIMAL(3,2) DEFAULT 0.00,
    ImageURL NVARCHAR(500) NULL,
    PdfURL NVARCHAR(500) NULL, 
    SupabasePath NVARCHAR(255) NULL, 
    CONSTRAINT FK_Books_Category FOREIGN KEY (CategoryID) REFERENCES Categories(CategoryID)
);

-- Inventory
CREATE TABLE Inventory (
    InventoryID INT IDENTITY(1,1) PRIMARY KEY,
    BookID INT NOT NULL UNIQUE,
    StockLevel INT NOT NULL DEFAULT 0,       
    LowStockThreshold INT DEFAULT 5,         
    TotalPhysicalSold INT DEFAULT 0,         
    TotalEbooksSold INT DEFAULT 0,           
    TotalEbooksRented INT DEFAULT 0,         
    LastRestockDate DATETIME2 NULL,
    UpdatedAt DATETIME2 DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_Inventory_Books FOREIGN KEY (BookID) REFERENCES Books(BookID) ON DELETE CASCADE,
    CONSTRAINT CHK_Stock_NonNegative CHECK (StockLevel >= 0)
);

-- Book Ratings & Reviews
CREATE TABLE BookRating (
    RatingID INT IDENTITY(1,1) PRIMARY KEY,
    BookID INT NOT NULL,
    UserID INT NOT NULL,
    Rating INT NOT NULL CHECK (Rating >= 1 AND Rating <= 5),
    Review NVARCHAR(MAX) NULL, 
    CreatedAt DATETIME2 DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_Rating_Book FOREIGN KEY (BookID) REFERENCES Books(BookID) ON DELETE CASCADE,
    CONSTRAINT FK_Rating_User FOREIGN KEY (UserID) REFERENCES Users(UserID) ON DELETE CASCADE,
    CONSTRAINT UQ_User_Book_Rating UNIQUE (BookID, UserID)
);

-- User Wishlist
CREATE TABLE UserWishlist (
    WishlistID INT IDENTITY(1,1) PRIMARY KEY,
    UserID INT NOT NULL,
    BookID INT NOT NULL,
    CreatedAt DATETIME2 DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_Wishlist_User FOREIGN KEY (UserID) REFERENCES Users(UserID) ON DELETE CASCADE,
    CONSTRAINT FK_Wishlist_Book FOREIGN KEY (BookID) REFERENCES Books(BookID) ON DELETE CASCADE,
    CONSTRAINT UQ_User_Wishlist UNIQUE (UserID, BookID)
);

-- User Requests (For books not in catalog)
CREATE TABLE Requests (
    RequestID INT IDENTITY(1,1) PRIMARY KEY,
    UserID INT NOT NULL,
    Title NVARCHAR(300) NOT NULL,
    Author NVARCHAR(300) NULL,
    Status NVARCHAR(50) DEFAULT 'New',
    CreatedAt DATETIME2 DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_Requests_User FOREIGN KEY (UserID) REFERENCES Users(UserID) ON DELETE CASCADE
);

-- ────────────────────────────────────────────────────────────
-- 3. CART & ORDERING TABLES
-- ────────────────────────────────────────────────────────────

-- Shopping Cart
CREATE TABLE Cart (
    CartID INT IDENTITY(1,1) PRIMARY KEY,
    UserID INT NOT NULL UNIQUE,
    CreatedAt DATETIME2 DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_Cart_User FOREIGN KEY (UserID) REFERENCES Users(UserID) ON DELETE CASCADE
);

-- Cart Items
CREATE TABLE CartItems (
    CartItemID INT IDENTITY(1,1) PRIMARY KEY,
    CartID INT NOT NULL,
    BookID INT NOT NULL,
    FormatID INT NOT NULL, 
    Quantity INT NOT NULL DEFAULT 1,
    RentalDays INT NULL, 
    CONSTRAINT FK_CartItems_Cart FOREIGN KEY (CartID) REFERENCES Cart(CartID) ON DELETE CASCADE,
    CONSTRAINT FK_CartItems_Book FOREIGN KEY (BookID) REFERENCES Books(BookID),
    CONSTRAINT FK_CartItems_Format FOREIGN KEY (FormatID) REFERENCES PurchaseFormat(FormatID)
);

-- Orders
CREATE TABLE Orders (
    OrderID INT IDENTITY(1,1) PRIMARY KEY,
    OrderNumber NVARCHAR(50) NOT NULL UNIQUE,
    UserID INT NOT NULL,
    OrderDate DATETIME2 DEFAULT SYSUTCDATETIME(),
    TotalAmount DECIMAL(12,2) NOT NULL,
    StatusID INT NOT NULL,
    PaymentMethodID INT NOT NULL,
    PaymentStatusID INT NOT NULL,
    ShippingAddress NVARCHAR(500) NULL,
    CONSTRAINT FK_Orders_User FOREIGN KEY (UserID) REFERENCES Users(UserID),
    CONSTRAINT FK_Orders_Status FOREIGN KEY (StatusID) REFERENCES OrderStatus(StatusID),
    CONSTRAINT FK_Orders_PaymentMethod FOREIGN KEY (PaymentMethodID) REFERENCES PaymentMethods(PaymentMethodID),
    CONSTRAINT FK_Orders_PaymentStatus FOREIGN KEY (PaymentStatusID) REFERENCES PaymentStatus(StatusID)
);

-- Order Items
CREATE TABLE OrderItems (
    OrderItemID INT IDENTITY(1,1) PRIMARY KEY,
    OrderID INT NOT NULL,
    BookID INT NOT NULL,
    FormatID INT NOT NULL,
    Quantity INT NOT NULL,
    UnitPrice DECIMAL(10,2) NOT NULL, 
    RentalDays INT NULL, 
    DownloadCount INT NOT NULL DEFAULT 0,
    MaxDownloads INT NOT NULL DEFAULT 3,   
    CONSTRAINT FK_OrderItems_Order FOREIGN KEY (OrderID) REFERENCES Orders(OrderID) ON DELETE CASCADE,
    CONSTRAINT FK_OrderItems_Book FOREIGN KEY (BookID) REFERENCES Books(BookID),
    CONSTRAINT FK_OrderItems_Format FOREIGN KEY (FormatID) REFERENCES PurchaseFormat(FormatID)
);

-- Ebook Rentals Tracking
CREATE TABLE EbookRentals (
    RentalID INT IDENTITY(1,1) PRIMARY KEY,
    OrderID INT NOT NULL,
    UserID INT NOT NULL,
    BookID INT NOT NULL,
    StartDate DATETIME2 DEFAULT SYSUTCDATETIME(),
    DueDate DATETIME2 NOT NULL,
    ActualReturnDate DATETIME2 NULL, 
    CurrentFine DECIMAL(10,2) DEFAULT 0.00,
    IsNotified BIT NOT NULL DEFAULT 0, 
    CONSTRAINT FK_Rentals_Order FOREIGN KEY (OrderID) REFERENCES Orders(OrderID) ON DELETE CASCADE,
    CONSTRAINT FK_Rentals_User FOREIGN KEY (UserID) REFERENCES Users(UserID),
    CONSTRAINT FK_Rentals_Book FOREIGN KEY (BookID) REFERENCES Books(BookID)
);

GO

