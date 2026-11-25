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

import { API_BASE_URL } from "./config.js";
import { escapeHTML } from "./storage.js";
import { getCurrentUser } from "./auth.js";

// Khởi tạo state toàn cục của trang
let customersList = [];
let allGroomings = [];
let currentFilterDate = ""; // "" = xem tất cả, hoặc "YYYY-MM-DD"
let currentFilterStatus = ""; // "" = tất cả, hoặc "pending" | "in_progress" | "completed" | "cancelled"
let currentSearchTerm = "";

// Helpers định danh & phân quyền người dùng
function getCallerId(user = getCurrentUser()) {
  return user ? (user.id || user._id || null) : null;
}

function getUserRoleId(user = getCurrentUser()) {
  if (!user) return 0;
  if (user.role_id !== undefined && user.role_id !== null) {
    return Number(user.role_id);
  }
  if (user.role === "admin") return 1;
  if (user.role === "doctor") return 2;
  if (user.role === "receptionist") return 3;
  return 4;
}

function isStaffRole(user = getCurrentUser()) {
  return [1, 2, 3].includes(getUserRoleId(user));
}

// Helper kiểm tra lịch có thuộc về khách hàng hiện tại hay không
function isOwnSchedule(item, user = getCurrentUser()) {
  if (!user || !item) return false;
  const callerId = String(getCallerId(user) || "");
  const userPhone = user.phone ? String(user.phone).trim() : "";

  const itemCustId =
    item.customerId && typeof item.customerId === "object"
      ? String(item.customerId._id || item.customerId.id || "")
      : String(item.customerId || "");
  const itemPhone = item.customerPhone ? String(item.customerPhone).trim() : "";

  return Boolean((callerId && itemCustId === callerId) || (userPhone && itemPhone === userPhone));
}

// Helper gọi API Grooming luôn kèm header x-user-id
async function groomingFetch(endpoint, options = {}) {
  const callerId = getCallerId();
  const headers = {
    "Content-Type": "application/json",
    ...(callerId ? { "x-user-id": callerId } : {}),
    ...(options.headers || {}),
  };

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });
  } catch (networkErr) {
    throw new Error(
      "Không kết nối được máy chủ. Vui lòng kiểm tra BackEnd đang hoạt động."
    );
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const err = new Error(data.message || `Lỗi máy chủ (HTTP ${response.status})`);
    err.status = response.status;
    err.data = data;
    throw err;
  }

  return data;
}

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

