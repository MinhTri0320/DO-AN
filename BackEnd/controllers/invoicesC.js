const Invoice = require("../models/invoice");
const User = require("../models/user");

/**
 * Helper xác thực người gọi API hóa đơn (phân quyền Khách hàng vs Nhân viên)
 */
async function getCallerInfo(req) {
  const callerId =
    req.headers["x-user-id"] ||
    req.headers["user-id"] ||
    req.query.userId ||
    req.query.customerId;

  if (!callerId) return null;

  try {
    const user = await User.findById(callerId).lean();
    if (user) {
      return {
        id: String(user._id),
        name: user.name,
        phone: user.phone,
        role: user.role,
        role_id: user.role_id || (user.role === "admin" ? 1 : user.role === "doctor" ? 2 : user.role === "receptionist" ? 3 : 4),
      };
    }
  } catch (e) {}

  return null;
}

// 1. Tạo mới hóa đơn (POST /api/invoices)
// Tự động tính tổng tiền từ backend, khóa cố định đơn giá tại thời điểm lập
const createInvoice = async (req, res) => {
  try {
    const {
      customerId,
      petId,
      dispensingId,
      prescriptionCode,
      items,
      notes,
    } = req.body;

    if (!customerId || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng cung cấp mã khách hàng và ít nhất một mục thanh toán!",
      });
    }

    const newInvoice = await Invoice.createInvoice({
      customerId,
      petId: petId || null,
      dispensingId: dispensingId || null,
      prescriptionCode: prescriptionCode || "",
      items,
      notes: notes || "",
    });

    return res.status(201).json({
      success: true,
      message: `Tạo hóa đơn [${newInvoice.invoiceCode}] thành công! Tổng tiền: ${newInvoice.totalAmount.toLocaleString("vi-VN")}đ`,
      invoice: newInvoice,
    });
  } catch (error) {
    console.error("Lỗi tạo hóa đơn:", error.message);
    return res.status(400).json({
      success: false,
      message: error.message || "Không thể tạo hóa đơn.",
    });
  }
};

// 2. Tạo hóa đơn tự động từ lượt cấp thuốc (POST /api/invoices/from-dispensing/:dispensingId)
const createFromDispensing = async (req, res) => {
  try {
    const { dispensingId } = req.params;

    const newInvoice = await Invoice.createFromDispensing(dispensingId);

    return res.status(201).json({
      success: true,
      message: `Đã lập hóa đơn [${newInvoice.invoiceCode}] từ lượt cấp thuốc thành công! Tổng tiền: ${newInvoice.totalAmount.toLocaleString("vi-VN")}đ`,
      invoice: newInvoice,
    });
  } catch (error) {
    console.error("Lỗi tạo hóa đơn từ lượt cấp thuốc:", error.message);
    return res.status(400).json({
      success: false,
      message: error.message || "Không thể tạo hóa đơn từ lượt cấp thuốc.",
    });
  }
};

// 3. Lấy danh sách hóa đơn (GET /api/invoices)
// Phân quyền khách hàng: Khách hàng (role_id = 4) CHỈ xem được hóa đơn của mình
const getInvoices = async (req, res) => {
  try {
    const { customerId, status } = req.query;
    const caller = await getCallerInfo(req);

    // 1. Bắt buộc phải có thông tin định danh người gọi
    if (!caller) {
      return res.status(401).json({
        success: false,
        message: "Vui lòng đăng nhập để truy cập thông tin hóa đơn.",
      });
    }

    // 2. Phân quyền: role_id = 1 (Admin) và role_id = 2 (Bác sĩ) không có quyền truy cập hóa đơn phòng khám
    if (caller.role_id === 1 || caller.role_id === 2) {
      return res.status(403).json({
        success: false,
        message: "Quyền truy cập bị từ chối! Quản trị viên và Bác sĩ không có quyền truy cập danh sách hóa đơn chung. Chức năng này chỉ dành cho Nhân viên Lễ tân (role_id = 3).",
      });
    }

    const filter = { isDeleted: false };

    // 3. Khách hàng (role_id = 4): CHỈ được phép xem duy nhất hóa đơn gắn với chính mình
    if (caller.role_id === 4) {
      filter.$or = [{ customerId: caller.id }, { customerPhone: caller.phone }];
    } else if (caller.role_id === 3) {
      // 4. Lễ tân (role_id = 3): Được xem danh sách chung hoặc lọc theo khách hàng
      if (customerId) {
        filter.customerId = customerId;
      }
    }

    if (status) {
      filter.status = status;
    }

    const invoices = await Invoice.find(filter)
      .populate("customerId", "name phone")
      .populate("petId", "name species")
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: invoices.length,
      invoices,
    });
  } catch (error) {
    console.error("Lỗi lấy danh sách hóa đơn:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi máy chủ khi lấy danh sách hóa đơn.",
    });
  }
};

// 4. Chi tiết một hóa đơn (GET /api/invoices/:id)
// Khách hàng không thể xem trộm hóa đơn của người khác; Admin & Bác sĩ không truy cập
const getInvoiceById = async (req, res) => {
  try {
    const { id } = req.params;
    const caller = await getCallerInfo(req);

    if (!caller) {
      return res.status(401).json({
        success: false,
        message: "Vui lòng đăng nhập để xem chi tiết hóa đơn.",
      });
    }

    if (caller.role_id === 1 || caller.role_id === 2) {
      return res.status(403).json({
        success: false,
        message: "Quyền truy cập bị từ chối! Quản trị viên và Bác sĩ không có quyền truy cập chi tiết hóa đơn.",
      });
    }

    const invoice = await Invoice.findOne({
      $or: [
        { _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null },
        { invoiceCode: id },
      ],
      isDeleted: false,
    })
      .populate("customerId", "name phone")
      .populate("petId", "name species")
      .populate("paymentId")
      .lean();

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy hóa đơn yêu cầu.",
      });
    }

    // Kiểm tra phân quyền: Khách hàng chỉ xem được hóa đơn của chính mình
    if (caller.role_id === 4) {
      const invCustomerId = invoice.customerId?._id
        ? String(invoice.customerId._id)
        : String(invoice.customerId);

      if (invCustomerId !== caller.id && invoice.customerPhone !== caller.phone) {
        return res.status(403).json({
          success: false,
          message: "Quyền truy cập bị từ chối! Bạn chỉ có thể xem hóa đơn của chính mình.",
        });
      }
    }

    return res.status(200).json({
      success: true,
      invoice,
    });
  } catch (error) {
    console.error("Lỗi lấy chi tiết hóa đơn:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi máy chủ khi lấy chi tiết hóa đơn.",
    });
  }
};

module.exports = {
  createInvoice,
  createFromDispensing,
  getInvoices,
  getInvoiceById,
  getCallerInfo,
};
