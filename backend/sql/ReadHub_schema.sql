CREATE DATABASE Read_Hub;
USE Read_Hub;

IF EXISTS (SELECT name FROM sys.databases WHERE name = 'Read_Hub')
    DROP DATABASE Read_Hub;

-- Drop tables 
DROP TABLE IF EXISTS EbookRentals;
DROP TABLE IF EXISTS OrderItems;
DROP TABLE IF EXISTS Orders;
DROP TABLE IF EXISTS CartItems;
DROP TABLE IF EXISTS Cart;
DROP TABLE IF EXISTS BookRating;
DROP TABLE IF EXISTS Inventory;
DROP TABLE IF EXISTS Books;
DROP TABLE IF EXISTS Categories;
DROP TABLE IF EXISTS Users;
DROP TABLE IF EXISTS Roles;
DROP TABLE IF EXISTS PurchaseFormat;
DROP TABLE IF EXISTS OrderStatus;
DROP TABLE IF EXISTS PaymentStatus;
DROP TABLE IF EXISTS PaymentMethods;
DROP TABLE IF EXISTS Requests;

CREATE TABLE PaymentMethods (
    PaymentMethodID INT IDENTITY(1,1) PRIMARY KEY,
    MethodName NVARCHAR(50) NOT NULL UNIQUE,
    Description NVARCHAR(200) NULL,
    IsActive BIT DEFAULT 1
);
INSERT INTO PaymentMethods (MethodName, Description, IsActive)
VALUES
('Cash on Delivery', 'Pay with cash upon receiving the physical book', 1),
('Card', 'Pay using credit/debit card online', 1);


CREATE TABLE PaymentStatus (
    StatusID INT IDENTITY(1,1) PRIMARY KEY,
    StatusName NVARCHAR(50) NOT NULL UNIQUE,
    Description NVARCHAR(200) NULL
);
INSERT INTO PaymentStatus (StatusName, Description)
VALUES
('Pending', 'Payment not yet completed'),
('Completed', 'Payment successfully done'),
('Failed', 'Payment failed');


CREATE TABLE OrderStatus (
    StatusID INT IDENTITY(1,1) PRIMARY KEY,
    StatusName NVARCHAR(50) NOT NULL UNIQUE,
    Description NVARCHAR(200) NULL,
    DisplayOrder INT DEFAULT 0,
    IsActive BIT DEFAULT 1,
    CONSTRAINT CHK_OrderStatus_Name CHECK (StatusName IN ('Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Refunded'))
);
INSERT INTO OrderStatus (StatusName, Description, DisplayOrder, IsActive)
VALUES
('Pending', 'Order placed but not yet processed', 1, 1),
('Processing', 'Order is being processed', 2, 1),
('Shipped', 'Order has been shipped', 3, 1),
('Delivered', 'Order has been delivered to customer', 4, 1),
('Cancelled', 'Order has been cancelled', 5, 1),
('Refunded', 'Order amount refunded to customer', 6, 1);


CREATE TABLE PurchaseFormat (
    FormatID INT PRIMARY KEY,
    FormatName NVARCHAR(50) NOT NULL 
);
INSERT INTO PurchaseFormat (FormatID, FormatName) VALUES (1, 'Physical'), (2, 'Ebook Buy'), (3, 'Ebook Rent');


CREATE TABLE Roles (
    RoleID INT IDENTITY(1,1) PRIMARY KEY,
    RoleName NVARCHAR(50) NOT NULL UNIQUE
);
INSERT INTO Roles (RoleName)
VALUES ('Admin'), ('Customer');

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
    IsActive BIT DEFAULT 1,
    RoleID INT NOT NULL,
    CreatedAt DATETIME2 DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_Users_Role FOREIGN KEY (RoleID) REFERENCES Roles(RoleID)
    
);


CREATE TABLE Categories (
    CategoryID INT IDENTITY(1,1) PRIMARY KEY,
    Name NVARCHAR(150) NOT NULL UNIQUE,
    Description NVARCHAR(500) NULL
);

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
    
    CONSTRAINT FK_Books_Category FOREIGN KEY (CategoryID) REFERENCES Categories(CategoryID)
);

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

