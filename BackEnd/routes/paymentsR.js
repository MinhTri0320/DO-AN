const express = require("express");
const payments = require("../controllers/paymentsC");

const router = express.Router();

/* ============================================================
   PAYMENT ROUTES (API Thanh toán hóa đơn)
   ============================================================ */

// 1. Thực hiện thanh toán (chặn thanh toán lại, kiểm tra số tiền khớp 100%, chuyển hóa đơn sang paid)
router.post("/payments", payments.processPayment);

// 2. Danh sách lịch sử thanh toán
router.get("/payments", payments.getPayments);

// 3. Lấy thông tin thanh toán theo mã hóa đơn
router.get("/payments/invoice/:invoiceId", payments.getPaymentByInvoice);

module.exports = router;
