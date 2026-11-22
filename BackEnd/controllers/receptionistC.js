const Appointment = require("../models/appointment");
const Grooming = require("../models/grooming");
const Invoice = require("../models/invoice");
const Prescription = require("../models/prescription");
const Dispensing = require("../models/dispensing");
const Doctor = require("../models/doctor");
const User = require("../models/user");

/**
 * Helper xác thực Lễ tân (role_id = 3 hoặc role = 'receptionist', hoặc admin)
 */
async function verifyReceptionistCaller(req) {
  const callerId =
    req.headers["x-user-id"] ||
    req.headers["user-id"] ||
    req.query.userId ||
    req.body.userId;

  if (callerId) {
    try {
      const user = await User.findById(callerId).lean();
      if (user && (user.role_id === 3 || user.role === "receptionist" || user.role_id === 1 || user.role === "admin")) {
        return { authorized: true, user };
      }
    } catch (e) {}
  }

  return {
    authorized: false,
    status: 403,
    message: "Quyền truy cập bị từ chối! Chức năng này chỉ dành cho Nhân viên Lễ tân (role_id = 3).",
  };
}

// 1. Lấy tất cả lịch khám của khách hàng kèm thông tin Hóa đơn (GET /api/receptionist/appointments)
// Mặc định CHỈ HIỂN THỊ CÁC CA CHỜ XÁC NHẬN (pending / Chờ xác nhận), loại bỏ các ca đã duyệt hoặc đã hủy
const getAllAppointmentsWithInvoices = async (req, res) => {
  try {
    const auth = await verifyReceptionistCaller(req);
    if (!auth.authorized) {
      return res.status(auth.status).json({ success: false, message: auth.message });
    }

    const { date, month, search, showAll } = req.query;

    const filterAppointment = {};
    const filterGrooming = { isDeleted: false };

    // Yêu cầu: Ẩn các lịch khám "Đã xác nhận" hoặc "Đã hủy", chỉ hiển thị lịch cần duyệt
    if (showAll !== "true") {
      filterAppointment.status = { $in: ["Chờ xác nhận", "pending"] };
      filterGrooming.status = { $in: ["pending", "Chờ xác nhận"] };
    }

    if (date) {
      filterAppointment.date = date;
      filterGrooming.date = date;
    } else if (month) {
      const monthPrefix = new RegExp(`^${month}`);
      filterAppointment.dateISO = monthPrefix;
      filterGrooming.dateISO = monthPrefix;
    }

    if (search && search.trim()) {
      const regex = new RegExp(search.trim(), "i");
      filterAppointment.$or = [
        { ownerName: regex },
        { ownerPhone: regex },
        { petName: regex },
        { bookingCode: regex },
      ];
      filterGrooming.$or = [
        { customerName: regex },
        { customerPhone: regex },
        { petName: regex },
        { groomingCode: regex },
      ];
    }

    const [appointments, groomings] = await Promise.all([
      Appointment.find(filterAppointment).sort({ dateISO: -1, time: 1 }).lean(),
      Grooming.find(filterGrooming).sort({ dateISO: -1, startMinutes: 1 }).lean(),
    ]);

    // Tìm hóa đơn khớp theo SĐT khách hàng
    const allPhones = [...new Set([
      ...appointments.map((a) => a.ownerPhone).filter(Boolean),
      ...groomings.map((g) => g.customerPhone).filter(Boolean),
    ])];

    const invoices = await Invoice.find({
      customerPhone: { $in: allPhones },
      isDeleted: false,
    }).lean();

    const invoiceByPhoneMap = new Map();
    invoices.forEach((inv) => {
      if (!invoiceByPhoneMap.has(inv.customerPhone)) invoiceByPhoneMap.set(inv.customerPhone, []);
      invoiceByPhoneMap.get(inv.customerPhone).push({
        id: inv._id,
        invoiceCode: inv.invoiceCode,
        totalAmount: inv.totalAmount,
        status: inv.status,
        createdAt: inv.createdAt,
      });
    });

    const enrichedAppointments = appointments.map((a) => ({
      id: a._id,
      code: a.bookingCode,
      type: "appointment",
      typeName: "Khám bệnh thú y",
      serviceName: a.serviceName,
      petName: a.petName,
      petSpecies: a.petSpecies,
      customerName: a.ownerName,
      customerPhone: a.ownerPhone,
      date: a.date,
      dateISO: a.dateISO,
      time: a.time,
      status: a.status,
      doctorName: a.notes?.includes("BS") ? a.notes : (a.id_bac_sy ? `BS. [${a.id_bac_sy}]` : "Chưa phân công"),
      invoices: invoiceByPhoneMap.get(a.ownerPhone) || [],
    }));

    const enrichedGroomings = groomings.map((g) => ({
      id: g._id,
      code: g.groomingCode,
      type: "grooming",
      typeName: "Spa & Cắt tỉa",
      serviceName: g.serviceName,
      petName: g.petName,
      petSpecies: "Thú cưng",
      customerName: g.customerName,
      customerPhone: g.customerPhone,
      date: g.date,
      dateISO: g.dateISO,
      time: g.startTime,
      status: g.status,
      doctorName: g.groomerName || (g.id_bac_sy ? `BS/KTV. [${g.id_bac_sy}]` : "Chưa phân công"),
      invoices: invoiceByPhoneMap.get(g.customerPhone) || [],
    }));

    const allList = [...enrichedAppointments, ...enrichedGroomings].sort((a, b) => {
      const cmp = (b.dateISO || "").localeCompare(a.dateISO || "");
      if (cmp !== 0) return cmp;
      return (a.time || "").localeCompare(b.time || "");
    });

    return res.status(200).json({
      success: true,
      count: allList.length,
      appointments: allList,
    });
  } catch (error) {
    console.error("Lỗi lấy danh sách lịch khám toàn viện:", error);
    return res.status(500).json({ success: false, message: "Lỗi máy chủ khi lấy lịch khám." });
  }
};

