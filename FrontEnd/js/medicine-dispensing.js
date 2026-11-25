/* ============================================================
   medicine-dispensing.js
   Sprint 4: Medicine & Dispensing (Toàn phụ trách)
   1. Medicine list (hiện số lượng, hạn dùng, nhãn Còn hàng/Hết hàng/Hết hạn)
   2. Code Medicine list: thêm/sửa/xóa/tìm kiếm
   3. Prescription dispensing: chọn đơn, kiểm tra tồn kho & hạn dùng, xác nhận cấp, trừ kho, báo lỗi rõ tên thuốc
   ============================================================ */

import {
  apiGetMedicines,
  apiCreateMedicine,
  apiUpdateMedicine,
  apiDeleteMedicine,
  apiDispensePrescription,
  apiCreateInvoiceFromDispensing,
} from "./api.js";
import { getCurrentUser } from "./auth.js";
import { escapeHTML } from "./storage.js";
import { API_BASE_URL } from "./config.js";

let masterMedicines = [];
let filteredMedicines = [];
let allPrescriptions = [];
let currentSearchMed = "";
let currentStockFilter = "";
let currentSearchPres = "";
let selectedPrescription = null;

// Helper xác định trạng thái tồn kho của một loại thuốc
function getMedicineStockStatus(m) {
  if (m.isExpired || (m.expiryDate && new Date(m.expiryDate) < new Date())) {
    return "Hết hạn";
  }
  if (m.isOutOfStock || Number(m.quantity) <= 0) {
    return "Hết hàng";
  }
  return "Còn hàng";
}

