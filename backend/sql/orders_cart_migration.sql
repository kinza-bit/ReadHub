-- ============================================================
-- ReadHub — Orders & Cart Feature Migration
-- Stored Procedures for:
--   1. Cart management (add, view, update, remove, clear)
--   2. Checkout with address + payment method
--   3. User order history with full details
--   4. Admin order management (list, detail, update status, cancel/refund)
-- ============================================================

USE Read_Hub;
GO

-- ────────────────────────────────────────────────────────────
--  CART: Add item to cart
-- ────────────────────────────────────────────────────────────
IF OBJECT_ID('sp_AddToCart', 'P') IS NOT NULL DROP PROCEDURE sp_AddToCart;
GO
CREATE PROCEDURE sp_AddToCart
    @UserID   INT,
    @BookID   INT,
    @FormatID INT,
    @Quantity INT = 1,
    @RentalDays INT = NULL
AS
BEGIN
    SET NOCOUNT ON;

    -- Ensure cart exists for user
    IF NOT EXISTS (SELECT 1 FROM Cart WHERE UserID = @UserID)
        INSERT INTO Cart (UserID) VALUES (@UserID);

    DECLARE @CartID INT = (SELECT CartID FROM Cart WHERE UserID = @UserID);

    -- If same book+format already in cart, increment quantity
    IF EXISTS (SELECT 1 FROM CartItems WHERE CartID = @CartID AND BookID = @BookID AND FormatID = @FormatID)
    BEGIN
        UPDATE CartItems
        SET Quantity = Quantity + @Quantity
        WHERE CartID = @CartID AND BookID = @BookID AND FormatID = @FormatID;
    END
    ELSE
    BEGIN
        INSERT INTO CartItems (CartID, BookID, FormatID, Quantity, RentalDays)
        VALUES (@CartID, @BookID, @FormatID, @Quantity, @RentalDays);
    END
END;
GO

-- ────────────────────────────────────────────────────────────
--  CART: Get cart items for user
-- ────────────────────────────────────────────────────────────
IF OBJECT_ID('sp_GetCartItems', 'P') IS NOT NULL DROP PROCEDURE sp_GetCartItems;
GO
CREATE PROCEDURE sp_GetCartItems
    @UserID INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT ci.CartItemID, ci.BookID, ci.FormatID, ci.Quantity, ci.RentalDays,
           b.Title, b.Author, b.ImageURL,
           b.PhysicalPrice, b.EbookPrice, b.RentalPricePerDay,
           pf.FormatName,
           ISNULL(inv.StockLevel, 0) AS StockLevel,
           CASE
               WHEN ci.FormatID = 1 THEN b.PhysicalPrice
               WHEN ci.FormatID = 2 THEN b.EbookPrice
               WHEN ci.FormatID = 3 THEN b.RentalPricePerDay * ISNULL(ci.RentalDays, 1)
               ELSE 0
           END AS ItemPrice
    FROM Cart c
    INNER JOIN CartItems ci ON c.CartID = ci.CartID
    INNER JOIN Books b ON ci.BookID = b.BookID
    INNER JOIN PurchaseFormat pf ON ci.FormatID = pf.FormatID
    LEFT JOIN Inventory inv ON inv.BookID = b.BookID
    WHERE c.UserID = @UserID
    ORDER BY ci.CartItemID ASC;
END;
GO

-- ────────────────────────────────────────────────────────────
--  CART: Update quantity for a cart item
-- ────────────────────────────────────────────────────────────
IF OBJECT_ID('sp_UpdateCartItemQty', 'P') IS NOT NULL DROP PROCEDURE sp_UpdateCartItemQty;
GO
CREATE PROCEDURE sp_UpdateCartItemQty
    @UserID     INT,
    @CartItemID INT,
    @Quantity   INT
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE ci
    SET ci.Quantity = @Quantity
    FROM CartItems ci
    INNER JOIN Cart c ON c.CartID = ci.CartID
    WHERE c.UserID = @UserID AND ci.CartItemID = @CartItemID;
END;
GO

