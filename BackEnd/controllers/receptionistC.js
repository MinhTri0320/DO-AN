const mongoose = require("mongoose");
const Appointment = require("../models/appointment");
const Grooming = require("../models/grooming");
const Invoice = require("../models/invoice");
const Prescription = require("../models/prescription");
const Dispensing = require("../models/dispensing");
const Doctor = require("../models/doctor");
const User = require("../models/user");

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
 * Helper xác thực Lễ tân (role_id = 3 hoặc role = 'receptionist', hoặc admin)
 */
async function verifyReceptionistCaller(req) {
  const body = req.body || {};
  const callerId =
    req.headers["x-user-id"] ||
    req.headers["user-id"] ||
    req.query.userId ||
    body.userId;

  if (callerId && mongoose.Types.ObjectId.isValid(callerId)) {
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
const getAllAppointmentsWithInvoices = async (req, res) => {
  try {
    const auth = await verifyReceptionistCaller(req);
    if (!auth.authorized) {
      return res.status(auth.status).json({ success: false, message: auth.message });
    }

    const { date, month, search, showAll, status } = req.query;

    const filterAppointment = {};
    const filterGrooming = { isDeleted: false };

    // Map bộ lọc status thông minh cho cả 2 bảng (Appointment & Grooming)
    if (status) {
      const s = String(status).trim();
      if (s === "pending" || s === "Chờ xác nhận") {
        filterAppointment.status = { $in: ["Chờ xác nhận", "pending"] };
        filterGrooming.status = { $in: ["pending"] };
      } else if (s === "Đã xác nhận" || s === "in_progress") {
        filterAppointment.status = { $in: ["Đã xác nhận"] };
        filterGrooming.status = { $in: ["in_progress"] };
      } else if (s === "Hoàn thành" || s === "completed") {
        filterAppointment.status = { $in: ["Hoàn thành", "completed"] };
        filterGrooming.status = { $in: ["completed"] };
      } else if (s === "Đã hủy" || s === "cancelled") {
        filterAppointment.status = { $in: ["Đã hủy"] };
        filterGrooming.status = { $in: ["cancelled"] };
      } else {
        filterAppointment.status = s;
        filterGrooming.status = s;
      }
    } else if (showAll === "false") {
      // Chỉ khi người dùng yêu cầu rõ ràng "chỉ xem chờ duyệt"
      filterAppointment.status = { $in: ["Chờ xác nhận", "pending"] };
      filterGrooming.status = { $in: ["pending"] };
    }
    // Mặc định hoặc showAll="true": hiển thị tất cả các ca để Lễ tân theo dõi được hóa đơn và trạng thái!

    if (date) {
      const { dateISO, dateVN } = normalizeDateFormats(date);
      const dateValues = [...new Set([String(date).trim(), dateISO, dateVN].filter(Boolean))];
      filterAppointment.$and = filterAppointment.$and || [];
      filterAppointment.$and.push({
        $or: [{ date: { $in: dateValues } }, { dateISO: { $in: dateValues } }],
      });
      filterGrooming.$and = filterGrooming.$and || [];
      filterGrooming.$and.push({
        $or: [{ date: { $in: dateValues } }, { dateISO: { $in: dateValues } }],
      });
    } else if (month) {
      const monthPrefix = new RegExp(`^${escapeRegex(month)}`);
      filterAppointment.dateISO = monthPrefix;
      filterGrooming.dateISO = monthPrefix;
    }

    if (search && String(search).trim()) {
      const regex = new RegExp(escapeRegex(String(search).trim()), "i");
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

    // Tìm hóa đơn khớp theo SĐT khách hàng hoặc Customer ID (lọc chỉ giữ ObjectId hợp lệ)
    const allPhones = [...new Set([
      ...appointments.map((a) => a.ownerPhone).filter(Boolean),
      ...groomings.map((g) => g.customerPhone).filter(Boolean),
    ])];
    const validCustomerIds = [...new Set([
      ...appointments.map((a) => String(a.userId || a.ownerId || "")).filter(Boolean),
      ...groomings.map((g) => String(g.customerId || "")).filter(Boolean),
    ])].filter((id) => mongoose.Types.ObjectId.isValid(id));

    const invoiceOr = [];
    if (allPhones.length > 0) invoiceOr.push({ customerPhone: { $in: allPhones } });
    if (validCustomerIds.length > 0) invoiceOr.push({ customerId: { $in: validCustomerIds } });

    const invoices =
      invoiceOr.length > 0
        ? await Invoice.find({ $or: invoiceOr, isDeleted: false }).lean()
        : [];

    const invoiceByPhoneMap = new Map();
    invoices.forEach((inv) => {
      const keyPhone = inv.customerPhone;
      const keyCustId = inv.customerId ? String(inv.customerId) : null;

      const item = {
        id: inv._id,
        invoiceCode: inv.invoiceCode,
        totalAmount: inv.totalAmount,
        status: inv.status,
        createdAt: inv.createdAt,
      };

      if (keyPhone) {
        if (!invoiceByPhoneMap.has(keyPhone)) invoiceByPhoneMap.set(keyPhone, []);
        invoiceByPhoneMap.get(keyPhone).push(item);
      }
      if (keyCustId) {
        if (!invoiceByPhoneMap.has(keyCustId)) invoiceByPhoneMap.set(keyCustId, []);
        invoiceByPhoneMap.get(keyCustId).push(item);
      }
    });

    const enrichedAppointments = appointments.map((a) => {
      const matchedInvoices = [
        ...(invoiceByPhoneMap.get(a.ownerPhone) || []),
        ...(invoiceByPhoneMap.get(String(a.userId || a.ownerId)) || []),
      ];
      // Loại bỏ trùng lặp hóa đơn nếu có
      const uniqueInvoices = Array.from(new Map(matchedInvoices.map(i => [String(i.id), i])).values());

      return {
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
        doctorName:
          a.doctorName ||
          (a.notes?.includes("BS") ? a.notes : (a.id_bac_sy ? `BS. [${a.id_bac_sy}]` : "Chưa phân công")),
        invoices: uniqueInvoices,
      };
    });

    const enrichedGroomings = groomings.map((g) => {
      const matchedInvoices = [
        ...(invoiceByPhoneMap.get(g.customerPhone) || []),
        ...(invoiceByPhoneMap.get(String(g.customerId)) || []),
      ];
      const uniqueInvoices = Array.from(new Map(matchedInvoices.map(i => [String(i.id), i])).values());

      return {
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
        invoices: uniqueInvoices,
      };
    });

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

    if (search && String(search).trim()) {
      const regex = new RegExp(escapeRegex(String(search).trim()), "i");
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
      isDeleted: false,
      status: "dispensed",
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
    const body = req.body || {};
    const { action, type, id_bac_sy, cancelReason } = body;

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
      let grooming = null;
      if (mongoose.Types.ObjectId.isValid(id)) {
        grooming = await Grooming.findById(id);
      }
      if (!grooming) {
        grooming = await Grooming.findOne({ groomingCode: id, isDeleted: false });
      }
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
        if (cancelReason) {
          grooming.note = grooming.note ? `${grooming.note} | [Lý do hủy: ${cancelReason}]` : `[Lý do hủy: ${cancelReason}]`;
        }
        await grooming.save();
        return res.status(200).json({
          success: true,
          message: `Đã hủy lịch [${grooming.groomingCode}] thành công.`,
        });
      }
    } else {
      // type === "appointment" hoặc tìm theo ID / bookingCode
      let appointment = null;
      if (mongoose.Types.ObjectId.isValid(id)) {
        appointment = await Appointment.findById(id);
      }
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
        appointment.doctorName = doctor.name;
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
        appointment.slotReserved = false;
        appointment.cancelledAt = new Date();
        appointment.cancelReason = cancelReason || "Lễ tân hủy đơn";
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

// 4. Tra cứu thông tin tổng hợp cho Lễ tân (GET /api/receptionist/lookup?q=...)
const lookupReceptionistInfo = async (req, res) => {
  try {
    const auth = await verifyReceptionistCaller(req);
    if (!auth.authorized) {
      return res.status(auth.status).json({ success: false, message: auth.message });
    }

    const { q, search } = req.query;
    const queryStr = (q || search || "").trim();

    if (!queryStr) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng nhập từ khóa tra cứu (SĐT, tên khách hàng, tên thú cưng, mã hóa đơn/lịch hẹn)!",
      });
    }

    const regex = new RegExp(escapeRegex(queryStr), "i");
    const Pet = require("../models/pet");

    // 1. Tra cứu Khách hàng
    const customers = await User.find({
      $or: [{ name: regex }, { fullName: regex }, { phone: regex }, { email: regex }],
    })
      .select("name fullName phone email address role role_id createdAt")
      .lean();

    // 2. Tra cứu Thú cưng
    const pets = await Pet.find({
      $or: [{ name: regex }, { species: regex }, { breed: regex }],
    }).lean();

    // 3. Tra cứu Lịch khám & Grooming
    const [appointments, groomings] = await Promise.all([
      Appointment.find({
        $or: [
          { bookingCode: regex },
          { ownerName: regex },
          { ownerPhone: regex },
          { petName: regex },
          { serviceName: regex },
        ],
      }).sort({ createdAt: -1 }).lean(),
      Grooming.find({
        $or: [
          { groomingCode: regex },
          { customerName: regex },
          { customerPhone: regex },
          { petName: regex },
          { serviceName: regex },
        ],
        isDeleted: false,
      }).sort({ createdAt: -1 }).lean(),
    ]);

    // 4. Tra cứu Hóa đơn
    const invoices = await Invoice.find({
      $or: [
        { invoiceCode: regex },
        { customerName: regex },
        { customerPhone: regex },
        { petName: regex },
        { prescriptionCode: regex },
      ],
      isDeleted: false,
    }).sort({ createdAt: -1 }).lean();

    // 5. Tra cứu Đơn thuốc
    const prescriptions = await Prescription.find({
      $or: [
        { prescriptionCode: regex },
        { petName: regex },
        { diagnosis: regex },
        { recordCode: regex },
      ],
      isDeleted: false,
    }).sort({ createdAt: -1 }).lean();

    return res.status(200).json({
      success: true,
      query: queryStr,
      results: {
        customersCount: customers.length,
        customers,
        petsCount: pets.length,
        pets,
        appointmentsCount: appointments.length,
        appointments,
        groomingsCount: groomings.length,
        groomings,
        invoicesCount: invoices.length,
        invoices,
        prescriptionsCount: prescriptions.length,
        prescriptions,
      },
    });
  } catch (error) {
    console.error("Lỗi tra cứu thông tin lễ tân:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi máy chủ khi tra cứu thông tin.",
    });
  }
};

module.exports = {
  getAllAppointmentsWithInvoices,
  getPrescriptionsWithDispensings,
  confirmOrCancelAppointment,
  lookupReceptionistInfo,
  verifyReceptionistCaller,
};