// Helper format ngày YYYY-MM-DD theo GIỜ LOCAL (tránh lệch múi giờ UTC)
function formatLocalDate(dateObj) {
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, "0");
  const day = String(dateObj.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getTodayString() {
  return formatLocalDate(new Date());
}

function getTomorrowString() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return formatLocalDate(d);
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

// 1. Tải danh sách khách hàng & thú cưng (không dùng fallback ID giả)
async function loadCustomersAndPets() {
  const selectCustomer = document.getElementById("grmCustomer");
  const selectPet = document.getElementById("grmPet");
  const btnSubmit = document.getElementById("btnSubmitGrooming");
  if (!selectCustomer || !selectPet) return;

  const user = getCurrentUser();
  const callerId = getCallerId(user);

  if (!user || !callerId) {
    customersList = [];
    selectCustomer.innerHTML = `<option value="">-- Vui lòng đăng nhập --</option>`;
    selectCustomer.disabled = true;
    selectPet.innerHTML = `<option value="">-- Vui lòng đăng nhập --</option>`;
    selectPet.disabled = true;
    if (btnSubmit) btnSubmit.disabled = true;
    showFormAlert(
      'Vui lòng <a href="./login.html" style="color: #1E429F; font-weight: 700;">đăng nhập</a> để đặt lịch chăm sóc grooming.',
      "warning"
    );
    return;
  }

  if (btnSubmit) btnSubmit.disabled = false;
  showFormAlert("");

  let fetchedCustomers = [];
  let apiFailed = false;
  try {
    const res = await groomingFetch("/grooming-meta/customers", { method: "GET" });
    if (res && res.success && Array.isArray(res.customers)) {
      fetchedCustomers = res.customers;
    } else {
      apiFailed = true;
      showFormAlert(escapeHTML(res?.message || "Không tải được danh sách khách hàng."), "danger");
    }
  } catch (err) {
    apiFailed = true;
    console.warn("Không tải được danh sách khách hàng từ API:", err);
    showFormAlert(escapeHTML(err.message || "Không tải được danh sách khách hàng."), "danger");
  }

  const roleId = getUserRoleId(user);

  // Nếu là Khách hàng (role_id === 4): chỉ hiển thị & khóa chọn khách hàng là chính mình
  if (roleId === 4) {
    let matchedCustomer = fetchedCustomers.find(
      (c) =>
        String(c.id) === String(callerId) ||
        (c.phone && user.phone && String(c.phone).trim() === String(user.phone).trim())
    );

    if (!matchedCustomer) {
      matchedCustomer = {
        id: String(callerId),
        name: user.name || "Khách hàng",
        phone: user.phone || "",
        pets: [],
      };
    }

    customersList = [matchedCustomer];
    selectCustomer.innerHTML = `<option value="${escapeHTML(matchedCustomer.id)}">${escapeHTML(matchedCustomer.name)} (${escapeHTML(matchedCustomer.phone || "Chưa có SĐT")})</option>`;
    selectCustomer.value = matchedCustomer.id;
    selectCustomer.disabled = true;

    if (apiFailed) {
      selectPet.innerHTML = `<option value="">-- Không tải được danh sách thú cưng --</option>`;
      selectPet.disabled = true;
      return;
    }

    handleCustomerChange(matchedCustomer.id);
    return;
  }

  // Nhân viên (Admin / Bác sĩ / Lễ tân): chọn từ danh sách khách hàng thật trong DB
  customersList = fetchedCustomers;
  selectCustomer.disabled = false;

  if (customersList.length === 0) {
    selectCustomer.innerHTML = `<option value="">-- Chưa có khách hàng nào trong hệ thống --</option>`;
    selectPet.innerHTML = `<option value="">-- Vui lòng tạo hồ sơ khách hàng/thú cưng trước --</option>`;
    selectPet.disabled = true;
    if (!apiFailed) {
      showFormAlert("Hiện chưa có dữ liệu khách hàng trong hệ thống.", "warning");
    }
    return;
  }

  selectCustomer.innerHTML =
    `<option value="">-- Chọn khách hàng --</option>` +
    customersList
      .map(
        (c) =>
          `<option value="${escapeHTML(c.id)}">${escapeHTML(c.name)} (${escapeHTML(c.phone || "Chưa có SĐT")})</option>`
      )
      .join("");

  selectPet.innerHTML = `<option value="">-- Vui lòng chọn khách hàng trước --</option>`;
  selectPet.disabled = true;
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
    const isCustomerRole = getUserRoleId() === 4;
    selectPet.innerHTML = isCustomerRole
      ? `<option value="">-- Bạn chưa có hồ sơ thú cưng --</option>`
      : `<option value="">-- Khách hàng này chưa có hồ sơ thú cưng --</option>`;
    selectPet.disabled = true;
    showFormAlert(
      isCustomerRole
        ? 'Bạn chưa có hồ sơ thú cưng nào. Vui lòng <a href="./pet-profile.html" style="color: #1E429F; font-weight: 700;">tạo hồ sơ thú cưng</a> trước khi đặt lịch grooming!'
        : 'Khách hàng này chưa có hồ sơ thú cưng. Vui lòng tạo hồ sơ thú cưng trước khi đặt lịch grooming!',
      "warning"
    );
    return;
  }

  selectPet.disabled = false;
  selectPet.innerHTML =
    `<option value="">-- Chọn thú cưng của khách --</option>` +
    customer.pets
      .map(
        (p) =>
          `<option value="${escapeHTML(p.id)}">${escapeHTML(p.name)} (${escapeHTML(p.species || "Thú cưng")}${p.breed ? " - " + escapeHTML(p.breed) : ""})</option>`
      )
      .join("");
}