-- ────────────────────────────────────────────────────────────
--  CART: Remove a single item from cart
-- ────────────────────────────────────────────────────────────
IF OBJECT_ID('sp_RemoveCartItem', 'P') IS NOT NULL DROP PROCEDURE sp_RemoveCartItem;
GO
CREATE PROCEDURE sp_RemoveCartItem
    @UserID     INT,
    @CartItemID INT
AS
BEGIN
    SET NOCOUNT ON;
    DELETE ci
    FROM CartItems ci
    INNER JOIN Cart c ON c.CartID = ci.CartID
    WHERE c.UserID = @UserID AND ci.CartItemID = @CartItemID;
END;
GO

-- ────────────────────────────────────────────────────────────
--  CART: Clear entire cart
-- ────────────────────────────────────────────────────────────
IF OBJECT_ID('sp_ClearCart', 'P') IS NOT NULL DROP PROCEDURE sp_ClearCart;
GO
CREATE PROCEDURE sp_ClearCart
    @UserID INT
AS
BEGIN
    SET NOCOUNT ON;
    DELETE ci
    FROM CartItems ci
    INNER JOIN Cart c ON c.CartID = ci.CartID
    WHERE c.UserID = @UserID;
END;
GO

-- ────────────────────────────────────────────────────────────
--  CHECKOUT: Place order from cart
--  Creates an Order + OrderItems from the user's cart, 
--  then clears the cart. Returns the generated OrderNumber.
-- ────────────────────────────────────────────────────────────
IF OBJECT_ID('sp_CheckoutCart', 'P') IS NOT NULL DROP PROCEDURE sp_CheckoutCart;
GO
CREATE PROCEDURE sp_CheckoutCart
    @UserID          INT,
    @PaymentMethodID INT,
    @ShippingName    NVARCHAR(200),
    @ShippingAddress NVARCHAR(500),
    @ShippingCity    NVARCHAR(100),
    @ShippingPhone   NVARCHAR(20)
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRANSACTION;
    BEGIN TRY
        DECLARE @CartID INT = (SELECT CartID FROM Cart WHERE UserID = @UserID);
        IF @CartID IS NULL
        BEGIN
            THROW 50020, 'Cart is empty.', 1;
        END

        -- Check cart has items
        IF NOT EXISTS (SELECT 1 FROM CartItems WHERE CartID = @CartID)
        BEGIN
            THROW 50020, 'Cart is empty.', 1;
        END

        -- Build full shipping address string
        DECLARE @FullShippingAddr NVARCHAR(500) = @ShippingName + ' | ' + @ShippingAddress + ', ' + @ShippingCity + ' | Phone: ' + @ShippingPhone;

        -- Calculate total
        DECLARE @TotalAmount DECIMAL(12,2) = (
            SELECT SUM(
                CASE
                    WHEN ci.FormatID = 1 THEN b.PhysicalPrice * ci.Quantity
                    WHEN ci.FormatID = 2 THEN b.EbookPrice * ci.Quantity
                    WHEN ci.FormatID = 3 THEN b.RentalPricePerDay * ISNULL(ci.RentalDays, 1) * ci.Quantity
                    ELSE 0
                END
            )
            FROM CartItems ci
            INNER JOIN Books b ON ci.BookID = b.BookID
            WHERE ci.CartID = @CartID
        );

        -- Determine initial payment status
        DECLARE @PaymentStatusID INT;
        IF @PaymentMethodID = 2 -- Card = Completed immediately
            SET @PaymentStatusID = (SELECT StatusID FROM PaymentStatus WHERE StatusName = 'Completed');
        ELSE -- Cash on Delivery = Pending
            SET @PaymentStatusID = (SELECT StatusID FROM PaymentStatus WHERE StatusName = 'Pending');

        -- Check if all items are ebook-only (no physical). If so, set status to Completed for card payments.
        DECLARE @HasPhysical BIT = 0;
        IF EXISTS (SELECT 1 FROM CartItems WHERE CartID = @CartID AND FormatID = 1)
            SET @HasPhysical = 1;

        -- Initial order status
        DECLARE @OrderStatusID INT;
        IF @HasPhysical = 0 AND @PaymentMethodID = 2
            SET @OrderStatusID = (SELECT StatusID FROM OrderStatus WHERE StatusName = 'Delivered'); -- Ebook + Card = instant complete
        ELSE
            SET @OrderStatusID = (SELECT StatusID FROM OrderStatus WHERE StatusName = 'Pending');

        -- Generate unique order number
        DECLARE @OrderNumber NVARCHAR(50) = 'ORD-' + FORMAT(SYSUTCDATETIME(), 'yyyyMMdd') + '-' + RIGHT(CAST(ABS(CHECKSUM(NEWID())) AS VARCHAR(10)), 6);

        -- Create order
        INSERT INTO Orders (OrderNumber, UserID, TotalAmount, StatusID, PaymentMethodID, PaymentStatusID, ShippingAddress)
        VALUES (@OrderNumber, @UserID, @TotalAmount, @OrderStatusID, @PaymentMethodID, @PaymentStatusID, @FullShippingAddr);

        DECLARE @NewOrderID INT = SCOPE_IDENTITY();

        -- Insert order items from cart (triggers handle inventory)
        INSERT INTO OrderItems (OrderID, BookID, FormatID, Quantity, UnitPrice, RentalDays)
        SELECT @NewOrderID, ci.BookID, ci.FormatID, ci.Quantity,
               CASE
                   WHEN ci.FormatID = 1 THEN b.PhysicalPrice
                   WHEN ci.FormatID = 2 THEN b.EbookPrice
                   WHEN ci.FormatID = 3 THEN b.RentalPricePerDay * ISNULL(ci.RentalDays, 1)
                   ELSE 0
               END,
               ci.RentalDays
        FROM CartItems ci
        INNER JOIN Books b ON ci.BookID = b.BookID
        WHERE ci.CartID = @CartID;

        -- Create ebook rental entries if any
        INSERT INTO EbookRentals (OrderID, UserID, BookID, DueDate)
        SELECT @NewOrderID, @UserID, ci.BookID, DATEADD(DAY, ISNULL(ci.RentalDays, 7), SYSUTCDATETIME())
        FROM CartItems ci
        WHERE ci.CartID = @CartID AND ci.FormatID = 3;

        -- Clear the cart
        DELETE FROM CartItems WHERE CartID = @CartID;

        -- Return order confirmation
        SELECT @OrderNumber AS OrderNumber, @NewOrderID AS OrderID, @TotalAmount AS TotalAmount;

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        ROLLBACK TRANSACTION;
        THROW;
    END CATCH