CREATE TABLE BookRating (
    RatingID INT IDENTITY(1,1) PRIMARY KEY,
    BookID INT NOT NULL,
    UserID INT NOT NULL,
    Rating INT NOT NULL CHECK (Rating >= 1 AND Rating <= 5),
    CreatedAt DATETIME2 DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_Rating_Book FOREIGN KEY (BookID) REFERENCES Books(BookID) ON DELETE CASCADE,
    CONSTRAINT FK_Rating_User FOREIGN KEY (UserID) REFERENCES Users(UserID)  ON DELETE CASCADE,
    CONSTRAINT UQ_User_Book_Rating UNIQUE (BookID, UserID)
);

CREATE TABLE Cart (
    CartID INT IDENTITY(1,1) PRIMARY KEY,
    UserID INT NOT NULL UNIQUE,
    CreatedAt DATETIME2 DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_Cart_User FOREIGN KEY (UserID) REFERENCES Users(UserID) ON DELETE CASCADE
);

CREATE TABLE CartItems (
    CartItemID INT IDENTITY(1,1) PRIMARY KEY,
    CartID INT NOT NULL,
    BookID INT NOT NULL,
    FormatID INT NOT NULL, 
    Quantity INT NOT NULL DEFAULT 1,
    RentalDays INT NULL, -- Only if FormatID is 3 (Ebook Rent)
    CONSTRAINT FK_CartItems_Cart FOREIGN KEY (CartID) REFERENCES Cart(CartID) ON DELETE CASCADE,
    CONSTRAINT FK_CartItems_Book FOREIGN KEY (BookID) REFERENCES Books(BookID),
    CONSTRAINT FK_CartItems_Format FOREIGN KEY (FormatID) REFERENCES PurchaseFormat(FormatID)
);

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

CREATE TABLE OrderItems (
    OrderItemID INT IDENTITY(1,1) PRIMARY KEY,
    OrderID INT NOT NULL,
    BookID INT NOT NULL,
    FormatID INT NOT NULL,
    Quantity INT NOT NULL,
    UnitPrice DECIMAL(10,2) NOT NULL, -- Price at time of purchase
    RentalDays INT NULL, 
    CONSTRAINT FK_OrderItems_Order FOREIGN KEY (OrderID) REFERENCES Orders(OrderID) ON DELETE CASCADE,
    CONSTRAINT FK_OrderItems_Book FOREIGN KEY (BookID) REFERENCES Books(BookID),
    CONSTRAINT FK_OrderItems_Format FOREIGN KEY (FormatID) REFERENCES PurchaseFormat(FormatID)
);


CREATE TABLE EbookRentals (
    RentalID INT IDENTITY(1,1) PRIMARY KEY,
    OrderID INT NOT NULL,
    UserID INT NOT NULL,
    BookID INT NOT NULL,
    StartDate DATETIME2 DEFAULT SYSUTCDATETIME(),
    DueDate DATETIME2 NOT NULL,
    ActualReturnDate DATETIME2 NULL, 
    CurrentFine DECIMAL(10,2) DEFAULT 0.00,
    CONSTRAINT FK_Rentals_Order FOREIGN KEY (OrderID) REFERENCES Orders(OrderID) ON DELETE CASCADE,
    CONSTRAINT FK_Rentals_User FOREIGN KEY (UserID) REFERENCES Users(UserID),
    CONSTRAINT FK_Rentals_Book FOREIGN KEY (BookID) REFERENCES Books(BookID)
);


CREATE TABLE Requests (
    RequestID INT IDENTITY(1,1) PRIMARY KEY,
    UserID INT NOT NULL,
    Title NVARCHAR(300) NOT NULL,
    Author NVARCHAR(300) NULL,
    Status NVARCHAR(50) DEFAULT 'New',
    CreatedAt DATETIME2 DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_Requests_User FOREIGN KEY (UserID) REFERENCES Users(UserID) ON DELETE CASCADE
);
GO


--  insert categories
INSERT INTO Categories (Name, Description) VALUES
('Engineering', 'Engineering textbooks and technical references covering various engineering disciplines'),
('Horror', 'Horror fiction books featuring supernatural elements, suspense, and terrifying narratives'),
('Mystery or Thriller', 'Mystery and thriller novels involving crime, suspense, and detective work'),
('Self Help', 'Self-development books focused on personal growth, habits, and success principles');


-- Book

