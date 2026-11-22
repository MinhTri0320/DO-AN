const mongoose = require("mongoose");
const Cage = require("../models/cage");

/**
 * Helper chuẩn hóa kích cỡ chuồng
 * "small" / "nhỏ" -> "nhỏ"
 * "medium" / "vừa" -> "vừa"
 * "large" / "lớn" -> "lớn"
 */
function normalizeSize(sizeStr) {
  if (!sizeStr) return "vừa";
  const s = String(sizeStr).trim().toLowerCase();
  if (s === "small" || s === "nhỏ") return "nhỏ";
  if (s === "large" || s === "lớn") return "lớn";
  return "vừa";
}

/**
 * 1. LẤY DANH SÁCH CHUỒNG VÀ THỐNG KÊ (GET /api/cages)
 * Hỗ trợ lọc theo:
 * - status: available, occupied, maintenance, all
 * - size: nhỏ, vừa, lớn (hoặc small, medium, large, all)
 * - search: từ khóa theo mã chuồng, tên chuồng, ghi chú
 * - minPrice, maxPrice: khoảng giá theo ngày
 */
const getCages = async (req, res) => {
  try {
    const { status, size, search, minPrice, maxPrice } = req.query;
    const filter = { isDeleted: false };

    // Lọc theo trạng thái
    if (status && status !== "all") {
      const validStatuses = ["available", "occupied", "maintenance"];
      const s = String(status).trim().toLowerCase();
      if (validStatuses.includes(s)) {
        filter.status = s;
      }
    }

    // Lọc theo kích cỡ
    if (size && size !== "all") {
      const s = String(size).trim().toLowerCase();
      if (s === "small" || s === "nhỏ") {
        filter.size = { $in: ["nhỏ", "small", "Small"] };
      } else if (s === "large" || s === "lớn") {
        filter.size = { $in: ["lớn", "large", "Large"] };
      } else if (s === "medium" || s === "vừa") {
        filter.size = { $in: ["vừa", "medium", "Medium"] };
      } else {
        filter.size = size;
      }
    }

    // Lọc theo khoảng giá
    if (minPrice != null || maxPrice != null) {
      filter.pricePerDay = {};
      if (minPrice != null && !isNaN(minPrice)) {
        filter.pricePerDay.$gte = Number(minPrice);
      }
      if (maxPrice != null && !isNaN(maxPrice)) {
        filter.pricePerDay.$lte = Number(maxPrice);
      }
    }

    // Tìm kiếm từ khóa theo mã chuồng, tên, mô tả
    if (search && String(search).trim() !== "") {
      const searchRegex = new RegExp(String(search).trim(), "i");
      filter.$or = [
        { cageCode: searchRegex },
        { name: searchRegex },
        { notes: searchRegex },
        { currentPetName: searchRegex },
      ];
    }

    // Lấy danh sách chuồng theo bộ lọc
    const cages = await Cage.find(filter)
      .sort({ cageCode: 1 })
      .lean({ virtuals: true });

    // Tính toán KPI thống kê toàn bộ chuồng (không bị ảnh hưởng bởi search/filter)
    const [total, available, occupied, maintenance] = await Promise.all([
      Cage.countDocuments({ isDeleted: false }),
      Cage.countDocuments({ status: "available", isDeleted: false }),
      Cage.countDocuments({ status: "occupied", isDeleted: false }),
      Cage.countDocuments({ status: "maintenance", isDeleted: false }),
    ]);

    return res.status(200).json({
      success: true,
      count: cages.length,
      kpi: {
        total,
        available,
        occupied,
        maintenance,
      },
      cages,
    });
  } catch (error) {
    console.error("Lỗi lấy danh sách chuồng:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi máy chủ khi lấy danh sách chuồng: " + error.message,
    });
  }
};

/**
 * 2. LẤY THỐNG KÊ KPI RIÊNG (GET /api/cages/kpi)
 */
const getCageKPIs = async (req, res) => {
  try {
    const [total, available, occupied, maintenance] = await Promise.all([
      Cage.countDocuments({ isDeleted: false }),
      Cage.countDocuments({ status: "available", isDeleted: false }),
      Cage.countDocuments({ status: "occupied", isDeleted: false }),
      Cage.countDocuments({ status: "maintenance", isDeleted: false }),
    ]);

    return res.status(200).json({
      success: true,
      kpi: {
        total,
        available,
        occupied,
        maintenance,
      },
    });
  } catch (error) {
    console.error("Lỗi lấy thống kê chuồng:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi máy chủ khi lấy thống kê chuồng: " + error.message,
    });
  }
};

