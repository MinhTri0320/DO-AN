const User = require("../models/user");
const Doctor = require("../models/doctor");
const Diagnosis = require("../models/diagnosis");
const MedicalRecord = require("../models/medicalRecord");
const Grooming = require("../models/grooming");
const Appointment = require("../models/appointment");
const Invoice = require("../models/invoice");

/**
 * Helper xác thực Bác sĩ (CHỈ dành riêng cho Bác sĩ thú y: role_id = 2)
 */
async function verifyDoctorCaller(req) {
  const callerId =
    req.headers["x-user-id"] ||
    req.headers["user-id"] ||
    req.query.doctorId ||
    req.body.doctorId;

  let doctorDoc = null;
  let callerUser = null;

  if (callerId) {
    callerUser = await User.findById(callerId).lean();
    if (callerUser) {
      if (callerUser.role_id !== 2 && callerUser.role !== "doctor") {
        return {
          authorized: false,
          status: 403,
          message: "Quyền truy cập bị từ chối! Chức năng này chỉ dành riêng cho Bác sĩ thú y (role_id = 2).",
        };
      }
      doctorDoc = await Doctor.findOne({ userId: callerUser._id, isActive: true }).lean();
      return { authorized: true, user: callerUser, doctor: doctorDoc };
    }
  }

  // Hoặc kiểm tra qua id_bac_sy trực tiếp nếu truyền header/query
  const id_bac_sy = req.headers["x-doctor-id"] || req.query.id_bac_sy;
  if (id_bac_sy) {
    doctorDoc = await Doctor.findOne({ id_bac_sy, isActive: true }).lean();
    if (doctorDoc) {
      return { authorized: true, user: null, doctor: doctorDoc };
    }
  }

  return {
    authorized: false,
    status: 403,
    message: "Quyền truy cập bị từ chối! Vui lòng đăng nhập tài khoản Bác sĩ thú y (role_id = 2).",
  };
}

// 1. Lịch hẹn cá nhân của riêng từng Bác sĩ (GET /api/doctor/appointments)
// Tối ưu hóa trải nghiệm bác sĩ: Hiển thị toàn bộ lịch của bác sĩ theo khung tháng / các ca tiếp theo
const getDoctorAppointments = async (req, res) => {
  try {
    const auth = await verifyDoctorCaller(req);
    if (!auth.authorized) {
      return res.status(auth.status).json({ success: false, message: auth.message });
    }

    const id_bac_sy = req.query.id_bac_sy || (auth.doctor ? auth.doctor.id_bac_sy : null);
    const doctorPhone = auth.doctor ? auth.doctor.phone : auth.user?.phone;
    const { month, date, startDate, endDate } = req.query; // Hỗ trợ lọc theo tháng (YYYY-MM) hoặc khoảng ngày

    const filterGrooming = { isDeleted: false };
    const filterAppointment = {};

    if (id_bac_sy) {
      filterGrooming.$or = [{ id_bac_sy }, { doctorPhone }];
      filterAppointment.$or = [{ id_bac_sy }, { doctorPhone }];
    } else if (doctorPhone) {
      filterGrooming.doctorPhone = doctorPhone;
      filterAppointment.doctorPhone = doctorPhone;
    }

    // Bộ lọc thời gian (tháng YYYY-MM, ngày YYYY-MM-DD, hoặc khoảng ngày)
    if (month) {
      const monthPrefix = new RegExp(`^${month}`);
      filterGrooming.dateISO = monthPrefix;
      filterAppointment.dateISO = monthPrefix;
    } else if (date) {
      filterGrooming.date = date;
      filterAppointment.date = date;
    } else if (startDate && endDate) {
      filterGrooming.dateISO = { $gte: startDate, $lte: endDate };
      filterAppointment.dateISO = { $gte: startDate, $lte: endDate };
    }

    // 1. Lấy danh sách lịch Grooming của bác sĩ
    const groomings = await Grooming.find(filterGrooming)
      .sort({ dateISO: 1, startMinutes: 1 })
      .lean();

    // 2. Lấy danh sách lịch khám chung (Appointment) của bác sĩ
    // Nếu bảng appointment chưa có id_bac_sy cụ thể, tìm theo doctorPhone hoặc bác sĩ phụ trách
    const appointments = await Appointment.find(filterAppointment)
      .sort({ dateISO: 1, time: 1 })
      .lean();

    // 3. Tìm các hóa đơn tương ứng của khách hàng có lịch
    const customerPhones = [...new Set([
      ...groomings.map((g) => g.customerPhone).filter(Boolean),
      ...appointments.map((a) => a.ownerPhone).filter(Boolean),
    ])];

    const invoices = await Invoice.find({
      customerPhone: { $in: customerPhones },
      isDeleted: false,
    }).lean();

    const invoiceByPhoneMap = new Map();
    invoices.forEach((inv) => {
      if (!invoiceByPhoneMap.has(inv.customerPhone)) {
        invoiceByPhoneMap.set(inv.customerPhone, []);
      }
      invoiceByPhoneMap.get(inv.customerPhone).push({
        invoiceCode: inv.invoiceCode,
        totalAmount: inv.totalAmount,
        status: inv.status,
        createdAt: inv.createdAt,
      });
    });

    // 4. Định dạng dữ liệu Grooming
    const enrichedGroomings = groomings.map((g) => ({
      type: "grooming",
      id: g._id,
      code: g.groomingCode,
      petName: g.petName,
      customerName: g.customerName,
      customerPhone: g.customerPhone,
      serviceName: g.serviceName,
      price: g.price,
      date: g.date,
      dateISO: g.dateISO,
      startTime: g.startTime,
      endTime: g.endTime,
      status: g.status,
      id_bac_sy: g.id_bac_sy,
      doctorName: g.groomerName,
      notes: g.notes || "",
      invoices: invoiceByPhoneMap.get(g.customerPhone) || [],
    }));

    // 5. Định dạng dữ liệu Appointment (Lịch khám thú y thông thường)
    const enrichedAppointments = appointments.map((a) => ({
      type: "appointment",
      id: a._id,
      code: a.bookingCode,
      petName: a.petName,
      customerName: a.ownerName,
      customerPhone: a.ownerPhone,
      serviceName: a.serviceName,
      price: a.feeDisplay || "Theo hóa đơn khám",
      date: a.date,
      dateISO: a.dateISO,
      startTime: a.time,
      endTime: "",
      status: a.status,
      id_bac_sy: a.id_bac_sy || id_bac_sy,
      doctorName: auth.doctor ? auth.doctor.name : "Bác sĩ phụ trách",
      notes: a.notes || "",
      invoices: invoiceByPhoneMap.get(a.ownerPhone) || [],
    }));

    // 6. Gộp cả hai nguồn lịch và sắp xếp tăng dần theo thời gian (chuẩn ngày + giờ)
    const combinedList = [...enrichedGroomings, ...enrichedAppointments].sort((a, b) => {
      const cmpDate = (a.dateISO || "").localeCompare(b.dateISO || "");
      if (cmpDate !== 0) return cmpDate;
      return (a.startTime || "").localeCompare(b.startTime || "");
    });

    return res.status(200).json({
      success: true,
      id_bac_sy,
      doctorName: auth.doctor ? auth.doctor.name : "",
      count: combinedList.length,
      appointments: combinedList,
    });
  } catch (error) {
    console.error("Lỗi lấy lịch đặt trước của bác sĩ:", error);
    return res.status(500).json({ success: false, message: "Lỗi máy chủ khi lấy lịch đặt trước." });
  }
};

