const mongoose = require("mongoose");
const Dispensing = require("../models/dispensing");
const Medicine = require("../models/medicine");
const Prescription = require("../models/prescription");
const Pet = require("../models/pet");
const User = require("../models/user");

// 1. Cấp thuốc theo đơn (POST /api/dispensing)
// Kiểm tra tồn kho, hạn dùng, chặn cấp lặp, tự động trừ quantity và lưu lịch sử cấp
const dispensePrescription = async (req, res) => {
  try {
    const body = req.body || {};
    const {
      prescriptionId,
      prescriptionCode,
      items: rawItems,
      dispensedBy,
      dispensedAt,
      petId,
      petName,
      customerId,
      customerName,
      notes,
      note,
    } = body;

    const presId = prescriptionId || prescriptionCode;
    if (!presId) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng cung cấp mã đơn thuốc (prescriptionId).",
      });
    }

    let itemsToDispense = rawItems;
    let targetPetId = petId || "";
    let targetPetName = petName || "Bé cưng";
    let targetCustomerId = customerId || "";
    let targetCustomerName = customerName || "Khách hàng";

    const presIdStr = String(presId).trim();
    const rxOrConditions = [{ prescriptionCode: presIdStr }];
    if (mongoose.Types.ObjectId.isValid(presIdStr)) {
      rxOrConditions.unshift({ _id: presIdStr });
    }

    // Nếu không truyền items từ client, tự động đọc đơn thuốc từ Model Prescription (Sprint 3)
    if (!itemsToDispense || !Array.isArray(itemsToDispense) || itemsToDispense.length === 0) {
      const rx = await Prescription.findOne({
        $or: rxOrConditions,
        isDeleted: false,
      }).lean();

      if (!rx) {
        return res.status(404).json({
          success: false,
          message: `Không tìm thấy đơn thuốc [${presIdStr}] trong hệ thống để cấp thuốc.`,
        });
      }

      targetPetId = rx.petId || targetPetId;
      targetPetName = rx.petName || targetPetName;

      // Chuyển đổi danh sách thuốc trong Prescription sang items cấp thuốc
      itemsToDispense = (rx.medicines || []).map((m) => {
        // Tách số lượng từ chuỗi (ví dụ: "14 viên" -> 14, hoặc mặc định 1)
        const qtyMatch = String(m.quantity || "").match(/\d+/);
        const qty = qtyMatch ? parseInt(qtyMatch[0], 10) : 1;
        return {
          medicineName: m.name,
          quantity: qty > 0 ? qty : 1,
          notes: m.instructions || m.dosage || "",
        };
      });

      if (itemsToDispense.length === 0) {
        return res.status(400).json({
          success: false,
          message: `Đơn thuốc [${presIdStr}] không có danh mục thuốc nào để cấp phát.`,
        });
      }
    }

    // Nếu chưa có targetCustomerId hợp lệ, tự tìm Pet theo petId/petName để lấy ownerId và tên chủ nuôi
    if (!targetCustomerId || !mongoose.Types.ObjectId.isValid(targetCustomerId)) {
      let foundPet = null;
      if (targetPetId && mongoose.Types.ObjectId.isValid(targetPetId)) {
        foundPet = await Pet.findById(targetPetId).lean();
      }
      if (!foundPet && targetPetName && targetPetName !== "Bé cưng") {
        foundPet = await Pet.findOne({ name: targetPetName }).lean();
      }
      if (foundPet && foundPet.ownerId) {
        targetCustomerId = String(foundPet.ownerId);
        if (!targetPetId) {
          targetPetId = String(foundPet._id);
        }
      }
    }

    if (
      targetCustomerId &&
      mongoose.Types.ObjectId.isValid(targetCustomerId) &&
      (!customerName || targetCustomerName === "Khách hàng")
    ) {
      const owner = await User.findById(targetCustomerId).select("name phone").lean();
      if (owner && owner.name) {
        targetCustomerName = owner.name;
      }
    }

    // Gọi hàm static dispensePrescription trong Model Dispensing
    // (đã bao gồm: 1. Chặn cấp lặp, 2. Kiểm tra hết hạn, 3. Kiểm tra tồn kho, 4. Trừ kho nguyên tử)
    const newDispensing = await Dispensing.dispensePrescription({
      prescriptionId: presIdStr,
      items: itemsToDispense,
      dispensedBy: dispensedBy || "Dược sĩ PawnCare",
      dispensedAt: dispensedAt || new Date(),
      petId: targetPetId,
      petName: targetPetName,
      customerId: targetCustomerId,
      customerName: targetCustomerName,
      notes: notes || note || "",
    });

    // Cập nhật trạng thái đơn thuốc nếu tìm thấy trong Prescription
    await Prescription.findOneAndUpdate(
      { $or: rxOrConditions },
      {
        $set: {
          dispensed: true,
          dispensedAt: newDispensing.dispensedAt,
          dispensingCode: newDispensing.dispensingCode,
        },
      }
    ).catch(() => {});

    console.log(`✓ Cấp thuốc thành công cho đơn [${presId}] - Mã lượt cấp: ${newDispensing.dispensingCode}`);

    return res.status(201).json({
      success: true,
      message: `Cấp thuốc cho đơn [${presId}] thành công! Đã tự động cập nhật trừ tồn kho.`,
      dispensing: newDispensing,
    });
  } catch (error) {
    console.error("Lỗi cấp thuốc theo đơn:", error.message);
    return res.status(400).json({
      success: false,
      message: error.message || "Không thể thực hiện cấp thuốc theo đơn.",
    });
  }
};

// 2. Lấy danh sách các lượt cấp thuốc (GET /api/dispensing)
const getDispensings = async (req, res) => {
  try {
    const { prescriptionId, petId } = req.query;
    let list = [];

    if (prescriptionId) {
      list = await Dispensing.findByPrescription(prescriptionId).lean();
    } else if (petId) {
      list = await Dispensing.findByPet(petId).lean();
    } else {
      list = await Dispensing.listAll().lean();
    }

    return res.status(200).json({
      success: true,
      count: list.length,
      dispensings: list,
    });
  } catch (error) {
    console.error("Lỗi lấy danh sách cấp thuốc:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi máy chủ khi lấy lịch sử cấp thuốc.",
    });
  }
};

// 3. Chi tiết lượt cấp thuốc theo ID hoặc dispensingCode (GET /api/dispensing/:id)
const getDispensingById = async (req, res) => {
  try {
    const { id } = req.params;
    const dispensing = await Dispensing.findOne({
      $or: [
        { _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null },
        { dispensingCode: id },
      ],
      isDeleted: false,
    })
      .populate("items.medicineId", "name unit price expiryDate")
      .lean();

    if (!dispensing) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy thông tin lượt cấp thuốc.",
      });
    }

    return res.status(200).json({
      success: true,
      dispensing,
    });
  } catch (error) {
    console.error("Lỗi lấy chi tiết cấp thuốc:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi máy chủ khi lấy chi tiết lượt cấp thuốc.",
    });
  }
};

module.exports = {
  dispensePrescription,
  getDispensings,
  getDispensingById,
};
