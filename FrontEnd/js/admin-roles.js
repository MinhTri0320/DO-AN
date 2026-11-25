/* ============================================================
   admin-roles.js
   Quản lý phân quyền người dùng dành riêng cho Admin (role_id = 1)
   Hiển thị 3 cột/dòng: role_id_cu, tên người dùng, role_id_moi + update
   ============================================================ */

import { getCurrentUser, logoutUser, updateCurrentUser } from "./auth.js";
import { escapeHTML } from "./storage.js";
import { API_BASE_URL } from "./config.js";

let rolesList = [
  { role_id: 1, code: "admin", name: "Quản trị viên (Admin)" },
  { role_id: 2, code: "doctor", name: "Bác sĩ thú y (Doctor)" },
  { role_id: 3, code: "receptionist", name: "Nhân viên lễ tân (Receptionist)" },
  { role_id: 4, code: "pet_owner", name: "Khách hàng (Pet Owner)" },
];

let allUsers = [];

function showAlert(message, type = "success") {
  const alertBox = document.getElementById("alertBox");
  if (!alertBox) return;
  alertBox.textContent = message;
  alertBox.className = `admin-alert show ${type}`;
  setTimeout(() => {
    alertBox.className = "admin-alert";
  }, 4000);
}

// Kiểm tra quyền Admin khi truy cập trang
function checkAdminAuth() {
  const user = getCurrentUser();
  if (!user || (Number(user.role_id) !== 1 && user.role !== "admin")) {
    alert("Quyền truy cập bị từ chối! Trang này chỉ dành riêng cho Quản trị viên (Admin).");
    window.location.href = "./index.html";
    return null;
  }
  const greetingEl = document.getElementById("adminGreeting");
  if (greetingEl) greetingEl.textContent = `Admin: ${user.name}`;
  return user;
}

// Tải danh mục vai trò chuẩn từ MongoDB
async function loadRoles() {
  try {
    const res = await fetch(`${API_BASE_URL}/admin/roles`);
    if (res.ok) {
      const data = await res.json();
      if (data.roles && data.roles.length > 0) {
        rolesList = data.roles;
      }
    }
  } catch (err) {
    console.warn("Không thể tải roles từ API, dùng danh mục mặc định:", err);
  }
}

// Tải danh sách người dùng từ Backend
async function fetchUsers() {
  const currentUser = getCurrentUser();
  if (!currentUser) return;

  const roleFilter = document.getElementById("filterRoleOld").value;
  const searchInput = document.getElementById("searchUserName").value.trim();

  const tbody = document.getElementById("usersTableBody");
  tbody.innerHTML = `<tr><td colspan="3" class="empty-state">Đang tải danh sách người dùng...</td></tr>`;

  try {
    const queryParams = new URLSearchParams();
    if (roleFilter) queryParams.append("role_id", roleFilter);
    if (searchInput) queryParams.append("search", searchInput);

    const res = await fetch(`${API_BASE_URL}/admin/users?${queryParams.toString()}`, {
      headers: {
        "x-user-id": currentUser.id || currentUser._id,
      },
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || "Không thể tải danh sách người dùng.");
    }

    allUsers = data.users || [];
    const countEl = document.getElementById("totalUsersCount");
    if (countEl) countEl.textContent = allUsers.length;

    renderUsersTable(allUsers);
  } catch (err) {
    console.error("Lỗi fetchUsers:", err);
    tbody.innerHTML = `<tr><td colspan="3" class="empty-state" style="color: #c53030;">${escapeHTML(err.message || "Không thể tải danh sách người dùng.")}</td></tr>`;
  }
}