// Helper format ngày local YYYY-MM-DD
function formatLocalDate(dateObj) {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, "0");
  const d = String(dateObj.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Helper format tiền tệ VNĐ
function formatVND(amount) {
  if (!amount || isNaN(amount)) return "0 đ";
  return Number(amount).toLocaleString("vi-VN") + " đ";
}

// Toast thông báo
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

// 1. TẢI TOÀN BỘ DANH MỤC THUỐC (masterMedicines) & LỌC HIỂN THỊ (filteredMedicines)
async function loadMedicines() {
  const tbody = document.getElementById("medTableBody");
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 30px; color: var(--ink-faint);">⏳ Đang tải kho thuốc...</td></tr>`;

  try {
    // Luôn tải toàn bộ kho chưa lọc để KPI & kiểm tra cấp thuốc luôn chính xác
    const res = await apiGetMedicines({});
    if (!res || res.success === false) {
      throw new Error(res?.message || "Không thể tải dữ liệu kho thuốc.");
    }
    masterMedicines = res.medicines || [];

    updateMedicineKPIs();
    applyMedicineFilters();
  } catch (err) {
    console.error("Lỗi tải danh mục thuốc:", err);
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #DC2626; padding: 30px;">Lỗi tải dữ liệu: ${escapeHTML(err.message)}</td></tr>`;
  }
}

// Lọc từ masterMedicines ra filteredMedicines để hiển thị bảng mà không làm sai lệch KPI
function applyMedicineFilters() {
  let list = masterMedicines.slice();

  if (currentSearchMed) {
    const term = currentSearchMed.toLowerCase();
    list = list.filter(
      (m) =>
        (m.name && m.name.toLowerCase().includes(term)) ||
        (m.activeIngredient && m.activeIngredient.toLowerCase().includes(term)) ||
        (m.medicineCode && m.medicineCode.toLowerCase().includes(term)) ||
        (m.description && m.description.toLowerCase().includes(term))
    );
  }

  if (currentStockFilter) {
    list = list.filter((m) => getMedicineStockStatus(m) === currentStockFilter);
  }

  filteredMedicines = list;
  renderMedicineTable();
}

// 2. CẬP NHẬT KPI KHO THUỐC (LUÔN TÍNH TỪ TOÀN BỘ KHO masterMedicines)
function updateMedicineKPIs() {
  const statTotal = document.getElementById("statTotalMeds");
  const statInStock = document.getElementById("statInStockMeds");
  const statOutOfStock = document.getElementById("statOutOfStockMeds");
  const statExpired = document.getElementById("statExpiredMeds");

  let inStockCount = 0;
  let outOfStockCount = 0;
  let expiredCount = 0;

  masterMedicines.forEach((m) => {
    const status = getMedicineStockStatus(m);
    if (status === "Hết hạn") {
      expiredCount++;
    } else if (status === "Hết hàng") {
      outOfStockCount++;
    } else {
      inStockCount++;
    }
  });

  if (statTotal) statTotal.textContent = masterMedicines.length;
  if (statInStock) statInStock.textContent = inStockCount;
  if (statOutOfStock) statOutOfStock.textContent = outOfStockCount;
  if (statExpired) statExpired.textContent = expiredCount;
}

// 3. RENDER BẢNG DANH MỤC THUỐC (HIỂN THỊ filteredMedicines)
function renderMedicineTable() {
  const tbody = document.getElementById("medTableBody");
  if (!tbody) return;

  if (filteredMedicines.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 30px; color: var(--ink-faint);">Không tìm thấy loại thuốc nào phù hợp.</td></tr>`;
    return;
  }

  const user = getCurrentUser();
  const canEdit = user && [1, 2, 3].includes(Number(user.role_id));

  tbody.innerHTML = filteredMedicines
    .map((m) => {
      const stockStatus = getMedicineStockStatus(m);
      let statusTag = `<span class="stock-tag available">✓ Còn hàng</span>`;
      if (stockStatus === "Hết hạn") {
        statusTag = `<span class="stock-tag expired">🚫 Hết hạn</span>`;
      } else if (stockStatus === "Hết hàng") {
        statusTag = `<span class="stock-tag out-of-stock">⚠️ Hết hàng</span>`;
      }

      const expDateStr = m.expiryDate
        ? new Date(m.expiryDate).toLocaleDateString("vi-VN")
        : "--/--/----";

      return `
        <tr data-id="${escapeHTML(m._id)}">
          <td>
            <strong style="color: var(--espresso); font-size: 14px;">${escapeHTML(m.name)}</strong><br/>
            <small style="color: var(--ink-faint);">${escapeHTML(m.medicineCode || "")} ${m.activeIngredient ? `(${escapeHTML(m.activeIngredient)})` : ""}</small>
          </td>
          <td><strong>${escapeHTML(m.unit || "viên")}</strong></td>
          <td><strong style="color: #1E429F;">${formatVND(m.price)}</strong></td>
          <td>
            <strong style="font-size: 14px; ${m.quantity <= 0 ? "color: #DC2626;" : "color: var(--ink);"}">
              ${m.quantity}
            </strong> ${escapeHTML(m.unit || "")}
            ${m.quantity <= 0 ? `<br/><small style="color: #DC2626; font-weight: 600;">(Đã hết tồn kho)</small>` : ""}
          </td>
          <td>
            <span>${expDateStr}</span>
            ${stockStatus === "Hết hạn" ? `<br/><small style="color: #D97706; font-weight: 600;">(Đã quá hạn)</small>` : ""}
          </td>
          <td>${statusTag}</td>
          <td>
            ${canEdit ? `<button type="button" class="btn-med-act btn-med-edit" data-id="${escapeHTML(m._id)}">✏️ Sửa</button>` : ""}
            ${canEdit ? `<button type="button" class="btn-med-act btn-med-delete" data-id="${escapeHTML(m._id)}" data-name="${escapeHTML(m.name)}">🗑️ Xóa</button>` : ""}
          </td>
        </tr>
      `;
    })
    .join("");

  // Gắn sự kiện sửa / xóa
  tbody.querySelectorAll(".btn-med-edit").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-id");
      const med = masterMedicines.find((m) => String(m._id) === String(id));
      if (med) openMedicineModal(med);
    });
  });

  tbody.querySelectorAll(".btn-med-delete").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-id");
      const name = btn.getAttribute("data-name");
      if (!confirm(`Bạn có chắc muốn xóa thuốc "${name}" khỏi kho không?`)) return;

      try {
        await apiDeleteMedicine(id);
        showToast(`Đã xóa thuốc "${name}" thành công!`, "success");
        await loadMedicines();
      } catch (err) {
        showToast(err.message || "Xóa thuốc thất bại.", "error");
      }
    });
  });
}