END;
GO

-- ────────────────────────────────────────────────────────────
--  USER: Get order history with details
-- ────────────────────────────────────────────────────────────
IF OBJECT_ID('sp_GetUserOrderHistory', 'P') IS NOT NULL DROP PROCEDURE sp_GetUserOrderHistory;
GO
CREATE PROCEDURE sp_GetUserOrderHistory
    @UserID INT
AS
BEGIN
    SET NOCOUNT ON;

    -- Orders summary
    SELECT o.OrderID, o.OrderNumber, o.OrderDate, o.TotalAmount,
           os.StatusName AS OrderStatus,
           pm.MethodName AS PaymentMethod,
           ps.StatusName AS PaymentStatus,
           o.ShippingAddress
    FROM Orders o
    INNER JOIN OrderStatus os ON o.StatusID = os.StatusID
    INNER JOIN PaymentMethods pm ON o.PaymentMethodID = pm.PaymentMethodID
    INNER JOIN PaymentStatus ps ON o.PaymentStatusID = ps.StatusID
    WHERE o.UserID = @UserID
    ORDER BY o.OrderDate DESC;

    -- Order items (second recordset)
    SELECT oi.OrderID, oi.BookID, oi.FormatID, oi.Quantity, oi.UnitPrice, oi.RentalDays,
           b.Title, b.Author, b.ImageURL,
           pf.FormatName
    FROM OrderItems oi
    INNER JOIN Orders o ON oi.OrderID = o.OrderID
    INNER JOIN Books b ON oi.BookID = b.BookID
    INNER JOIN PurchaseFormat pf ON oi.FormatID = pf.FormatID
    WHERE o.UserID = @UserID
    ORDER BY oi.OrderID DESC;
END;
GO

