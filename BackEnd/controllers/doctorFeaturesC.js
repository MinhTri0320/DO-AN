const mongoose = require("mongoose");
const User = require("../models/user");
const Doctor = require("../models/doctor");
const Diagnosis = require("../models/diagnosis");
const MedicalRecord = require("../models/medicalRecord");
const Grooming = require("../models/grooming");
const Appointment = require("../models/appointment");
const Invoice = require("../models/invoice");

function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeDateFormats(dateStr) {
  const s = String(dateStr || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split("-");
    return { dateISO: s, dateVN: `${d}/${m}/${y}` };
  }
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
    const [d, m, y] = s.split("/");
    return { dateISO: `${y}-${m}-${d}`, dateVN: s };
  }
  return { dateISO: s, dateVN: s };
}

/**
 * Helper xác thực Bác sĩ (CHỈ dành riêng cho Bác sĩ thú y: role_id = 2)
 */
async function verifyDoctorCaller(req) {
  const body = req.body || {};
  const callerId =
    req.headers["x-user-id"] ||
    req.headers["user-id"] ||
    req.query.doctorId ||
    body.doctorId;

  let doctorDoc = null;
  let callerUser = null;

  if (callerId && mongoose.Types.ObjectId.isValid(callerId)) {
    try {
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
    } catch (e) {}
  }

  // Hoặc kiểm tra qua id_bac_sy trực tiếp nếu truyền header/query
  const id_bac_sy = req.headers["x-doctor-id"] || req.query.id_bac_sy;
  if (id_bac_sy) {
    try {
      doctorDoc = await Doctor.findOne({ id_bac_sy, isActive: true }).lean();
      if (doctorDoc) {
        return { authorized: true, user: null, doctor: doctorDoc };
      }
    } catch (e) {}
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

    // Bộ lọc thời gian (tháng YYYY-MM, ngày DD/MM/YYYY hoặc YYYY-MM-DD, hoặc khoảng ngày)
    if (month) {
      const monthPrefix = new RegExp(`^${escapeRegex(month)}`);
      filterGrooming.dateISO = monthPrefix;
      filterAppointment.dateISO = monthPrefix;
    } else if (date) {
      const { dateISO, dateVN } = normalizeDateFormats(date);
      const dateValues = [...new Set([String(date).trim(), dateISO, dateVN].filter(Boolean))];
      filterGrooming.$and = filterGrooming.$and || [];
      filterGrooming.$and.push({
        $or: [{ date: { $in: dateValues } }, { dateISO: { $in: dateValues } }],
      });
      filterAppointment.$and = filterAppointment.$and || [];
      filterAppointment.$and.push({
        $or: [{ date: { $in: dateValues } }, { dateISO: { $in: dateValues } }],
      });
    } else if (startDate && endDate) {
      filterGrooming.dateISO = { $gte: startDate, $lte: endDate };
      filterAppointment.dateISO = { $gte: startDate, $lte: endDate };
    }

    // 1. Lấy danh sách lịch Grooming của bác sĩ
    const groomings = await Grooming.find(filterGrooming)
      .sort({ dateISO: 1, startMinutes: 1 })
      .lean();

    // 2. Lấy danh sách lịch khám chung (Appointment) của bác sĩ
    const appointments = await Appointment.find(filterAppointment)
      .sort({ dateISO: 1, time: 1 })
      .lean();

    // 3. Tìm các hóa đơn tương ứng của khách hàng có lịch
    const customerPhones = [...new Set([
      ...groomings.map((g) => g.customerPhone).filter(Boolean),
      ...appointments.map((a) => a.ownerPhone).filter(Boolean),
    ])];

    const invoices =
      customerPhones.length > 0
        ? await Invoice.find({
            customerPhone: { $in: customerPhones },
            isDeleted: false,
          }).lean()
        : [];

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
      notes: g.note || "",
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
      doctorName: a.doctorName || (auth.doctor ? auth.doctor.name : "Bác sĩ phụ trách"),
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

    // Tổng hợp hóa đơn khám cho từng ca chẩn đoán (lọc chỉ giữ ObjectId hợp lệ để tránh CastError 500)
    const petIds = diagnoses.map((d) => d.petId).filter(Boolean);
    const validPetIds = [...new Set(petIds.filter((id) => mongoose.Types.ObjectId.isValid(id)))];

    const invoices =
      validPetIds.length > 0
        ? await Invoice.find({
            petId: { $in: validPetIds },
            isDeleted: false,
          }).lean()
        : [];

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
      doctorName: d.doctorName || d.veterinarian,
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

    if (search && String(search).trim()) {
      const regex = new RegExp(escapeRegex(String(search).trim()), "i");
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

// 4. Xác nhận hoàn thành ca hẹn & Tự động chuyển từ Lịch hẹn cá nhân -> Hồ sơ khám (POST /api/doctor/appointments/:id/complete)
const completeAppointment = async (req, res) => {
  try {
    const auth = await verifyDoctorCaller(req);
    if (!auth.authorized) {
      return res.status(auth.status).json({ success: false, message: auth.message });
    }

    const { id } = req.params;
    const body = req.body || {};
    const { diagnosis, treatmentPlan, notes } = body;

    const doctorName = auth.doctor ? auth.doctor.name : (auth.user?.name || "Bác sĩ thú y");
    const id_bac_sy = auth.doctor ? auth.doctor.id_bac_sy : (body.id_bac_sy || "bs00001");
    const doctorPhone = auth.doctor ? auth.doctor.phone : auth.user?.phone;

    let appointment = null;
    let grooming = null;
    let targetType = "appointment";

    // 1. Tìm trong bảng Appointment
    if (mongoose.Types.ObjectId.isValid(id)) {
      appointment = await Appointment.findById(id);
    }
    if (!appointment) {
      appointment = await Appointment.findOne({ bookingCode: id });
    }

    // 2. Nếu không có, tìm trong bảng Grooming
    if (!appointment) {
      if (mongoose.Types.ObjectId.isValid(id)) {
        grooming = await Grooming.findById(id);
      }
      if (!grooming) {
        grooming = await Grooming.findOne({ groomingCode: id, isDeleted: false });
      }
      if (grooming) targetType = "grooming";
    }

    if (!appointment && !grooming) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy thông tin ca hẹn cần hoàn thành.",
      });
    }

    const blockedStatuses = ["Hoàn thành", "completed", "Đã hủy", "cancelled"];
    const currentStatus = targetType === "appointment" ? appointment.status : grooming.status;
    if (blockedStatuses.includes(currentStatus)) {
      return res.status(400).json({
        success: false,
        message: `Ca hẹn [${id}] hiện đang ở trạng thái "${currentStatus}", không thể xác nhận hoàn thành!`,
      });
    }

    const now = new Date();
    const todayStr = `${String(now.getDate()).padStart(2, "0")}/${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}`;
    const todayISO = now.toISOString().split("T")[0];

    let createdRecord = null;
    let createdDiagnosis = null;
    const Pet = require("../models/pet");

    if (targetType === "appointment") {
      appointment.status = "Hoàn thành";
      appointment.slotReserved = false;
      await appointment.save();

      // Xác định petId hợp lệ: ưu tiên tìm theo ownerId + name rồi mới fallback name
      let effectivePetId = appointment.petId;
      if (!effectivePetId) {
        let ownerObjectId =
          appointment.userId && mongoose.Types.ObjectId.isValid(appointment.userId)
            ? appointment.userId
            : null;
        if (!ownerObjectId && appointment.ownerPhone) {
          const ownerUser = await User.findOne({ phone: appointment.ownerPhone }).select("_id").lean();
          if (ownerUser) ownerObjectId = ownerUser._id;
        }

        let foundPet = null;
        if (ownerObjectId && appointment.petName) {
          foundPet = await Pet.findOne({ ownerId: ownerObjectId, name: appointment.petName }).lean();
        }
        if (!foundPet && appointment.petName) {
          foundPet = await Pet.findOne({ name: appointment.petName }).lean();
        }
        if (foundPet) {
          effectivePetId = String(foundPet._id);
        } else {
          effectivePetId = `pet_${String(appointment.userId || appointment._id).slice(-8)}`;
        }
      }

      const recordCode = `MR-${now.getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
      const confirmedDiag = (diagnosis && String(diagnosis).trim()) || appointment.serviceName || "Khám và điều trị hoàn tất";
      const finalTreatmentPlan =
        (treatmentPlan && String(treatmentPlan).trim()) ||
        "Đã hoàn thành khám và tư vấn điều trị tại phòng khám";
      const finalNotes = (notes && String(notes).trim()) || appointment.notes || "";

      // Tạo Hồ sơ khám (MedicalRecord)
      createdRecord = await MedicalRecord.create({
        recordCode,
        petId: effectivePetId,
        petName: appointment.petName || "Thú cưng",
        petSpecies: appointment.petSpecies || "Chó",
        ownerName: appointment.ownerName || "Khách hàng",
        ownerPhone: appointment.ownerPhone || "",
        title: `Hoàn thành ca khám: ${appointment.serviceName || "Khám bệnh"}`,
        status: "Đã hoàn thành",
        confirmedDiagnosis: confirmedDiag,
        treatmentPlan: finalTreatmentPlan,
        doctorAdvice: finalTreatmentPlan,
        veterinarian: `BS. ${doctorName}`,
        id_bac_sy: id_bac_sy,
        doctorPhone: doctorPhone,
        date: appointment.date || todayStr,
        dateISO: appointment.dateISO || todayISO,
        notes: finalNotes,
        isDeleted: false,
      });

      // Tạo Phiếu khám (Diagnosis) theo riêng Bác sĩ để hiển thị ở Tab 2
      const diagCode = `DX-${now.getFullYear()}-${Math.floor(100 + Math.random() * 900)}`;
      createdDiagnosis = await Diagnosis.create({
        diagnosisCode: diagCode,
        recordId: recordCode,
        petId: effectivePetId,
        petName: appointment.petName || "Thú cưng",
        petSpecies: appointment.petSpecies || "Chó",
        customerName: appointment.ownerName || "Khách hàng",
        customerPhone: appointment.ownerPhone || "",
        category: appointment.serviceName || "Khám nội khoa",
        status: "Đã hoàn thành",
        confirmedDiagnosis: confirmedDiag,
        treatmentPlan: finalTreatmentPlan,
        doctorAdvice: finalTreatmentPlan,
        veterinarian: `BS. ${doctorName}`,
        doctorName: doctorName,
        id_bac_sy: id_bac_sy,
        doctorPhone: doctorPhone,
        date: appointment.date || todayStr,
        dateISO: appointment.dateISO || todayISO,
        vitalSigns: {
          temperature: 38.5,
          weight: 5.0,
          heartRate: 110,
        },
        isDeleted: false,
      });
    } else {
      // Grooming hoàn thành: sử dụng diagnosis & treatmentPlan bác sĩ nhập trong modal
      grooming.status = "completed";
      await grooming.save();

      let effectivePetId = grooming.petId ? String(grooming.petId) : null;
      if (!effectivePetId) {
        let foundPet = null;
        if (grooming.customerId && mongoose.Types.ObjectId.isValid(grooming.customerId) && grooming.petName) {
          foundPet = await Pet.findOne({ ownerId: grooming.customerId, name: grooming.petName }).lean();
        }
        if (!foundPet && grooming.petName) {
          foundPet = await Pet.findOne({ name: grooming.petName }).lean();
        }
        effectivePetId = foundPet ? String(foundPet._id) : `pet_${String(grooming._id).slice(-8)}`;
      }

      const recordCode = `MR-${now.getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
      const confirmedDiag =
        (diagnosis && String(diagnosis).trim()) || `Hoàn thành dịch vụ ${grooming.serviceName}`;
      const finalTreatmentPlan =
        (treatmentPlan && String(treatmentPlan).trim()) ||
        "Bé cưng đã được vệ sinh sạch sẽ, lông mượt mà";
      const finalNotes = (notes && String(notes).trim()) || grooming.note || "";

      createdRecord = await MedicalRecord.create({
        recordCode,
        petId: effectivePetId,
        petName: grooming.petName || "Thú cưng",
        petSpecies: grooming.petSpecies || "Chó",
        ownerName: grooming.customerName || "Khách hàng",
        ownerPhone: grooming.customerPhone || "",
        title: `Dịch vụ Spa Grooming: ${grooming.serviceName}`,
        category: grooming.serviceName || "Spa & Grooming",
        status: "Đã hoàn thành",
        confirmedDiagnosis: confirmedDiag,
        treatmentPlan: finalTreatmentPlan,
        doctorAdvice: finalTreatmentPlan,
        veterinarian: `BS. ${doctorName}`,
        id_bac_sy: id_bac_sy,
        doctorPhone: doctorPhone,
        date: grooming.date || todayStr,
        dateISO: grooming.dateISO || todayISO,
        notes: finalNotes,
        isDeleted: false,
      });

      const diagCode = `DX-${now.getFullYear()}-${Math.floor(100 + Math.random() * 900)}`;
      createdDiagnosis = await Diagnosis.create({
        diagnosisCode: diagCode,
        recordId: recordCode,
        petId: effectivePetId,
        petName: grooming.petName || "Thú cưng",
        petSpecies: grooming.petSpecies || "Chó",
        customerName: grooming.customerName || "Khách hàng",
        customerPhone: grooming.customerPhone || "",
        category: grooming.serviceName || "Spa & Grooming",
        status: "Đã hoàn thành",
        confirmedDiagnosis: confirmedDiag,
        treatmentPlan: finalTreatmentPlan,
        doctorAdvice: finalTreatmentPlan,
        veterinarian: `BS. ${doctorName}`,
        doctorName: doctorName,
        id_bac_sy: id_bac_sy,
        doctorPhone: doctorPhone,
        date: grooming.date || todayStr,
        dateISO: grooming.dateISO || todayISO,
        vitalSigns: {
          temperature: 38.5,
          weight: 5.0,
          heartRate: 110,
        },
        isDeleted: false,
      });
    }

    return res.status(200).json({
      success: true,
      message: `Đã xác nhận hoàn thành ca hẹn [${id}]! Ca khám đã chuyển từ Lịch hẹn cá nhân sang Hồ sơ khám thành công.`,
      targetType,
      record: createdRecord,
      diagnosis: createdDiagnosis,
    });
  } catch (error) {
    console.error("Lỗi xác nhận hoàn thành lịch hẹn:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Lỗi máy chủ khi xác nhận hoàn thành lịch hẹn.",
    });
  }
};

