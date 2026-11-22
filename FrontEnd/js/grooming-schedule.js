/* ============================================================
   grooming-schedule.js
   Sprint 4: Grooming Schedule & Status (Toàn phụ trách)
   1. Thiết kế giao diện Grooming Schedule & Status:
      - Form tạo lịch (khách, thú cưng, tên dịch vụ nhập tự do, giá, ngày, giờ, thời lượng, ghi chú)
      - Lịch theo ngày / khoảng ngày (sắp xếp giờ tăng dần, ngày không có lịch hiển thị "Chưa có lịch hẹn")
      - Nhãn màu trạng thái riêng biệt: pending, in_progress, completed, cancelled
   2. Code giao diện Grooming Schedule & Status:
      - Chọn khách -> lọc danh sách thú cưng tương ứng
      - Tạo lịch: chặn thời điểm quá khứ, chặn trùng giờ (thông báo lỗi trùng giờ rõ ràng)
      - Nút đổi trạng thái đúng thứ tự: pending -> in_progress -> completed (hoặc cancelled)
      - Chặn chuyển ngược trạng thái
   ============================================================ */

import {
  apiGetGroomings,
  apiCreateGrooming,
  apiChangeGroomingStatus,
  apiCancelGrooming,
  apiGetGroomingCustomers,
} from "./api.js";
import { DEFAULT_HOTEL_CUSTOMERS } from "./hotel-data.js";
import { escapeHTML } from "./storage.js";
import { getCurrentUser } from "./auth.js";

// Khởi tạo state toàn cục của trang
let customersList = [];
let allGroomings = [];
let currentFilterDate = ""; // "" = xem tất cả, hoặc "YYYY-MM-DD"
let currentFilterStatus = ""; // "" = tất cả, hoặc "pending" | "in_progress" | "completed" | "cancelled"
let currentSearchTerm = "";

// Helper chuyển đổi HH:mm sang phút
function timeToMinutes(timeStr) {
  if (!timeStr) return 0;
  const parts = String(timeStr).split(":");
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  return h * 60 + m;
}

// Helper chuyển đổi phút sang HH:mm
function minutesToTime(minutes) {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// Helper format tiền tệ VNĐ
function formatVND(amount) {
  if (!amount || isNaN(amount)) return "0 đ";
  return Number(amount).toLocaleString("vi-VN") + " đ";
}

// Helper format ngày YYYY-MM-DD
function getTodayString() {
  const today = new Date();
  return today.toISOString().split("T")[0];
}

function getTomorrowString() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0];
}

// Helper thông minh tính ngày & giờ mặc định hợp lệ (không bao giờ rơi vào quá khứ)
function getSmartInitialDateTime() {
  const now = new Date();
  const currentHour = now.getHours();
  const todayStr = getTodayString();
  const tomorrowStr = getTomorrowString();

  // Nếu đã sau 17:00 chiều/tối: Chuyển sang ngày mai lúc 09:00 sáng để tránh bị lỗi quá khứ
  if (currentHour >= 17) {
    return {
      date: tomorrowStr,
      startTime: "09:00",
    };
  }

  // Nếu sáng sớm trước 08:00:
  if (currentHour < 8) {
    return {
      date: todayStr,
      startTime: "09:00",
    };
  }

  // Trong giờ làm việc ban ngày: lấy giờ tiếp theo (ví dụ 10:20 -> 11:00)
  const nextHour = currentHour + 1;
  const nextHourStr = String(nextHour).padStart(2, "0") + ":00";
  return {
    date: todayStr,
    startTime: nextHourStr,
  };
}

