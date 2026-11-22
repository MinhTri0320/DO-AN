const User = require("../models/user");
const Doctor = require("../models/doctor");
const Role = require("../models/role");

/**
 * Middleware kiểm tra quyền Quản trị viên (Admin - role_id = 1)
 */
async function verifyAdminCaller(req) {
  const callerId =
    req.headers["x-user-id"] ||
    req.headers["user-id"] ||
    req.query.adminId ||
    req.body.adminId;

  if (!callerId) {
    return {
      authorized: false,
      status: 401,
      message: "Vui lòng cung cấp định danh Admin (x-user-id) để thực hiện thao tác này.",
    };
  }

  const caller = await User.findById(callerId).lean();
  if (!caller || (caller.role_id !== 1 && caller.role !== "admin")) {
    return {
      authorized: false,
      status: 403,
      message: "Quyền truy cập bị từ chối! Chức năng này chỉ dành riêng cho Quản trị viên (Admin).",
    };
  }

  return { authorized: true, caller };
}

// 1. Lấy danh sách người dùng cho Admin (GET /api/admin/users)
// Tìm kiếm song song theo tên và số điện thoại
const getUsers = async (req, res) => {
  try {
    const auth = await verifyAdminCaller(req);
    if (!auth.authorized) {
      return res.status(auth.status).json({ success: false, message: auth.message });
    }

    const { search, role_id, role } = req.query;
    const filter = { isDeleted: { $ne: true } };

    // Tìm kiếm song song theo Tên hoặc Số điện thoại
    if (search && search.trim()) {
      const regex = new RegExp(search.trim(), "i");
      filter.$or = [{ name: regex }, { phone: regex }];
    }

    if (role_id) {
      filter.role_id = Number(role_id);
    } else if (role) {
      filter.role = String(role).trim();
    }

    const users = await User.find(filter)
      .select("-password")
      .sort({ createdAt: -1 })
      .lean();

    // Ghép thêm thông tin id_bac_sy nếu user là bác sĩ
    const doctorList = await Doctor.find({ isActive: true }).lean();
    const doctorMap = new Map();
    doctorList.forEach((d) => doctorMap.set(String(d.userId), d));

    const enrichedUsers = users.map((u) => {
      const doc = doctorMap.get(String(u._id));
      return {
        ...u,
        role_id: u.role_id || (u.role === "admin" ? 1 : u.role === "doctor" ? 2 : u.role === "receptionist" ? 3 : 4),
        id_bac_sy: doc ? doc.id_bac_sy : null,
        doctorOrder: doc ? doc.order : null,
      };
    });

    return res.status(200).json({
      success: true,
      count: enrichedUsers.length,
      users: enrichedUsers,
    });
  } catch (error) {
    console.error("Lỗi lấy danh sách người dùng admin:", error);
    return res.status(500).json({ success: false, message: "Lỗi máy chủ khi lấy danh sách người dùng." });
  }
};

// 2. Admin cập nhật role thủ công cho người dùng (PATCH /api/admin/users/:id/role)
const updateUserRole = async (req, res) => {
  try {
    const auth = await verifyAdminCaller(req);
    if (!auth.authorized) {
      return res.status(auth.status).json({ success: false, message: auth.message });
    }

    const { id } = req.params;
    let { role_id, role } = req.body;

    const targetUser = await User.findById(id);
    if (!targetUser) {
      return res.status(404).json({ success: false, message: "Không tìm thấy người dùng cần phân quyền." });
    }

    // Quy tắc bảo vệ Admin:
    // Admin chỉ có thể tự đổi role của chính mình khi trong hệ thống có nhiều hơn 2 Admin
    if (String(auth.caller._id) === String(targetUser._id)) {
      const adminCount = await User.countDocuments({
        $or: [{ role_id: 1 }, { role: "admin" }],
        isDeleted: { $ne: true },
      });

      if (adminCount <= 2) {
        return res.status(400).json({
          success: false,
          message: `Không thể tự đổi quyền Admin của chính mình khi hệ thống chỉ có ${adminCount} Admin! Hệ thống yêu cầu phải có nhiều hơn 2 Admin mới cho phép tự đổi quyền.`,
        });
      }
    }

    const roleToId = {
      admin: 1,
      doctor: 2,
      receptionist: 3,
      pet_owner: 4,
    };
    const idToRole = {
      1: "admin",
      2: "doctor",
      3: "receptionist",
      4: "pet_owner",
    };

    if (role_id !== undefined) {
      role_id = Number(role_id);
      role = idToRole[role_id] || "pet_owner";
    } else if (role) {
      role = String(role).trim().toLowerCase();
      role_id = roleToId[role] || 4;
    } else {
      return res.status(400).json({ success: false, message: "Vui lòng cung cấp role_id (1, 2, 3, 4) hoặc role." });
    }

    targetUser.role = role;
    targetUser.role_id = role_id;
    await targetUser.save();

    let doctorInfo = null;

    // Nếu phân quyền thành Bác sĩ (role_id = 2) -> tự động tạo/kích hoạt bác sĩ với mã bs0xxxx
    if (role_id === 2) {
      const doc = await Doctor.syncDoctorFromUser(targetUser);
      doctorInfo = {
        id_bac_sy: doc.id_bac_sy,
        order: doc.order,
      };
      console.log(`✓ Đã tự động tạo/kích hoạt bác sĩ [${doc.id_bac_sy}] cho người dùng: ${targetUser.name}`);
    } else {
      // Nếu đổi khỏi quyền bác sĩ -> chuyển trạng thái bác sĩ thành không hoạt động
      await Doctor.updateOne({ userId: targetUser._id }, { $set: { isActive: false } });
    }

    return res.status(200).json({
      success: true,
      message: `Phân quyền thành công cho người dùng "${targetUser.name}" sang vai trò: ${role} (role_id: ${role_id})`,
      user: {
        id: targetUser._id,
        name: targetUser.name,
        phone: targetUser.phone,
        role: targetUser.role,
        role_id: targetUser.role_id,
        id_bac_sy: doctorInfo ? doctorInfo.id_bac_sy : null,
      },
    });
  } catch (error) {
    console.error("Lỗi cập nhật phân quyền người dùng:", error);
    return res.status(500).json({ success: false, message: "Lỗi máy chủ khi cập nhật phân quyền." });
  }
};

// 3. Lấy danh sách các Bác sĩ đang hoạt động (GET /api/doctors)
const getDoctors = async (req, res) => {
  try {
    const doctors = await Doctor.find({ isActive: true })
      .sort({ order: 1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: doctors.length,
      doctors,
    });
  } catch (error) {
    console.error("Lỗi lấy danh sách bác sĩ:", error);
    return res.status(500).json({ success: false, message: "Lỗi máy chủ khi lấy danh sách bác sĩ." });
  }
};

// 4. Lấy danh sách danh mục các vai trò trong MongoDB (GET /api/admin/roles)
const getRoles = async (req, res) => {
  try {
    let roles = await Role.find({}).sort({ role_id: 1 }).lean();
    if (!roles || roles.length === 0) {
      await Role.seedDefaultRoles();
      roles = await Role.find({}).sort({ role_id: 1 }).lean();
    }
    return res.status(200).json({
      success: true,
      roles,
    });
  } catch (error) {
    console.error("Lỗi lấy danh mục vai trò:", error);
    return res.status(200).json({
      success: true,
      roles: Role.DEFAULT_ROLES,
    });
  }
};

module.exports = {
  getUsers,
  updateUserRole,
  getDoctors,
  getRoles,
  verifyAdminCaller,
};