// 5. Tra cứu thông tin toàn diện dành cho Bác sĩ (GET /api/doctor/lookup?q=...)
const lookupDoctorInfo = async (req, res) => {
  try {
    const auth = await verifyDoctorCaller(req);
    if (!auth.authorized) {
      return res.status(auth.status).json({ success: false, message: auth.message });
    }

    const { q, search } = req.query;
    const queryStr = (q || search || "").trim();

    if (!queryStr) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng nhập từ khóa tra cứu (tên thú cưng, SĐT, mã bệnh án, chẩn đoán, v.v.)!",
      });
    }

    const regex = new RegExp(escapeRegex(queryStr), "i");
    const Pet = require("../models/pet");
    const Prescription = require("../models/prescription");

    const [records, diagnoses, prescriptions, pets, customers] = await Promise.all([
      // 1. Hồ sơ khám
      MedicalRecord.find({
        $or: [
          { recordCode: regex },
          { petName: regex },
          { confirmedDiagnosis: regex },
          { title: regex },
          { ownerPhone: regex },
          { ownerName: regex },
        ],
        isDeleted: false,
      }).sort({ createdAt: -1 }).lean(),

      // 2. Phiếu khám
      Diagnosis.find({
        $or: [
          { diagnosisCode: regex },
          { petName: regex },
          { confirmedDiagnosis: regex },
          { customerPhone: regex },
          { customerName: regex },
        ],
        isDeleted: false,
      }).sort({ createdAt: -1 }).lean(),

      // 3. Đơn thuốc
      Prescription.find({
        $or: [
          { prescriptionCode: regex },
          { petName: regex },
          { diagnosis: regex },
          { recordCode: regex },
        ],
        isDeleted: false,
      }).sort({ createdAt: -1 }).lean(),

      // 4. Thú cưng
      Pet.find({
        $or: [{ name: regex }, { species: regex }, { breed: regex }],
      }).lean(),

      // 5. Khách hàng
      User.find({
        $or: [{ name: regex }, { fullName: regex }, { phone: regex }],
      }).select("name fullName phone email address").lean(),
    ]);

    return res.status(200).json({
      success: true,
      query: queryStr,
      results: {
        recordsCount: records.length,
        records,
        diagnosesCount: diagnoses.length,
        diagnoses,
        prescriptionsCount: prescriptions.length,
        prescriptions,
        petsCount: pets.length,
        pets,
        customersCount: customers.length,
        customers,
      },
    });
  } catch (error) {
    console.error("Lỗi tra cứu thông tin bác sĩ:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi máy chủ khi tra cứu thông tin bác sĩ.",
    });
  }
};

module.exports = {
  getDoctorAppointments,
  getDoctorDiagnoses,
  getPetMedicalRecords,
  completeAppointment,
  lookupDoctorInfo,
  verifyDoctorCaller,
};