// Toast hiển thị thông báo góc màn hình
function showToast(message, type = "success") {
  const existing = document.querySelector(".grooming-toast");
  if (existing) existing.remove();

  const toast = document.createElement("div");
  toast.className = `grooming-toast ${type === "error" ? "error" : type === "warning" ? "warning" : ""}`;
  const icon = type === "error" ? "❌" : type === "warning" ? "⚠️" : "✅";
  toast.innerHTML = `<span>${icon}</span> <span>${escapeHTML(message)}</span>`;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(20px)";
    toast.style.transition = "all 0.3s ease";
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// Hiển thị alert trong form tạo lịch
function showFormAlert(message, type = "danger") {
  const alertContainer = document.getElementById("groomingAlertContainer");
  if (!alertContainer) return;

  if (!message) {
    alertContainer.innerHTML = "";
    alertContainer.style.display = "none";
    return;
  }

  const icon = type === "danger" ? "🚫" : type === "warning" ? "⚠️" : "✅";
  alertContainer.className = `grooming-alert ${type}`;
  alertContainer.innerHTML = `
    <span style="font-size: 18px; line-height: 1;">${icon}</span>
    <div>${message}</div>
  `;
  alertContainer.style.display = "flex";
}

// 1. Tải danh sách khách hàng & thú cưng
async function loadCustomersAndPets() {
  const selectCustomer = document.getElementById("grmCustomer");
  const selectPet = document.getElementById("grmPet");
  if (!selectCustomer || !selectPet) return;

  const user = getCurrentUser();
  if (!user) {
    // Hiển thị toast nhẹ nhàng thay vì redirect
    showToast("Vui lòng đăng nhập để sử dụng tính năng này!", "warning");
    return;
  }

  try {
    const res = await apiGetGroomingCustomers();
    if (res && res.success && res.customers && res.customers.length > 0) {
      customersList = res.customers;
    } else {
      // Fallback sang khách hàng mặc định của hệ thống
      customersList = DEFAULT_HOTEL_CUSTOMERS;
    }
  } catch (err) {
    console.warn("Không tải được khách hàng từ API, dùng dữ liệu dự phòng:", err);
    customersList = DEFAULT_HOTEL_CUSTOMERS;
  }

  // Populate vào select
  selectCustomer.innerHTML = `<option value="">-- Chọn khách hàng --</option>` +
    customersList
      .map(
        (c) =>
          `<option value="${escapeHTML(c.id)}">${escapeHTML(c.name)} (${escapeHTML(c.phone || "Chưa có SĐT")})</option>`
      )
      .join("");

  selectPet.innerHTML = `<option value="">-- Vui lòng chọn khách hàng trước --</option>`;
  selectPet.disabled = true;

  // Tự động nhận diện tài khoản người dùng đang đăng nhập nếu có
  const currentUser = getCurrentUser();
  if (currentUser) {
    const matchedCustomer = customersList.find(
      (c) =>
        String(c.id) === String(currentUser.id) ||
        String(c.id) === String(currentUser._id) ||
        (c.phone && c.phone === currentUser.phone)
    );

    if (matchedCustomer) {
      selectCustomer.value = matchedCustomer.id;
      handleCustomerChange(matchedCustomer.id);
    }
  }
}

// 2. Khi chọn khách hàng -> Lọc danh sách thú cưng tương ứng
function handleCustomerChange(customerId) {
  const selectPet = document.getElementById("grmPet");
  if (!selectPet) return;

  showFormAlert(""); // Xóa cảnh báo cũ nếu có

  if (!customerId) {
    selectPet.innerHTML = `<option value="">-- Vui lòng chọn khách hàng trước --</option>`;
    selectPet.disabled = true;
    return;
  }

  const customer = customersList.find((c) => String(c.id) === String(customerId));
  if (!customer || !customer.pets || customer.pets.length === 0) {
    selectPet.innerHTML = `<option value="">-- Khách hàng này chưa có hồ sơ thú cưng --</option>`;
    selectPet.disabled = true;
    showFormAlert("Khách hàng này hiện chưa có thú cưng nào trong hệ thống!", "warning");
    return;
  }

  selectPet.disabled = false;
  selectPet.innerHTML = `<option value="">-- Chọn thú cưng của khách --</option>` +
    customer.pets
      .map(
        (p) =>
          `<option value="${escapeHTML(p.id)}">${escapeHTML(p.name)} (${escapeHTML(p.species || "Thú cưng")} ${p.breed ? "- " + escapeHTML(p.breed) : ""})</option>`
      )
      .join("");
}

// 3. Kiểm tra trùng giờ client-side (với các lịch chưa bị hủy)
function checkOverlapClient(newDateISO, newStartTime, durationMinutes) {
  const newStart = timeToMinutes(newStartTime);
  const newEnd = newStart + Number(durationMinutes);

  // Chỉ xét các lịch cùng ngày và status !== "cancelled"
  const activeSchedulesOnDate = allGroomings.filter(
    (g) => g.dateISO === newDateISO && g.status !== "cancelled"
  );

  for (const item of activeSchedulesOnDate) {
    const itemStart = item.startMinutes || timeToMinutes(item.startTime);
    const itemEnd = item.endMinutes || (itemStart + (item.duration || 45));

    // Công thức giao khoảng: StartA < EndB && StartB < EndA
    if (newStart < itemEnd && itemStart < newEnd) {
      return item; // Trả về lịch bị xung đột
    }
  }

  return null;
}

// 4. Xử lý gửi Form tạo lịch chăm sóc Grooming
async function handleCreateGrooming(e) {
  e.preventDefault();
  showFormAlert("");

  const user = getCurrentUser();
  if (!user) {
    showToast("Vui lòng đăng nhập để tạo lịch!", "warning");
    return;
  }

  const selectCustomer = document.getElementById("grmCustomer");
  const selectPet = document.getElementById("grmPet");
  const inputServiceName = document.getElementById("grmServiceName");
  const inputPrice = document.getElementById("grmPrice");
  const inputDate = document.getElementById("grmDate");
  const inputStartTime = document.getElementById("grmStartTime");
  const selectDuration = document.getElementById("grmDuration");
  const inputNote = document.getElementById("grmNote");
  const btnSubmit = document.getElementById("btnSubmitGrooming");

  const customerId = selectCustomer.value;
  const petId = selectPet.value;
  const serviceName = inputServiceName.value.trim();
  const price = inputPrice.value ? Number(inputPrice.value) : 0;
  const date = inputDate.value;
  const startTime = inputStartTime.value;
  const duration = Number(selectDuration.value) || 45;
  const note = inputNote.value.trim();

  // Kiểm tra dữ liệu bắt buộc từng trường để hướng dẫn người dùng chính xác
  if (!customerId) {
    showFormAlert("Vui lòng chọn <strong>Khách hàng</strong> trước khi đặt lịch!", "warning");
    selectCustomer.focus();
    return;
  }

  if (!petId) {
    showFormAlert("Vui lòng chọn <strong>Thú cưng</strong> muốn đặt dịch vụ grooming!", "warning");
    selectPet.focus();
    return;
  }

  if (!serviceName) {
    showFormAlert("Vui lòng nhập hoặc bấm chọn <strong>Tên dịch vụ</strong> (ví dụ: Tắm dưỡng mượt, Cắt tỉa lông...)!", "warning");
    inputServiceName.focus();
    return;
  }

  if (!date || !startTime) {
    showFormAlert("Vui lòng chọn <strong>Ngày hẹn</strong> và <strong>Giờ bắt đầu</strong>!", "warning");
    return;
  }

  // 1. RÀNG BUỘC: Không cho tạo lịch vào thời điểm trong quá khứ
  const selectedDateTime = new Date(`${date}T${startTime}:00`);
  if (selectedDateTime.getTime() < Date.now()) {
    showFormAlert("<strong>Không thể đặt lịch trong quá khứ!</strong> Vui lòng chọn ngày và giờ ở thời điểm hiện tại hoặc tương lai.", "danger");
    return;
  }

  // 2. RÀNG BUỘC: Kiểm tra trùng giờ với các lịch chưa hủy
  const conflict = checkOverlapClient(date, startTime, duration);
  if (conflict) {
    const conflictEndTime = conflict.endTime || minutesToTime(timeToMinutes(conflict.startTime) + (conflict.duration || 45));
    showFormAlert(
      `<strong>Trùng lịch hẹn!</strong> Khung giờ này bị trùng với lịch <strong>[${conflict.groomingCode || "Lịch hẹn"}]</strong> (${conflict.startTime} - ${conflictEndTime}) của bé <strong>${escapeHTML(conflict.petName)}</strong>. Vui lòng chọn khung giờ khác!`,
      "danger"
    );
    return;
  }

  // Khóa nút submit
  if (btnSubmit) {
    btnSubmit.disabled = true;
    btnSubmit.innerHTML = `<span>⏳ Đang tạo lịch...</span>`;
  }

  try {
    const payload = {
      customerId,
      petId,
      serviceName,
      price,
      date,
      startTime,
      duration,
      note,
    };

    const res = await apiCreateGrooming(payload);

    if (res && res.success) {
      showToast("Tạo lịch hẹn chăm sóc thành công!", "success");
      showFormAlert("Tạo lịch hẹn chăm sóc thành công!", "success");

      // Reset form một phần (giữ ngày để tiện đặt lịch tiếp)
      inputServiceName.value = "";
      inputPrice.value = "";
      inputNote.value = "";

      // Đặt bộ lọc ngày xem danh sách đúng ngày vừa tạo
      currentFilterDate = date;
      const filterDateInput = document.getElementById("filterDate");
      if (filterDateInput) filterDateInput.value = date;
      updateQuickDateButtonsActive(date);

      // Tải lại danh sách lịch
      await loadGroomingSchedules();
    } else {
      showFormAlert(res?.message || "Không thể tạo lịch hẹn.", "danger");
    }
  } catch (err) {
    console.error("Lỗi khi tạo lịch grooming:", err);
    showFormAlert(err.message || "Lỗi máy chủ khi tạo lịch hẹn. Vui lòng thử lại!", "danger");
  } finally {
    if (btnSubmit) {
      btnSubmit.disabled = false;
      btnSubmit.innerHTML = `<span>➕ Tạo Lịch Hẹn Chăm Sóc</span>`;
    }
  }
}

// 5. Tải danh sách lịch chăm sóc từ API & hiển thị
async function loadGroomingSchedules() {
  const container = document.getElementById("scheduleTimelineList");
  if (!container) return;

  container.innerHTML = `<div style="text-align: center; padding: 30px; color: var(--ink-faint);">⏳ Đang tải lịch hẹn...</div>`;

  try {
    const params = {};
    if (currentFilterDate) {
      params.date = currentFilterDate;
    }

    const res = await apiGetGroomings(params);

    if (res && res.success) {
      allGroomings = res.groomings || [];
    } else {
      allGroomings = [];
    }

    renderScheduleList();
    updateKPIStats();
  } catch (err) {
    console.error("Lỗi tải lịch grooming:", err);
    container.innerHTML = `
      <div class="no-schedule-box">
        <span class="no-schedule-icon">⚠️</span>
        <div class="no-schedule-title">Không thể tải dữ liệu lịch hẹn</div>
        <p class="no-schedule-desc">${escapeHTML(err.message)}</p>
      </div>
    `;
  }
}

// 6. Cập nhật thẻ KPI Thống kê 4 trạng thái
function updateKPIStats() {
  const statPending = document.getElementById("statPendingGroomings");
  const statInProgress = document.getElementById("statInProgressGroomings");
  const statCompleted = document.getElementById("statCompletedGroomings");
  const statCancelled = document.getElementById("statCancelledGroomings");

  let pendingCount = 0;
  let inProgressCount = 0;
  let completedCount = 0;
  let cancelledCount = 0;

  allGroomings.forEach((g) => {
    if (g.status === "pending") pendingCount++;
    else if (g.status === "in_progress") inProgressCount++;
    else if (g.status === "completed") completedCount++;
    else if (g.status === "cancelled") cancelledCount++;
  });

  if (statPending) statPending.textContent = pendingCount;
  if (statInProgress) statInProgress.textContent = inProgressCount;
  if (statCompleted) statCompleted.textContent = completedCount;
  if (statCancelled) statCancelled.textContent = cancelledCount;
}

// 7. Render danh sách lịch hẹn (SẮP XẾP GIỜ TĂNG DẦN & HIỂN THỊ "Chưa có lịch hẹn" NẾU TRỐNG)
function renderScheduleList() {
  const container = document.getElementById("scheduleTimelineList");
  const countDisplay = document.getElementById("scheduleCountDisplay");
  if (!container) return;

  // Lọc theo trạng thái và tìm kiếm
  let filtered = allGroomings.slice();

  if (currentFilterStatus) {
    filtered = filtered.filter((g) => g.status === currentFilterStatus);
  }

  if (currentSearchTerm) {
    const term = currentSearchTerm.toLowerCase();
    filtered = filtered.filter(
      (g) =>
        (g.petName && g.petName.toLowerCase().includes(term)) ||
        (g.customerName && g.customerName.toLowerCase().includes(term)) ||
        (g.serviceName && g.serviceName.toLowerCase().includes(term)) ||
        (g.groomingCode && g.groomingCode.toLowerCase().includes(term))
    );
  }

  // SẮP XẾP GIỜ TĂNG DẦN (theo ngày rồi theo startMinutes)
  filtered.sort((a, b) => {
    if (a.dateISO !== b.dateISO) {
      return (a.dateISO || "").localeCompare(b.dateISO || "");
    }
    const startA = a.startMinutes !== undefined ? a.startMinutes : timeToMinutes(a.startTime);
    const startB = b.startMinutes !== undefined ? b.startMinutes : timeToMinutes(b.startTime);
    return startA - startB;
  });

  if (countDisplay) {
    countDisplay.textContent = filtered.length;
  }

  // NẾU NGÀY KHÔNG CÓ LỊCH HẸN: HIỂN THỊ "Chưa có lịch hẹn" ĐÚNG ĐỀ BÀI
  if (filtered.length === 0) {
    const dateNotice = currentFilterDate ? `ngày ${currentFilterDate}` : "khoảng thời gian này";
    container.innerHTML = `
      <div class="no-schedule-box">
        <span class="no-schedule-icon">📅</span>
        <div class="no-schedule-title">Chưa có lịch hẹn</div>
        <p class="no-schedule-desc">
          Hiện tại chưa có lịch chăm sóc grooming nào trong ${escapeHTML(dateNotice)}. Hãy dùng form bên trái để đặt lịch cho các bé cưng nhé!
        </p>
        <button type="button" class="btn-book-from-empty" onclick="document.getElementById('grmServiceName').focus()">
          <span>➕ Đặt lịch ngay</span>
        </button>
      </div>
    `;
    return;
  }

  // Render từng thẻ lịch hẹn
  container.innerHTML = filtered
    .map((item) => {
      const statusClass = item.status || "pending";
      const statusTagHtml = getStatusBadgeHtml(item.status);
      const actionButtonsHtml = renderActionButtonsHtml(item);
      const endTimeDisplay = item.endTime || minutesToTime((item.startMinutes || timeToMinutes(item.startTime)) + (item.duration || 45));

      return `
        <div class="schedule-item-card status-${statusClass}" data-id="${escapeHTML(item._id || item.groomingCode)}">
          <div class="item-top-header">
            <div class="time-slot-badge">
              <span>⏰ ${escapeHTML(item.startTime)} - ${escapeHTML(endTimeDisplay)}</span>
              <span class="duration-pill">${item.duration || 45} phút</span>
              <span style="font-size: 12px; color: var(--ink-faint); font-weight: 500; margin-left: 4px;">(${escapeHTML(item.date || item.dateISO)})</span>
            </div>
            ${statusTagHtml}
          </div>

          <div class="item-main-body">
            <div class="item-info-col">
              <h3>
                <span>🐾</span>
                <span>${escapeHTML(item.petName || "Bé cưng")}</span>
                <span style="font-size: 12px; font-weight: 500; color: var(--ink-faint); background: var(--cream-latte); padding: 2px 8px; border-radius: 6px;">${escapeHTML(item.petSpecies || "Chó")}</span>
              </h3>
              <div class="pet-details-line">
                Mã lịch: <strong style="color: var(--espresso);">${escapeHTML(item.groomingCode || "GRM-001")}</strong>
              </div>
              <div class="customer-details-line">
                Chủ nuôi: <strong>${escapeHTML(item.customerName || "Khách hàng")}</strong> 
                ${item.customerPhone ? `(${escapeHTML(item.customerPhone)})` : ""}
              </div>
            </div>

            <div class="item-info-col">
              <div class="service-title-display">
                ✂️ ${escapeHTML(item.serviceName || "Chăm sóc Grooming")}
              </div>
              <div class="price-display-tag">
                Chi phí: ${item.price ? formatVND(item.price) : "Miễn phí / Theo gói"}
              </div>
              ${
                item.note
                  ? `<div class="note-box-display">📝 ${escapeHTML(item.note)}</div>`
                  : `<div style="font-size: 12px; color: var(--ink-faint); margin-top: 6px;">(Không có ghi chú thêm)</div>`
              }
            </div>
          </div>

          <div class="item-bottom-actions">
            <div class="groomer-assign-info">
              <span>👤 Phụ trách: <strong>${escapeHTML(item.groomerName || "Kỹ thuật viên Grooming")}</strong></span>
            </div>
            <div class="status-action-btns">
              ${actionButtonsHtml}
            </div>
          </div>
        </div>
      `;
    })
    .join("");

  attachActionButtonListeners();
}

// 8. Tạo HTML nhãn màu trạng thái riêng biệt (pending, in_progress, completed, cancelled)
function getStatusBadgeHtml(status) {
  switch (status) {
    case "pending":
      return `<span class="grooming-status-tag pending">⏳ Chờ làm (pending)</span>`;
    case "in_progress":
      return `<span class="grooming-status-tag in_progress">✂️ Đang làm (in_progress)</span>`;
    case "completed":
      return `<span class="grooming-status-tag completed">✅ Hoàn thành (completed)</span>`;
    case "cancelled":
      return `<span class="grooming-status-tag cancelled">🚫 Đã hủy (cancelled)</span>`;
    default:
      return `<span class="grooming-status-tag">${escapeHTML(status)}</span>`;
  }
}

// 9. Nút đổi trạng thái đúng thứ tự:
// pending -> in_progress -> completed (hoặc cancelled)
// Chặn tuyệt đối chuyển ngược trạng thái
function renderActionButtonsHtml(item) {
  const id = item._id || item.groomingCode;

  if (item.status === "pending") {
    return `
      <button type="button" class="btn-status-act btn-start-grooming" data-id="${id}" data-action="start">
        <span>✂️ Bắt đầu làm</span>
      </button>
      <button type="button" class="btn-status-act btn-cancel-grooming" data-id="${id}" data-action="cancel">
        <span>Hủy lịch</span>
      </button>
    `;
  }

  if (item.status === "in_progress") {
    return `
      <button type="button" class="btn-status-act btn-complete-grooming" data-id="${id}" data-action="complete">
        <span>✅ Hoàn thành</span>
      </button>
      <button type="button" class="btn-status-act btn-cancel-grooming" data-id="${id}" data-action="cancel">
        <span>Hủy lịch</span>
      </button>
    `;
  }

  if (item.status === "completed") {
    return `
      <span class="state-locked-badge">
        🔒 Đã hoàn thành (Không thể chuyển ngược)
      </span>
    `;
  }

  if (item.status === "cancelled") {
    return `
      <span class="state-locked-badge" style="color: #DC2626;">
        🚫 Đã hủy (Khung giờ đã được giải phóng)
      </span>
    `;
  }

  return "";
}

// 10. Gắn sự kiện cho các nút đổi trạng thái
function attachActionButtonListeners() {
  const buttons = document.querySelectorAll(".btn-status-act");
  buttons.forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const id = btn.getAttribute("data-id");
      const action = btn.getAttribute("data-action");

      if (!id || !action) return;

      if (action === "start") {
        await handleStatusTransition(id, "in_progress", "Bắt đầu làm");
      } else if (action === "complete") {
        await handleStatusTransition(id, "completed", "Hoàn thành dịch vụ");
      } else if (action === "cancel") {
        await handleCancelGrooming(id);
      }
    });
  });
}