-- ════════════════════════════════════════════════════════════
--  ADMIN: Order Management
-- ════════════════════════════════════════════════════════════

-- ────────────────────────────────────────────────────────────
--  ADMIN: Get all orders (with filtering)
-- ────────────────────────────────────────────────────────────
IF OBJECT_ID('sp_AdminGetAllOrders', 'P') IS NOT NULL DROP PROCEDURE sp_AdminGetAllOrders;
GO
CREATE PROCEDURE sp_AdminGetAllOrders
    @Search        NVARCHAR(100) = NULL,
    @OrderType     NVARCHAR(20)  = NULL,  -- 'physical', 'ebook', or NULL for all
    @StatusFilter  NVARCHAR(50)  = NULL,
    @PaymentFilter NVARCHAR(50)  = NULL,
    @DateFrom      DATETIME2     = NULL,
    @DateTo        DATETIME2     = NULL
AS
BEGIN
    SET NOCOUNT ON;

    SELECT o.OrderID, o.OrderNumber, o.OrderDate, o.TotalAmount,
           u.FullName AS CustomerName, u.Email AS CustomerEmail,
           os.StatusName AS OrderStatus, os.StatusID,
           pm.MethodName AS PaymentMethod,
           ps.StatusName AS PaymentStatus, ps.StatusID AS PaymentStatusID,
           o.ShippingAddress,
           -- Determine order type based on items
           CASE
               WHEN EXISTS (SELECT 1 FROM OrderItems oi WHERE oi.OrderID = o.OrderID AND oi.FormatID = 1) THEN 'Physical'
               WHEN EXISTS (SELECT 1 FROM OrderItems oi WHERE oi.OrderID = o.OrderID AND oi.FormatID IN (2,3)) THEN 'Ebook'
               ELSE 'Mixed'
           END AS OrderType,
           (SELECT COUNT(*) FROM OrderItems oi WHERE oi.OrderID = o.OrderID) AS ItemCount
    FROM Orders o
    INNER JOIN Users u ON o.UserID = u.UserID
    INNER JOIN OrderStatus os ON o.StatusID = os.StatusID
    INNER JOIN PaymentMethods pm ON o.PaymentMethodID = pm.PaymentMethodID
    INNER JOIN PaymentStatus ps ON o.PaymentStatusID = ps.StatusID
    WHERE (@Search IS NULL OR o.OrderNumber LIKE '%' + @Search + '%' OR u.FullName LIKE '%' + @Search + '%' OR u.Email LIKE '%' + @Search + '%')
      AND (@StatusFilter IS NULL OR os.StatusName = @StatusFilter)
      AND (@PaymentFilter IS NULL OR ps.StatusName = @PaymentFilter)
      AND (@DateFrom IS NULL OR o.OrderDate >= @DateFrom)
      AND (@DateTo IS NULL OR o.OrderDate <= @DateTo)
      AND (
          @OrderType IS NULL
          OR (@OrderType = 'physical' AND EXISTS (SELECT 1 FROM OrderItems oi WHERE oi.OrderID = o.OrderID AND oi.FormatID = 1))
          OR (@OrderType = 'ebook' AND EXISTS (SELECT 1 FROM OrderItems oi WHERE oi.OrderID = o.OrderID AND oi.FormatID IN (2,3)))
      )
    ORDER BY o.OrderDate DESC;
END;
GO

-- ────────────────────────────────────────────────────────────
--  ADMIN: Get single order detail
-- ────────────────────────────────────────────────────────────
IF OBJECT_ID('sp_AdminGetOrderDetail', 'P') IS NOT NULL DROP PROCEDURE sp_AdminGetOrderDetail;
GO
CREATE PROCEDURE sp_AdminGetOrderDetail
    @OrderID INT
