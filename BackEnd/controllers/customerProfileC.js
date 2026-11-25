const mongoose = require("mongoose");
const User = require("../models/user");
const Doctor = require("../models/doctor");

const ROLE_MAP = {
  admin: 1,
  doctor: 2,
  receptionist: 3,
  pet_owner: 4,
};

const normalizePhone = (raw) => {
  if (typeof raw !== "string") return "";
  let cleaned = raw.replace(/[\s\-().]+/g, "").trim();
  if (cleaned.startsWith("+84")) {
    cleaned = "0" + cleaned.slice(3);
  } else if (cleaned.startsWith("84") && cleaned.length === 11) {
    cleaned = "0" + cleaned.slice(2);
  }
  return cleaned;
};

const resolveValidObjectId = (...candidates) => {
  for (const candidate of candidates) {
    if (typeof candidate === "string" && mongoose.Types.ObjectId.isValid(candidate.trim())) {
      return candidate.trim();
    }
  }
  return null;
};

/**
 * Tìm user an toàn:
 * - Ưu tiên x-user-id / user-id / req.body.id (nếu ObjectId hợp lệ)
 * - Chỉ fallback sang phone (chuẩn hóa) theo chính sách của endpoint
 */
const findActiveUserSafely = async (
  req,
  { allowPhoneFallbackWhenIdNotFound = false } = {}
) => {
  const body = req.body || {};
  const query = req.query || {};

  const validId = resolveValidObjectId(
    req.headers["x-user-id"],
    req.headers["user-id"],
    body.id,
    body._id,
    query.id,
    query.userId
  );

  if (validId) {
    const userById = await User.findOne({
      _id: validId,
      isDeleted: { $ne: true },
    });
    if (userById) {
      return { user: userById, missingIdentifier: false };
    }
    if (!allowPhoneFallbackWhenIdNotFound) {
      return { user: null, missingIdentifier: false };
    }
  }

  const rawPhone =
    typeof query.phone === "string" && query.phone.trim()
      ? query.phone
      : typeof body.phone === "string" && body.phone.trim()
        ? body.phone
        : "";
  const normalizedPhone = normalizePhone(rawPhone);

  if (normalizedPhone) {
    const userByPhone = await User.findOne({
      phone: normalizedPhone,
      isDeleted: { $ne: true },
    });
    return { user: userByPhone, missingIdentifier: false };
  }

  return { user: null, missingIdentifier: !validId };
};

const formatUserProfile = async (user) => {
  const role_id = user.role_id || ROLE_MAP[user.role] || 4;
  let id_bac_sy = user.id_bac_sy || null;

  if (!id_bac_sy && role_id === 2) {
    const doc = await Doctor.findOne({ userId: user._id, isActive: true }).lean();
    if (doc) id_bac_sy = doc.id_bac_sy;
  }

  const addr = user.address || {};

  return {
    id: user._id,
    name: user.name || "",
    phone: user.phone || "",
    email: user.email || "",
    dob: user.dob || "",
    gender: user.gender || "other",
    address: {
      houseNumber: addr.houseNumber || "",
      street: addr.street || "",
      ward: addr.ward || "",
      district: addr.district || "",
      city: addr.city || "TP. Đà Nẵng",
    },
    role: user.role || "pet_owner",
    role_id,
    id_bac_sy,
  };
};

// Xem hồ sơ khách hàng
const getProfile = async (req, res) => {
  try {
    const { user, missingIdentifier } = await findActiveUserSafely(req, {
      allowPhoneFallbackWhenIdNotFound: true,
    });

    if (missingIdentifier) {
      return res.status(400).json({
        message: "Thiếu số điện thoại hoặc định danh người dùng",
      });
    }

    if (!user) {
      return res.status(404).json({
        message: "Không tìm thấy tài khoản",
      });
    }

    const formattedUser = await formatUserProfile(user);

    return res.status(200).json({
      message: "Lấy hồ sơ thành công",
      user: formattedUser,
    });
  } catch (error) {
    console.log("Lỗi lấy hồ sơ:", error);

    return res.status(500).json({
      message: "Lỗi server",
    });
  }
};

// Cập nhật hồ sơ khách hàng
const updateProfile = async (req, res) => {
  try {
    const body = req.body || {};

    // Xác định user theo x-user-id / body.id hợp lệ trước, chỉ fallback phone nếu KHÔNG có ID
    const { user, missingIdentifier } = await findActiveUserSafely(req, {
      allowPhoneFallbackWhenIdNotFound: false,
    });

    if (missingIdentifier) {
      return res.status(400).json({
        message: "Thiếu định danh hoặc số điện thoại người dùng",
      });
    }

    if (!user) {
      return res.status(404).json({
        message: "Không tìm thấy tài khoản",
      });
    }

    if (typeof body.name === "string" && body.name.trim()) {
      user.name = body.name.trim();
    }

    if (body.phone !== undefined && body.phone !== null && String(body.phone).trim() !== "") {
      const nextPhone = normalizePhone(String(body.phone));
      if (!/^0\d{9}$/.test(nextPhone)) {
        return res.status(400).json({
          message: "Số điện thoại không hợp lệ (phải gồm 10 chữ số và bắt đầu bằng số 0)",
        });
      }

      if (nextPhone !== user.phone) {
        const duplicateUser = await User.findOne({
          phone: nextPhone,
          _id: { $ne: user._id },
        }).lean();

        if (duplicateUser) {
          return res.status(409).json({
            message: "Số điện thoại này đã được tài khoản khác sử dụng",
          });
        }

        user.phone = nextPhone;
      }
    }

    if (typeof body.email === "string") {
      user.email = body.email.trim().toLowerCase();
    }

    if (typeof body.dob === "string") {
      user.dob = body.dob.trim();
    }

    if (typeof body.gender === "string" && body.gender.trim()) {
      user.gender = body.gender.trim();
    }

    if (body.address && typeof body.address === "object") {
      const currentAddr = user.address
        ? typeof user.address.toObject === "function"
          ? user.address.toObject()
          : { ...user.address }
        : {};
      const incoming = body.address;

      const nextHouseNumber =
        typeof incoming.houseNumber === "string" && incoming.houseNumber.trim() !== ""
          ? incoming.houseNumber.trim()
          : currentAddr.houseNumber || "";

      user.address = {
        houseNumber: nextHouseNumber,
        street:
          typeof incoming.street === "string"
            ? incoming.street.trim()
            : currentAddr.street || "",
        ward:
          typeof incoming.ward === "string"
            ? incoming.ward.trim()
            : currentAddr.ward || "",
        district:
          typeof incoming.district === "string"
            ? incoming.district.trim()
            : currentAddr.district || "",
        city:
          typeof incoming.city === "string" && incoming.city.trim() !== ""
            ? incoming.city.trim()
            : currentAddr.city || "TP. Đà Nẵng",
      };
    }

    await user.save();

    const formattedUser = await formatUserProfile(user);

    return res.status(200).json({
      message: "Cập nhật hồ sơ thành công",
      user: formattedUser,
    });
  } catch (error) {
    if (error && error.code === 11000) {
      return res.status(409).json({
        message: "Số điện thoại này đã được tài khoản khác sử dụng",
      });
    }

    console.log("Lỗi cập nhật hồ sơ:", error);

    return res.status(500).json({
      message: "Lỗi server",
    });
  }
};

module.exports = {
  getProfile,
  updateProfile,
};