/**
 * 3. LẤY CHI TIẾT CHUỒNG THEO ID HOẶC MÃ CHUỒNG (GET /api/cages/:id)
 */
const getCageById = async (req, res) => {
  try {
    const { id } = req.params;
    const isObjectId = mongoose.Types.ObjectId.isValid(id);

    const cage = await Cage.findOne({
      $or: [
        { _id: isObjectId ? id : null },
        { cageCode: String(id).trim().toUpperCase() },
      ],
      isDeleted: false,
    }).lean({ virtuals: true });

    if (!cage) {
      return res.status(404).json({
        success: false,
        message: `Không tìm thấy chuồng với ID hoặc mã: ${id}`,
      });
    }

    return res.status(200).json({
      success: true,
      cage,
    });
  } catch (error) {
    console.error("Lỗi lấy chi tiết chuồng:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi máy chủ khi lấy chi tiết chuồng: " + error.message,
    });
  }
};

/**
 * 4. THÊM CHUỒNG MỚI (POST /api/cages)
 * Ràng buộc:
 * - Mã chuồng không được trùng
 * - Giá theo ngày phải > 0
 * - Trạng thái ban đầu chỉ cho phép "available" hoặc "maintenance" (không được chỉnh occupied bằng tay)
 */
const createCage = async (req, res) => {
  try {
    const {
      cageCode,
      code,
      name,
      size,
      pricePerDay,
      price,
      status,
      notes,
      description,
    } = req.body;

    const finalCode = String(cageCode || code || "").trim().toUpperCase();
    if (!finalCode) {
      return res.status(400).json({
        success: false,
        message: "Mã chuồng là bắt buộc!",
      });
    }

    // Kiểm tra trùng mã chuồng
    const existingCage = await Cage.findOne({
      cageCode: finalCode,
      isDeleted: false,
    });
    if (existingCage) {
      return res.status(400).json({
        success: false,
        message: `Mã chuồng "${finalCode}" đã tồn tại! Vui lòng chọn mã khác.`,
      });
    }

    // Giá theo ngày
    const finalPrice = Number(pricePerDay != null ? pricePerDay : price);
    if (isNaN(finalPrice) || finalPrice <= 0) {
      return res.status(400).json({
        success: false,
        message: "Đơn giá theo ngày phải là số dương hợp lệ!",
      });
    }

    // Trạng thái ban đầu: chỉ cho phép available hoặc maintenance
    let initialStatus = "available";
    if (status) {
      const s = String(status).trim().toLowerCase();
      if (s === "maintenance") {
        initialStatus = "maintenance";
      } else if (s === "occupied") {
        return res.status(400).json({
          success: false,
          message: "Không thể tạo chuồng mới ở trạng thái 'occupied'. Trạng thái này do quy trình Check-in tự động kích hoạt!",
        });
      }
    }

    const finalSize = normalizeSize(size);
    const finalName = String(name || `Chuồng ${finalCode}`).trim();
    const finalNotes = String(notes || description || "").trim();

    const newCage = await Cage.create({
      cageCode: finalCode,
      name: finalName,
      size: finalSize,
      pricePerDay: finalPrice,
      status: initialStatus,
      notes: finalNotes,
      isDeleted: false,
    });

    return res.status(201).json({
      success: true,
      message: `Thêm chuồng mới ${finalCode} thành công!`,
      cage: newCage,
    });
  } catch (error) {
    console.error("Lỗi thêm chuồng mới:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi máy chủ khi thêm chuồng: " + error.message,
    });
  }
};

/**
 * 5. CHỈNH SỬA THÔNG TIN CHUỒNG (PUT /api/cages/:id)
 * Ràng buộc:
 * - Chuồng đang occupied KHÔNG ĐƯỢC CHỈNH TAY SANG AVAILABLE HOẶC MAINTENANCE.
 * - Nhân viên chỉ chỉnh tay khi chuyển sang hoặc ra khỏi maintenance (giữa available <-> maintenance).
 * - Không cho phép chỉnh tay sang occupied.
 */
