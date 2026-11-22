const Payment = require("../models/payment");
const Invoice = require("../models/invoice");

// 1. Thực hiện thanh toán cho hóa đơn (POST /api/payments)
// Kiểm tra: Hóa đơn unpaid, số tiền khớp 100%, chặn thanh toán lại, chuyển hóa đơn sang paid
const processPayment = async (req, res) => {
  try {
    const {
      invoiceId,
      amount,
      paymentMethod,
      cashier,
      transactionRef,
      notes,
    } = req.body;

    if (!invoiceId || amount === undefined || !paymentMethod) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng cung cấp mã hóa đơn, số tiền và phương thức thanh toán (cash hoặc transfer)!",
      });
    }

    if (!["cash", "transfer"].includes(paymentMethod)) {
      return res.status(400).json({
        success: false,
        message: 'Phương thức thanh toán phải là "cash" (tiền mặt) hoặc "transfer" (chuyển khoản)!',
      });
    }

    // Gọi hàm static processPayment trong Model Payment (đã bao gồm chặn thanh toán lại, so sánh số tiền chuẩn)
    const newPayment = await Payment.processPayment({
      invoiceId,
      amount: Number(amount),
      paymentMethod,
      cashier: cashier || "Thu ngân PawnCare",
      transactionRef: transactionRef || "",
      notes: notes || "",
      paidAt: new Date(),
    });

    return res.status(201).json({
      success: true,
      message: `Thanh toán thành công cho hóa đơn! Mã giao dịch: [${newPayment.paymentCode}]. Hóa đơn đã chuyển sang trạng thái "paid".`,
      payment: newPayment,
    });
  } catch (error) {
    console.error("Lỗi xử lý thanh toán:", error.message);
    return res.status(400).json({
      success: false,
      message: error.message || "Không thể thực hiện thanh toán cho hóa đơn.",
    });
  }
};

// 2. Lấy danh sách lịch sử các giao dịch thanh toán (GET /api/payments)
const getPayments = async (req, res) => {
  try {
    const { paymentMethod, invoiceId } = req.query;
    const filter = { isDeleted: false };

    if (paymentMethod) filter.paymentMethod = paymentMethod;
    if (invoiceId) filter.invoiceId = invoiceId;

    const payments = await Payment.find(filter)
      .populate("invoiceId", "invoiceCode totalAmount status")
      .populate("customerId", "name phone")
      .sort({ paidAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: payments.length,
      payments,
    });
  } catch (error) {
    console.error("Lỗi lấy danh sách thanh toán:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi máy chủ khi lấy danh sách thanh toán.",
    });
  }
};

// 3. Lấy thông tin thanh toán theo mã hóa đơn (GET /api/payments/invoice/:invoiceId)
const getPaymentByInvoice = async (req, res) => {
  try {
    const { invoiceId } = req.params;

    const payment = await Payment.findByInvoice(invoiceId);

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Hóa đơn này chưa được thanh toán hoặc không tìm thấy bản ghi giao dịch.",
      });
    }

    return res.status(200).json({
      success: true,
      payment,
    });
  } catch (error) {
    console.error("Lỗi lấy thông tin thanh toán theo hóa đơn:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi máy chủ khi lấy thông tin thanh toán.",
    });
  }
};

module.exports = {
  processPayment,
  getPayments,
  getPaymentByInvoice,
};