// Hiển thị bảng người dùng
function renderUsersTable(users) {
  const tbody = document.getElementById("usersTableBody");
  if (!users || users.length === 0) {
    tbody.innerHTML = `<tr><td colspan="3" class="empty-state">Không tìm thấy người dùng nào phù hợp.</td></tr>`;
    return;
  }

  tbody.innerHTML = users
    .map((u) => {
      const roleId = Number(u.role_id) || (u.role === "admin" ? 1 : u.role === "doctor" ? 2 : u.role === "receptionist" ? 3 : 4);
      const roleObj = rolesList.find((r) => r.role_id === roleId);
      const roleName = roleObj ? roleObj.name : `Vai trò ${roleId}`;

      const optionsHtml = rolesList
        .map(
          (r) =>
            `<option value="${Number(r.role_id)}" ${Number(r.role_id) === roleId ? "selected" : ""}>
              ${Number(r.role_id)} - ${escapeHTML(r.name || "")}
            </option>`
        )
        .join("");

      const safeUserId = escapeHTML(String(u._id || u.id || ""));
      const safeName = escapeHTML(u.name || "Chưa đặt tên");
      const safePhone = u.phone ? escapeHTML(String(u.phone)) : "";
      const safeDoctorCode = u.id_bac_sy ? escapeHTML(String(u.id_bac_sy)) : "";
      const safeRoleName = escapeHTML(roleName);

      return `
        <tr data-user-id="${safeUserId}">
          <td>
            <span class="role-badge role-${roleId}">
              ${roleId} - ${safeRoleName}
            </span>
          </td>
          <td>
            <div class="user-name-cell">${safeName}</div>
            ${safePhone ? `<div style="font-size: 12.5px; color: #7a6555; margin-top: 2px;">📞 ${safePhone}</div>` : ""}
            ${safeDoctorCode ? `<div style="font-size: 12px; color: #03543F; font-weight: 600; margin-top: 2px;">🩺 Mã BS: ${safeDoctorCode}</div>` : ""}
          </td>
          <td>
            <div class="action-cell">
              <select class="admin-select select-role-new" style="max-width: 240px;">
                ${optionsHtml}
              </select>
              <button type="button" class="btn-update-role" data-action="save">
                Cập nhật
              </button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");

  // Gắn sự kiện click cho các nút cập nhật
  tbody.querySelectorAll("button[data-action='save']").forEach((btn) => {
    btn.addEventListener("click", handleUpdateRole);
  });
}

// Xử lý cập nhật vai trò mới cho người dùng
async function handleUpdateRole(e) {
  const btn = e.currentTarget;
  const tr = btn.closest("tr");
  const targetUserId = tr.dataset.userId;
  const select = tr.querySelector(".select-role-new");
  const newRoleId = Number(select.value);

  const currentUser = getCurrentUser();
  if (!currentUser) return;

  btn.disabled = true;
  btn.textContent = "Đang lưu...";

  try {
    const res = await fetch(`${API_BASE_URL}/admin/users/${encodeURIComponent(targetUserId)}/role`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": currentUser.id || currentUser._id,
      },
      body: JSON.stringify({ role_id: newRoleId }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || "Cập nhật phân quyền thất bại.");
    }

    // Nếu Admin tự thay đổi vai trò của chính mình sang role khác Admin (role_id !== 1)
    const isSelf = String(targetUserId) === String(currentUser.id || currentUser._id);
    if (isSelf && Number(newRoleId) !== 1) {
      const idToRole = {
        1: "admin",
        2: "doctor",
        3: "receptionist",
        4: "pet_owner",
      };
      const nextRoleId = Number(data.user?.role_id) || newRoleId;
      const nextRole = data.user?.role || idToRole[nextRoleId] || "pet_owner";
      const patch = {
        role_id: nextRoleId,
        role: nextRole,
      };
      if (data.user?.id_bac_sy !== undefined) {
        patch.id_bac_sy = data.user.id_bac_sy;
      }
      updateCurrentUser(patch);
      showAlert(
        data.message || "Đã cập nhật vai trò của bạn. Đang chuyển về trang chủ...",
        "success"
      );
      setTimeout(() => {
        window.location.href = "./index.html";
      }, 800);
      return;
    }

    showAlert(data.message || "Cập nhật phân quyền thành công!", "success");
    await fetchUsers(); // Làm mới lại bảng
  } catch (err) {
    showAlert(err.message, "error");
    btn.disabled = false;
    btn.textContent = "Cập nhật";
  }
}

// Khởi tạo trang
document.addEventListener("DOMContentLoaded", async () => {
  const currentUser = checkAdminAuth();
  if (!currentUser) return;

  const logoutBtn = document.getElementById("adminLogoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", (e) => {
      e.preventDefault();
      logoutUser();
      window.location.href = "./index.html";
    });
  }

  await loadRoles();
  await fetchUsers();

  // Sự kiện lọc role_id_cu
  const filterRoleSelect = document.getElementById("filterRoleOld");
  filterRoleSelect.addEventListener("change", () => {
    fetchUsers();
  });

  // Sự kiện tìm kiếm tên
  let debounceTimer = null;
  const searchInput = document.getElementById("searchUserName");
  searchInput.addEventListener("input", () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      fetchUsers();
    }, 300);
  });

  // Nút làm mới
  const refreshBtn = document.getElementById("btnRefreshList");
  if (refreshBtn) {
    refreshBtn.addEventListener("click", () => {
      fetchUsers();
    });
  }
});
