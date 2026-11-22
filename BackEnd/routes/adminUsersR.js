const express = require("express");
const adminUsers = require("../controllers/adminUsersC");

const router = express.Router();

/* ============================================================
   ADMIN USER & ROLE MANAGEMENT ROUTES (Chỉ dành riêng cho Admin)
   ============================================================ */

// 0. Danh mục các vai trò chuẩn trong MongoDB
router.get("/admin/roles", adminUsers.getRoles);

// 1. Danh sách người dùng (tìm kiếm song song theo tên/số điện thoại, lọc theo role_id)
router.get("/admin/users", adminUsers.getUsers);

// 2. Chỉnh sửa role thủ công cho người dùng (tự sinh mã bs0xxxx nếu thành Bác sĩ)
router.patch("/admin/users/:id/role", adminUsers.updateUserRole);

// 3. Danh sách các Bác sĩ đang hoạt động
router.get("/doctors", adminUsers.getDoctors);

module.exports = router;