// 11. Xử lý chuyển trạng thái theo thứ tự
async function handleStatusTransition(id, newStatus, actionName) {
  const user = getCurrentUser();
  if (!user) {
    showToast("Vui lòng đăng nhập để thay đổi trạng thái!", "warning");
    return;
  }

  if (!confirm(`Bạn có chắc muốn chuyển trạng thái sang "${actionName}"?`)) {
    return;
  }

  try {
    const res = await apiChangeGroomingStatus(id, newStatus);
    if (res && res.success) {
      showToast(`Đã chuyển trạng thái sang "${actionName}" thành công!`, "success");
      await loadGroomingSchedules();
    } else {
      showToast(res?.message || "Không thể chuyển trạng thái.", "error");
    }
  } catch (err) {
    console.error("Lỗi chuyển trạng thái grooming:", err);
    showToast(err.message || "Lỗi chuyển trạng thái.", "error");
  }
}

// 12. Xử lý hủy lịch (cancelled)
async function handleCancelGrooming(id) {
  const user = getCurrentUser();
  if (!user) {
    showToast("Vui lòng đăng nhập để hủy lịch!", "warning");
    return;
  }

  if (!confirm("Bạn có chắc chắn muốn HỦY lịch hẹn này? Khung giờ sẽ được giải phóng cho khách khác.")) {
    return;
  }

  try {
    const res = await apiCancelGrooming(id);
    if (res && res.success) {
      showToast("Đã hủy lịch hẹn thành công. Khung giờ đã được giải phóng!", "success");
      await loadGroomingSchedules();
    } else {
      showToast(res?.message || "Không thể hủy lịch.", "error");
    }
  } catch (err) {
    console.error("Lỗi hủy lịch grooming:", err);
    showToast(err.message || "Lỗi khi hủy lịch.", "error");
  }
}

