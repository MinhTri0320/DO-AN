const mongoose = require("mongoose");
const Boarding = require("../models/boarding");
const Cage = require("../models/cage");
const Pet = require("../models/pet");
const User = require("../models/user");

function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseEndDate(dateVal) {
  if (typeof dateVal === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateVal.trim())) {
    const d = new Date(dateVal.trim());
    d.setUTCHours(23, 59, 59, 999);
    return d;
  }
  return new Date(dateVal);
}

function attachBoardingAliases(b) {
  if (!b) return b;
  return {
    ...b,
    id: b.id || (b._id ? String(b._id) : ""),
    totalFee: b.totalAmount,
    checkoutHealthNote: b.checkOutHealthNote,
    code: b.boardingCode,
    pricePerDay: b.dailyPrice,
  };
}

function attachCageAliases(c) {
  if (!c) return c;
  const s = (c.size || "").toLowerCase();
  let sizeLabel = "Vừa (5kg - 15kg)";
  if (s === "nhỏ" || s === "small") sizeLabel = "Nhỏ (Dưới 5kg)";
  else if (s === "lớn" || s === "large") sizeLabel = "Lớn (Trên 15kg)";
  return {
    ...c,
    id: c.id || (c._id ? String(c._id) : ""),
    code: c.cageCode,
    price: c.pricePerDay,
    dailyPrice: c.pricePerDay,
    description: c.notes,
    sizeLabel,
  };
}

/**
 * 1. CHECK-IN THÚ CƯNG VÀO LƯU CHUỒNG (POST /api/boardings/check-in)
 * Nghiệp vụ đáp ứng Sprint 4 - Task 2: Pet Check-in
 * - Chọn khách hàng, thú cưng, chuồng trống phù hợp
 * - Ngày nhận, ngày dự kiến trả (ngày trả phải sau ngày nhận)
 * - Ghi lại đồ mang theo (belongings) và tình trạng sức khỏe lúc nhận (healthNote)
 * - RÀNG BUỘC 1: Thú cưng phải thuộc về khách hàng đã chọn
 * - RÀNG BUỘC 2: Chuồng phải có trạng thái "available"
 * - RÀNG BUỘC 3: Một thú cưng không thể check-in khi vẫn đang lưu ở chuồng khác
 * - RÀNG BUỘC 4: Ngày dự kiến trả phải sau ngày nhận
 * - Check-in thành công -> tạo lượt lưu chuồng "checked_in" và tự động chuyển chuồng sang "occupied"
 * - Chuồng đã có người, thú cưng đang lưu hoặc dữ liệu sai đều bị từ chối kèm thông báo rõ ràng
 */
const checkIn = async (req, res) => {
  try {
    const body = req.body || {};
    const {
      customerId,
      petId,
      cageId,
      checkInDate,
      expectedCheckOutDate,
      belongings,
      healthNote,
      notes,
    } = body;

    // 1. Kiểm tra các trường thông tin bắt buộc
    if (!customerId) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng chọn khách hàng gửi thú cưng!",
      });
    }

    if (!petId) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng chọn thú cưng tiếp nhận!",
      });
    }

    if (!cageId) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng chọn chuồng trống để lưu trú!",
      });
    }

    if (!expectedCheckOutDate) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng chọn ngày dự kiến trả thú cưng!",
      });
    }

    // 2. Kiểm tra ngày nhận & ngày dự kiến trả
    const checkIn = checkInDate ? new Date(checkInDate) : new Date();
    const checkOut = new Date(expectedCheckOutDate);

    if (isNaN(checkIn.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Ngày nhận (checkInDate) không hợp lệ!",
      });
    }

    if (isNaN(checkOut.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Ngày dự kiến trả (expectedCheckOutDate) không hợp lệ!",
      });
    }

    if (checkOut <= checkIn) {
      return res.status(400).json({
        success: false,
        message: "Ngày dự kiến trả phòng phải sau ngày nhận phòng ít nhất 1 ngày!",
      });
    }

    // 3. Gọi hàm nghiệp vụ tĩnh performCheckIn trong Boarding Model
    const newBoarding = await Boarding.performCheckIn({
      customerId,
      petId,
      cageId,
      checkInDate: checkIn,
      expectedCheckOutDate: checkOut,
      belongings: String(belongings || "Không có đồ đạc mang theo").trim(),
      healthNote: String(healthNote || "Bình thường, tinh thần tốt").trim(),
      notes: String(notes || "").trim(),
    });

    return res.status(201).json({
      success: true,
      message: `Check-in thành công cho bé "${newBoarding.petName}" vào chuồng [${newBoarding.cageCode}]! Chuồng đã tự động chuyển sang trạng thái Đang dùng (occupied).`,
      boarding: newBoarding,
    });
  } catch (error) {
    console.error("Lỗi khi thực hiện Check-in thú cưng:", error.message);
    return res.status(400).json({
      success: false,
      message: error.message || "Lỗi máy chủ khi tiếp nhận thú cưng vào lưu chuồng.",
    });
  }
};

/**
 * 2. LẤY DANH SÁCH THÚ CƯNG ĐANG LƯU CHUỒNG (GET /api/boardings/active)
 */
