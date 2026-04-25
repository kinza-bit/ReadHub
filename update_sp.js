const { sql, poolPromise } = require('./backend/db');

async function test() {
  try {
    const pool = await poolPromise;
    await pool.request().query(`
ALTER PROCEDURE sp_AdminGetOrderDetail
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
    `);
    console.log('Procedure updated');
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}
test();