const updateCage = async (req, res) => {
  try {
    const { id } = req.params;
    const isObjectId = mongoose.Types.ObjectId.isValid(id);

    const cage = await Cage.findOne({
      $or: [
        { _id: isObjectId ? id : null },
        { cageCode: String(id).trim().toUpperCase() },
      ],
      isDeleted: false,
    });

    if (!cage) {
      return res.status(404).json({
        success: false,
        message: `Không tìm thấy chuồng với ID hoặc mã: ${id}`,
      });
    }

    const {
      cageCode,
      code,
      name,
      size,
      pricePerDay,
      price,
      status,
      notes,
      description,
    } = req.body;

    // Kiểm tra đổi mã chuồng (nếu có)
    const newCode = String(cageCode || code || "").trim().toUpperCase();
    if (newCode && newCode !== cage.cageCode) {
      const duplicate = await Cage.findOne({
        cageCode: newCode,
        _id: { $ne: cage._id },
        isDeleted: false,
      });
      if (duplicate) {
        return res.status(400).json({
          success: false,
          message: `Mã chuồng "${newCode}" đã được sử dụng bởi chuồng khác!`,
        });
      }
      cage.cageCode = newCode;
    }

    // Cập nhật tên chuồng
    if (name !== undefined) {
      cage.name = String(name).trim();
    }

    // Cập nhật kích cỡ
    if (size !== undefined) {
      cage.size = normalizeSize(size);
    }

    // Cập nhật giá theo ngày
    const newPrice = Number(pricePerDay != null ? pricePerDay : price);
    if (!isNaN(newPrice)) {
      if (newPrice <= 0) {
        return res.status(400).json({
          success: false,
          message: "Đơn giá theo ngày phải là số dương hợp lệ!",
        });
      }
      cage.pricePerDay = newPrice;
    }

    // Cập nhật ghi chú / mô tả
    if (notes !== undefined || description !== undefined) {
      cage.notes = String(notes != null ? notes : description).trim();
    }

    // XỬ LÝ TRẠNG THÁI (STATUS) THEO RÀNG BUỘC NGHIỆP VỤ:
    if (status !== undefined) {
      const targetStatus = String(status).trim().toLowerCase();

      if (cage.status === "occupied") {
        // Chuồng đang occupied: cấm nhân viên chỉnh tay sang available hoặc maintenance
        if (targetStatus !== "occupied") {
          return res.status(400).json({
            success: false,
            message: `Chuồng [${cage.cageCode}] đang có thú cưng lưu trú (occupied). Nhân viên không được phép đổi trạng thái thủ công! Trạng thái chỉ tự cập nhật khi Check-out.`,
          });
        }
      } else {
        // Chuồng đang available hoặc maintenance:
        // Cấm nhân viên chỉnh tay sang occupied
        if (targetStatus === "occupied") {
          return res.status(400).json({
            success: false,
            message: "Không được chuyển trạng thái sang 'occupied' bằng tay. Trạng thái 'occupied' do hệ thống tự cập nhật khi Check-in!",
          });
        }

        // Chỉ cho phép chuyển đổi giữa available và maintenance
        if (targetStatus === "available" || targetStatus === "maintenance") {
          cage.status = targetStatus;
        } else {
          return res.status(400).json({
            success: false,
            message: "Trạng thái chuồng chỉ có thể là 'available' hoặc 'maintenance'.",
          });
        }
      }
    }

    await cage.save();

    return res.status(200).json({
      success: true,
      message: `Cập nhật thông tin chuồng ${cage.cageCode} thành công!`,
      cage,
    });
  } catch (error) {
    console.error("Lỗi cập nhật chuồng:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi máy chủ khi cập nhật chuồng: " + error.message,
    });
  }
};

/**
 * 6. XÓA CHUỒNG (DELETE /api/cages/:id)
 * RÀNG BUỘC CỐT LÕI BẮT BUỘC:
 * "Chuồng đang occupied không được xóa."
 */
const deleteCage = async (req, res) => {
  try {
    const { id } = req.params;
    const isObjectId = mongoose.Types.ObjectId.isValid(id);

    const cage = await Cage.findOne({
      $or: [
        { _id: isObjectId ? id : null },
        { cageCode: String(id).trim().toUpperCase() },
      ],
      isDeleted: false,
    });

    if (!cage) {
      return res.status(404).json({
        success: false,
        message: `Không tìm thấy chuồng với ID hoặc mã: ${id}`,
      });
    }

    // RÀNG BUỘC: CHUỒNG ĐANG OCCUPIED KHÔNG ĐƯỢC XÓA
    if (cage.status === "occupied") {
      return res.status(400).json({
        success: false,
        message: `Chuồng [${cage.cageCode}] đang có thú cưng lưu trú (occupied). Nghiêm cấm xóa chuồng này!`,
      });
    }

    // Thực hiện xóa mềm
    cage.isDeleted = true;
    await cage.save();

    return res.status(200).json({
      success: true,
      message: `Đã xóa thành công chuồng [${cage.cageCode}]!`,
    });
  } catch (error) {
    console.error("Lỗi xóa chuồng:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi máy chủ khi xóa chuồng: " + error.message,
    });
  }
};