INSERT INTO Books (ISBN, Title, Author, CategoryID, Description, PhysicalPrice, EbookPrice, RentalPricePerDay, LateFeePerDay, AverageRating, ImageURL, PdfURL) VALUES
-- Engineering Books (CategoryID will be 1 after insert)
(NULL, 'Engineering Economy', 'Leland Blank and Anthony Tarquin', 1, 
 'This textbook provides a comprehensive introduction to the principles and applications of economic analysis in engineering. It covers essential topics such as time value of money, compound interest factors, and spreadsheet functions used for financial calculations. The book is designed to help students and professionals make informed financial decisions regarding engineering projects and investments. It includes detailed interest tables and practical examples to illustrate complex economic concepts.',
 2499.99, 1499.99, 75.00, 50.00, 0.00, NULL, NULL),

(NULL, 'Control Systems Engineering', 'Norman S. Nise', 1,
 'This book focuses on the analysis and design of feedback control systems, a fundamental aspect of modern engineering. It introduces key concepts such as the antenna azimuth position control system, illustrating how mathematical models are applied to physical hardware. The text explores system responses to various inputs, including ramp signals which represent linearly increasing commands. It is widely used for its clear explanations of complex control theory and its practical, real-world applications.',
 2699.99, 1599.99, 85.00, 50.00, 0.00, NULL, NULL),

(NULL, 'Modern Digital and Analog Communication Systems', 'B.P. Lathi and T. Srinivasa Rao', 1,
 'This textbook is renowned for its user-friendly and highly readable presentation of both analog and digital communication systems. It begins by introducing students to the basics of communication without requiring prior knowledge of probabilistic theory, building a solid foundation before covering more complex statistical concepts. The third edition includes expanded coverage of modern technologies such as cellular communication, global positioning systems (GPS), and spread-spectrum systems. It emphasizes intuitive insights and heuristic explanations alongside mathematical proofs to ensure difficult concepts are clear and accessible.',
 2899.99, 1699.99, 95.00, 50.00, 0.00, NULL, NULL),

(NULL, 'Fundamentals of Thermodynamics', 'Claus Borgnakke and Richard E. Sonntag', 1,
 'This leading textbook provides a comprehensive and rigorous introduction to the essential principles of classical thermodynamics within an engineering context. It is designed to prepare students for the practical application of thermodynamics in engineering and to lay the foundation for advanced studies in fluid mechanics and heat transfer. The tenth edition features updated data, enhanced pedagogical tools, and a systematic approach to teaching properties of pure substances and energy equations. It includes numerous real-world examples and carefully sequenced problems to help students master complex concepts effectively.',
 2999.99, 1799.99, 99.00, 50.00, 0.00, NULL, NULL),

(NULL, 'PIC Microcontroller and Embedded Systems: Using Assembly and C for PIC18', 'Muhammad Ali Mazidi, Rolin D. McKinlay, and Danny Causey', 1,
 'This book offers a systematic, step-by-step approach to programming and interfacing the PIC18 microcontroller using both Assembly and C languages. It provides thorough coverage of the PIC18 architecture and includes dedicated chapters for interfacing with peripherals such as LCDs, keyboards, sensors, and motors. The text features numerous practical examples that demonstrate how to program features like timers, serial communication, and ADC. It is widely used in both classroom and lab settings, supported by detailed appendices and hardware design information.',
 2299.99, 1399.99, 69.00, 50.00, 0.00, NULL, NULL),

-- Horror Books (CategoryID will be 2)
(NULL, 'Mostly Dark: A Collection of Small Pieces', 'Miranda Kate', 2,
 'This book is a compilation of flash fiction tales written over a five-year period, many of which originated from online writing contests. The stories are primarily dark or disturbing, though the collection also includes some heartwarming pieces. The author has organized the tales into sections following the phases of the moon---waxing, full, and waning---to reflect the varying levels of darkness and light within the narratives. Each piece is a brief, intense work of fiction designed to "prove" the creative potential of both the author and the reader.',
 899.99, 499.99, 35.00, 50.00, 0.00, NULL, NULL),

(NULL, 'Resurrection: A Zombie Novel', 'Michael J. Totten', 2,
 'This novel follows the survivors of a global apocalypse where the dead have returned to life, beginning with the section "All In Ashes". The story tracks their journey through devastated landscapes as they seek safety and answers, eventually leading them toward an island refuge. As the first book in a trilogy, it establishes a world where humanity must navigate both the literal monsters and the breakdown of civilization. The author, a veteran foreign correspondent, uses his background in reporting from conflict zones to bring a sense of realism to this survivalist horror narrative.',
 999.99, 599.99, 45.00, 50.00, 0.00, NULL, NULL),