// 4. MODAL THÊM / SỬA THUỐC
function openMedicineModal(med = null) {
  const modal = document.getElementById("medModal");
  const title = document.getElementById("medModalTitle");
  const formId = document.getElementById("formMedId");
  const formName = document.getElementById("formMedName");
  const formUnit = document.getElementById("formMedUnit");
  const formPrice = document.getElementById("formMedPrice");
  const formQty = document.getElementById("formMedQuantity");
  const formExp = document.getElementById("formMedExpiry");
  const formDesc = document.getElementById("formMedDesc");
  const alertBox = document.getElementById("medFormAlert");

  if (!modal) return;
  alertBox.style.display = "none";
  alertBox.innerHTML = "";

  if (med) {
    title.textContent = `✏️ Chỉnh Sửa Thuốc: ${med.name}`;
    formId.value = med._id;
    formName.value = med.name || "";
    formUnit.value = med.unit || "";
    formPrice.value = med.price || "";
    formQty.value = med.quantity !== undefined ? med.quantity : 0;
    formExp.value = med.expiryDate ? med.expiryDate.slice(0, 10) : "";
    formDesc.value = med.description || "";
  } else {
    title.textContent = "➕ Thêm Thuốc Mới Vào Kho";
    formId.value = "";
    formName.value = "";
    formUnit.value = "viên";
    formPrice.value = "";
    formQty.value = "50";
    // Mặc định hạn dùng 1 năm sau (theo giờ local)
    const nextYear = new Date();
    nextYear.setFullYear(nextYear.getFullYear() + 1);
    formExp.value = formatLocalDate(nextYear);
    formDesc.value = "";
  }

  modal.style.display = "flex";
}

function closeMedicineModal() {
  const modal = document.getElementById("medModal");
  if (modal) modal.style.display = "none";
}

// Xử lý submit form thuốc
async function handleSaveMedicine(e) {
  e.preventDefault();

  const formId = document.getElementById("formMedId").value;
  const name = document.getElementById("formMedName").value.trim();
  const unit = document.getElementById("formMedUnit").value.trim();
  const price = Number(document.getElementById("formMedPrice").value);
  const quantity = Number(document.getElementById("formMedQuantity").value);
  const expiryDate = document.getElementById("formMedExpiry").value;
  const description = document.getElementById("formMedDesc").value.trim();
  const alertBox = document.getElementById("medFormAlert");

  // RÀNG BUỘC THEO ĐỀ BÀI:
  // Giá phải lớn hơn 0, Số lượng tồn không được âm
  if (price <= 0) {
    alertBox.style.display = "flex";
    alertBox.innerHTML = "<span>⚠️</span> <span>Giá bán của thuốc phải lớn hơn 0!</span>";
    return;
  }
  if (quantity < 0) {
    alertBox.style.display = "flex";
    alertBox.innerHTML = "<span>⚠️</span> <span>Số lượng tồn kho không được âm!</span>";
    return;
  }

  const payload = {
    name,
    unit,
    price,
    quantity,
    expiryDate,
    description,
  };

  try {
    if (formId) {
      await apiUpdateMedicine(formId, payload);
      showToast(`Cập nhật thuốc "${name}" thành công!`, "success");
    } else {
      await apiCreateMedicine(payload);
      showToast(`Thêm thuốc mới "${name}" vào kho thành công!`, "success");
    }
    closeMedicineModal();
    await loadMedicines();
  } catch (err) {
    alertBox.style.display = "flex";
    alertBox.innerHTML = `<span>🚫</span> <span>${escapeHTML(err.message || "Lỗi lưu thuốc.")}</span>`;
  }
}

