const mongoose = require("mongoose");

/* =====================================================================
 *  PHẦN 1: BOOKING (Đặt lịch)
 *  - Cấu trúc dữ liệu lịch hẹn
 *  - Chống trùng khung giờ
 * ===================================================================== */
const appointmentSchema = new mongoose.Schema(
  {
    bookingCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      maxlength: 40,
    },
    userId: { type: String, trim: true, maxlength: 100 },
    userEmail: { type: String, trim: true, lowercase: true, maxlength: 254 },
    serviceId: { type: String, required: true, trim: true, maxlength: 50 },
    serviceName: { type: String, required: true, trim: true, maxlength: 120 },
    serviceIcon: { type: String, trim: true, maxlength: 20 },
    petName: { type: String, required: true, trim: true, maxlength: 100 },
    petSpecies: { type: String, trim: true, maxlength: 60 },
    petBreed: { type: String, trim: true, maxlength: 100 },
    petAvatar: { type: String, trim: true, maxlength: 500 },
    date: { type: String, required: true, trim: true, maxlength: 10 },
    dateISO: { type: String, required: true, trim: true, maxlength: 10 },
    time: { type: String, required: true, trim: true, maxlength: 5 },
    ownerName: { type: String, required: true, trim: true, maxlength: 120 },
    ownerPhone: { type: String, required: true, trim: true, maxlength: 20 },
    notes: { type: String, trim: true, maxlength: 1000 },
    location: { type: String, trim: true, maxlength: 250 },
    status: {
      type: String,
      enum: ["Chờ xác nhận", "Đã xác nhận", "Đã hủy"],
      default: "Chờ xác nhận",
    },
    feeDisplay: { type: String, trim: true, maxlength: 60 },
    slotReserved: { type: Boolean, default: true },

    /* ---------- CANCEL: thông tin hủy lịch ---------- */
    cancelledAt: { type: Date, default: null },
    cancelReason: { type: String, trim: true, maxlength: 500 },
    cancelledBy: {
      type: String,
      enum: ["customer", "staff", "system"],
    },
  },
  { timestamps: true }
);

// BOOKING: mỗi khung giờ chỉ có 1 lịch đang giữ chỗ
appointmentSchema.index(
  { dateISO: 1, time: 1 },
  { unique: true, partialFilterExpression: { slotReserved: true } }
);

/* =====================================================================
 *  HÀM DÙNG CHUNG (cho LIST và CANCEL)
 * ===================================================================== */
const todayISO = () =>
  new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Ho_Chi_Minh" });

const ownerFilter = (user = {}) => {
  const or = [];
  if (user.userId) or.push({ userId: String(user.userId) });
  if (user.userEmail) or.push({ userEmail: String(user.userEmail).toLowerCase() });
  if (!or.length) {
    const err = new Error("Vui lòng đăng nhập tài khoản");
    err.status = 401;
    throw err;
  }
  return { $or: or };
};
/* =====================================================================
 *  PHẦN 2: LIST (Danh sách lịch hẹn)
 *  - listByUser: lấy danh sách có lọc, phân trang
 *  - statsByUser: thống kê số lượng theo trạng thái
 * ===================================================================== */
appointmentSchema.statics.listByUser = async function (user, options = {}) {
  const { status, tab, page = 1, limit = 10 } = options;
  const filter = { ...ownerFilter(user) };

  if (status) filter.status = status;
  if (tab === "upcoming") {
    filter.dateISO = { $gte: todayISO() };
    filter.status = status || { $ne: "Đã hủy" };
  } else if (tab === "past") {
    filter.dateISO = { $lt: todayISO() };
  }

  const p = Math.max(parseInt(page, 10) || 1, 1);
  const l = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 50);
  const dir = tab === "past" ? -1 : 1;

  const [rows, total] = await Promise.all([
    this.find(filter)
      .sort({ dateISO: dir, time: dir })
      .skip((p - 1) * l)
      .limit(l)
      .lean(),
    this.countDocuments(filter),
  ]);

  const today = todayISO();
  const items = rows.map((a) => ({
    ...a,
    canCancel: a.status !== "Đã hủy" && a.dateISO >= today,
  }));

  return { items, total, page: p, limit: l, totalPages: Math.ceil(total / l) };
};

appointmentSchema.statics.statsByUser = async function (user) {
  const rows = await this.aggregate([
    { $match: ownerFilter(user) },
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]);
  const stats = { total: 0, "Chờ xác nhận": 0, "Đã xác nhận": 0, "Đã hủy": 0 };
  rows.forEach((r) => {
    stats[r._id] = r.count;
    stats.total += r.count;
  });
  return stats;
};

/* =====================================================================
 *  PHẦN 3: CANCEL (Hủy lịch hẹn)
 *  - cancelByUser: đổi trạng thái sang "Đã hủy", lưu thông tin hủy,
 *    trả lại khung giờ (slotReserved = false)
 * ===================================================================== */
appointmentSchema.statics.cancelByUser = async function (
  bookingCode,
  user,
  reason = "",
  cancelledBy = "customer"
) {
  return this.findOneAndUpdate(
    {
      bookingCode,
      ...ownerFilter(user),
      status: { $ne: "Đã hủy" },
      dateISO: { $gte: todayISO() },
    },
    {
      $set: {
        status: "Đã hủy",
        slotReserved: false,
        cancelledAt: new Date(),
        cancelReason: String(reason || "").trim().slice(0, 500),
        cancelledBy,
      },
    },
    { new: true, runValidators: true }
  );
};

module.exports = mongoose.model("Appointment", appointmentSchema, "appointments");