// 2. Lấy danh sách Đơn thuốc sau khám kèm tình trạng cấp thuốc & hóa đơn thuốc (GET /api/receptionist/prescriptions)
const getPrescriptionsWithDispensings = async (req, res) => {
  try {
    const auth = await verifyReceptionistCaller(req);
    if (!auth.authorized) {
      return res.status(auth.status).json({ success: false, message: auth.message });
    }

    const { search } = req.query;
    const filter = { isDeleted: false };

    if (search && search.trim()) {
      const regex = new RegExp(search.trim(), "i");
      filter.$or = [
        { prescriptionCode: regex },
        { petName: regex },
        { diagnosis: regex },
        { veterinarian: regex },
      ];
    }

    const prescriptions = await Prescription.find(filter)
      .sort({ dateISO: -1, createdAt: -1 })
      .lean();

    const presCodes = prescriptions.map((p) => p.prescriptionCode);

    const dispensings = await Dispensing.find({
      prescriptionCode: { $in: presCodes },
    }).lean();

    const dispensingMap = new Map();
    dispensings.forEach((d) => dispensingMap.set(d.prescriptionCode, d));

    const dispensingIds = dispensings.map((d) => d._id);
    const invoices = await Invoice.find({
      $or: [
        { dispensingId: { $in: dispensingIds } },
        { prescriptionCode: { $in: presCodes } },
      ],
      isDeleted: false,
    }).lean();

    const invoiceMap = new Map();
    invoices.forEach((inv) => {
      if (inv.prescriptionCode) invoiceMap.set(inv.prescriptionCode, inv);
      if (inv.dispensingId) invoiceMap.set(String(inv.dispensingId), inv);
    });

    const enrichedPrescriptions = prescriptions.map((p) => {
      const disp = dispensingMap.get(p.prescriptionCode);
      const inv = invoiceMap.get(p.prescriptionCode) || (disp ? invoiceMap.get(String(disp._id)) : null);

      return {
        id: p._id,
        prescriptionCode: p.prescriptionCode,
        date: p.date,
        petId: p.petId,
        petName: p.petName,
        petSpecies: p.petSpecies,
        diagnosis: p.diagnosis || "Chẩn đoán lâm sàng",
        veterinarian: p.veterinarian,
        medicines: p.medicines || [],
        isDispensed: !!disp,
        dispensing: disp
          ? {
              id: disp._id,
              dispensingCode: disp.dispensingCode,
              dispensedAt: disp.dispensedAt,
              dispensedBy: disp.dispensedBy,
              items: disp.items,
            }
          : null,
        invoice: inv
          ? {
              id: inv._id,
              invoiceCode: inv.invoiceCode,
              totalAmount: inv.totalAmount,
              status: inv.status,
            }
          : null,
      };
    });

    return res.status(200).json({
      success: true,
      count: enrichedPrescriptions.length,
      prescriptions: enrichedPrescriptions,
    });
  } catch (error) {
    console.error("Lỗi lấy danh sách đơn thuốc:", error);
    return res.status(500).json({ success: false, message: "Lỗi máy chủ khi lấy đơn thuốc." });
  }
};