// 5. TẢI DANH SÁCH ĐƠN THUỐC CẦN CẤP (PRESCRIPTIONS)
async function loadPrescriptions() {
  const tbody = document.getElementById("prescriptionsTableBody");
  const countEl = document.getElementById("prescriptionsCount");
  if (!tbody) return;

  const user = getCurrentUser();
  const callerId = user ? (user.id || user._id) : null;

  if (!user || !callerId) {
    allPrescriptions = [];
    if (countEl) countEl.textContent = "0";
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 30px; color: #DC2626;">⚠️ Vui lòng <a href="./login.html" style="color: #1E429F; font-weight: 600;">đăng nhập</a> bằng tài khoản Lễ tân / Quản trị viên để xem và cấp thuốc theo đơn.</td></tr>`;
    return;
  }

  tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 30px; color: var(--ink-faint);">⏳ Đang tải đơn thuốc sau khám...</td></tr>`;

  try {
    const params = new URLSearchParams();
    if (currentSearchPres) params.append("search", currentSearchPres);

    const headers = { "x-user-id": callerId };

    const res = await fetch(`${API_BASE_URL}/receptionist/prescriptions?${params.toString()}`, { headers });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      allPrescriptions = [];
      if (countEl) countEl.textContent = "0";

      if (res.status === 403) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #B45309; padding: 30px; font-weight: 600;">🔒 Chức năng cấp thuốc chỉ dành cho Lễ tân / Quản trị viên.</td></tr>`;
        return;
      }
      if (res.status === 401) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #DC2626; padding: 30px;">⚠️ Phiên đăng nhập không hợp lệ. Vui lòng <a href="./login.html" style="color: #1E429F; font-weight: 600;">đăng nhập lại</a>.</td></tr>`;
        return;
      }

      throw new Error(data.message || `Không thể tải danh sách đơn thuốc (HTTP ${res.status}).`);
    }

    allPrescriptions = data.prescriptions || [];
    if (countEl) countEl.textContent = allPrescriptions.length;

    renderPrescriptionsTable();
  } catch (err) {
    console.error("Lỗi tải đơn thuốc:", err);
    allPrescriptions = [];
    if (countEl) countEl.textContent = "0";
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #DC2626; padding: 30px;">Lỗi: ${escapeHTML(err.message)}</td></tr>`;
  }
}

// 6. RENDER BẢNG ĐƠN THUỐC
function renderPrescriptionsTable() {
  const tbody = document.getElementById("prescriptionsTableBody");
  if (!tbody) return;

  if (allPrescriptions.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 30px; color: var(--ink-faint);">Không có đơn thuốc nào cần xử lý.</td></tr>`;
    return;
  }

  tbody.innerHTML = allPrescriptions
    .map((p) => {
      const medListHtml = (p.medicines || [])
        .map((m) => `• <strong>${escapeHTML(m.name)}</strong>: ${m.quantity || 1} ${escapeHTML(m.unit || "")} (${escapeHTML(m.dosage || "")})`)
        .join("<br/>") || '<span style="color: var(--ink-faint);">(Chưa kê thuốc)</span>';

      const isDispensed = Boolean(p.isDispensed || p.dispensing);

      const statusHtml = isDispensed
        ? `<span class="stock-tag available">✓ Đã cấp [${escapeHTML(p.dispensing?.dispensingCode || "DISP")}]</span><br/>
           <small style="color: var(--ink-faint);">${escapeHTML(p.dispensing?.dispensedBy || "Dược sĩ")} • ${p.dispensing?.dispensedAt ? new Date(p.dispensing.dispensedAt).toLocaleTimeString("vi-VN") : ""}</small>`
        : `<span class="stock-tag expired">⏳ Chờ cấp thuốc</span>`;

      // Nút cấp thuốc (chặn cấp lặp nếu đã cấp)
      const actionBtn = isDispensed
        ? `<span style="font-size: 12.5px; color: var(--ink-faint); font-style: italic;">🔒 Đã hoàn thành (Chặn cấp lặp)</span>`
        : `<button type="button" class="btn-dispense-act" data-pres-code="${escapeHTML(p.prescriptionCode)}">💊 Cấp Thuốc &amp; Lập HĐ</button>`;

      return `
        <tr>
          <td>
            <strong style="color: var(--espresso); font-size: 14px;">${escapeHTML(p.prescriptionCode)}</strong><br/>
            <small style="color: var(--ink-faint);">${escapeHTML(p.date || "")}</small>
          </td>
          <td>
            <strong>${escapeHTML(p.petName || "Bé cưng")}</strong><br/>
            <small style="color: var(--ink-faint);">${escapeHTML(p.petSpecies || "")} ${p.customerName ? `• Chủ: ${escapeHTML(p.customerName)}` : ""}</small>
          </td>
          <td>
            <strong style="color: #683D22;">${escapeHTML(p.diagnosis || "Chẩn đoán chung")}</strong><br/>
            <small style="color: var(--ink-faint);">BS: ${escapeHTML(p.veterinarian || "Bác sĩ điều trị")}</small>
          </td>
          <td style="font-size: 13px; line-height: 1.5;">${medListHtml}</td>
          <td>${statusHtml}</td>
          <td>${actionBtn}</td>
        </tr>
      `;
    })
    .join("");

  // Gắn sự kiện nút Cấp thuốc
  tbody.querySelectorAll(".btn-dispense-act").forEach((btn) => {
    btn.addEventListener("click", () => {
      const presCode = btn.getAttribute("data-pres-code");
      const pres = allPrescriptions.find((p) => p.prescriptionCode === presCode);
      if (pres) openDispenseModal(pres);
    });
  });
}

