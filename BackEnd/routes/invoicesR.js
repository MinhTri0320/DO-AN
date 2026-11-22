const express = require("express");
const invoices = require("../controllers/invoicesC");

const router = express.Router();

/* ============================================================
   INVOICE ROUTES (API Quản lý hóa đơn)
   ============================================================ */

// 1. Tạo mới hóa đơn (tự tính tổng tiền, khóa đơn giá tại thời điểm lập)
router.post("/invoices", invoices.createInvoice);

// 2. Tạo hóa đơn tự động từ lượt cấp thuốc (Dispensing)
router.post("/invoices/from-dispensing/:dispensingId", invoices.createFromDispensing);

// 3. Danh sách hóa đơn (phân quyền: khách hàng chỉ xem của mình, nhân viên xem tất cả)
router.get("/invoices", invoices.getInvoices);

// 4. Chi tiết một hóa đơn theo ID hoặc mã invoiceCode
router.get("/invoices/:id", invoices.getInvoiceById);

module.exports = router;