// 2. Phiếu khám của riêng từng bác sĩ kèm tổng hợp hóa đơn (GET /api/doctor/diagnoses)
// Phân biệt theo id_bac_sy (bác sĩ chỉ xem phiếu khám của chính mình)
const getDoctorDiagnoses = async (req, res) => {
  try {
    const auth = await verifyDoctorCaller(req);
    if (!auth.authorized) {
      return res.status(auth.status).json({ success: false, message: auth.message });
    }

    const id_bac_sy = req.query.id_bac_sy || (auth.doctor ? auth.doctor.id_bac_sy : null);
    const doctorPhone = auth.doctor ? auth.doctor.phone : auth.user?.phone;

    const filter = { isDeleted: false };

    if (id_bac_sy) {
      filter.$or = [{ id_bac_sy }, { doctorPhone }];
    } else if (doctorPhone) {
      filter.doctorPhone = doctorPhone;
    }

    const diagnoses = await Diagnosis.find(filter)
      .sort({ dateISO: -1, createdAt: -1 })
      .lean();

    // Tổng hợp hóa đơn khám cho từng ca chẩn đoán
    const petIds = diagnoses.map((d) => d.petId).filter(Boolean);
    const invoices = await Invoice.find({
      petId: { $in: petIds },
      isDeleted: false,
    }).lean();

    const invoiceByPetMap = new Map();
    invoices.forEach((inv) => {
      const pId = String(inv.petId);
      if (!invoiceByPetMap.has(pId)) invoiceByPetMap.set(pId, []);
      invoiceByPetMap.get(pId).push({
        invoiceCode: inv.invoiceCode,
        totalAmount: inv.totalAmount,
        status: inv.status,
        createdAt: inv.createdAt,
      });
    });

    const enrichedDiagnoses = diagnoses.map((d) => ({
      ...d,
      invoices: invoiceByPetMap.get(String(d.petId)) || [],
    }));

    return res.status(200).json({
      success: true,
      id_bac_sy,
      doctorName: auth.doctor ? auth.doctor.name : "",
      count: enrichedDiagnoses.length,
      diagnoses: enrichedDiagnoses,
    });
  } catch (error) {
    console.error("Lỗi lấy phiếu khám của bác sĩ:", error);
    return res.status(500).json({ success: false, message: "Lỗi máy chủ khi lấy phiếu khám." });
  }
};

// 3. Hồ sơ khám thú cưng dùng chung cho tất cả Bác sĩ (role_id = 2) (GET /api/doctor/medical-records)
const getPetMedicalRecords = async (req, res) => {
  try {
    const auth = await verifyDoctorCaller(req);
    if (!auth.authorized) {
      return res.status(auth.status).json({ success: false, message: auth.message });
    }

    const { petId, search } = req.query;
    const filter = { isDeleted: false };

    if (petId) {
      filter.petId = String(petId).trim();
    }

    if (search && search.trim()) {
      const regex = new RegExp(search.trim(), "i");
      filter.$or = [
        { recordCode: regex },
        { petName: regex },
        { confirmedDiagnosis: regex },
        { title: regex },
      ];
    }

    const records = await MedicalRecord.find(filter)
      .sort({ dateISO: -1, createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: records.length,
      records,
    });
  } catch (error) {
    console.error("Lỗi lấy hồ sơ khám thú cưng dùng chung:", error);
    return res.status(500).json({ success: false, message: "Lỗi máy chủ khi lấy hồ sơ khám." });
  }
};

module.exports = {
  getDoctorAppointments,
  getDoctorDiagnoses,
  getPetMedicalRecords,
  verifyDoctorCaller,
};