// 3. Duyệt hoặc Hủy đơn khám & Phân công bác sĩ (PATCH /api/receptionist/appointments/:id/confirm)
const confirmOrCancelAppointment = async (req, res) => {
  try {
    const auth = await verifyReceptionistCaller(req);
    if (!auth.authorized) {
      return res.status(auth.status).json({ success: false, message: auth.message });
    }

    const { id } = req.params;
    const { action, type, id_bac_sy, cancelReason } = req.body;

    if (!["confirm", "cancel"].includes(action)) {
      return res.status(400).json({
        success: false,
        message: 'Thao tác không hợp lệ! Chỉ chấp nhận "confirm" (Duyệt) hoặc "cancel" (Hủy).',
      });
    }

    // Nếu Duyệt đơn khám: BẮT BUỘC CHỌN 1 BÁC SĨ PHỤ TRÁCH (theo yêu cầu user)
    let doctor = null;
    if (action === "confirm") {
      if (!id_bac_sy) {
        return res.status(400).json({
          success: false,
          message: "Vui lòng chọn 1 Bác sĩ phụ trách để duyệt phiếu khám!",
        });
      }
      doctor = await Doctor.findOne({ id_bac_sy, isActive: true }).lean();
      if (!doctor) {
        return res.status(404).json({
          success: false,
          message: `Không tìm thấy thông tin bác sĩ có mã [${id_bac_sy}]!`,
        });
      }
    }

    if (type === "grooming") {
      const grooming = await Grooming.findById(id);
      if (!grooming) {
        return res.status(404).json({ success: false, message: "Không tìm thấy lịch spa/grooming." });
      }

      if (action === "confirm") {
        grooming.status = "in_progress";
        grooming.id_bac_sy = doctor.id_bac_sy;
        grooming.doctorPhone = doctor.phone;
        grooming.groomerName = doctor.name;
        await grooming.save();
        return res.status(200).json({
          success: true,
          message: `Đã duyệt lịch [${grooming.groomingCode}] và phân công cho BS. ${doctor.name} (${doctor.id_bac_sy}) thành công!`,
        });
      } else {
        grooming.status = "cancelled";
        grooming.cancelledReason = cancelReason || "Lễ tân hủy đơn khám";
        await grooming.save();
        return res.status(200).json({
          success: true,
          message: `Đã hủy lịch [${grooming.groomingCode}] thành công.`,
        });
      }
    } else {
      // type === "appointment" hoặc tìm theo ID
      let appointment = await Appointment.findById(id);
      if (!appointment) {
        appointment = await Appointment.findOne({ bookingCode: id });
      }

      if (!appointment) {
        return res.status(404).json({ success: false, message: "Không tìm thấy lịch khám thú y." });
      }

      if (action === "confirm") {
        appointment.status = "Đã xác nhận";
        appointment.id_bac_sy = doctor.id_bac_sy;
        appointment.doctorPhone = doctor.phone;
        const noteDoctor = `[BS phụ trách: ${doctor.name} - ${doctor.id_bac_sy}]`;
        if (!appointment.notes || !appointment.notes.includes(doctor.id_bac_sy)) {
          appointment.notes = appointment.notes ? `${appointment.notes} | ${noteDoctor}` : noteDoctor;
        }
        await appointment.save();
        return res.status(200).json({
          success: true,
          message: `Đã duyệt lịch khám [${appointment.bookingCode}] và phân công cho BS. ${doctor.name} (${doctor.id_bac_sy}) thành công!`,
        });
      } else {
        appointment.status = "Đã hủy";
        appointment.cancelledAt = new Date();
        appointment.cancelReason = cancelReason || "Lễ tân hủy đơn khám";
        appointment.cancelledBy = "staff";
        await appointment.save();
        return res.status(200).json({
          success: true,
          message: `Đã hủy lịch khám [${appointment.bookingCode}] thành công.`,
        });
      }
    }
  } catch (error) {
    console.error("Lỗi duyệt/hủy lịch khám:", error);
    return res.status(500).json({ success: false, message: "Lỗi máy chủ khi xử lý duyệt/hủy lịch khám." });
  }
};

module.exports = {
  getAllAppointmentsWithInvoices,
  getPrescriptionsWithDispensings,
  confirmOrCancelAppointment,
  verifyReceptionistCaller,
};
