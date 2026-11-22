/* ============================================================
   doctor-dashboard.js
   Cổng thông tin chuyên biệt dành riêng cho Bác Sĩ (role_id = 2)
   Không hiển thị giao diện trang chủ của khách hàng
   Bao gồm 3 Tab:
   1. Lịch Hẹn Cá Nhân (theo tháng/hôm nay/tiếp theo, kèm hóa đơn)
   2. Phiếu Khám Bệnh (chẩn đoán lâm sàng & hóa đơn cá nhân)
   3. Hồ Sơ Khám (hồ sơ bệnh án dùng chung)
   ============================================================ */

import { getCurrentUser, logoutUser } from "./auth.js";
import { API_BASE_URL } from "./config.js";

function checkDoctorAuth() {
  const user = getCurrentUser();
  if (!user || (Number(user.role_id) !== 2 && user.role !== "doctor")) {
    alert("Quyền truy cập bị từ chối! Trang này chỉ dành riêng cho Bác sĩ thú y (role_id = 2).");
    window.location.href = "./index.html";
    return null;
  }

  const greetingEl = document.getElementById("doctorGreeting");
  if (greetingEl) greetingEl.textContent = `BS: ${user.name}`;

  const badgeEl = document.getElementById("doctorCodeBadge");
  if (badgeEl && user.id_bac_sy) {
    badgeEl.innerHTML = `Mã BS: <strong>${user.id_bac_sy}</strong>`;
  }
  return user;
}