// 7. MODAL XÁC NHẬN CẤP THUỐC VÀ KIỂM TRA TỒN KHO / HẠN DÙNG
function openDispenseModal(pres) {
  selectedPrescription = pres;
  const modal = document.getElementById("dispenseModal");
  const presCodeEl = document.getElementById("dispenseModalPresCode");
  const petNameEl = document.getElementById("dispenseModalPetName");
  const diagnosisEl = document.getElementById("dispenseModalDiagnosis");
  const itemsContainer = document.getElementById("dispenseItemsListContainer");
  const alertContainer = document.getElementById("dispenseAlertContainer");
  const btnExecute = document.getElementById("btnExecuteDispense");
  const noteInput = document.getElementById("dispenseNoteInput");

  if (!modal) return;

  // Xóa trắng ghi chú cũ mỗi khi mở Modal cấp thuốc
  if (noteInput) noteInput.value = "";

  presCodeEl.textContent = pres.prescriptionCode;
  petNameEl.textContent = `${pres.petName} (${pres.petSpecies || ""})`;
  diagnosisEl.textContent = `${pres.diagnosis || ""} (BS: ${pres.veterinarian || ""})`;

  alertContainer.style.display = "none";
  alertContainer.innerHTML = "";
  btnExecute.disabled = false;

  // Kiểm tra từng thuốc trong đơn với toàn bộ kho masterMedicines (không bị ảnh hưởng bởi bộ lọc Tab 1)
  const medsInPres = pres.medicines || [];
  let hasStockError = false;
  let errorMessages = [];

  const itemsHtml = medsInPres
    .map((item) => {
      const qtyMatch = String(item.quantity || "").match(/\d+/);
      const parsedQty = qtyMatch ? parseInt(qtyMatch[0], 10) : 1;
      const reqQty = parsedQty > 0 ? parsedQty : 1;
      // Tìm trong toàn bộ kho theo tên
      const matched = masterMedicines.find(
        (m) => m.name.toLowerCase().trim() === String(item.name || "").toLowerCase().trim()
      );

      let statusBadge = "";
      if (!matched) {
        hasStockError = true;
        errorMessages.push(`Thuốc [${item.name}] chưa được tạo trong kho dược!`);
        statusBadge = `<span class="stock-tag out-of-stock">Chưa có trong kho</span>`;
      } else if (getMedicineStockStatus(matched) === "Hết hạn") {
        hasStockError = true;
        const expStr = matched.expiryDate ? new Date(matched.expiryDate).toLocaleDateString("vi-VN") : "";
        errorMessages.push(`Thuốc [${item.name}] đã hết hạn dùng vào ngày ${expStr}! Không thể cấp!`);
        statusBadge = `<span class="stock-tag expired">Đã hết hạn (${expStr})</span>`;
      } else if (Number(matched.quantity) < reqQty) {
        hasStockError = true;
        errorMessages.push(`Thuốc [${item.name}] không đủ tồn kho (Cần: ${reqQty}, Còn: ${matched.quantity})!`);
        statusBadge = `<span class="stock-tag out-of-stock">Thiếu tồn kho (Còn ${matched.quantity})</span>`;
      } else {
        statusBadge = `<span class="stock-tag available">✓ Đủ tồn kho (Còn ${matched.quantity})</span>`;
      }

      const displayUnit = item.unit || matched?.unit || "viên";

      return `
        <div class="dispense-item-row">
          <div>
            <strong>${escapeHTML(item.name)}</strong> - Yêu cầu: <strong>${reqQty}</strong> ${escapeHTML(displayUnit)}
            ${item.dosage ? `<br/><small style="color: var(--ink-faint);">${escapeHTML(item.dosage)}</small>` : ""}
          </div>
          <div>${statusBadge}</div>
        </div>
      `;
    })
    .join("");

  itemsContainer.innerHTML = itemsHtml || '<div style="color: var(--ink-faint);">Không có thông tin thuốc trong đơn này.</div>';

  // NẾU CÓ THUỐC HẾT HÀNG HOẶC HẾT HẠN: BÁO RÕ TÊN THUỐC CÓ VẤN ĐỀ & KHÓA NÚT CẤP
  if (hasStockError) {
    alertContainer.style.display = "flex";
    alertContainer.innerHTML = `
      <span>🚫</span>
      <div>
        <strong>Không thể cấp thuốc!</strong><br/>
        ${errorMessages.map((e) => `• ${escapeHTML(e)}`).join("<br/>")}
      </div>
    `;
    btnExecute.disabled = true;
  }

  modal.style.display = "flex";
}