// 3. Xử lý gửi Form tạo lịch chăm sóc Grooming
// (Kiểm tra trùng giờ chuẩn theo từng bác sĩ do BackEnd thực hiện để không chặn oan khi có nhiều bác sĩ)
async function handleCreateGrooming(e) {
  e.preventDefault();
  showFormAlert("");

  const user = getCurrentUser();
  const callerId = getCallerId(user);
  if (!user || !callerId) {
    showToast("Vui lòng đăng nhập để tạo lịch!", "warning");
    showFormAlert(
      'Vui lòng <a href="./login.html" style="color: #1E429F; font-weight: 700;">đăng nhập</a> để đặt lịch chăm sóc grooming.',
      "warning"
    );
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

  const customerId = getUserRoleId(user) === 4 ? String(callerId) : selectCustomer.value;
  const petId = selectPet.value;
  const serviceName = inputServiceName.value.trim();
  const price = inputPrice.value ? Number(inputPrice.value) : 0;
  const date = inputDate.value;
  const startTime = inputStartTime.value;
  const duration = Number(selectDuration.value) || 45;
  const note = inputNote.value.trim();

  // Kiểm tra dữ liệu bắt buộc từng trường
  if (!customerId) {
    showFormAlert("Vui lòng chọn <strong>Khách hàng</strong> trước khi đặt lịch!", "warning");
    selectCustomer.focus();
    return;
  }

  if (!petId) {
    const selectedCust = customersList.find((c) => String(c.id) === String(customerId));
    if (!selectedCust || !selectedCust.pets || selectedCust.pets.length === 0) {
      showFormAlert(
        'Khách hàng chưa có hồ sơ thú cưng. Vui lòng <a href="./pet-profile.html" style="color: #1E429F; font-weight: 700;">tạo hồ sơ thú cưng</a> trước khi đặt lịch!',
        "warning"
      );
    } else {
      showFormAlert("Vui lòng chọn <strong>Thú cưng</strong> muốn đặt dịch vụ grooming!", "warning");
      selectPet.focus();
    }
    return;
  }

  if (!serviceName) {
    showFormAlert(
      "Vui lòng nhập hoặc bấm chọn <strong>Tên dịch vụ</strong> (ví dụ: Tắm dưỡng mượt, Cắt tỉa lông...)!",
      "warning"
    );
    inputServiceName.focus();
    return;
  }

  if (!date || !startTime) {
    showFormAlert("Vui lòng chọn <strong>Ngày hẹn</strong> và <strong>Giờ bắt đầu</strong>!", "warning");
    return;
  }

  // RÀNG BUỘC: Không cho tạo lịch vào thời điểm trong quá khứ
  const selectedDateTime = new Date(`${date}T${startTime}:00`);
  if (selectedDateTime.getTime() < Date.now()) {
    showFormAlert(
      "<strong>Không thể đặt lịch trong quá khứ!</strong> Vui lòng chọn ngày và giờ ở thời điểm hiện tại hoặc tương lai.",
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

    const res = await groomingFetch("/grooming", {
      method: "POST",
      body: JSON.stringify(payload),
    });

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
      showFormAlert(escapeHTML(res?.message || "Không thể tạo lịch hẹn."), "danger");
    }
  } catch (err) {
    console.error("Lỗi khi tạo lịch grooming:", err);
    showFormAlert(
      `<strong>Không thể tạo lịch:</strong> ${escapeHTML(err.message || "Lỗi máy chủ khi tạo lịch hẹn. Vui lòng thử lại!")}`,
      "danger"
    );
    const alertContainer = document.getElementById("groomingAlertContainer");
    if (alertContainer) {
      alertContainer.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  } finally {
    if (btnSubmit) {
      btnSubmit.disabled = false;
      btnSubmit.innerHTML = `<span>➕ Tạo Lịch Hẹn Chăm Sóc</span>`;
    }
  }
}

// 4. Tải danh sách lịch chăm sóc từ API & hiển thị (có kiểm tra đăng nhập & x-user-id)
async function loadGroomingSchedules() {
  const container = document.getElementById("scheduleTimelineList");
  const countDisplay = document.getElementById("scheduleCountDisplay");
  if (!container) return;

  const user = getCurrentUser();
  const callerId = getCallerId(user);

  if (!user || !callerId) {
    allGroomings = [];
    updateKPIStats();
    if (countDisplay) countDisplay.textContent = "0";
    container.innerHTML = `
      <div class="no-schedule-box">
        <span class="no-schedule-icon">🔒</span>
        <div class="no-schedule-title">Vui lòng đăng nhập để xem lịch chăm sóc</div>
        <p class="no-schedule-desc">
          Đăng nhập vào tài khoản PawnCare của bạn để xem, đặt mới hoặc quản lý lịch chăm sóc spa &amp; grooming.
        </p>
        <a href="./login.html" class="btn-book-from-empty" style="text-decoration: none;">
          <span>🔑 Đăng nhập ngay</span>
        </a>
      </div>
    `;
    return;
  }

  container.innerHTML = `<div style="text-align: center; padding: 30px; color: var(--ink-faint);">⏳ Đang tải lịch hẹn...</div>`;

  try {
    const params = new URLSearchParams();
    if (currentFilterDate) {
      params.append("date", currentFilterDate);
    }
    if (getUserRoleId(user) === 4) {
      params.append("customerId", callerId);
    }

    const query = params.toString();
    const endpoint = query ? `/grooming?${query}` : "/grooming";
    const res = await groomingFetch(endpoint, { method: "GET" });

    let rawList = res && res.success ? res.groomings || [] : [];

    // Bảo vệ phía client: Khách hàng (role_id === 4) chỉ thấy lịch của chính mình
    if (getUserRoleId(user) === 4) {
      rawList = rawList.filter((item) => isOwnSchedule(item, user));
    }

    allGroomings = rawList;

    renderScheduleList();
    updateKPIStats();
  } catch (err) {
    console.error("Lỗi tải lịch grooming:", err);
    allGroomings = [];
    updateKPIStats();
    if (countDisplay) countDisplay.textContent = "0";
    container.innerHTML = `
      <div class="no-schedule-box">
        <span class="no-schedule-icon">⚠️</span>
        <div class="no-schedule-title">Không thể tải dữ liệu lịch hẹn</div>
        <p class="no-schedule-desc">${escapeHTML(err.message)}</p>
      </div>
    `;
  }
}

// 5. Cập nhật thẻ KPI Thống kê 4 trạng thái
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

// 6. Render danh sách lịch hẹn (SẮP XẾP GIỜ TĂNG DẦN & HIỂN THỊ "Chưa có lịch hẹn" NẾU TRỐNG)
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
          Hiện tại chưa có lịch chăm sóc grooming nào trong ${escapeHTML(dateNotice)}. Hãy dùng form phía trên để đặt lịch cho các bé cưng nhé!
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
      const endTimeDisplay =
        item.endTime ||
        minutesToTime((item.startMinutes || timeToMinutes(item.startTime)) + (item.duration || 45));

      return `
        <div class="schedule-item-card status-${escapeHTML(statusClass)}" data-id="${escapeHTML(item._id || item.groomingCode)}">
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

// 7. Tạo HTML nhãn màu trạng thái riêng biệt (pending, in_progress, completed, cancelled)
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

// 8. Nút đổi trạng thái theo phân quyền:
// - Nhân viên (role_id 1, 2, 3): pending -> in_progress -> completed (hoặc cancelled)
// - Khách hàng (role_id 4): KHÔNG thấy nút "Bắt đầu làm" / "Hoàn thành", chỉ được Hủy lịch pending của chính mình
function renderActionButtonsHtml(item) {
  const id = escapeHTML(item._id || item.groomingCode);
  const user = getCurrentUser();
  const staff = isStaffRole(user);

  if (item.status === "pending") {
    if (staff) {
      return `
        <button type="button" class="btn-status-act btn-start-grooming" data-id="${id}" data-action="start">
          <span>✂️ Bắt đầu làm</span>
        </button>
        <button type="button" class="btn-status-act btn-cancel-grooming" data-id="${id}" data-action="cancel">
          <span>Hủy lịch</span>
        </button>
      `;
    }

    if (isOwnSchedule(item, user)) {
      return `
        <button type="button" class="btn-status-act btn-cancel-grooming" data-id="${id}" data-action="cancel">
          <span>Hủy lịch</span>
        </button>
      `;
    }

    return `<span class="state-locked-badge">⏳ Đang chờ nhân viên tiếp nhận</span>`;
  }

  if (item.status === "in_progress") {
    if (staff) {
      return `
        <button type="button" class="btn-status-act btn-complete-grooming" data-id="${id}" data-action="complete">
          <span>✅ Hoàn thành</span>
        </button>
        <button type="button" class="btn-status-act btn-cancel-grooming" data-id="${id}" data-action="cancel">
          <span>Hủy lịch</span>
        </button>
      `;
    }

    return `<span class="state-locked-badge">✂️ Bé đang được chăm sóc tại spa</span>`;
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

// 9. Gắn sự kiện cho các nút đổi trạng thái
function attachActionButtonListeners() {
  const buttons = document.querySelectorAll(".btn-status-act");
  buttons.forEach((btn) => {
    btn.addEventListener("click", async () => {
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

// 10. Xử lý chuyển trạng thái theo thứ tự (chỉ dành cho nhân viên role_id 1, 2, 3)
async function handleStatusTransition(id, newStatus, actionName) {
  const user = getCurrentUser();
  if (!user) {
    showToast("Vui lòng đăng nhập để thay đổi trạng thái!", "warning");
    return;
  }

  if (!isStaffRole(user)) {
    showToast("Chỉ nhân viên phòng khám mới được chuyển tiến trình dịch vụ!", "error");
    return;
  }

  if (!confirm(`Bạn có chắc muốn chuyển trạng thái sang "${actionName}"?`)) {
    return;
  }

  try {
    const res = await groomingFetch(`/grooming/${encodeURIComponent(id)}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status: newStatus }),
    });
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