(NULL, 'The Killing Complex (Book One in the Killing Saga)', 'KG Leslie', 2,
 'The story opens with a woman named Cassie regaining consciousness in a disorienting and dangerous situation, finding herself fitted with a mysterious metallic collar. She must navigate a high-stakes environment where she has been separated from her loved ones and is haunted by a promise to return to someone named Thomas. As she explores her surroundings, she deals with feelings of guilt and the realization that she is part of a much larger, potentially lethal "complex" or game. This psychological thriller marks the beginning of a saga that explores themes of captivity, survival, and the lengths one will go to for family.',
 849.99, 449.99, 32.00, 50.00, 0.00, NULL, NULL),

(NULL, 'The Reaper of Washington County', 'Steven Banner', 2,
 'Set in the late 19th century, this supernatural western follows characters like Tommy and Major Jeremiah Linwood Lancaster as they confront a terrifying threat known as "The Reaper". The narrative blends historical elements---including U.S. Marshals and life at sea---with a hunt for vampires that are terrorizing Washington County. Through exhumations and investigative work, an alliance is formed to eradicate the undead presence from the United States. The book serves as the first installment in a series, setting the stage for ongoing battles against organized crime and supernatural forces across New England.',
 949.99, 549.99, 39.00, 50.00, 0.00, NULL, NULL),

(NULL, 'Dracula', 'Bram Stoker', 2,
 'This classic Gothic horror novel is presented as a series of diary entries, letters, and ship logs, centered around the attempts of Count Dracula to move from Transylvania to England to find new blood and spread the undead curse. The story follows Jonathan Harker, who travels to the Count''s castle, and later a small group of men and women led by Professor Abraham Van Helsing as they battle the vampire. It explores themes of Victorian anxieties, the struggle between modern science and ancient superstition, and the battle between good and evil. The novel has become one of the most famous pieces of English literature, defining the modern perception of vampires.',
 699.99, 399.99, 25.00, 50.00, 0.00, NULL, NULL),

-- Mystery or Thriller Books (CategoryID will be 3)
(NULL, 'The Attic Murder', 'Sydney Fowler', 3,
 'This mystery story follows a man who escapes from court after being sentenced for a crime he claims he did not commit. While hiding in a rented apartment, he tries to avoid capture and figure out how to prove his innocence. The story focuses on his fear of being discovered, his attempts to plan an escape, and the psychological tension of living under a false identity while searching for evidence to clear his name.',
 799.99, 449.99, 30.00, 50.00, 0.00, NULL, NULL),


(NULL, 'The Apartment Next Door', 'William Andrew Johnston', 3,
 'This classic mystery novel centers on a young woman who witnesses strange and suspicious events late at night near her apartment building. When a mysterious incident occurs involving a man she recognizes from the neighboring apartment, she begins to suspect that a serious crime may have taken place. The story unfolds through clues, secret messages, and investigations that gradually reveal the truth behind the mystery next door.',
 749.99, 399.99, 28.00, 50.00, 0.00, NULL, NULL),

(NULL, 'The Adventure of the Bruce-Partington Plans', 'Arthur Conan Doyle', 3,
 'In this Sherlock Holmes mystery, the famous detective is asked by his brother Mycroft Holmes to investigate a case involving stolen secret submarine plans from the government. A clerk named Arthur Cadogan West is found dead near a railway line, and several pages of the important plans are missing. With the help of Dr. John Watson, Sherlock Holmes must uncover whether the crime involves treason, espionage, or murder. The case becomes a race against time to recover the missing documents before they fall into the hands of foreign spies.',
 799.99, 449.99, 30.00, 50.00, 0.00, NULL, NULL),

(NULL, 'Whose Body?', 'Dorothy L. Sayers', 3,
 'This novel introduces the clever amateur detective Lord Peter Wimsey. The mystery begins when a naked dead body wearing only a pair of gold pince-nez glasses is discovered in the bathtub of an architect''s home in London. At the same time, a wealthy businessman suddenly disappears. As Lord Peter investigates these strange events, he discovers that the two cases are connected. Using his intelligence and careful reasoning, he works to reveal the identity of the victim and expose the murderer behind the unusual crime.',
 849.99, 499.99, 32.00, 50.00, 0.00, NULL, NULL),