function closeDispenseModal() {
  const modal = document.getElementById("dispenseModal");
  if (modal) modal.style.display = "none";
}

// 8. THỰC HIỆN CẤP THUỐC THEO ĐƠN & TỰ ĐỘNG XUẤT HÓA ĐƠN
async function handleExecuteDispense() {
  if (!selectedPrescription) return;

  const user = getCurrentUser();
  const noteInput = document.getElementById("dispenseNoteInput");
  const note = noteInput ? noteInput.value.trim() : "";
  const btn = document.getElementById("btnExecuteDispense");

  btn.disabled = true;
  btn.textContent = "⏳ Đang cấp thuốc & trừ kho...";

  try {
    // 1. Cấp thuốc (backend tự kiểm tra & trừ quantity)
    const dispensePayload = {
      prescriptionCode: selectedPrescription.prescriptionCode,
      dispensedBy: user ? (user.name || "Dược sĩ Lễ tân") : "Dược sĩ Lễ tân",
      notes: note || "Cấp theo đơn sau khám",
    };

    const res = await apiDispensePrescription(dispensePayload);

    if (!res || !res.success) {
      throw new Error(res?.message || "Cấp thuốc không thành công.");
    }

    // 2. Tự động lập hóa đơn từ phiếu cấp thuốc (Dispensing) và kiểm tra kết quả rõ ràng
    const dispensingId = res.dispensing?._id;
    let invoiceCreated = false;
    let invoiceErrorMsg = "";
    let createdInvoiceCode = "";

    if (dispensingId) {
      try {
        const invRes = await apiCreateInvoiceFromDispensing(dispensingId);
        if (invRes && invRes.success) {
          invoiceCreated = true;
          createdInvoiceCode = invRes.invoice?.invoiceCode || "";
        } else {
          invoiceErrorMsg = invRes?.message || "Máy chủ không trả về xác nhận tạo hóa đơn.";
        }
      } catch (invErr) {
        console.warn("Lỗi xuất hóa đơn tự động:", invErr);
        invoiceErrorMsg = invErr?.message || "Không thể lập hóa đơn tự động.";
      }
    } else {
      invoiceErrorMsg = "Thiếu mã phiếu cấp thuốc (dispensingId).";
    }

    if (invoiceCreated) {
      const invSuffix = createdInvoiceCode ? ` và lập hóa đơn [${createdInvoiceCode}]` : " và tự động lập hóa đơn";
      showToast(
        `Đã cấp thuốc cho đơn [${selectedPrescription.prescriptionCode}], trừ kho${invSuffix} thành công!`,
        "success"
      );
    } else {
      showToast(
        `Đã cấp thuốc & trừ kho cho đơn [${selectedPrescription.prescriptionCode}], nhưng tạo hóa đơn tự động thất bại: ${invoiceErrorMsg}`,
        "warning"
      );
    }

    closeDispenseModal();

    // Tải lại cả kho thuốc và danh sách đơn thuốc để cập nhật số lượng tồn kho giảm đúng!
    await loadMedicines();
    await loadPrescriptions();
  } catch (err) {
    console.error("Lỗi khi cấp thuốc:", err);
    const alertContainer = document.getElementById("dispenseAlertContainer");
    if (alertContainer) {
      alertContainer.style.display = "flex";
      alertContainer.innerHTML = `<span>🚫</span> <span>${escapeHTML(err.message)}</span>`;
    }
  } finally {
    btn.disabled = false;
    btn.textContent = "✓ Xác Nhận Cấp & Trừ Kho";
  }
}