AS
BEGIN
    SET NOCOUNT ON;

    -- Order header
    SELECT o.OrderID, o.OrderNumber, o.OrderDate, o.TotalAmount,
           u.UserID, u.FullName AS CustomerName, u.Email AS CustomerEmail, u.PhoneNumber AS CustomerPhone,
           os.StatusName AS OrderStatus, os.StatusID,
           pm.MethodName AS PaymentMethod, pm.PaymentMethodID,
           ps.StatusName AS PaymentStatus, ps.StatusID AS PaymentStatusID,
           o.ShippingAddress
    FROM Orders o
    INNER JOIN Users u ON o.UserID = u.UserID
    INNER JOIN OrderStatus os ON o.StatusID = os.StatusID
    INNER JOIN PaymentMethods pm ON o.PaymentMethodID = pm.PaymentMethodID
    INNER JOIN PaymentStatus ps ON o.PaymentStatusID = ps.StatusID
    WHERE o.OrderID = @OrderID;

    -- Order items
    SELECT oi.OrderItemID, oi.BookID, oi.FormatID, oi.Quantity, oi.UnitPrice, oi.RentalDays,
           b.Title, b.Author, b.ImageURL,
           pf.FormatName,
           ISNULL(inv.StockLevel, 0) AS CurrentStock,
           er.DueDate
    FROM OrderItems oi
    INNER JOIN Books b ON oi.BookID = b.BookID
    INNER JOIN PurchaseFormat pf ON oi.FormatID = pf.FormatID
    LEFT JOIN Inventory inv ON inv.BookID = b.BookID
    LEFT JOIN EbookRentals er ON oi.OrderID = er.OrderID AND oi.BookID = er.BookID
    WHERE oi.OrderID = @OrderID;
END;
GO

-- ────────────────────────────────────────────────────────────
--  ADMIN: Update order status
-- ────────────────────────────────────────────────────────────
IF OBJECT_ID('sp_AdminUpdateOrderStatus', 'P') IS NOT NULL DROP PROCEDURE sp_AdminUpdateOrderStatus;
GO
CREATE PROCEDURE sp_AdminUpdateOrderStatus
    @OrderID  INT,
    @StatusID INT
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE Orders SET StatusID = @StatusID WHERE OrderID = @OrderID;
END;
GO

-- ────────────────────────────────────────────────────────────
--  ADMIN: Update payment status
-- ────────────────────────────────────────────────────────────
IF OBJECT_ID('sp_AdminUpdatePaymentStatus', 'P') IS NOT NULL DROP PROCEDURE sp_AdminUpdatePaymentStatus;
GO
CREATE PROCEDURE sp_AdminUpdatePaymentStatus
    @OrderID        INT,
    @PaymentStatusID INT
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE Orders SET PaymentStatusID = @PaymentStatusID WHERE OrderID = @OrderID;
END;
GO

-- ────────────────────────────────────────────────────────────
--  ADMIN: Get order status list (for dropdowns)
-- ────────────────────────────────────────────────────────────
IF OBJECT_ID('sp_GetOrderStatuses', 'P') IS NOT NULL DROP PROCEDURE sp_GetOrderStatuses;
GO
CREATE PROCEDURE sp_GetOrderStatuses
AS
BEGIN
    SET NOCOUNT ON;
    SELECT StatusID, StatusName FROM OrderStatus WHERE IsActive = 1 ORDER BY DisplayOrder ASC;
END;
GO

-- ────────────────────────────────────────────────────────────
--  ADMIN: Get payment statuses (for dropdowns)
-- ────────────────────────────────────────────────────────────
IF OBJECT_ID('sp_GetPaymentStatuses', 'P') IS NOT NULL DROP PROCEDURE sp_GetPaymentStatuses;
GO
CREATE PROCEDURE sp_GetPaymentStatuses
AS
BEGIN
    SET NOCOUNT ON;
    SELECT StatusID, StatusName FROM PaymentStatus;
END;
GO

-- ────────────────────────────────────────────────────────────
--  CART: Get cart item count (for navbar badge)
-- ────────────────────────────────────────────────────────────
IF OBJECT_ID('sp_GetCartCount', 'P') IS NOT NULL DROP PROCEDURE sp_GetCartCount;
GO
CREATE PROCEDURE sp_GetCartCount
    @UserID INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT ISNULL(SUM(ci.Quantity), 0) AS CartCount
    FROM Cart c
    INNER JOIN CartItems ci ON c.CartID = ci.CartID
    WHERE c.UserID = @UserID;
END;
GO

PRINT '✅ Orders & Cart migration applied successfully.';
GO
