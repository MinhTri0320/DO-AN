const Medicine = require("../models/medicine");

function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// 1. Lấy danh sách thuốc (GET /api/medicines)
// Hỗ trợ tìm kiếm theo tên, lọc kết hợp đồng thời theo trạng thái kho (Hết hàng, Hết hạn, Còn hàng)
const getMedicines = async (req, res) => {
  try {
    const { search, stockStatus } = req.query;
    const now = new Date();
    const filter = { isDeleted: false };

    if (search && String(search).trim()) {
      const regex = new RegExp(escapeRegex(String(search).trim()), "i");
      filter.$or = [
        { name: regex },
        { activeIngredient: regex },
        { medicineCode: regex },
      ];
    }

    if (stockStatus === "Hết hàng") {
      filter.quantity = { $lte: 0 };
    } else if (stockStatus === "Hết hạn") {
      filter.expiryDate = { $lt: now };
    } else if (stockStatus === "Còn hàng") {
      filter.quantity = { $gt: 0 };
      filter.expiryDate = { $gte: now };
    }

    const sortOrder = stockStatus === "Hết hạn" ? { expiryDate: 1 } : { name: 1 };
    const medicines = await Medicine.find(filter).sort(sortOrder).lean();

    // Gắn thêm nhãn stockStatus (Hết hàng, Hết hạn, Còn hàng)
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
    const body = req.body || {};
    const {
      name,
      activeIngredient,
      unit,
      price,
      quantity,
      expiryDate,
      description,
      manufacturer,
    } = body;

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
    const body = req.body || {};

    const allowedFields = [
      "name",
      "activeIngredient",
      "unit",
      "price",
      "quantity",
      "expiryDate",
      "description",
      "manufacturer",
    ];
    const updateData = {};

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    if (updateData.price !== undefined) {
      const priceNum = Number(updateData.price);
      if (isNaN(priceNum) || priceNum <= 0) {
        return res.status(400).json({
          success: false,
          message: "Giá thuốc phải là số lớn hơn 0!",
        });
      }
      updateData.price = priceNum;
    }

    if (updateData.quantity !== undefined) {
      const qtyNum = Number(updateData.quantity);
      if (isNaN(qtyNum) || qtyNum < 0) {
        return res.status(400).json({
          success: false,
          message: "Số lượng tồn kho không được âm (>= 0)!",
        });
      }
      updateData.quantity = qtyNum;
    }

    if (updateData.expiryDate !== undefined) {
      const parsedDate = new Date(updateData.expiryDate);
      if (isNaN(parsedDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: "Hạn dùng (expiryDate) không hợp lệ!",
        });
      }
      updateData.expiryDate = parsedDate;
    }

    for (const strField of ["name", "activeIngredient", "unit", "description", "manufacturer"]) {
      if (typeof updateData[strField] === "string") {
        updateData[strField] = updateData[strField].trim();
      }
    }

    const updated = await Medicine.findOneAndUpdate(
      {
        $or: [
          { _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null },
          { medicineCode: id },
        ],
        isDeleted: false,
      },
      { $set: updateData },
      { new: true, runValidators: true }
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
