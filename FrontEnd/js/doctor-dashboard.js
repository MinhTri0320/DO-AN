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
import { escapeHTML } from "./storage.js";

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

        let isCompleted = item.status === "completed" || item.status === "Hoàn thành";
        let isCancelled = item.status === "cancelled" || item.status === "Đã hủy";

        let actionHtml = "";
        if (isCompleted) {
          actionHtml = `<span style="color: #16A34A; font-weight: 700; font-size: 12.5px;">✓ Đã chuyển Hồ sơ</span>`;
        } else if (isCancelled) {
          actionHtml = `<span style="color: #999; font-size: 12px;">Đã hủy</span>`;
        } else {
          actionHtml = `<button type="button" class="btn-action-small btn-complete-appt" data-id="${item.code || item.id}" data-pet="${escapeHTML(item.petName)}" data-service="${escapeHTML(item.serviceName)}" style="background: #16A34A; color: #fff; font-weight: 700; cursor: pointer;">✓ Hoàn thành</button>`;
        }

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
            <td>${actionHtml}</td>
          </tr>
        `;
      })
      .join("");

    // Gắn sự kiện cho các nút Xác nhận hoàn thành ca khám
    tbody.querySelectorAll(".btn-complete-appt").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        const pet = btn.getAttribute("data-pet");
        const service = btn.getAttribute("data-service");
        openCompleteModal(id, pet, service);
      });
    });
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #c53030; padding: 30px;">${err.message}</td></tr>`;
  }
}

// Hàm mở Modal Xác nhận hoàn thành ca khám
function openCompleteModal(id, petName, serviceName) {
  const modal = document.getElementById("modalCompleteAppt");
  if (!modal) return;

  document.getElementById("completeTargetId").value = id;
  document.getElementById("completeApptCode").textContent = id;
  document.getElementById("completePetName").textContent = petName || "Bé cưng";
  document.getElementById("completeServiceName").textContent = serviceName || "Dịch vụ khám";
  document.getElementById("completeDiagnosisInput").value = serviceName ? `${serviceName} - Bình thường` : "Khám lâm sàng tốt";
  document.getElementById("completeTreatmentInput").value = "Theo dõi và chăm sóc bé tại nhà, giữ ấm và ăn uống điều độ.";

  modal.style.display = "flex";
}

function closeCompleteModal() {
  const modal = document.getElementById("modalCompleteAppt");
  if (modal) modal.style.display = "none";
}

