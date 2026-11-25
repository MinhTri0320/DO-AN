const mongoose = require("mongoose");
const Grooming = require("../models/grooming");
const { getCallerInfo } = require("./invoicesC");

function normalizeDateISO(dateStr) {
  if (!dateStr) return "";
  const s = String(dateStr).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
    const parts = s.split("/");
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  const d = new Date(s);
  return !isNaN(d.getTime()) ? d.toISOString().slice(0, 10) : s;
}

// 1. Tạo mới lịch chăm sóc Grooming (POST /api/grooming)
const createGrooming = async (req, res) => {
  try {
    const body = req.body || {};
    const {
      customerId,
      petId,
      serviceName,
      price,
      date,
      startTime,
      duration,
      note,
      id_bac_sy,
      groomerName,
      skipPastCheck,
    } = body;

    if (!customerId || !petId || !serviceName || !date || !startTime) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng nhập đầy đủ: Khách hàng, thú cưng, tên dịch vụ, ngày và giờ bắt đầu!",
      });
    }

    // Gọi hàm nghiệp vụ cốt lõi createSchedule trong Model (đã kiểm tra thú cưng thuộc khách, chặn quá khứ, chặn trùng giờ theo bác sĩ)
    const newGrooming = await Grooming.createSchedule({
      customerId,
      petId,
      serviceName,
      price: price !== undefined && price !== "" ? Number(price) : 0,
      date,
      startTime,
      duration: duration !== undefined && duration !== "" ? Number(duration) : 45,
      note: note || "",
      id_bac_sy: id_bac_sy || null,
      groomerName: groomerName || "Kỹ thuật viên Grooming",
      skipPastCheck: Boolean(skipPastCheck),
    });

    return res.status(201).json({
      success: true,
      message: "Tạo lịch chăm sóc grooming thành công!",
      grooming: newGrooming,
    });
  } catch (error) {
    console.error("Lỗi tạo lịch grooming:", error.message);
    return res.status(400).json({
      success: false,
      message: error.message || "Không thể tạo lịch chăm sóc grooming.",
    });
  }
};

// 2. Lấy danh sách lịch grooming theo ngày hoặc khoảng ngày kết hợp các bộ lọc (GET /api/grooming)
const getGroomings = async (req, res) => {
  try {
    const { date, fromDate, toDate, startDate, endDate, customerId, petId, status, id_bac_sy } = req.query;
    const caller = await getCallerInfo(req);

    const from = fromDate || startDate;
    const to = toDate || endDate;

    const filter = { isDeleted: false };

    if (from && to) {
      filter.dateISO = { $gte: normalizeDateISO(from), $lte: normalizeDateISO(to) };
    } else if (from) {
      filter.dateISO = { $gte: normalizeDateISO(from) };
    } else if (to) {
      filter.dateISO = { $lte: normalizeDateISO(to) };
    } else if (date) {
      filter.dateISO = normalizeDateISO(date);
    }

    if (status) filter.status = status;
    if (id_bac_sy) filter.id_bac_sy = id_bac_sy;

    // Nếu caller là khách hàng (role_id === 4) thì ép chỉ xem lịch của chính mình
    if (caller && caller.role_id === 4) {
      filter.customerId = caller.id;
    } else if (customerId && mongoose.Types.ObjectId.isValid(customerId)) {
      filter.customerId = customerId;
    }

    if (petId && mongoose.Types.ObjectId.isValid(petId)) {
      filter.petId = petId;
    }

    const groomings = await Grooming.find(filter)
      .populate("customerId", "name phone")
      .populate("petId", "name species breed weight avatar")
      .sort({ dateISO: 1, startMinutes: 1, startTime: 1 })
      .lean();

    // Nếu ngày đó không có lịch hẹn -> Trả về thông báo "Chưa có lịch hẹn" theo đúng yêu cầu đề bài
    if (groomings.length === 0) {
      return res.status(200).json({
        success: true,
        count: 0,
        groomings: [],
        message: "Chưa có lịch hẹn",
      });
    }

    return res.status(200).json({
      success: true,
      count: groomings.length,
      groomings,
      message: "Lấy danh sách lịch chăm sóc thành công.",
    });
  } catch (error) {
    console.error("Lỗi lấy danh sách grooming:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi máy chủ khi lấy danh sách lịch grooming.",
    });
  }
};

// 3. Xem chi tiết lịch grooming theo ID hoặc groomingCode (GET /api/grooming/:id)
const getGroomingById = async (req, res) => {
  try {
    const { id } = req.params;
    const grooming = await Grooming.findOne({
      $or: [
        { _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null },
        { groomingCode: id },
      ],
      isDeleted: false,
    })
      .populate("customerId", "name phone")
      .populate("petId", "name species breed")
      .lean();

    if (!grooming) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy thông tin lịch chăm sóc grooming.",
      });
    }

    return res.status(200).json({
      success: true,
      grooming,
    });
  } catch (error) {
    console.error("Lỗi lấy chi tiết grooming:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi máy chủ khi lấy chi tiết lịch grooming.",
    });
  }
};

