const mongoose = require("mongoose");

/* =====================================================================
 *  GROOMING MODEL (Quản lý lịch chăm sóc thú cưng - Grooming Schedule & Status)
 *  Phục vụ Sprint 4 - Task DataBase (Trần Minh Trí phụ trách)
 *  - Lưu thông tin Grooming: customerId, petId, serviceName, price,
 *    date, startTime, duration, note, status (Trí)
 *  - Truy vấn Grooming: theo ngày, theo khoảng ngày, theo khách,
 *    theo thú cưng, kiểm tra trùng giờ (Trí)
 * ===================================================================== */

// Helper chuyển đổi HH:mm sang phút
function timeToMinutes(timeStr) {
  if (!timeStr) return 0;
  const parts = String(timeStr).split(":");
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  return h * 60 + m;
}

// Helper chuyển đổi phút sang HH:mm
function minutesToTime(minutes) {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// Helper chuẩn hóa giờ bắt đầu về định dạng HH:mm (padStart 2 chữ số cho giờ & phút)
function normalizeTimeHHmm(timeStr) {
  if (!timeStr) return "00:00";
  const parts = String(timeStr).trim().split(":");
  const h = String(parseInt(parts[0], 10) || 0).padStart(2, "0");
  const m = String(parseInt(parts[1], 10) || 0).padStart(2, "0");
  return `${h}:${m}`;
}

// Helper chuẩn hóa ngày YYYY-MM-DD
function normalizeDateISO(dateStr) {
  if (!dateStr) return new Date().toISOString().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
    const parts = dateStr.split("/");
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  const d = new Date(dateStr);
  return !isNaN(d.getTime()) ? d.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
}

const groomingSchema = new mongoose.Schema(
  {
    groomingCode: {
      type: String,
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    // Khách hàng đặt lịch
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Mã khách hàng (customerId) là bắt buộc"],
      index: true,
    },
    customerName: {
      type: String,
      trim: true,
      default: "",
    },
    customerPhone: {
      type: String,
      trim: true,
      default: "",
    },
    // Thú cưng được chăm sóc
    petId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Pet",
      required: [true, "Mã thú cưng (petId) là bắt buộc"],
      index: true,
    },
    petName: {
      type: String,
      trim: true,
      default: "Bé cưng",
    },
    petSpecies: {
      type: String,
      trim: true,
      default: "Chó",
    },
    // Tên dịch vụ (nhập tự do, ví dụ: "Tắm", "Cắt tỉa lông", "Cắt móng", "Grooming toàn diện")
    serviceName: {
      type: String,
      required: [true, "Tên dịch vụ (serviceName) là bắt buộc"],
      trim: true,
    },
    // Giá dịch vụ (không bắt buộc, VNĐ)
    price: {
      type: Number,
      min: [0, "Giá không được âm"],
      default: 0,
    },
    // Ngày hẹn (DD/MM/YYYY hoặc chuỗi ngày hiển thị)
    date: {
      type: String,
      required: [true, "Ngày hẹn (date) là bắt buộc"],
      trim: true,
    },
    // Ngày chuẩn hóa YYYY-MM-DD phục vụ truy vấn & sắp xếp
    dateISO: {
      type: String,
      trim: true,
      index: true,
    },
    // Giờ bắt đầu (định dạng HH:mm, ví dụ "09:00", "14:30")
    startTime: {
      type: String,
      required: [true, "Giờ bắt đầu (startTime) là bắt buộc"],
      trim: true,
    },
    // Thời lượng dự kiến (phút, ví dụ 30, 45, 60, 90)
    duration: {
      type: Number,
      required: [true, "Thời lượng dự kiến (duration) là bắt buộc"],
      min: [1, "Thời lượng tối thiểu là 1 phút"],
      default: 45,
    },
    // Giờ kết thúc dự kiến (HH:mm)
    endTime: {
      type: String,
      trim: true,
    },
    // Số phút tính từ 00:00 phục vụ so sánh trùng giờ và sắp xếp
    startMinutes: {
      type: Number,
      index: true,
    },
    endMinutes: {
      type: Number,
      index: true,
    },
    // Ghi chú dịch vụ (yêu cầu của chủ nuôi)
    note: {
      type: String,
      trim: true,
      default: "",
    },
    // Trạng thái lịch: pending (chờ) -> in_progress (đang làm) -> completed (hoàn thành), ngoài ra có cancelled (đã hủy)
    status: {
      type: String,
      trim: true,
      enum: {
        values: ["pending", "in_progress", "completed", "cancelled"],
        message: "Trạng thái phải là pending, in_progress, completed hoặc cancelled",
      },
      default: "pending",
      index: true,
    },
    // Nhân viên kỹ thuật grooming / Bác sĩ phụ trách
    groomerName: {
      type: String,
      trim: true,
      default: "Nhân viên Grooming PawnCare",
    },
    // Mã bác sĩ / kỹ thuật viên phụ trách (format: bs0xxxx)
    id_bac_sy: {
      type: String,
      trim: true,
      index: true,
    },
    doctorPhone: {
      type: String,
      trim: true,
      index: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Middleware tiền xử lý dữ liệu trước khi lưu
groomingSchema.pre("save", function () {
  // 1. Tự động sinh mã groomingCode nếu chưa có
  if (!this.groomingCode) {
    const randomNum = Math.floor(100 + Math.random() * 900);
    this.groomingCode = `GRM-${new Date().getFullYear()}-${randomNum}`;
  }

  // 2. Chuẩn hóa dateISO
  this.dateISO = normalizeDateISO(this.dateISO || this.date);

  // 3. Tính toán startMinutes, endMinutes và endTime
  if (this.startTime) {
    this.startMinutes = timeToMinutes(this.startTime);
    const dur = this.duration || 45;
    this.endMinutes = this.startMinutes + dur;
    this.endTime = minutesToTime(this.endMinutes);
  }
});

// =====================================================================
//  CÁC PHƯƠNG THỨC LƯU & XỬ LÝ LỊCH GROOMING (DATABASE SAVE / LOGIC - TRÍ)
// =====================================================================

/**
 * Hàm kiểm tra trùng giờ:
 * Hai lịch trùng nhau trên cùng 1 ngày khi:
 * StartA < EndB VÀ StartB < EndA
 * (Lịch đã hủy "cancelled" không bị tính)
 */
groomingSchema.statics.checkOverlap = async function ({
  dateISO,
  startTime,
  duration,
  id_bac_sy = null,
  excludeId = null,
}) {
  const normDate = normalizeDateISO(dateISO);
  const startM = timeToMinutes(startTime);
  const endM = startM + Number(duration);

  const query = {
    dateISO: normDate,
    status: { $ne: "cancelled" },
    isDeleted: false,
    $and: [
      { startMinutes: { $lt: endM } },
      { endMinutes: { $gt: startM } },
    ],
  };

  if (id_bac_sy) {
    query.id_bac_sy = id_bac_sy;
  }

  if (excludeId) {
    query._id = { $ne: excludeId };
  }

  const conflictingBookings = await this.find(query).lean();
  return conflictingBookings;
};

/**
 * Hàm nghiệp vụ cốt lõi: Tạo mới lịch chăm sóc Grooming (Trí)
 * Đáp ứng đầy đủ các ràng buộc:
 * 1. Thú cưng được chọn phải thuộc về khách hàng đã chọn
 * 2. Không cho tạo lịch vào thời điểm trong quá khứ (trừ khi skipPastCheck)
 * 3. Không cho tạo lịch trùng giờ với lịch chưa hủy
 */
groomingSchema.statics.createSchedule = async function ({
  customerId,
  petId,
  serviceName,
  price = 0,
  date,
  startTime,
  duration = 45,
  note = "",
  id_bac_sy = null,
  groomerName = "Kỹ thuật viên Grooming",
  skipPastCheck = false,
}) {
  const Pet = mongoose.model("Pet");
  const User = mongoose.model("User");
  const Doctor = mongoose.models.Doctor || mongoose.model("Doctor");

  // 1. Kiểm tra thú cưng tồn tại & có thuộc khách hàng đã chọn không
  const pet = await Pet.findById(petId).lean();
  if (!pet) {
    throw new Error("Không tìm thấy thông tin thú cưng!");
  }
  if (String(pet.ownerId) !== String(customerId)) {
    throw new Error("Thú cưng được chọn không thuộc về khách hàng đã chọn!");
  }

  // Lấy thông tin khách hàng
  const user = await User.findById(customerId).lean();
  const customerName = user ? (user.name || user.fullName || user.username || "Khách hàng") : "Khách hàng";
  const customerPhone = user ? (user.phone || "") : "";

  const normDateISO = normalizeDateISO(date);
  const paddedStartTime = normalizeTimeHHmm(startTime);

  // 2. Kiểm tra không cho tạo lịch trong quá khứ
  if (!skipPastCheck) {
    const scheduledDateTime = new Date(`${normDateISO}T${paddedStartTime}:00`);
    if (isNaN(scheduledDateTime.getTime())) {
      throw new Error("Ngày hoặc giờ hẹn không hợp lệ!");
    }
    if (scheduledDateTime.getTime() < Date.now()) {
      throw new Error("Không thể đặt lịch hẹn vào thời điểm trong quá khứ!");
    }
  }

  // 3. Kiểm tra danh sách bác sĩ đang hoạt động trong hệ thống
  const activeDoctors = await Doctor.find({ isActive: true }).lean();
  if (!activeDoctors || activeDoctors.length === 0) {
    throw new Error(
      "Hệ thống hiện chưa có bác sĩ nào được phân quyền (role_id = 2). Vui lòng yêu cầu Admin phân quyền tài khoản bác sĩ trước khi tạo lịch!"
    );
  }

  const startM = timeToMinutes(paddedStartTime);
  const endM = startM + Number(duration);
  const endTime = minutesToTime(endM);

  let finalDoctor = null;

  if (id_bac_sy) {
    finalDoctor = activeDoctors.find((d) => d.id_bac_sy === id_bac_sy);
    if (!finalDoctor) {
      throw new Error(`Không tìm thấy bác sĩ có mã [${id_bac_sy}] đang hoạt động trong hệ thống!`);
    }

    const overlap = await this.checkOverlap({
      dateISO: normDateISO,
      startTime: paddedStartTime,
      duration,
      id_bac_sy,
    });

    if (overlap && overlap.length > 0) {
      throw new Error(
        `Bác sĩ ${finalDoctor.name} (${id_bac_sy}) đã có lịch hẹn [${overlap[0].groomingCode}] (${overlap[0].startTime} - ${overlap[0].endTime}) trong khung giờ này!`
      );
    }
  } else {
    // Không chỉ định đích danh bác sĩ: kiểm tra tổng số lịch đang có
    const conflicts = await this.checkOverlap({
      dateISO: normDateISO,
      startTime: paddedStartTime,
      duration,
    });

    if (conflicts.length >= activeDoctors.length) {
      throw new Error(
        `Lịch đã đầy trong khung giờ ${paddedStartTime} - ${endTime} ngày ${date} (tất cả ${activeDoctors.length} bác sĩ đều bận)!`
      );
    }

    // Tự động phân bổ vào bác sĩ còn rảnh trong ca này
    const busyDoctorIds = conflicts.map((c) => c.id_bac_sy).filter(Boolean);
    finalDoctor = activeDoctors.find((d) => !busyDoctorIds.includes(d.id_bac_sy)) || activeDoctors[0];
  }

  const randomNum = Math.floor(100 + Math.random() * 900);
  const groomingCode = `GRM-${new Date().getFullYear()}-${randomNum}`;

  const newGrooming = await this.create({
    groomingCode,
    customerId: user ? user._id : customerId,
    customerName,
    customerPhone,
    petId: pet._id,
    petName: pet.name,
    petSpecies: pet.species || "Chó",
    serviceName,
    price: Number(price) || 0,
    date,
    dateISO: normDateISO,
    startTime: paddedStartTime,
    duration: Number(duration),
    endTime,
    startMinutes: startM,
    endMinutes: endM,
    note,
    status: "pending",
    id_bac_sy: finalDoctor.id_bac_sy,
    doctorPhone: finalDoctor.phone,
    groomerName: finalDoctor.name || groomerName,
  });

  return newGrooming;
};

/**
 * Hàm chuyển đổi trạng thái đúng thứ tự nghiệp vụ:
 * pending -> in_progress -> completed, hoặc -> cancelled
 * KHÔNG CHO CHUYỂN NGƯỢC (ví dụ completed không thể về pending)
 */
groomingSchema.methods.changeStatus = async function (newStatus) {
  const currentStatus = this.status;

  if (currentStatus === newStatus) {
    return this;
  }

  // Định nghĩa các bước chuyển trạng thái hợp lệ
  const validTransitions = {
    pending: ["in_progress", "cancelled"],
    in_progress: ["completed", "cancelled"],
    completed: [], // Đã hoàn thành thì không được chuyển sang trạng thái nào khác
    cancelled: [], // Đã hủy thì không được chuyển sang trạng thái nào khác
  };

  const allowed = validTransitions[currentStatus] || [];
  if (!allowed.includes(newStatus)) {
    throw new Error(
      `Không thể chuyển ngược hoặc sai thứ tự trạng thái từ "${currentStatus}" sang "${newStatus}"! Thứ tự hợp lệ: pending -> in_progress -> completed (hoặc cancelled).`
    );
  }

  this.status = newStatus;
  await this.save();
  return this;
};

// =====================================================================
//  CÁC PHƯƠNG THỨC TRUY VẤN CƠ SỞ DỮ LIỆU (DATABASE QUERY METHODS - TRÍ)
// =====================================================================

/**
 * 1. Truy vấn lịch theo ngày cụ thể (sắp xếp theo giờ tăng dần)
 */
groomingSchema.statics.findByDate = function (dateStr) {
  const normDate = normalizeDateISO(dateStr);
  return this.find({ dateISO: normDate, isDeleted: false })
    .populate("customerId", "name phone")
    .populate("petId", "name species breed weight avatar")
    .sort({ startMinutes: 1, startTime: 1 });
};

/**
 * 2. Truy vấn lịch theo khoảng ngày (fromDate -> toDate, sắp xếp theo ngày và giờ tăng dần)
 */
groomingSchema.statics.findByDateRange = function (fromDate, toDate) {
  const normFrom = normalizeDateISO(fromDate);
  const normTo = normalizeDateISO(toDate);

  return this.find({
    dateISO: { $gte: normFrom, $lte: normTo },
    isDeleted: false,
  })
    .populate("customerId", "name phone")
    .populate("petId", "name species breed")
    .sort({ dateISO: 1, startMinutes: 1 });
};

/**
 * 3. Truy vấn lịch theo khách hàng (customerId)
 */
groomingSchema.statics.findByCustomer = function (customerId, status = null) {
  const query = { customerId, isDeleted: false };
  if (status) query.status = status;

  return this.find(query)
    .populate("petId", "name species breed")
    .sort({ dateISO: -1, startMinutes: -1 });
};

/**
 * 4. Truy vấn lịch theo thú cưng (petId)
 */
groomingSchema.statics.findByPet = function (petId, status = null) {
  const query = { petId, isDeleted: false };
  if (status) query.status = status;

  return this.find(query)
    .populate("customerId", "name phone")
    .sort({ dateISO: -1, startMinutes: -1 });
};

// Indexes tối ưu hiệu năng truy vấn
groomingSchema.index({ dateISO: 1, startMinutes: 1 });
groomingSchema.index({ customerId: 1, dateISO: -1 });
groomingSchema.index({ petId: 1, dateISO: -1 });
groomingSchema.index({ status: 1, dateISO: 1 });

module.exports = mongoose.models.Grooming || mongoose.model("Grooming", groomingSchema, "groomings");
