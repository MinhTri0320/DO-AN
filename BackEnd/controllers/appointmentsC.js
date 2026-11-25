const crypto = require("crypto");
const mongoose = require("mongoose");
const Appointment = require("../models/appointment");
const User = require("../models/user");

const ROLE_MAP = {
  admin: 1,
  doctor: 2,
  receptionist: 3,
  pet_owner: 4,
};

const getVietnamNow = () => {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    hourCycle: "h23",
  });
  const parts = {};
  for (const part of formatter.formatToParts(now)) {
    if (part.type !== "literal") parts[part.type] = part.value;
  }
  const hour = Number(parts.hour) % 24;
  const minute = Number(parts.minute);
  return {
    todayVN: `${parts.year}-${parts.month}-${parts.day}`,
    nowMinutesVN: hour * 60 + minute,
  };
};

const isDate = (value) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const parsed = new Date(`${value}T00:00:00Z`);

  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
};

const isClinicTime = (value) => {
  if (
    typeof value !== "string" ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)
  ) {
    return false;
  }

  const [hours, minutes] = value.split(":").map(Number);
  const totalMinutes = hours * 60 + minutes;

  return (
    (totalMinutes >= 8 * 60 + 30 && totalMinutes <= 11 * 60 + 30) ||
    (totalMinutes >= 13 * 60 + 30 && totalMinutes <= 19 * 60 + 30)
  );
};

const isText = (value, maxLength) =>
  typeof value === "string" &&
  value.trim().length > 0 &&
  value.trim().length <= maxLength;


/* ============================================================
   1. BOOKING - ĐẶT LỊCH
   POST /api/appointments
   ============================================================ */

const create = async (req, res) => {
  const data = req.body || {};

  const requiredFields = [
    ["serviceId", 50],
    ["serviceName", 120],
    ["petName", 100],
    ["ownerName", 120],
    ["ownerPhone", 20],
  ];

  if (
    requiredFields.some(([field, max]) => !isText(data[field], max)) ||
    !isDate(data.dateISO) ||
    !isClinicTime(data.time) ||
    (data.notes !== undefined &&
      (typeof data.notes !== "string" || data.notes.length > 1000)) ||
    (data.userId !== undefined &&
      (typeof data.userId !== "string" || data.userId.length > 100)) ||
    (data.userEmail !== undefined &&
      (typeof data.userEmail !== "string" ||
        data.userEmail.length > 254))
  ) {
    return res.status(400).json({
      message: "Thông tin đặt lịch không hợp lệ.",
    });
  }

  // Không cho đặt lịch vào ngày/giờ trong quá khứ theo giờ Việt Nam (UTC+7)
  const { todayVN, nowMinutesVN } = getVietnamNow();
  if (data.dateISO < todayVN) {
    return res.status(400).json({
      message: "Không thể đặt lịch vào ngày trong quá khứ.",
    });
  }
  if (data.dateISO === todayVN) {
    const [slotHour, slotMinute] = data.time.split(":").map(Number);
    const slotMinutes = slotHour * 60 + slotMinute;
    if (slotMinutes <= nowMinutesVN) {
      return res.status(400).json({
        message: "Khung giờ này đã trôi qua. Vui lòng chọn khung giờ khác.",
      });
    }
  }

  const bookingCode = `PC-${data.dateISO.replaceAll("-", "")}-${crypto
    .randomBytes(8)
    .toString("hex")
    .toUpperCase()}`;

  try {
    const appointment = await Appointment.create({
      bookingCode,
      userId: data.userId,
      userEmail: data.userEmail,

      serviceId: data.serviceId.trim(),
      serviceName: data.serviceName.trim(),
      serviceIcon: data.serviceIcon,

      petName: data.petName.trim(),
      petSpecies: data.petSpecies,
      petBreed: data.petBreed,
      petAvatar: data.petAvatar,

      date: data.dateISO.split("-").reverse().join("/"),
      dateISO: data.dateISO,
      time: data.time,

      ownerName: data.ownerName.trim(),
      ownerPhone: data.ownerPhone.trim(),

      notes: data.notes,
      location: data.location,
      feeDisplay: data.feeDisplay,
    });

    return res.status(201).json({
      appointment,
    });
  } catch (error) {
    if (
      error.code === 11000 &&
      error.keyPattern?.dateISO &&
      error.keyPattern?.time
    ) {
      return res.status(409).json({
        message: "Khung giờ đã được đặt trước.",
      });
    }

    console.error("Lỗi lưu lịch hẹn:", error);

    return res.status(500).json({
      message: "Không thể đặt lịch lúc này.",
    });
  }
};


/* ============================================================
   2. LIST - LẤY DANH SÁCH LỊCH HẸN CỦA NGƯỜI DÙNG
   GET /api/appointments
   ============================================================ */