// 4. Chuyển đổi trạng thái đúng thứ tự (PATCH /api/grooming/:id/status)
// pending -> in_progress -> completed, hoặc -> cancelled. KHÔNG CHO CHUYỂN NGƯỢC
const changeStatus = async (req, res) => {
  try {
    const caller = await getCallerInfo(req);
    if (caller && caller.role_id === 4) {
      return res.status(403).json({
        success: false,
        message: "Chỉ nhân viên mới có quyền cập nhật trạng thái dịch vụ.",
      });
    }

    const { id } = req.params;
    const body = req.body || {};
    const { status: newStatus } = body;

    if (!newStatus) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng cung cấp trạng thái mới (newStatus).",
      });
    }

    const grooming = await Grooming.findOne({
      $or: [
        { _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null },
        { groomingCode: id },
      ],
      isDeleted: false,
    });

    if (!grooming) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy lịch chăm sóc cần cập nhật trạng thái.",
      });
    }

    // Gọi hàm method changeStatus trong Model để kiểm tra thứ tự chuyển trạng thái
    await grooming.changeStatus(newStatus);

    return res.status(200).json({
      success: true,
      message: `Đã chuyển trạng thái lịch [${grooming.groomingCode}] sang: "${newStatus}" thành công!`,
      grooming,
    });
  } catch (error) {
    console.error("Lỗi chuyển trạng thái grooming:", error.message);
    return res.status(400).json({
      success: false,
      message: error.message || "Không thể chuyển trạng thái lịch grooming.",
    });
  }
};

// 5. Hủy lịch grooming (PATCH /api/grooming/:id/cancel)
// Lịch cancelled không còn bị tính vào việc kiểm tra trùng giờ
const cancelGrooming = async (req, res) => {
  try {
    const caller = await getCallerInfo(req);
    const { id } = req.params;
    const grooming = await Grooming.findOne({
      $or: [
        { _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null },
        { groomingCode: id },
      ],
      isDeleted: false,
    });

    if (!grooming) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy lịch chăm sóc để hủy.",
      });
    }

    if (caller && caller.role_id === 4 && String(grooming.customerId) !== caller.id) {
      return res.status(403).json({
        success: false,
        message: "Bạn chỉ có quyền hủy lịch chăm sóc của chính mình.",
      });
    }

    if (grooming.status === "completed") {
      return res.status(400).json({
        success: false,
        message: "Lịch hẹn đã hoàn thành (completed) không thể hủy!",
      });
    }

    await grooming.changeStatus("cancelled");

    return res.status(200).json({
      success: true,
      message: `Đã hủy lịch hẹn [${grooming.groomingCode}] thành công. Khung giờ này đã được giải phóng.`,
      grooming,
    });
  } catch (error) {
    console.error("Lỗi hủy lịch grooming:", error.message);
    return res.status(400).json({
      success: false,
      message: error.message || "Không thể hủy lịch grooming.",
    });
  }
};

// 6. Lấy danh sách khách hàng và thú cưng để phục vụ Form đặt lịch Grooming (GET /api/grooming-meta/customers)
const getGroomingCustomers = async (req, res) => {
  try {
    const Pet = require("../models/pet");
    const User = require("../models/user");
    const caller = await getCallerInfo(req);

    // Nếu caller là khách hàng (role_id === 4), chỉ trả thông tin + thú cưng của chính khách đó
    if (caller && caller.role_id === 4) {
      const [user, uPets] = await Promise.all([
        User.findById(caller.id).select("name fullName username phone email").lean(),
        Pet.find({ ownerId: caller.id }).lean(),
      ]);

      const customers = user
        ? [
            {
              id: String(user._id),
              name: user.name || user.fullName || user.username || "Khách hàng",
              phone: user.phone || "",
              email: user.email || "",
              pets: uPets.map((p) => ({
                id: String(p._id),
                name: p.name,
                species: p.species || "Chó",
                breed: p.breed || "",
                weight: p.weight || "",
              })),
            },
          ]
        : [];

      return res.status(200).json({
        success: true,
        customers,
      });
    }

    const pets = await Pet.find({}).lean();
    const userIds = [
      ...new Set(
        pets
          .map((p) => String(p.ownerId || ""))
          .filter((id) => mongoose.Types.ObjectId.isValid(id))
      ),
    ];

    const users = await User.find({
      isDeleted: { $ne: true },
      $or: [{ _id: { $in: userIds } }, { role_id: 4 }, { role: "pet_owner" }],
    })
      .select("name fullName username phone email")
      .lean();

    const customers = users.map((u) => {
      const uPets = pets
        .filter((p) => String(p.ownerId) === String(u._id))
        .map((p) => ({
          id: String(p._id),
          name: p.name,
          species: p.species || "Chó",
          breed: p.breed || "",
          weight: p.weight || "",
        }));
      return {
        id: String(u._id),
        name: u.name || u.fullName || u.username || "Khách hàng",
        phone: u.phone || "",
        email: u.email || "",
        pets: uPets,
      };
    });

    return res.status(200).json({
      success: true,
      customers,
    });
  } catch (error) {
    console.error("Lỗi lấy danh sách khách hàng grooming:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi máy chủ khi lấy danh sách khách hàng.",
    });
  }
};

module.exports = {
  createGrooming,
  getGroomings,
  getGroomingById,
  changeStatus,
  cancelGrooming,
  getGroomingCustomers,
};