// 2. Tải Phiếu Khám Bệnh (TÁCH RIÊNG THEO ID BÁC SĨ)
async function loadDoctorDiagnoses() {
  const user = getCurrentUser();
  if (!user) return;

  const badgeEl = document.getElementById("docDiagDoctorIdBadge");
  if (badgeEl && user.id_bac_sy) {
    badgeEl.textContent = `Mã BS: ${user.id_bac_sy}`;
  }

  const tbody = document.getElementById("docDiagnosesTableBody");
  tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #888; padding: 30px;">Đang tải phiếu khám của bác sĩ...</td></tr>`;

  try {
    const params = new URLSearchParams();
    if (user.id_bac_sy) params.append("id_bac_sy", user.id_bac_sy);

    const res = await fetch(`${API_BASE_URL}/doctor/diagnoses?${params.toString()}`, {
      headers: { "x-user-id": user.id || user._id },
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Không thể tải phiếu khám.");

    const list = data.diagnoses || [];
    const countEl = document.getElementById("docDiagnosesCount");
    if (countEl) countEl.textContent = list.length;

    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #888; padding: 30px;">Chưa có phiếu khám nào gắn với mã bác sĩ [${user.id_bac_sy || "này"}].</td></tr>`;
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
              <span style="background: #DEF7EC; color: #03543F; padding: 3px 8px; border-radius: 6px; font-weight: 700; font-size: 12px;">${d.id_bac_sy || user.id_bac_sy || "bs00001"}</span><br/>
              <small style="color: #666;">${d.doctorName || user.name}</small>
            </td>
            <td>
              <strong>${d.petName || "Bé cưng"}</strong> (${d.petSpecies || "Thú cưng"})<br/>
              <small style="color: #666;">Chủ: ${d.customerName || "Khách"} - ${d.customerPhone || ""}</small>
            </td>
            <td>
              <strong style="color: #2A5A44;">${d.confirmedDiagnosis || d.category || "Khám tổng quát"}</strong><br/>
              <span style="font-size: 12.5px; color: #666;">${d.treatmentPlan || "Đang theo dõi điều trị"}</span>
            </td>
            <td><small style="color: #555;">${vitalsStr}</small></td>
            <td>${invoicesHtml}</td>
          </tr>
        `;
      })
      .join("");
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #c53030; padding: 30px;">${err.message}</td></tr>`;
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

// 4. Tra cứu thông tin toàn diện cho Bác Sĩ (Tab 4)
async function executeDoctorLookup(query) {
  const container = document.getElementById("docLookupResultsContainer");
  if (!container) return;

  if (!query) {
    container.innerHTML = `<div style="text-align: center; color: #888; padding: 40px 20px;">Vui lòng nhập từ khóa tra cứu.</div>`;
    return;
  }

  container.innerHTML = `<div style="text-align: center; color: #888; padding: 40px 20px;">⏳ Đang tra cứu thông tin cho "${escapeHTML(query)}"...</div>`;

  try {
    const user = getCurrentUser();
    const res = await fetch(`${API_BASE_URL}/doctor/lookup?q=${encodeURIComponent(query)}`, {
      headers: { "x-user-id": user.id || user._id },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Không thể tra cứu thông tin.");

    const { records = [], diagnoses = [], prescriptions = [], pets = [], customers = [] } = data.results || {};
    const totalFound = records.length + diagnoses.length + prescriptions.length + pets.length + customers.length;

    if (totalFound === 0) {
      container.innerHTML = `<div style="text-align: center; color: #666; padding: 40px 20px;">Không tìm thấy thông tin nào phù hợp với từ khóa "<strong>${escapeHTML(query)}</strong>".</div>`;
      return;
    }

    let html = `<div style="margin-bottom: 16px; font-weight: 700; color: #2A5A44;">🔍 Kết quả tra cứu cho "${escapeHTML(query)}" (${totalFound} mục tìm thấy):</div>`;

    // 1. Hồ sơ khám
    if (records.length > 0) {
      html += `
        <div style="margin-bottom: 24px;">
          <h4 style="margin: 0 0 10px 0; color: #2A5A44;">📁 Hồ Sơ Khám Bệnh (${records.length})</h4>
          <table class="portal-table" style="margin-bottom: 0;">
            <thead>
              <tr><th>Mã hồ sơ</th><th>Thú cưng</th><th>Chủ nuôi</th><th>Chẩn đoán</th><th>Ngày khám</th><th>Bác sĩ</th></tr>
            </thead>
            <tbody>
              ${records.map(r => `
                <tr>
                  <td><strong>${r.recordCode}</strong></td>
                  <td>${r.petName} (${r.petSpecies || "Thú cưng"})</td>
                  <td>${r.ownerName || "—"} (${r.ownerPhone || "—"})</td>
                  <td><strong>${r.confirmedDiagnosis || r.title}</strong></td>
                  <td>${r.date || r.dateISO}</td>
                  <td><span style="color: #2A5A44; font-weight: 600;">${r.veterinarian || "Bác sĩ"}</span></td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      `;
    }

    // 2. Phiếu khám
    if (diagnoses.length > 0) {
      html += `
        <div style="margin-bottom: 24px;">
          <h4 style="margin: 0 0 10px 0; color: #2A5A44;">📋 Phiếu Khám Lâm Sàng (${diagnoses.length})</h4>
          <table class="portal-table" style="margin-bottom: 0;">
            <thead>
              <tr><th>Mã phiếu</th><th>Bác sĩ (Mã BS)</th><th>Thú cưng</th><th>Khách hàng</th><th>Chẩn đoán</th><th>Điều trị</th></tr>
            </thead>
            <tbody>
              ${diagnoses.map(d => `
                <tr>
                  <td><strong>${d.diagnosisCode}</strong></td>
                  <td><span style="background: #DEF7EC; color: #03543F; padding: 2px 6px; border-radius: 4px; font-weight: 700; font-size: 11.5px;">${d.id_bac_sy || "bs00001"}</span> ${d.doctorName || ""}</td>
                  <td>${d.petName}</td>
                  <td>${d.customerName || "—"} (${d.customerPhone || "—"})</td>
                  <td><strong>${d.confirmedDiagnosis || d.category}</strong></td>
                  <td><small style="color: #555;">${d.treatmentPlan || "—"}</small></td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      `;
    }

    // 3. Đơn thuốc
    if (prescriptions.length > 0) {
      html += `
        <div style="margin-bottom: 24px;">
          <h4 style="margin: 0 0 10px 0; color: #2A5A44;">💊 Đơn Thuốc (${prescriptions.length})</h4>
          <table class="portal-table" style="margin-bottom: 0;">
            <thead>
              <tr><th>Mã đơn</th><th>Bé cưng</th><th>Số loại thuốc</th><th>Ngày kê</th><th>Ghi chú</th></tr>
            </thead>
            <tbody>
              ${prescriptions.map(p => `
                <tr>
                  <td><strong>${p.prescriptionCode}</strong></td>
                  <td>${p.petName}</td>
                  <td><strong>${(p.medicines || []).length}</strong> loại thuốc</td>
                  <td>${p.date || "—"}</td>
                  <td><small style="color: #666;">${p.notes || "—"}</small></td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      `;
    }

    // 4. Thú cưng & Khách hàng
    if (pets.length > 0 || customers.length > 0) {
      html += `
        <div style="display: flex; gap: 20px; flex-wrap: wrap;">
          ${pets.length > 0 ? `
            <div style="flex: 1; min-width: 280px;">
              <h4 style="margin: 0 0 10px 0; color: #2A5A44;">🐾 Thú Cưng (${pets.length})</h4>
              <ul style="padding-left: 20px; line-height: 1.8;">
                ${pets.map(p => `<li><strong>${p.name}</strong> (${p.species || "Thú cưng"} ${p.breed ? "- " + p.breed : ""})</li>`).join("")}
              </ul>
            </div>
          ` : ""}
          ${customers.length > 0 ? `
            <div style="flex: 1; min-width: 280px;">
              <h4 style="margin: 0 0 10px 0; color: #2A5A44;">👤 Khách Hàng (${customers.length})</h4>
              <ul style="padding-left: 20px; line-height: 1.8;">
                ${customers.map(c => `<li><strong>${c.name || c.fullName}</strong> - SĐT: ${c.phone || "Chưa có"}</li>`).join("")}
              </ul>
            </div>
          ` : ""}
        </div>
      `;
    }

    container.innerHTML = html;
  } catch (err) {
    container.innerHTML = `<div style="text-align: center; color: #c53030; padding: 30px;">Lỗi: ${err.message}</div>`;
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
      else if (targetTab === "tabDoctorLookup") {
        const input = document.getElementById("docLookupInput");
        if (input && input.value.trim()) executeDoctorLookup(input.value.trim());
      }
    });
  });

  // Sự kiện Modal hoàn thành ca khám
  const closeBtn = document.getElementById("btnCloseCompleteModal");
  const cancelBtn = document.getElementById("btnCancelCompleteModal");
  if (closeBtn) closeBtn.addEventListener("click", closeCompleteModal);
  if (cancelBtn) cancelBtn.addEventListener("click", closeCompleteModal);

  const formComplete = document.getElementById("formCompleteAppt");
  if (formComplete) {
    formComplete.addEventListener("submit", async (e) => {
      e.preventDefault();
      const targetId = document.getElementById("completeTargetId").value;
      const diagnosis = document.getElementById("completeDiagnosisInput").value.trim();
      const treatmentPlan = document.getElementById("completeTreatmentInput").value.trim();

      const submitBtn = document.getElementById("btnSubmitCompleteAppt");
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Đang xử lý...";
      }

      try {
        const user = getCurrentUser();
        const res = await fetch(`${API_BASE_URL}/doctor/appointments/${encodeURIComponent(targetId)}/complete`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-user-id": user.id || user._id,
          },
          body: JSON.stringify({ diagnosis, treatmentPlan }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Không thể xác nhận hoàn thành.");

        alert(`✓ Thành công!\nCa khám [${targetId}] đã được hoàn thành và chuyển trực tiếp vào Hồ Sơ Khám & Phiếu Khám Bệnh.`);
        closeCompleteModal();

        // Tải lại dữ liệu các tab
        await loadDoctorAppointments();
        await loadDoctorDiagnoses();
        await loadDoctorMedicalRecords();
      } catch (err) {
        alert("Lỗi: " + err.message);
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = "✓ Hoàn Thành & Chuyển Hồ Sơ";
        }
      }
    });
  }

  // Tra cứu thông tin Bác sĩ (Tab 4)
  const lookupInput = document.getElementById("docLookupInput");
  const lookupBtn = document.getElementById("btnDocLookupExecute");
  if (lookupBtn && lookupInput) {
    lookupBtn.addEventListener("click", () => {
      executeDoctorLookup(lookupInput.value.trim());
    });
    lookupInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") executeDoctorLookup(lookupInput.value.trim());
    });
  }

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