const list = async (req, res) => {
  try {
    const {
      userId,
      userEmail,
      status,
      tab,
      page,
      limit,
    } = req.query;

    const result = await Appointment.listByUser(
      {
        userId,
        userEmail,
      },
      {
        status,
        tab,
        page,
        limit,
      }
    );

    return res.status(200).json({
      appointments: result.items,
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    });
  } catch (error) {
    console.error("Lỗi lấy danh sách lịch hẹn:", error);

    return res.status(error.status || 500).json({
      message:
        error.message || "Không thể lấy danh sách lịch hẹn.",
    });
  }
};


/* ============================================================
   3. LIST BOOKED SLOTS - LẤY CÁC GIỜ ĐÃ ĐƯỢC ĐẶT
   GET /api/appointments/slots?date=YYYY-MM-DD
   ============================================================ */

const listBookedSlots = async (req, res) => {
  const { date } = req.query;

  if (!isDate(date)) {
    return res.status(400).json({
      message: "Ngày cần kiểm tra không hợp lệ.",
    });
  }

  try {
    const appointments = await Appointment.find({
      dateISO: date,
      slotReserved: true,
    })
      .select("time -_id")
      .lean();

    return res.json({
      bookedTimes: appointments.map(({ time }) => time),
    });
  } catch (error) {
    console.error("Lỗi tải khung giờ đã đặt:", error);

    return res.status(500).json({
      message: "Không thể tải khung giờ lúc này.",
    });
  }
};


/* ============================================================
   4. CANCEL - HỦY LỊCH
   PATCH /api/appointments/:bookingCode/cancel
   ============================================================ */

const cancel = async (req, res) => {
  try {
    const bookingCode = req.params.bookingCode;
    const body = req.body || {};

    const lookupQuery = mongoose.Types.ObjectId.isValid(bookingCode)
      ? { $or: [{ bookingCode }, { _id: bookingCode }] }
      : { bookingCode };

    const existing = await Appointment.findOne(lookupQuery);

    if (!existing) {
      return res.status(404).json({
        message: "Không tìm thấy lịch hẹn đang hoạt động.",
      });
    }

    // Kiểm tra quyền sở hữu nếu có x-user-id hoặc body.userId (nhân viên role_id 1/2/3 được phép hủy)
    const rawCallerId =
      req.headers["x-user-id"] ||
      req.headers["user-id"] ||
      body.userId;
    const callerId = typeof rawCallerId === "string" ? rawCallerId.trim() : "";

    let isStaff = false;
    if (callerId) {
      if (mongoose.Types.ObjectId.isValid(callerId)) {
        const caller = await User.findOne({
          _id: callerId,
          isDeleted: { $ne: true },
        }).lean();
        if (caller) {
          const roleId = caller.role_id || ROLE_MAP[caller.role] || 4;
          if ([1, 2, 3].includes(roleId)) {
            isStaff = true;
          }
        }
      }

      if (!isStaff && existing.userId && String(existing.userId) !== String(callerId)) {
        return res.status(403).json({
          message: "Bạn chỉ có thể hủy lịch hẹn của chính mình",
        });
      }
    }

    // Chặn hủy lịch đã hoàn thành hoặc đã hủy trước đó
    const currentStatus = String(existing.status || "").trim();
    if (["Hoàn thành", "completed", "Đã hủy"].includes(currentStatus)) {
      const msg =
        currentStatus === "Đã hủy"
          ? "Lịch hẹn này đã được hủy trước đó."
          : "Không thể hủy lịch hẹn đã hoàn thành.";
      return res.status(400).json({ message: msg });
    }

    const rawReason =
      body.reason || body.cancelReason || "Khách hàng hủy lịch";
    const cancelReason =
      String(rawReason).trim().slice(0, 500) || "Khách hàng hủy lịch";

    // models/appointment.js quy định enum cancelledBy: ["customer", "staff", "system"]
    const cancelledBy = isStaff ? "staff" : "customer";

    const appointment = await Appointment.findOneAndUpdate(
      {
        _id: existing._id,
        status: { $nin: ["Hoàn thành", "completed", "Đã hủy"] },
      },
      {
        $set: {
          status: "Đã hủy",
          slotReserved: false,
          cancelledAt: new Date(),
          cancelReason,
          cancelledBy,
        },
      },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!appointment) {
      return res.status(400).json({
        message: "Lịch hẹn này không thể hủy ở trạng thái hiện tại.",
      });
    }

    return res.status(200).json({
      appointment,
    });
  } catch (error) {
    console.error("Lỗi hủy lịch hẹn:", error);

    return res.status(500).json({
      message: "Không thể hủy lịch hẹn lúc này.",
    });
  }
};


module.exports = {
  create,
  list,
  listBookedSlots,
  cancel,
};