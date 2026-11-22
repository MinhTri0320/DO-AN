const User = require("../models/user");
const Doctor = require("../models/doctor");
const Diagnosis = require("../models/diagnosis");
const MedicalRecord = require("../models/medicalRecord");
const Grooming = require("../models/grooming");
const Appointment = require("../models/appointment");
const Invoice = require("../models/invoice");

/**
 * Helper xác thực Bác sĩ (role_id = 2 hoặc admin role_id = 1)
 */
async function verifyDoctorCaller(req) {
  const callerId =
    req.headers["x-user-id"] ||
    req.headers["user-id"] ||
    req.query.doctorId ||
    req.body.doctorId;

  let doctorDoc = null;

  if (callerId) {
    const user = await User.findById(callerId).lean();
    if (user && (user.role_id === 2 || user.role === "doctor" || user.role_id === 1 || user.role === "admin")) {
      doctorDoc = await Doctor.findOne({ userId: user._id, isActive: true }).lean();
      return { authorized: true, user, doctor: doctorDoc };
    }
  }

  // Hoặc kiểm tra qua id_bac_sy trực tiếp nếu truyền query/header
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
    message: "Quyền truy cập bị từ chối! Chức năng này chỉ dành cho Bác sĩ thú y (role_id = 2) hoặc Quản trị viên.",
  };
}

// 1. Lịch đặt trước của riêng từng bác sĩ (GET /api/doctor/appointments)
// Phân biệt dựa trên id_bac_sy hoặc số điện thoại bác sĩ, kèm thông tin hóa đơn và SĐT người khám
const getDoctorAppointments = async (req, res) => {
  try {
    const auth = await verifyDoctorCaller(req);
    if (!auth.authorized) {
      return res.status(auth.status).json({ success: false, message: auth.message });
    }

    const id_bac_sy = req.query.id_bac_sy || (auth.doctor ? auth.doctor.id_bac_sy : null);
    const doctorPhone = auth.doctor ? auth.doctor.phone : auth.user?.phone;

    const filterGrooming = { isDeleted: false };
    const filterAppointment = {};

    if (id_bac_sy) {
      filterGrooming.$or = [{ id_bac_sy }, { doctorPhone }];
    } else if (doctorPhone) {
      filterGrooming.doctorPhone = doctorPhone;
    }

    // Lấy danh sách lịch grooming
    const groomings = await Grooming.find(filterGrooming)
      .sort({ dateISO: 1, startMinutes: 1 })
      .lean();

    // Lấy danh sách lịch hẹn chung (Appointment)
    const appointments = await Appointment.find(filterAppointment)
      .sort({ dateISO: 1, time: 1 })
      .lean();

    // Tìm các hóa đơn tương ứng với số điện thoại của người khám
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

    // Ghép thông tin hóa đơn vào từng lịch hẹn
    const enrichedGroomings = groomings.map((g) => ({
      type: "grooming",
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
      invoices: invoiceByPhoneMap.get(g.customerPhone) || [],
    }));

    return res.status(200).json({
      success: true,
      id_bac_sy,
      count: enrichedGroomings.length,
      appointments: enrichedGroomings,
    });
  } catch (error) {
    console.error("Lỗi lấy lịch đặt trước của bác sĩ:", error);
    return res.status(500).json({ success: false, message: "Lỗi máy chủ khi lấy lịch đặt trước." });
  }
};

// 2. Phiếu khám của riêng từng bác sĩ (GET /api/doctor/diagnoses)
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

    return res.status(200).json({
      success: true,
      id_bac_sy,
      count: diagnoses.length,
      diagnoses,
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