// 13. Cập nhật nút chọn nhanh ngày (Hôm nay, Ngày mai, Tất cả)
function updateQuickDateButtonsActive(dateVal) {
  const btnToday = document.getElementById("btnDateToday");
  const btnTomorrow = document.getElementById("btnDateTomorrow");
  const btnAll = document.getElementById("btnDateAll");

  const todayStr = getTodayString();
  const tomorrowStr = getTomorrowString();

  if (btnToday) btnToday.classList.toggle("active", dateVal === todayStr);
  if (btnTomorrow) btnTomorrow.classList.toggle("active", dateVal === tomorrowStr);
  if (btnAll) btnAll.classList.toggle("active", !dateVal);
}

// Khởi chạy khi DOM sẵn sàng
document.addEventListener("DOMContentLoaded", async () => {
  const container = document.getElementById("groomingSchedulePage");
  if (!container) return;

  // Đặt ngày và giờ mặc định thông minh cho form tạo lịch
  const inputDate = document.getElementById("grmDate");
  const inputStartTime = document.getElementById("grmStartTime");
  const filterDateInput = document.getElementById("filterDate");
  const todayStr = getTodayString();
  const smartInitial = getSmartInitialDateTime();

  if (inputDate) {
    inputDate.value = smartInitial.date;
    inputDate.min = todayStr; // Chặn chọn ngày quá khứ ngay trên input date
  }

  if (inputStartTime) {
    inputStartTime.value = smartInitial.startTime;
  }

  if (filterDateInput) {
    filterDateInput.value = todayStr;
    currentFilterDate = todayStr;
  }

  // Lắng nghe sự kiện đăng nhập / đăng xuất để tự động cập nhật danh sách khách
  window.addEventListener("pawncare:auth-changed", async () => {
    await loadCustomersAndPets();
  });

  // 1. Tải danh sách khách hàng và thú cưng
  await loadCustomersAndPets();

  // 2. Tải danh sách lịch hẹn ban đầu
  await loadGroomingSchedules();

  // 3. Sự kiện đổi khách hàng -> lọc thú cưng
  const selectCustomer = document.getElementById("grmCustomer");
  if (selectCustomer) {
    selectCustomer.addEventListener("change", (e) => {
      handleCustomerChange(e.target.value);
    });
  }

  // 4. Sự kiện chip gợi ý dịch vụ
  const chipButtons = document.querySelectorAll(".service-chip-btn");
  const inputServiceName = document.getElementById("grmServiceName");
  chipButtons.forEach((chip) => {
    chip.addEventListener("click", () => {
      const service = chip.getAttribute("data-service");
      if (inputServiceName && service) {
        inputServiceName.value = service;
        inputServiceName.focus();
      }
    });
  });

  // 5. Sự kiện submit form
  const form = document.getElementById("createGroomingForm");
  if (form) {
    form.addEventListener("submit", handleCreateGrooming);
  }

  // 6. Sự kiện bộ lọc ngày
  if (filterDateInput) {
    filterDateInput.addEventListener("change", async (e) => {
      currentFilterDate = e.target.value;
      updateQuickDateButtonsActive(currentFilterDate);
      await loadGroomingSchedules();
    });
  }

  // Quick date buttons
  const btnToday = document.getElementById("btnDateToday");
  const btnTomorrow = document.getElementById("btnDateTomorrow");
  const btnAll = document.getElementById("btnDateAll");

  if (btnToday) {
    btnToday.addEventListener("click", async () => {
      currentFilterDate = getTodayString();
      if (filterDateInput) filterDateInput.value = currentFilterDate;
      updateQuickDateButtonsActive(currentFilterDate);
      await loadGroomingSchedules();
    });
  }

  if (btnTomorrow) {
    btnTomorrow.addEventListener("click", async () => {
      currentFilterDate = getTomorrowString();
      if (filterDateInput) filterDateInput.value = currentFilterDate;
      updateQuickDateButtonsActive(currentFilterDate);
      await loadGroomingSchedules();
    });
  }

  if (btnAll) {
    btnAll.addEventListener("click", async () => {
      currentFilterDate = "";
      if (filterDateInput) filterDateInput.value = "";
      updateQuickDateButtonsActive("");
      await loadGroomingSchedules();
    });
  }

  // 7. Bộ lọc trạng thái
  const statusPills = document.querySelectorAll(".status-filter-pill");
  statusPills.forEach((pill) => {
    pill.addEventListener("click", () => {
      statusPills.forEach((p) => p.classList.remove("active"));
      pill.classList.add("active");
      currentFilterStatus = pill.getAttribute("data-status");
      renderScheduleList();
    });
  });

  // 8. Tìm kiếm nhanh
  const searchInput = document.getElementById("filterSearchInput");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      currentSearchTerm = e.target.value.trim();
      renderScheduleList();
    });
  }

  // 9. Nút refresh
  const btnRefresh = document.getElementById("btnRefreshSchedule");
  if (btnRefresh) {
    btnRefresh.addEventListener("click", async () => {
      await loadGroomingSchedules();
      showToast("Đã cập nhật lại lịch hẹn mới nhất!", "success");
    });
  }

  // 10. Sidebar logout
  const sidebarLogout = document.getElementById("sidebarLogoutLink");
  if (sidebarLogout) {
    sidebarLogout.addEventListener("click", (e) => {
      e.preventDefault();
      import("./auth.js").then(({ logoutUser }) => {
        logoutUser();
        window.location.href = "./index.html";
      });
    });
  }
});