/**
 * 7. CHUYỂN TRẠNG THÁI BẢO TRÌ (PATCH /api/cages/:id/maintenance)
 * Nhân viên chỉnh tay chuyển sang hoặc ra khỏi maintenance
 * Nếu chuồng đang occupied -> từ chối
 */
const toggleMaintenance = async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body || {};
    const isObjectId = mongoose.Types.ObjectId.isValid(id);

    const cage = await Cage.findOne({
      $or: [
        { _id: isObjectId ? id : null },
        { cageCode: String(id).trim().toUpperCase() },
      ],
      isDeleted: false,
    });

    if (!cage) {
      return res.status(404).json({
        success: false,
        message: `Không tìm thấy chuồng với ID hoặc mã: ${id}`,
      });
    }

    if (cage.status === "occupied") {
      return res.status(400).json({
        success: false,
        message: `Chuồng [${cage.cageCode}] đang có thú cưng lưu trú (occupied), không thể chuyển sang bảo trì!`,
      });
    }

    if (cage.status === "maintenance") {
      cage.status = "available";
      if (notes) cage.notes = notes;
      await cage.save();
      return res.status(200).json({
        success: true,
        message: `Đã mở lại hoạt động (available) cho chuồng [${cage.cageCode}]!`,
        cage,
      });
    } else {
      cage.status = "maintenance";
      if (notes) cage.notes = notes;
      await cage.save();
      return res.status(200).json({
        success: true,
        message: `Đã chuyển chuồng [${cage.cageCode}] sang trạng thái Bảo trì (maintenance).`,
        cage,
      });
    }
  } catch (error) {
    console.error("Lỗi chuyển đổi bảo trì:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi máy chủ khi chuyển trạng thái bảo trì: " + error.message,
    });
  }
};

/**
 * 8. HỆ THỐNG TỰ CẬP NHẬT KHI CHECK-IN (POST /api/cages/:id/check-in)
 * Tự động chuyển chuồng sang occupied khi tiếp nhận thú cưng
 */
const checkIn = async (req, res) => {
  try {
    const { id } = req.params;
    const { petId, petName, checkOutDate } = req.body;
    const isObjectId = mongoose.Types.ObjectId.isValid(id);

    const cage = await Cage.findOne({
      $or: [
        { _id: isObjectId ? id : null },
        { cageCode: String(id).trim().toUpperCase() },
      ],
      isDeleted: false,
    });

    if (!cage) {
      return res.status(404).json({
        success: false,
        message: `Không tìm thấy chuồng với ID hoặc mã: ${id}`,
      });
    }

    if (cage.status !== "available") {
      return res.status(400).json({
        success: false,
        message: `Chuồng [${cage.cageCode}] hiện không khả dụng (Trạng thái hiện tại: ${cage.status}). Vui lòng chọn chuồng trống!`,
      });
    }

    await cage.checkIn(petId, petName, checkOutDate);

    return res.status(200).json({
      success: true,
      message: `Hệ thống đã Check-in và tự động chuyển chuồng [${cage.cageCode}] sang 'occupied'!`,
      cage,
    });
  } catch (error) {
    console.error("Lỗi Check-in chuồng:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi khi Check-in chuồng: " + error.message,
    });
  }
};

/**
 * 9. HỆ THỐNG TỰ CẬP NHẬT KHI CHECK-OUT (POST /api/cages/:id/check-out)
 * Tự động chuyển chuồng sang available khi trả thú cưng
 */
const checkOut = async (req, res) => {
  try {
    const { id } = req.params;
    const isObjectId = mongoose.Types.ObjectId.isValid(id);

    const cage = await Cage.findOne({
      $or: [
        { _id: isObjectId ? id : null },
        { cageCode: String(id).trim().toUpperCase() },
      ],
      isDeleted: false,
    });

    if (!cage) {
      return res.status(404).json({
        success: false,
        message: `Không tìm thấy chuồng với ID hoặc mã: ${id}`,
      });
    }

    if (cage.status !== "occupied") {
      return res.status(400).json({
        success: false,
        message: `Chuồng [${cage.cageCode}] không ở trạng thái 'occupied' (hiện tại: ${cage.status}), không cần Check-out!`,
      });
    }

    await cage.checkOut();

    return res.status(200).json({
      success: true,
      message: `Hệ thống đã Check-out và tự động chuyển chuồng [${cage.cageCode}] sang 'available'!`,
      cage,
    });
  } catch (error) {
    console.error("Lỗi Check-out chuồng:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi khi Check-out chuồng: " + error.message,
    });
  }
};

module.exports = {
  getCages,
  getCageKPIs,
  getCageById,
  createCage,
  updateCage,
  deleteCage,
  toggleMaintenance,
  checkIn,
  checkOut,
};