const getActiveBoardings = async (req, res) => {
  try {
    const activeList = await Boarding.findActiveBoardings();

    return res.status(200).json({
      success: true,
      count: activeList.length,
      boardings: activeList,
    });
  } catch (error) {
    console.error("Lỗi lấy danh sách thú cưng đang lưu chuồng:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi máy chủ khi lấy danh sách thú cưng đang lưu: " + error.message,
    });
  }
};

/**
 * 3. LẤY DANH SÁCH CHUỒNG TRỐNG CHO CHECK-IN (GET /api/boardings/available-cages)
 */
const getAvailableCages = async (req, res) => {
  try {
    const { size } = req.query;
    const filter = { status: "available", isDeleted: false };

    if (size && size !== "all") {
      const s = String(size).trim().toLowerCase();
      if (s === "small" || s === "nhỏ") {
        filter.size = { $in: ["nhỏ", "small", "Small"] };
      } else if (s === "large" || s === "lớn") {
        filter.size = { $in: ["lớn", "large", "Large"] };
      } else if (s === "medium" || s === "vừa") {
        filter.size = { $in: ["vừa", "medium", "Medium"] };
      }
    }

    const cages = await Cage.find(filter)
      .sort({ pricePerDay: 1, cageCode: 1 })
      .lean();

    const mappedCages = cages.map(attachCageAliases);

    return res.status(200).json({
      success: true,
      count: mappedCages.length,
      cages: mappedCages,
    });
  } catch (error) {
    console.error("Lỗi lấy danh sách chuồng trống:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi máy chủ khi lấy chuồng trống: " + error.message,
    });
  }
};

/**
 * 4. KIỂM TRA THÚ CƯNG CÓ ĐANG LƯU CHUỒNG KHÔNG (GET /api/boardings/check-pet/:petId)
 */
const checkPetBoarding = async (req, res) => {
  try {
    const { petId } = req.params;
    const isObjectId = mongoose.Types.ObjectId.isValid(petId);
    const petObjId = isObjectId ? new mongoose.Types.ObjectId(petId) : null;

    const activeBoarding = await Boarding.findOne({
      $or: [
        { petId: petObjId },
        { petId: String(petId) },
      ],
      status: "checked_in",
      isDeleted: false,
    }).lean();

    return res.status(200).json({
      success: true,
      isBoarding: Boolean(activeBoarding),
      activeBoarding: activeBoarding || null,
    });
  } catch (error) {
    console.error("Lỗi kiểm tra thú cưng lưu chuồng:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi máy chủ khi kiểm tra thú cưng: " + error.message,
    });
  }
};

/**
 * 5. LẤY CHI TIẾT LƯỢT LƯU CHUỒNG (GET /api/boardings/:id)
 */
const getBoardingById = async (req, res) => {
  try {
    const { id } = req.params;
    const isObjectId = mongoose.Types.ObjectId.isValid(id);
    const objId = isObjectId ? new mongoose.Types.ObjectId(id) : null;

    const boarding = await Boarding.findOne({
      $or: [
        { _id: objId },
        { boardingCode: String(id).trim().toUpperCase() },
      ],
      isDeleted: false,
    })
      .populate("customerId", "name phone")
      .populate("petId", "name species breed weight")
      .populate("cageId", "cageCode size pricePerDay status")
      .lean();

    if (!boarding) {
      return res.status(404).json({
        success: false,
        message: `Không tìm thấy lượt lưu chuồng với mã hoặc ID: ${id}`,
      });
    }

    return res.status(200).json({
      success: true,
      boarding: attachBoardingAliases(boarding),
    });
  } catch (error) {
    console.error("Lỗi lấy chi tiết lưu chuồng:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi máy chủ khi lấy chi tiết lưu chuồng: " + error.message,
    });
  }
};

/**
 * 6. CHECK-OUT TRẢ THÚ CƯNG (POST /api/boardings/:id/check-out & POST /api/boardings/check-out)
 * Ràng buộc Sprint 4 - Task 3: Pet Check-out
 * - Nhân viên chọn lượt đang checked_in
 * - Hệ thống ghi ngày trả thực tế, tình trạng sức khỏe lúc trả (healthNote khi trả)
 * - Tự tính số ngày lưu cùng tổng tiền (số ngày × giá chuồng, tối thiểu 1 ngày) để dùng cho hóa đơn
 * - RÀNG BUỘC: Chỉ lượt đang checked_in mới check-out được và không check-out hai lần
 * - Check-out thành công thì lượt chuyển sang checked_out và chuồng tự chuyển về available
 */