// 11. Xử lý hủy lịch (cancelled)
async function handleCancelGrooming(id) {
  const user = getCurrentUser();
  if (!user) {
    showToast("Vui lòng đăng nhập để hủy lịch!", "warning");
    return;
  }

  // Khách hàng chỉ được hủy lịch pending của chính mình
  if (!isStaffRole(user)) {
    const target = allGroomings.find(
      (g) => String(g._id) === String(id) || String(g.groomingCode) === String(id)
    );
    if (!target || target.status !== "pending" || !isOwnSchedule(target, user)) {
      showToast("Bạn chỉ có thể hủy lịch hẹn đang chờ (pending) của chính mình!", "error");
      return;
    }
  }

  if (!confirm("Bạn có chắc chắn muốn HỦY lịch hẹn này? Khung giờ sẽ được giải phóng cho khách khác.")) {
    return;
  }

  try {
    const res = await groomingFetch(`/grooming/${encodeURIComponent(id)}/cancel`, {
      method: "PATCH",
    });
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

// 12. Cập nhật nút chọn nhanh ngày (Hôm nay, Ngày mai, Tất cả)
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

  // Lắng nghe sự kiện đăng nhập / đăng xuất để tự động cập nhật danh sách khách và lịch hẹn
  window.addEventListener("pawncare:auth-changed", async () => {
    await loadCustomersAndPets();
    await loadGroomingSchedules();
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
      currentFilterStatus = pill.getAttribute("data-status") || "";
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
});