// 1. Tải Lịch Hẹn Cá Nhân
async function loadDoctorAppointments(filter = {}) {
  const user = getCurrentUser();
  if (!user) return;

  const tbody = document.getElementById("docApptsTableBody");
  tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #888; padding: 30px;">Đang tải lịch hẹn...</td></tr>`;

  try {
    const params = new URLSearchParams();
    if (filter.month) params.append("month", filter.month);
    if (filter.date) params.append("date", filter.date);
    if (user.id_bac_sy) params.append("id_bac_sy", user.id_bac_sy);

    const res = await fetch(`${API_BASE_URL}/doctor/appointments?${params.toString()}`, {
      headers: { "x-user-id": user.id || user._id },
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Không thể tải lịch hẹn.");

    const list = data.appointments || [];
    const countEl = document.getElementById("docApptsCount");
    if (countEl) countEl.textContent = list.length;

    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #888; padding: 30px;">Chưa có ca hẹn nào trong khoảng thời gian này.</td></tr>`;
      return;
    }

    tbody.innerHTML = list
      .map((item) => {
        let statusClass = "status-pending";
        let statusLabel = item.status || "Chờ";
        if (item.status === "in_progress" || item.status === "Đang làm") {
          statusClass = "status-in_progress";
          statusLabel = "Đang làm";
        } else if (item.status === "completed" || item.status === "Đã xác nhận") {
          statusClass = "status-completed";
          statusLabel = "Đã xác nhận";
        } else if (item.status === "cancelled" || item.status === "Đã hủy") {
          statusClass = "status-cancelled";
          statusLabel = "Đã hủy";
        }

        const invoicesHtml = (item.invoices || [])
          .map(
            (inv) => `
            <div style="margin-bottom: 3px;">
              <span class="invoice-tag ${inv.status === "paid" ? "paid" : ""}">
                ${inv.invoiceCode} - ${(inv.totalAmount || 0).toLocaleString("vi-VN")}đ (${inv.status === "paid" ? "Đã TT" : "Chưa TT"})
              </span>
            </div>`
          )
          .join("") || '<span style="color: #999; font-size: 12px;">Chưa có HĐ</span>';

        return `
          <tr>
            <td>
              <strong>${item.date}</strong><br/>
              <span style="color: #2A5A44; font-weight: 700;">${item.startTime || "--:--"}</span>
            </td>
            <td>
              <strong>${item.serviceName}</strong><br/>
              <small style="color: #888;">${item.type === "grooming" ? "Spa / Grooming" : "Khám thú y"}</small>
            </td>
            <td><strong>${item.petName}</strong></td>
            <td>
              ${item.customerName}<br/>
              <small style="color: #666;">${item.customerPhone}</small>
            </td>
            <td><span class="status-pill ${statusClass}">${statusLabel}</span></td>
            <td>${invoicesHtml}</td>
          </tr>
        `;
      })
      .join("");
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #c53030; padding: 30px;">${err.message}</td></tr>`;
  }
}

// 2. Tải Phiếu Khám Bệnh
async function loadDoctorDiagnoses() {
  const user = getCurrentUser();
  if (!user) return;

  const tbody = document.getElementById("docDiagnosesTableBody");
  tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #888; padding: 30px;">Đang tải phiếu khám...</td></tr>`;

  try {
    const res = await fetch(`${API_BASE_URL}/doctor/diagnoses`, {
      headers: { "x-user-id": user.id || user._id },
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Không thể tải phiếu khám.");

    const list = data.diagnoses || [];
    const countEl = document.getElementById("docDiagnosesCount");
    if (countEl) countEl.textContent = list.length;

    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #888; padding: 30px;">Chưa có phiếu khám nào được ghi nhận.</td></tr>`;
      return;
    }

    tbody.innerHTML = list
      .map((d) => {
        const invoicesHtml = (d.invoices || [])
          .map(
            (inv) => `
            <div style="margin-bottom: 3px;">
              <span class="invoice-tag ${inv.status === "paid" ? "paid" : ""}">
                ${inv.invoiceCode} - ${(inv.totalAmount || 0).toLocaleString("vi-VN")}đ (${inv.status === "paid" ? "Đã TT" : "Chưa TT"})
              </span>
            </div>`
          )
          .join("") || '<span style="color: #999; font-size: 12px;">Chưa lập HĐ</span>';

        const vitals = d.vitalSigns || {};
        const vitalsStr = `T: ${vitals.temperature || "--"}°C | W: ${vitals.weight || "--"}kg | HR: ${vitals.heartRate || "--"}`;

        return `
          <tr>
            <td>
              <strong>${d.diagnosisCode}</strong><br/>
              <small style="color: #777;">${d.date || ""}</small>
            </td>
            <td>
              <strong>${d.petName || "Bé cưng"}</strong><br/>
              <small style="color: #888;">${d.petSpecies || "Thú cưng"}</small>
            </td>
            <td>
              <strong>${d.confirmedDiagnosis || d.category || "Khám tổng quát"}</strong><br/>
              <span style="font-size: 12.5px; color: #666;">${d.treatmentPlan || "Đang theo dõi điều trị"}</span>
            </td>
            <td><small style="color: #555;">${vitalsStr}</small></td>
            <td>${invoicesHtml}</td>
          </tr>
        `;
      })
      .join("");
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #c53030; padding: 30px;">${err.message}</td></tr>`;
  }
}

// 3. Tải Hồ Sơ Khám (Hồ sơ dùng chung)
async function loadDoctorMedicalRecords(search = "") {
  const user = getCurrentUser();
  if (!user) return;

  const tbody = document.getElementById("docRecordsTableBody");
  tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #888; padding: 30px;">Đang tải hồ sơ khám...</td></tr>`;

  try {
    const params = new URLSearchParams();
    if (search) params.append("search", search);

    const res = await fetch(`${API_BASE_URL}/doctor/medical-records?${params.toString()}`, {
      headers: { "x-user-id": user.id || user._id },
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Không thể tải hồ sơ.");

    const list = data.records || [];
    const countEl = document.getElementById("docRecordsCount");
    if (countEl) countEl.textContent = list.length;

    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #888; padding: 30px;">Không tìm thấy hồ sơ khám nào.</td></tr>`;
      return;
    }

    tbody.innerHTML = list
      .map(
        (r) => `
        <tr>
          <td><strong>${r.recordCode}</strong></td>
          <td>${r.date || ""}<br/><small style="color: #888;">${r.veterinarian || ""}</small></td>
          <td>
            <strong>${r.petName}</strong><br/>
            <small style="color: #777;">${r.petSpecies || ""}</small>
          </td>
          <td><span style="color: #2A5A44; font-weight: 700;">${r.confirmedDiagnosis || r.title || "Khám điều trị"}</span></td>
          <td><small style="color: #555;">${r.treatmentPlan || "Theo dõi định kỳ"}</small></td>
        </tr>
      `
      )
      .join("");
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #c53030; padding: 30px;">${err.message}</td></tr>`;
  }
}

// Khởi tạo Dashboard Bác sĩ
document.addEventListener("DOMContentLoaded", async () => {
  const currentUser = checkDoctorAuth();
  if (!currentUser) return;

  // Xử lý nút Đăng xuất
  const logoutBtn = document.getElementById("doctorLogoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", (e) => {
      e.preventDefault();
      logoutUser();
      window.location.href = "./index.html";
    });
  }

  // Chuyển Tab 3 chức năng
  const tabButtons = document.querySelectorAll(".tab-btn");
  const tabContents = document.querySelectorAll(".tab-content");

  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetTab = btn.dataset.tab;
      tabButtons.forEach((b) => b.classList.remove("active"));
      tabContents.forEach((c) => (c.style.display = "none"));

      btn.classList.add("active");
      const activeContent = document.getElementById(targetTab);
      if (activeContent) activeContent.style.display = "block";

      if (targetTab === "tabDoctorAppts") loadDoctorAppointments();
      else if (targetTab === "tabDoctorDiagnoses") loadDoctorDiagnoses();
      else if (targetTab === "tabDoctorRecords") loadDoctorMedicalRecords();
    });
  });

  // Bộ lọc Tab 1 (Lịch hẹn cá nhân)
  const monthInput = document.getElementById("docFilterMonth");
  if (monthInput) {
    const now = new Date();
    const curMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    monthInput.value = curMonth;
    monthInput.addEventListener("change", () => {
      loadDoctorAppointments({ month: monthInput.value });
    });
  }

  const btnToday = document.getElementById("btnDocApptsToday");
  if (btnToday) {
    btnToday.addEventListener("click", () => {
      const now = new Date();
      const todayStr = `${String(now.getDate()).padStart(2, "0")}/${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}`;
      loadDoctorAppointments({ date: todayStr });
    });
  }

  const btnUpcoming = document.getElementById("btnDocApptsUpcoming");
  if (btnUpcoming) {
    btnUpcoming.addEventListener("click", () => {
      loadDoctorAppointments({});
    });
  }

  // Tìm kiếm Tab 3 (Hồ sơ khám)
  const searchInput = document.getElementById("docRecordSearch");
  const searchBtn = document.getElementById("btnDocRecordSearch");
  if (searchBtn && searchInput) {
    searchBtn.addEventListener("click", () => {
      loadDoctorMedicalRecords(searchInput.value.trim());
    });
    searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") loadDoctorMedicalRecords(searchInput.value.trim());
    });
  }

  // Tải dữ liệu ban đầu cho Tab 1
  await loadDoctorAppointments();
});
