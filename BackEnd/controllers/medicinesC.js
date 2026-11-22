const Medicine = require("../models/medicine");

// 1. Lấy danh sách thuốc (GET /api/medicines)
// Hỗ trợ tìm kiếm theo tên, lọc theo trạng thái kho (Hết hàng, Hết hạn, Còn hàng)
const getMedicines = async (req, res) => {
  try {
    const { search, stockStatus } = req.query;
    let medicines = [];

    if (search && search.trim()) {
      medicines = await Medicine.findByName(search).lean();
    } else if (stockStatus === "Hết hàng") {
      medicines = await Medicine.findOutOfStock().lean();
    } else if (stockStatus === "Hết hạn") {
      medicines = await Medicine.findExpired().lean();
    } else if (stockStatus === "Còn hàng") {
      medicines = await Medicine.findAvailable().lean();
    } else {
      medicines = await Medicine.find({ isDeleted: false }).sort({ name: 1 }).lean();
    }

    // Gắn thêm nhãn stockStatus (Hết hàng, Hết hạn, Còn hàng)
    const now = new Date();
    const enrichedMedicines = medicines.map((m) => {
      let status = "Còn hàng";
      if (m.expiryDate && new Date(m.expiryDate) < now) {
        status = "Hết hạn";
      } else if (m.quantity <= 0) {
        status = "Hết hàng";
      }
      return {
        ...m,
        stockStatus: status,
        isOutOfStock: m.quantity <= 0,
        isExpired: m.expiryDate ? new Date(m.expiryDate) < now : false,
      };
    });

    return res.status(200).json({
      success: true,
      count: enrichedMedicines.length,
      medicines: enrichedMedicines,
    });
  } catch (error) {
    console.error("Lỗi lấy danh sách thuốc:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi máy chủ khi lấy danh mục thuốc.",
    });
  }
};

// 2. Chi tiết thuốc theo ID hoặc medicineCode (GET /api/medicines/:id)
const getMedicineById = async (req, res) => {
  try {
    const { id } = req.params;
    const medicine = await Medicine.findOne({
      $or: [
        { _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null },
        { medicineCode: id },
      ],
      isDeleted: false,
    }).lean();

    if (!medicine) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy thông tin thuốc trong kho.",
      });
    }

    const now = new Date();
    let status = "Còn hàng";
    if (medicine.expiryDate && new Date(medicine.expiryDate) < now) {
      status = "Hết hạn";
    } else if (medicine.quantity <= 0) {
      status = "Hết hàng";
    }

    return res.status(200).json({
      success: true,
      medicine: {
        ...medicine,
        stockStatus: status,
      },
    });
  } catch (error) {
    console.error("Lỗi lấy chi tiết thuốc:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi máy chủ khi lấy chi tiết thuốc.",
    });
  }
};

// 3. Thêm mới thuốc vào kho (POST /api/medicines)
const createMedicine = async (req, res) => {
  try {
    const {
      name,
      activeIngredient,
      unit,
      price,
      quantity,
      expiryDate,
      description,
      manufacturer,
    } = req.body;

    if (!name || !unit || price === undefined || quantity === undefined || !expiryDate) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng nhập đầy đủ: Tên thuốc, đơn vị, giá, số lượng tồn và hạn dùng!",
      });
    }

    const priceNum = Number(price);
    const qtyNum = Number(quantity);

    // Ràng buộc nghiệp vụ: Số lượng tồn không được âm, giá phải lớn hơn 0
    if (isNaN(priceNum) || priceNum <= 0) {
      return res.status(400).json({
        success: false,
        message: "Giá thuốc phải là số lớn hơn 0!",
      });
    }

    if (isNaN(qtyNum) || qtyNum < 0) {
      return res.status(400).json({
        success: false,
        message: "Số lượng tồn kho không được âm (>= 0)!",
      });
    }

    const randomNum = Math.floor(100 + Math.random() * 900);
    const medicineCode = `MED-${new Date().getFullYear()}-${randomNum}`;

    const newMedicine = await Medicine.create({
      medicineCode,
      name: name.trim(),
      activeIngredient: activeIngredient ? activeIngredient.trim() : "",
      unit: unit.trim(),
      price: priceNum,
      quantity: qtyNum,
      expiryDate: new Date(expiryDate),
      description: description ? description.trim() : "",
      manufacturer: manufacturer ? manufacturer.trim() : "Dược phẩm thú y",
    });

    return res.status(201).json({
      success: true,
      message: `Đã thêm thuốc "${newMedicine.name}" vào kho thành công!`,
      medicine: newMedicine,
    });
  } catch (error) {
    console.error("Lỗi tạo thuốc:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Không thể thêm thuốc mới vào kho.",
    });
  }
};

// 4. Sửa thông tin thuốc (PUT /api/medicines/:id)
const updateMedicine = async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body || {};

    if (data.price !== undefined) {
      const priceNum = Number(data.price);
      if (isNaN(priceNum) || priceNum <= 0) {
        return res.status(400).json({
          success: false,
          message: "Giá thuốc phải là số lớn hơn 0!",
        });
      }
      data.price = priceNum;
    }

    if (data.quantity !== undefined) {
      const qtyNum = Number(data.quantity);
      if (isNaN(qtyNum) || qtyNum < 0) {
        return res.status(400).json({
          success: false,
          message: "Số lượng tồn kho không được âm (>= 0)!",
        });
      }
      data.quantity = qtyNum;
    }

    if (data.expiryDate) {
      data.expiryDate = new Date(data.expiryDate);
    }

    const updated = await Medicine.findOneAndUpdate(
      {
        $or: [
          { _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null },
          { medicineCode: id },
        ],
        isDeleted: false,
      },
      { $set: data },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy thuốc cần cập nhật.",
      });
    }

    return res.status(200).json({
      success: true,
      message: `Cập nhật thông tin thuốc "${updated.name}" thành công!`,
      medicine: updated,
    });
  } catch (error) {
    console.error("Lỗi cập nhật thuốc:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Không thể cập nhật thuốc.",
    });
  }
};

// 5. Xóa thuốc (Xóa mềm có xác nhận) (DELETE /api/medicines/:id)
const deleteMedicine = async (req, res) => {
  try {
    const { id } = req.params;

    const targetMedicine = await Medicine.findOne({
      $or: [
        { _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null },
        { medicineCode: id },
      ],
      isDeleted: false,
    });

    if (!targetMedicine) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy thuốc để xóa.",
      });
    }

    targetMedicine.isDeleted = true;
    await targetMedicine.save();

    return res.status(200).json({
      success: true,
      message: `Đã xóa thuốc "${targetMedicine.name}" khỏi danh mục thành công!`,
    });
  } catch (error) {
    console.error("Lỗi xóa thuốc:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi máy chủ khi xóa thuốc.",
    });
  }
};

module.exports = {
  getMedicines,
  getMedicineById,
  createMedicine,
  updateMedicine,
  deleteMedicine,
};