(NULL, 'The Valley of Fear', 'Arthur Conan Doyle', 3,
 'This Sherlock Holmes novel begins when Sherlock Holmes receives a secret coded message warning about danger to a man named John Douglas. Soon after, Douglas is found murdered at his home in Birlstone Manor. Holmes and Dr. John Watson investigate the crime and uncover clues that lead them to a dark past connected to a violent secret society in America. The story reveals a tale of revenge, hidden identities, and a dangerous criminal network known as the Scowrers in a place called the Valley of Fear.',
 849.99, 499.99, 32.00, 50.00, 0.00, NULL, NULL),

-- Self Help Books (CategoryID will be 4)
(NULL, 'Atomic Habits', 'James Clear', 4,
 'This book explains how small daily habits can lead to remarkable personal improvement. The book teaches readers how to break bad habits and build good ones by focusing on tiny behavioral changes and improving systems rather than just setting goals. Its core idea is that becoming 1% better every day can produce powerful long-term results.',
 1299.99, 799.99, 45.00, 50.00, 0.00, NULL, NULL),

(NULL, 'How to Win Friends and Influence People', 'Dale Carnegie', 4,
 'This classic self-development book teaches effective communication and relationship-building skills. It provides practical advice on how to interact with people, influence others positively, handle disagreements, and become more likable in personal and professional life. The book emphasizes showing genuine interest in others, listening carefully, and offering sincere appreciation.',
 1199.99, 699.99, 40.00, 50.00, 0.00, NULL, NULL),

(NULL, 'The 7 Habits of Highly Effective People', 'Stephen R. Covey', 4,
 'This book presents seven habits that help individuals achieve effectiveness in both personal and professional life. The book focuses on principles such as being proactive, setting clear goals, prioritizing important tasks, and developing strong relationships. It emphasizes building strong character and values as the foundation for long-term success.',
 1399.99, 899.99, 49.00, 50.00, 0.00, NULL, NULL),

(NULL, 'The Power of Now', 'Eckhart Tolle', 4,
 'This book focuses on the importance of living fully in the present moment. It teaches that many emotional problems come from dwelling on the past or worrying about the future. Through mindfulness and self-awareness, the book encourages readers to quiet the mind, reduce stress, and achieve inner peace by focusing on the present.',
 1099.99, 649.99, 38.00, 50.00, 0.00, NULL, NULL),

(NULL, 'Think and Grow Rich', 'Napoleon Hill', 4,
 'This classic personal development book explores the mindset and principles needed to achieve success and wealth. Based on years of studying successful individuals, the book outlines key ideas such as strong desire, faith, persistence, organized planning, and positive thinking. It argues that success begins with a clear goal and a strong belief in one''s ability to achieve it.',
 999.99, 599.99, 35.00, 50.00, 0.00, NULL, NULL);

-- Now update ISBN numbers based on the generated BookID
-- The pattern: 978-969-37-{BookID}-0001
UPDATE Books SET ISBN = '978-969-37-' + RIGHT('000' + CAST(BookID AS VARCHAR(3)), 3) + '-0001' 
WHERE ISBN IS NULL;

INSERT INTO Inventory (BookID, StockLevel, LowStockThreshold, TotalPhysicalSold, TotalEbooksSold, TotalEbooksRented, LastRestockDate)
SELECT 
    BookID,
    50 AS StockLevel,  -- Default stock level
    5 AS LowStockThreshold,
    0 AS TotalPhysicalSold,
    0 AS TotalEbooksSold,
    0 AS TotalEbooksRented,
    SYSUTCDATETIME() AS LastRestockDate
FROM Books; 


select* from Users;
INSERT INTO Users 
(Username, PasswordHash, Email, FullName, PhoneNumber, AddressLine1, City, Country, RoleID)
VALUES 
('admin1', 'password', 'admin@gmail.com', 'Admin User', '03001234567', 'Street 1', 'Lahore', 'Pakistan', 1);

update Users set PasswordHash = '$2b$10$ZwhnEWcn/7zKsbGIrRY2iuXGHHhu6kr7cF4aefmFW6d90XrjWUbre' where Email ='admin@gmail.com';