// Khởi chạy khi DOM load
document.addEventListener("DOMContentLoaded", async () => {
  const page = document.getElementById("medicineDispensingPage");
  if (!page) return;

  // Tabs
  const tabPharmacy = document.getElementById("tabPharmacy");
  const tabDispensing = document.getElementById("tabDispensing");
  const btnTabPharmacy = document.getElementById("tabBtnPharmacy");
  const btnTabDispensing = document.getElementById("tabBtnDispensing");

  if (btnTabPharmacy && btnTabDispensing) {
    btnTabPharmacy.addEventListener("click", () => {
      btnTabPharmacy.classList.add("active");
      btnTabDispensing.classList.remove("active");
      tabPharmacy.style.display = "block";
      tabDispensing.style.display = "none";
    });

    btnTabDispensing.addEventListener("click", () => {
      btnTabDispensing.classList.add("active");
      btnTabPharmacy.classList.remove("active");
      tabPharmacy.style.display = "none";
      tabDispensing.style.display = "block";
      loadPrescriptions();
    });
  }

  // Tải danh mục thuốc ban đầu
  await loadMedicines();

  // Tìm kiếm thuốc (lọc trên filteredMedicines, giữ nguyên masterMedicines & KPI)
  const searchInput = document.getElementById("searchMedInput");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      currentSearchMed = e.target.value.trim();
      applyMedicineFilters();
    });
  }

  // Lọc theo trạng thái kho
  const stockFilter = document.getElementById("filterStockStatus");
  if (stockFilter) {
    stockFilter.addEventListener("change", (e) => {
      currentStockFilter = e.target.value;
      applyMedicineFilters();
    });
  }

  // Modal thuốc
  const btnOpenAdd = document.getElementById("btnOpenAddMedModal");
  const btnCloseMed = document.getElementById("btnCloseMedModal");
  const btnCancelMed = document.getElementById("btnCancelMedModal");
  const medForm = document.getElementById("medForm");

  if (btnOpenAdd) btnOpenAdd.addEventListener("click", () => openMedicineModal(null));
  if (btnCloseMed) btnCloseMed.addEventListener("click", closeMedicineModal);
  if (btnCancelMed) btnCancelMed.addEventListener("click", closeMedicineModal);
  if (medForm) medForm.addEventListener("submit", handleSaveMedicine);

  // Modal cấp thuốc
  const btnCloseDispense = document.getElementById("btnCloseDispenseModal");
  const btnCancelDispense = document.getElementById("btnCancelDispense");
  const btnExecuteDispense = document.getElementById("btnExecuteDispense");

  if (btnCloseDispense) btnCloseDispense.addEventListener("click", closeDispenseModal);
  if (btnCancelDispense) btnCancelDispense.addEventListener("click", closeDispenseModal);
  if (btnExecuteDispense) btnExecuteDispense.addEventListener("click", handleExecuteDispense);

  // Tìm kiếm đơn thuốc
  const searchPresInput = document.getElementById("searchPrescriptionInput");
  if (searchPresInput) {
    searchPresInput.addEventListener("input", (e) => {
      currentSearchPres = e.target.value.trim();
      loadPrescriptions();
    });
  }

  // Ẩn nút thêm thuốc nếu không có quyền (tái sử dụng biến btnOpenAdd ở trên)
  const currentUser = getCurrentUser();
  const canEditMeds = currentUser && [1, 2, 3].includes(Number(currentUser.role_id));
  if (btnOpenAdd && !canEditMeds) btnOpenAdd.style.display = "none";
});