const checkOut = async (req, res) => {
  try {
    const body = req.body || {};
    const id = req.params.id || body.boardingId || body.id || body.boardingCode;
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng cung cấp mã hoặc ID lượt lưu chuồng cần check-out!",
      });
    }

    const isObjectId = mongoose.Types.ObjectId.isValid(id);
    const objId = isObjectId ? new mongoose.Types.ObjectId(id) : null;

    const boarding = await Boarding.findOne({
      $or: [
        { _id: objId },
        { boardingCode: String(id).trim().toUpperCase() },
      ],
      isDeleted: false,
    });

    if (!boarding) {
      return res.status(404).json({
        success: false,
        message: `Không tìm thấy lượt lưu chuồng với mã hoặc ID: ${id}`,
      });
    }

    // RÀNG BUỘC 1: Chỉ lượt đang checked_in mới check-out được, không check-out hai lần
    if (boarding.status === "checked_out") {
      return res.status(400).json({
        success: false,
        message: `Lượt lưu chuồng [${boarding.boardingCode}] đã được check-out trước đó. Nghiêm cấm check-out lặp hai lần!`,
      });
    }

    if (boarding.status !== "checked_in") {
      return res.status(400).json({
        success: false,
        message: `Không thể check-out: Lượt lưu chuồng [${boarding.boardingCode}] hiện ở trạng thái "${boarding.status}" (không phải "checked_in")!`,
      });
    }

    const {
      actualCheckOutDate,
      checkOutHealthNote,
      checkoutHealthNote,
      notes,
    } = body;

    const finalCheckOutDate = actualCheckOutDate ? new Date(actualCheckOutDate) : new Date();
    if (isNaN(finalCheckOutDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Ngày trả thực tế (actualCheckOutDate) không hợp lệ!",
      });
    }

    const finalHealthNote = String(
      checkOutHealthNote || checkoutHealthNote || "Bé khỏe mạnh, tinh thần hoạt bát khi bàn giao cho chủ nuôi."
    ).trim();

    // Gọi phương thức nghiệp vụ performCheckOut trên document
    await boarding.performCheckOut({
      actualCheckOutDate: finalCheckOutDate,
      checkOutHealthNote: finalHealthNote,
      notes: notes || "",
    });

    return res.status(200).json({
      success: true,
      message: `Check-out thành công cho bé "${boarding.petName}"! Chuồng [${boarding.cageCode}] đã được giải phóng (available).`,
      boarding,
    });
  } catch (error) {
    console.error("Lỗi khi thực hiện Check-out:", error.message);
    return res.status(400).json({
      success: false,
      message: error.message || "Lỗi máy chủ khi thực hiện Check-out.",
    });
  }
};

/**
 * 7. XEM LỊCH SỬ LƯU CHUỒNG (GET /api/boardings/history)
 * Các lượt đã checked_out chính là lịch sử lưu chuồng, có thể lọc theo khách hoặc thú cưng
 */
const getHistory = async (req, res) => {
  try {
    const { customerId, petId, search, fromDate, toDate } = req.query;
    const filter = { status: "checked_out", isDeleted: false };

    // Lọc theo khách hàng
    if (customerId && customerId !== "all") {
      const isObjectId = mongoose.Types.ObjectId.isValid(customerId);
      const custObjId = isObjectId ? new mongoose.Types.ObjectId(customerId) : null;
      filter.$or = [
        { customerId: custObjId },
        { customerId: String(customerId) },
      ];
    }

    // Lọc theo thú cưng
    if (petId && petId !== "all") {
      const isObjectId = mongoose.Types.ObjectId.isValid(petId);
      const petObjId = isObjectId ? new mongoose.Types.ObjectId(petId) : null;
      const petFilter = [
        { petId: petObjId },
        { petId: String(petId) },
      ];
      if (filter.$or) {
        filter.$and = [{ $or: filter.$or }, { $or: petFilter }];
        delete filter.$or;
      } else {
        filter.$or = petFilter;
      }
    }

    // Lọc theo khoảng ngày trả
    if (fromDate || toDate) {
      filter.actualCheckOutDate = {};
      if (fromDate) filter.actualCheckOutDate.$gte = new Date(fromDate);
      if (toDate) filter.actualCheckOutDate.$lte = parseEndDate(toDate);
    }

    // Tìm kiếm theo từ khóa
    if (search && String(search).trim() !== "") {
      const searchRegex = new RegExp(escapeRegex(String(search).trim()), "i");
      const searchConditions = [
        { petName: searchRegex },
        { customerName: searchRegex },
        { customerPhone: searchRegex },
        { cageCode: searchRegex },
        { boardingCode: searchRegex },
      ];
      if (filter.$and) {
        filter.$and.push({ $or: searchConditions });
      } else if (filter.$or) {
        filter.$and = [{ $or: filter.$or }, { $or: searchConditions }];
        delete filter.$or;
      } else {
        filter.$or = searchConditions;
      }
    }

    const history = await Boarding.find(filter)
      .sort({ actualCheckOutDate: -1, updatedAt: -1 })
      .lean();

    const mappedHistory = history.map(attachBoardingAliases);

    return res.status(200).json({
      success: true,
      count: mappedHistory.length,
      history: mappedHistory,
    });
  } catch (error) {
    console.error("Lỗi lấy lịch sử lưu chuồng:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi máy chủ khi lấy lịch sử lưu chuồng: " + error.message,
    });
  }
};

module.exports = {
  checkIn,
  getActiveBoardings,
  getAvailableCages,
  checkPetBoarding,
  getBoardingById,
  checkOut,
  getHistory,
};