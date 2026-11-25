const mongoose = require("mongoose");
const Payment = require("../models/payment");
const Invoice = require("../models/invoice");
const { getCallerInfo } = require("./invoicesC");

// 1. Thực hiện thanh toán cho hóa đơn (POST /api/payments)
// Kiểm tra: Hóa đơn unpaid, số tiền khớp 100%, chặn thanh toán lại, chuyển hóa đơn sang paid
const processPayment = async (req, res) => {
  try {
    const caller = await getCallerInfo(req);
    if (!caller) {
      return res.status(401).json({
        success: false,
        message: "Vui lòng đăng nhập với tài khoản Lễ tân/Quản trị để thực hiện thanh toán.",
      });
    }
    if (caller.role_id === 4) {
      return res.status(403).json({
        success: false,
        message: "Khách hàng không có quyền tự chốt thanh toán hóa đơn. Vui lòng liên hệ Lễ tân.",
      });
    }
    if (![1, 3].includes(caller.role_id)) {
      return res.status(403).json({
        success: false,
        message: "Chỉ Lễ tân hoặc Quản trị viên mới có quyền chốt thanh toán hóa đơn.",
      });
    }

    const body = req.body || {};
    const {
      invoiceId,
      amount,
      paymentMethod,
      cashier,
      transactionRef,
      notes,
      note,
    } = body;

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
    const { payment: newPayment, invoice: updatedInvoice } = await Payment.processPayment({
      invoiceId,
      amount: Number(amount),
      paymentMethod,
      cashier: cashier || caller.name || "Thu ngân PawnCare",
      transactionRef: transactionRef || "",
      notes: notes || note || "",
      paidAt: new Date(),
    });

    return res.status(201).json({
      success: true,
      message: `Thanh toán thành công cho hóa đơn! Mã giao dịch: [${newPayment.paymentCode}]. Hóa đơn đã chuyển sang trạng thái "paid".`,
      payment: newPayment,
      invoice: updatedInvoice,
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
    if (invoiceId) {
      if (mongoose.Types.ObjectId.isValid(invoiceId)) {
        filter.invoiceId = invoiceId;
      } else {
        filter.invoiceCode = invoiceId;
      }
    }

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
