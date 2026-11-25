/* ============================================================
 medical-record.js
 Chức năng 1: Medical Record (Quản lý hồ sơ y tế / Bệnh án của thú cưng)
 Chuẩn Pawmily, kết nối MongoDB với an toàn fallback localStorage.
 ============================================================ */

import { getPetsList, fetchPetsFromDatabase } from "./pet-profile.js";
import {
 apiGetMedicalRecords,
 apiSaveMedicalRecord,
 apiDeleteMedicalRecord,
 apiSavePetHealthProfile,
} from "./api.js";
import {
 getStoredMedicalRecords,
 setStoredMedicalRecords,
 getStoredHealthProfiles,
 setStoredHealthProfiles,
 showToast,
 updateSidebarInfo,
} from "./medical-data.js";
import { escapeHTML } from "./storage.js";

export function initMedicalRecordPage() {
 const pageContainer = document.getElementById("medicalRecordPage");
 if (!pageContainer) return; // Nếu không ở trang medical-record.html thì bỏ qua

 let currentPetId = null;
 let editingRecordId = null;

 // 1. Kiểm tra tham số petId từ URL (vd: ?petId=pet_2)
 const urlParams = new URLSearchParams(window.location.search);
 const paramPetId = urlParams.get("petId");

 // 2. Cập nhật thẻ người dùng sidebar
 updateSidebarInfo();

 // 3. Khởi tạo danh sách thú cưng và chọn bé đầu tiên
 let pets = getPetsList();
 if (pets.length> 0) {
 if (paramPetId && pets.some((p) => p.id === paramPetId)) {
 currentPetId = paramPetId;
 } else {
 currentPetId = pets[0].id;
 }
 }

 // 4. Đồng bộ dữ liệu thú cưng & hồ sơ y tế từ MongoDB
 async function syncFromDatabase() {
 try {
 const dbPets = await fetchPetsFromDatabase();
 if (dbPets && dbPets.length> 0) {
 pets = dbPets;
 if (!currentPetId || !pets.some((p) => p.id === currentPetId)) {
 currentPetId = pets[0].id;
 }
 }

 const dbRecords = await apiGetMedicalRecords(currentPetId);
 if (dbRecords && Array.isArray(dbRecords) && dbRecords.length> 0) {
 // Chuẩn hóa DB records: đảm bảo có trường `id` nhất quán với recordCode
 const normalizedDbRecords = dbRecords.map((r) => ({
 ...r,
 id: r.id || r.recordCode || (r._id ? String(r._id) : ""),
 recordCode: r.recordCode || r.id || (r._id ? String(r._id) : ""),
 }));

 // Tạo Set chứa tất cả key đã biết của DB records để tra cứu nhanh
 const dbKeySet = new Set();
 normalizedDbRecords.forEach((r) => {
 if (r.id) dbKeySet.add(r.id);
 if (r.recordCode) dbKeySet.add(r.recordCode);
 if (r._id) dbKeySet.add(String(r._id));
 });

 // Lấy tất cả records local, tách theo pet hiện tại và các pet khác
 const local = getStoredMedicalRecords();
 const localOtherPets = local.filter((r) => r.petId !== currentPetId);
 const localCurrentPet = local.filter((r) => r.petId === currentPetId);

 // Merge: Lấy DB records làm gốc, chỉ thêm local records chưa có trên DB
 const mergedCurrentPet = [...normalizedDbRecords];
 localCurrentPet.forEach((loc) => {
 const locKey = loc.id || loc.recordCode || "";
 if (locKey && !dbKeySet.has(locKey)) {
 mergedCurrentPet.push(loc);
 }
 });

 // Ghép lại: records pet hiện tại (đã merge) + records các pet khác
 const merged = [...mergedCurrentPet, ...localOtherPets];
 setStoredMedicalRecords(merged);
 }

 renderAll();
 } catch (e) {
 console.warn("[MedicalRecord] Offline fallback:", e);
 }
 }

 function renderAll() {
 renderPetSwitcher();
 renderHealthIdentityCard();
 renderStatsBanner();
 renderMedicalRecords();
 }

 /* ===== PET SWITCHER STRIP ===== */
 function renderPetSwitcher() {
 const container = document.getElementById("petSwitchList");
 if (!container) return;

 if (pets.length === 0) {
 container.innerHTML = `<p style="font-size:13px; color:var(--ink-faint);">Chưa có thú cưng nào. Vui lòng thêm thú cưng tại Hồ sơ thú cưng.</p>`;
 return;
 }

 container.innerHTML = pets
 .map((p) => {
 const isActive = p.id === currentPetId;
 const speciesIcon = p.species === "Mèo" ? "🐱" : "🐶";
 const avatarSrc = p.avatar || (p.species === "Mèo" ? "../assets/img/frenchie.jpg" : "../assets/img/golden.jpg");

 return `
 <button type="button" class="pet-switch-btn ${isActive ? "active" : ""}" data-pet-id="${p.id}">
 <img class="pet-switch-avatar" src="${escapeHTML(avatarSrc)}" alt="${escapeHTML(p.name)}" />
 <div class="pet-switch-info">
 <span class="pet-switch-name">${escapeHTML(p.name)}</span>
 <span class="pet-switch-meta">${speciesIcon} ${escapeHTML(p.breed || p.species)} • ${escapeHTML(p.age || "1 tuổi")}</span>
 </div>
 </button>
 `;
 })
 .join("");

 container.querySelectorAll(".pet-switch-btn").forEach((btn) => {
 btn.addEventListener("click", () => {
 currentPetId = btn.dataset.petId;
 renderAll();
 });
 });
 }

 /* ===== PET HEALTH IDENTITY CARD ===== */
 function renderHealthIdentityCard() {
 const cardEl = document.getElementById("petHealthIdCard");
 if (!cardEl) return;

 const pet = pets.find((p) => p.id === currentPetId);
 if (!pet) {
 cardEl.hidden = true;
 return;
 }
 cardEl.hidden = false;

 const profiles = getStoredHealthProfiles();
 const health = profiles[pet.id] || {
 bloodType: pet.species === "Mèo" ? "Nhóm A (Mèo)" : "DEA 1.1 (+)",
 microchip: "Đang cập nhật",
 allergies: "Chưa ghi nhận dị ứng",
 chronicConditions: "Không có",
 sterilized: pet.sterilized || "Đã triệt sản",
 vaccinationStatus: pet.vaccinated || "Đã tiêm phòng đủ",
 dewormingStatus: "Đã tẩy giun định kỳ",
 overallStatus: "Khỏe mạnh",
 };

 const avatarSrc = pet.avatar || (pet.species === "Mèo" ? "../assets/img/frenchie.jpg" : "../assets/img/golden.jpg");
 const speciesIcon = pet.species === "Mèo" ? "🐱" : "🐶";

 cardEl.innerHTML = `
 <div class="health-id-top">
 <div class="health-id-pet">
 <img class="health-id-avatar" src="${escapeHTML(avatarSrc)}" alt="${escapeHTML(pet.name)}" />
 <div class="health-id-names">
 <h2>
 <span>${escapeHTML(pet.name)}</span>
 <span class="health-id-badge">✓ ${escapeHTML(health.overallStatus)}</span>
 </h2>
 <p>${speciesIcon} ${escapeHTML(pet.species)} • ${escapeHTML(pet.breed || "Chưa rõ giống")} • ${escapeHTML(pet.age || "Chưa rõ tuổi")} • Giới tính: ${escapeHTML(pet.gender || "Đực")}</p>
 </div>
 </div>
 <div class="health-id-actions">
 <button type="button" class="btn-cta" id="btnQuickAddRecord">
 <span>➕</span>
 <span>Thêm Bệnh Án Mới</span>
 </button>
 <button type="button" class="btn-cta btn-cta-outline" id="btnEditHealthProfile">
 <span>⚙️</span>
 <span>Cập nhật chỉ số y tế</span>
 </button>
 </div>
 </div>

 <div class="health-metrics-grid">
 <div class="health-metric-box">
 <span class="metric-label">Cân nặng</span>
 <span class="metric-value highlight-amber">${escapeHTML(pet.weight || "19.5")} kg</span>
 </div>
 <div class="health-metric-box">
 <span class="metric-label">Nhóm máu</span>
 <span class="metric-value">${escapeHTML(health.bloodType)}</span>
 </div>
 <div class="health-metric-box">
 <span class="metric-label">Mã Microchip</span>
 <span class="metric-value" style="font-size:12px;">${escapeHTML(health.microchip)}</span>
 </div>
 <div class="health-metric-box">
 <span class="metric-label">Tiền sử Dị ứng</span>
 <span class="metric-value" style="font-size:12px; color:#C95A34;" title="${escapeHTML(health.allergies)}">${escapeHTML(health.allergies.length> 25 ? health.allergies.slice(0, 25) + "..." : health.allergies)}</span>
 </div>
 <div class="health-metric-box">
 <span class="metric-label">Tiêm chủng</span>
 <span class="metric-value highlight-green" style="font-size:12px;">${escapeHTML(health.vaccinationStatus)}</span>
 </div>
 <div class="health-metric-box">
 <span class="metric-label">Tẩy giun / Ve</span>
 <span class="metric-value highlight-green" style="font-size:12px;">${escapeHTML(health.dewormingStatus)}</span>
 </div>
 </div>
 `;

 document.getElementById("btnQuickAddRecord")?.addEventListener("click", () => {
 openRecordModal();
 });

 document.getElementById("btnEditHealthProfile")?.addEventListener("click", () => {
 openHealthProfileModal();
 });
 }

 /* ===== STATS BANNER ===== */
 function renderStatsBanner() {
 const allRecords = getStoredMedicalRecords().filter((r) => r.petId === currentPetId);
 const countTotal = document.getElementById("statCountTotal");
 const countTreating = document.getElementById("statCountTreating");
 const countCompleted = document.getElementById("statCountCompleted");
 const nextFollowup = document.getElementById("statNextFollowup");

 if (countTotal) countTotal.textContent = allRecords.length;
 if (countTreating) countTreating.textContent = allRecords.filter((r) => r.status === "Đang điều trị").length;
 if (countCompleted) countCompleted.textContent = allRecords.filter((r) => r.status === "Đã hoàn thành").length;

 const followups = allRecords.filter((r) => r.nextAppointment);
 if (nextFollowup) {
 if (followups.length> 0) {
 nextFollowup.textContent = followups[0].nextAppointment;
 } else {
 nextFollowup.textContent = "Chưa có";
 }
 }
 }

 /* ===== DANH SÁCH BỆNH ÁN ===== */
 function renderMedicalRecords() {
 const container = document.getElementById("medicalRecordsContainer");
 if (!container) return;

 const searchInput = document.getElementById("medicalSearchInput");
 const categorySelect = document.getElementById("medicalCategoryFilter");
 const statusSelect = document.getElementById("medicalStatusFilter");

 const keyword = (searchInput?.value || "").toLowerCase().trim();
 const category = categorySelect?.value || "all";
 const status = statusSelect?.value || "all";

 const allRecords = getStoredMedicalRecords().filter((r) => r.petId === currentPetId);

 const filtered = allRecords.filter((r) => {
 const matchKey =
 !keyword ||
 (r.title && r.title.toLowerCase().includes(keyword)) ||
 (r.reason && r.reason.toLowerCase().includes(keyword)) ||
 (r.veterinarian && r.veterinarian.toLowerCase().includes(keyword)) ||
 (r.id && r.id.toLowerCase().includes(keyword));

 const matchCat = category === "all" || r.category === category;
 const matchStat = status === "all" || r.status === status;

 return matchKey && matchCat && matchStat;
 });

 if (filtered.length === 0) {
 container.innerHTML = `
 <div style="text-align:center; padding: 48px 20px; background:var(--surface); border:1.5px dashed var(--line); border-radius:var(--radius-card);">
 <div style="font-size:48px; margin-bottom:12px;">🩺</div>
 <h3 style="font-family:var(--font-display); color:var(--brown); font-size:20px; margin-bottom:8px;">Chưa có bệnh án phù hợp</h3>
 <p style="font-size:14px; color:var(--ink-faint); margin-bottom:18px;">Không tìm thấy đợt khám bệnh nào theo bộ lọc hoặc bé cưng chưa có bệnh án.</p>
 <button type="button" class="btn-cta" id="btnEmptyAddRecord">
 <span>➕</span>
 <span>Tạo bệnh án đầu tiên</span>
 </button>
 </div>
 `;
 document.getElementById("btnEmptyAddRecord")?.addEventListener("click", () => {
 openRecordModal();
 });
 return;
 }

 container.innerHTML = filtered
 .map((r) => {
 let statusClass = "status-completed";
 if (r.status === "Đang điều trị") statusClass = "status-treating";
 if (r.status === "Cần tái khám") statusClass = "status-followup";

 const symptomsHtml = (r.symptoms || [])
 .map((s) => `<span class="symptom-tag">• ${escapeHTML(s)}</span>`)
 .join("");

 const rxCount = (r.prescription || []).length;
 const rxSummary = rxCount> 0 ? `Đơn thuốc: ${rxCount} loại thuốc kê toa` : "Không kê đơn thuốc";

 return `
 <article class="medical-record-card" data-record-id="${r.id}">
 <div class="med-card-header">
 <div class="med-card-id-wrap">
 <span class="med-code-badge">${escapeHTML(r.id)}</span>
 <span class="med-category-tag">${escapeHTML(r.category || "Tổng quát")}</span>
 <span class="med-card-date">📅 Ngày khám: ${escapeHTML(r.date)}</span>
 </div>
 <span class="med-status-pill ${statusClass}">● ${escapeHTML(r.status)}</span>
 </div>

 <div class="med-card-body">
 <div class="med-card-main">
 <h3>
 <span>${escapeHTML(r.title || "Khám sức khỏe")}</span>
 </h3>
 <p class="med-card-reason"><strong>Lý do khám:</strong> ${escapeHTML(r.reason || "Kiểm tra định kỳ")}</p>
 
 <div class="med-symptoms-tags">
 ${symptomsHtml}
 </div>

 <div style="background:var(--cream-soft); padding:10px 14px; border-radius:10px; font-size:13px; line-height:1.45; color:var(--brown);">
 <strong style="color:var(--accent-dark);">Chẩn đoán xác định:</strong> ${escapeHTML(r.confirmedDiagnosis || r.preliminaryDiagnosis || "Đang theo dõi lâm sàng")}
 </div>
 </div>

 <div class="med-card-side">
 <div class="med-doctor-row">
 <div class="med-doctor-icon">👨‍⚕️</div>
 <div class="med-doctor-text">
 <strong>${escapeHTML(r.veterinarian || "Bác sĩ PawnCare")}</strong>
 <span>${escapeHTML(r.clinicBranch || "Cơ sở Đà Nẵng")}</span>
 </div>
 </div>

 <div class="med-card-prescription-summary">
 💊 ${escapeHTML(rxSummary)}
 </div>

 ${
 r.nextAppointment
 ? `<div class="med-next-visit-row">
 <span>🔔 Hẹn tái khám:</span>
 <strong>${escapeHTML(r.nextAppointment)}</strong>
 </div>`
 : `<div style="font-size:12px; color:var(--ink-faint);">✓ Không yêu cầu tái khám</div>`
 }
 </div>
 </div>

 <div class="med-card-footer">
 <div class="med-card-cost">
 Chi phí đợt khám: <strong>${escapeHTML(r.totalCost || "0đ")}</strong>
 </div>
 <div class="med-card-btn-group">
 <a href="./diagnosis.html?petId=${r.petId}&recordId=${r.id}" class="btn-med-action btn-med-diagnosis">
 <span>🔬</span>
 <span>Xem chi tiết chẩn đoán</span>
 </a>
 <button type="button" class="btn-med-action btn-med-print" data-action="print" data-id="${r.id}">
 <span>🖨️</span>
 <span>In phiếu khám</span>
 </button>
 <button type="button" class="btn-med-action btn-med-edit" data-action="edit" data-id="${r.id}">
 <span>✏️</span>
 </button>
 <button type="button" class="btn-med-action btn-med-delete" data-action="delete" data-id="${r.id}" title="Xóa bệnh án">
 <span>🗑️</span>
 </button>
 </div>
 </div>
 </article>
 `;
 })
 .join("");

 container.querySelectorAll('[data-action="print"]').forEach((btn) => {
 btn.addEventListener("click", () => {
 openPrintModal(btn.dataset.id);
 });
 });

 container.querySelectorAll('[data-action="edit"]').forEach((btn) => {
 btn.addEventListener("click", () => {
 openRecordModal(btn.dataset.id);
 });
 });

 container.querySelectorAll('[data-action="delete"]').forEach((btn) => {
 btn.addEventListener("click", () => {
 confirmDeleteRecord(btn.dataset.id);
 });
 });
 }

 // Filter listeners
 document.getElementById("medicalSearchInput")?.addEventListener("input", renderMedicalRecords);
 document.getElementById("medicalCategoryFilter")?.addEventListener("change", renderMedicalRecords);
 document.getElementById("medicalStatusFilter")?.addEventListener("change", renderMedicalRecords);

 /* ===== MODAL 1: THÊM / SỬA BỆNH ÁN ===== */
 const recordModal = document.getElementById("medicalRecordModal");
 const recordForm = document.getElementById("medicalRecordForm");
 const modalRecordTitle = document.getElementById("modalRecordTitle");

 // Hiển thị lịch sử các đợt khám & bệnh án trước đây của pet trong modal
 function renderModalPetHistory(selectedPetId, excludeRecordId = null) {
 const petNameEl = document.getElementById("modalHistoryPetName");
 const countBadgeEl = document.getElementById("modalHistoryCountBadge");
 const metricsEl = document.getElementById("modalHistoryPetMetrics");
 const recordsListEl = document.getElementById("modalHistoryRecordsList");

 if (!recordsListEl) return;

 const pet = pets.find((p) => p.id === selectedPetId) || { name: "Bé cưng", species: "Thú cưng" };
 if (petNameEl) petNameEl.textContent = pet.name || "bé cưng";

 // 1. Chỉ số sức khỏe nền
 if (metricsEl) {
 const profiles = getStoredHealthProfiles();
 const h = profiles[selectedPetId] || {};
 metricsEl.innerHTML = `
 <span class="modal-hist-metric-tag">🩸 Nhóm máu: <strong>${escapeHTML(h.bloodType || (pet.species === "Mèo" ? "Nhóm A" : "DEA 1.1 (+)"))}</strong></span>
 <span class="modal-hist-metric-tag" style="color:#C95A34;">⚠️ Dị ứng: <strong>${escapeHTML(h.allergies || "Chưa ghi nhận dị ứng")}</strong></span>
 <span class="modal-hist-metric-tag">💉 Tiêm phòng: <strong>${escapeHTML(h.vaccinationStatus || "Đã tiêm phòng đủ")}</strong></span>
 <span class="modal-hist-metric-tag">🩺 Tình trạng: <strong>${escapeHTML(h.overallStatus || "Khỏe mạnh")}</strong></span>
 `;
 }

 // 2. Lịch sử các đợt khám trước
 const allRecords = getStoredMedicalRecords();
 const prevRecords = allRecords
 .filter((r) => r.petId === selectedPetId && (!excludeRecordId || r.id !== excludeRecordId))
 .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

 if (countBadgeEl) {
 countBadgeEl.textContent = `${prevRecords.length} đợt khám`;
 }

 if (prevRecords.length === 0) {
 recordsListEl.innerHTML = `
 <div class="modal-hist-empty">
 <div style="font-size:24px; margin-bottom:6px;">🌱</div>
 <strong>Chưa có tiền sử bệnh án trước đây</strong>
 <p style="margin:4px 0 0; font-size:12px; color:var(--ink-faint);">Đây là đợt khám đầu tiên được ghi nhận của ${escapeHTML(pet.name)}.</p>
 </div>
 `;
 return;
 }

 recordsListEl.innerHTML = prevRecords
 .map((r) => {
 let statusStyle = "background:#E8F5E9; color:#2E5C38;";
 if (r.status === "Đang điều trị") statusStyle = "background:#FFF3E0; color:#E65100;";
 else if (r.status === "Cần tái khám") statusStyle = "background:var(--cream-latte); color:var(--espresso); border:1px solid var(--accent-border);";

 const rxCount = (r.prescription || []).length;
 const rxText = rxCount> 0 ? `${rxCount} loại thuốc kê toa` : "Không kê đơn thuốc";
 const symptomsText = Array.isArray(r.symptoms) ? r.symptoms.join(", ") : (r.symptoms || "Bình thường");

 return `
 <div class="modal-hist-item">
 <div class="modal-hist-item-header">
 <div class="modal-hist-item-meta">
 <span class="modal-hist-code">${escapeHTML(r.id || r.recordCode)}</span>
 <span class="modal-hist-date">📅 ${escapeHTML(r.date)}</span>
 <span class="modal-hist-category">${escapeHTML(r.category || "Tổng quát")}</span>
 </div>
 <span class="med-status-pill" style="font-size:11px; padding:3px 10px; ${statusStyle}">● ${escapeHTML(r.status)}</span>
 </div>

 <div class="modal-hist-item-title">${escapeHTML(r.title || "Khám sức khỏe")}</div>
 <div class="modal-hist-item-diag">
 <strong>Chẩn đoán:</strong> ${escapeHTML(r.confirmedDiagnosis || r.preliminaryDiagnosis || "Khỏe mạnh")}
 </div>

 <div class="modal-hist-item-details">
 <div>👨‍⚕️ <strong>Bác sĩ:</strong> ${escapeHTML(r.veterinarian || "PawnCare Vet")}</div>
 <div>🌡️ <strong>Thể trạng:</strong> ${r.vitalSigns?.temperature || "--"}°C • ${r.vitalSigns?.weight || "--"} kg</div>
 <div style="grid-column: span 2;">🔬 <strong>Triệu chứng:</strong> ${escapeHTML(symptomsText)}</div>
 <div style="grid-column: span 2;">💊 <strong>Đơn thuốc:</strong> ${escapeHTML(rxText)}</div>
 </div>

 <div class="modal-hist-item-footer">
 <span>Chi phí: <strong style="color:#2E5C38;">${escapeHTML(r.totalCost || "0đ")}</strong></span>
 <a href="./diagnosis.html?petId=${r.petId}&recordId=${r.id || r.recordCode}" target="_blank" style="color:var(--brown); text-decoration:underline; font-weight:600;">
 🔬 Xem chi tiết chẩn đoán →
 </a>
 </div>
 </div>
 `;
 })
 .join("");
 }

 // Toggle thu gọn/mở rộng lịch sử trong modal
 const historyToggleBtn = document.getElementById("modalHistoryToggleBtn");
 const historyBox = document.getElementById("modalPetHistoryBox");
 if (historyToggleBtn && historyBox) {
 const toggleHistory = () => {
 historyBox.classList.toggle("collapsed");
 };
 historyToggleBtn.addEventListener("click", toggleHistory);
 historyToggleBtn.addEventListener("keydown", (e) => {
 if (e.key === "Enter" || e.key === " ") {
 e.preventDefault();
 toggleHistory();
 }
 });
 }

 // Khi thay đổi thú cưng trong select của modal, cập nhật ngay lịch sử tương ứng
 recordForm?.elements?.modalPetSelect?.addEventListener("change", (e) => {
 renderModalPetHistory(e.target.value, editingRecordId);
 });

 function openRecordModal(recordId = null) {
 editingRecordId = recordId;
 if (!recordModal || !recordForm) return;

 recordForm.reset();

 let targetPetId = currentPetId;
 if (recordId) {
 const records = getStoredMedicalRecords();
 const target = records.find((r) => (r.id || r.recordCode) === recordId);
 if (target?.petId) targetPetId = target.petId;
 }

 const petSelect = recordForm.elements.modalPetSelect;
 if (petSelect) {
 petSelect.innerHTML = pets
 .map((p) => `<option value="${p.id}" ${p.id === targetPetId ? "selected" : ""}>${escapeHTML(p.name)} (${escapeHTML(p.species)})</option>`)
 .join("");
 }

 // Hiển thị lịch sử các đợt khám của bé cưng
 renderModalPetHistory(targetPetId, recordId);

 if (recordId) {
 if (modalRecordTitle) {
 modalRecordTitle.innerHTML = `<span>✏️</span> <span>Chỉnh Sửa Hồ Sơ Bệnh Án</span>`;
 }
 const records = getStoredMedicalRecords();
 const target = records.find((r) => (r.id || r.recordCode) === recordId);
 if (target) {
 if (recordForm.elements.modalRecordId) recordForm.elements.modalRecordId.value = target.id || target.recordCode;
 if (recordForm.elements.modalDate) recordForm.elements.modalDate.value = target.date || "";
 if (recordForm.elements.modalCategory) recordForm.elements.modalCategory.value = target.category || "Khám tổng quát";
 if (recordForm.elements.modalStatus) recordForm.elements.modalStatus.value = target.status || "Đang điều trị";
 if (recordForm.elements.modalDoctor) recordForm.elements.modalDoctor.value = target.veterinarian || "";
 if (recordForm.elements.modalTitle) recordForm.elements.modalTitle.value = target.title || "";
 if (recordForm.elements.modalReason) recordForm.elements.modalReason.value = target.reason || "";
 if (recordForm.elements.modalSymptoms) recordForm.elements.modalSymptoms.value = (target.symptoms || []).join(", ");
 if (recordForm.elements.modalConfirmedDiag) recordForm.elements.modalConfirmedDiag.value = target.confirmedDiagnosis || "";
 if (recordForm.elements.modalTemp) recordForm.elements.modalTemp.value = target.vitalSigns?.temperature || "38.5";
 if (recordForm.elements.modalWeight) recordForm.elements.modalWeight.value = target.vitalSigns?.weight || "5.0";
 if (recordForm.elements.modalAdvice) recordForm.elements.modalAdvice.value = target.doctorAdvice || "";
 if (recordForm.elements.modalNextAppointment) recordForm.elements.modalNextAppointment.value = target.nextAppointment || "";
 if (recordForm.elements.modalCost) recordForm.elements.modalCost.value = target.totalCost || "250.000đ";
 }
 } else {
 if (modalRecordTitle) {
 modalRecordTitle.innerHTML = `<span>📋</span> <span>Thêm Đợt Khám &amp; Bệnh Án Mới</span>`;
 }
 const now = new Date();
 const todayStr = `${String(now.getDate()).padStart(2, "0")}/${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}`;
 if (recordForm.elements.modalRecordId) recordForm.elements.modalRecordId.value = "MED-" + now.getFullYear() + "-" + Math.floor(100 + Math.random() * 900);
 if (recordForm.elements.modalDate) recordForm.elements.modalDate.value = todayStr;
 if (recordForm.elements.modalDoctor) recordForm.elements.modalDoctor.value = "BS. CKI. Nguyễn Văn Hùng";
 if (recordForm.elements.modalTemp) recordForm.elements.modalTemp.value = "38.5";
 if (recordForm.elements.modalWeight) {
 const p = pets.find((pt) => pt.id === targetPetId);
 recordForm.elements.modalWeight.value = p?.weight || "5.0";
 }
 }

 recordModal.hidden = false;
 }

 function closeRecordModal() {
 if (recordModal) recordModal.hidden = true;
 editingRecordId = null;
 }

 document.getElementById("btnRecordModalClose")?.addEventListener("click", closeRecordModal);
 document.getElementById("btnCancelRecordModal")?.addEventListener("click", closeRecordModal);

 if (recordForm) {
 recordForm.addEventListener("submit", async (e) => {
 e.preventDefault();

 const pId = recordForm.elements.modalPetSelect.value;
 const pet = pets.find((p) => p.id === pId) || {};
 const recordId = recordForm.elements.modalRecordId.value;

 const symptomsStr = (recordForm.elements.modalSymptoms.value || "").trim();
 const symptoms = symptomsStr ? symptomsStr.split(",").map((s) => s.trim()).filter(Boolean) : ["Sức khỏe bình thường"];

 const records = getStoredMedicalRecords();
 const matchId = editingRecordId || recordId;
 const idx = records.findIndex((r) => (r.id || r.recordCode) === matchId);
 const existingRecord = editingRecordId && idx >= 0 ? records[idx] : null;

 const defaultVitalSigns = {
 heartRate: "110",
 respiratoryRate: "24",
 mucousMembranes: "Hồng hào",
 hydration: "Bình thường",
 };
 const existingVitalSigns = existingRecord?.vitalSigns || {};
 const preservedPrescription = existingRecord
 ? Array.isArray(existingRecord.prescription)
 ? existingRecord.prescription
 : []
 : [
 {
 name: "Thuốc bổ & Kháng viêm dịu nhẹ",
 active: "Vitamin tổng hợp",
 dosage: "1 viên/ngày",
 duration: "5 ngày",
 notes: "Uống sau ăn",
 },
 ];

 const recordData = {
 ...(existingRecord || {}),
 id: recordId,
 recordCode: recordId,
 petId: pId,
 petName: pet.name || existingRecord?.petName || "Bé cưng",
 petSpecies: pet.species || existingRecord?.petSpecies || "Chó",
 petBreed: pet.breed || existingRecord?.petBreed || "Chưa rõ",
 date: recordForm.elements.modalDate.value || "Hôm nay",
 category: recordForm.elements.modalCategory.value || "Khám tổng quát",
 status: recordForm.elements.modalStatus.value || "Đã hoàn thành",
 veterinarian: recordForm.elements.modalDoctor.value || "Bác sĩ PawnCare",
 clinicBranch: existingRecord?.clinicBranch || "PawnCare 123 Nguyễn Văn Linh, Hải Châu, Đà Nẵng",
 title: recordForm.elements.modalTitle.value || "Khám sức khỏe",
 reason: recordForm.elements.modalReason.value || "Kiểm tra định kỳ",
 symptoms: symptoms,
 preliminaryDiagnosis: existingRecord?.preliminaryDiagnosis || "Chẩn đoán lâm sàng",
 confirmedDiagnosis: recordForm.elements.modalConfirmedDiag.value || "Khỏe mạnh",
 vitalSigns: {
 ...defaultVitalSigns,
 ...existingVitalSigns,
 temperature: recordForm.elements.modalTemp.value || existingVitalSigns.temperature || "38.5",
 weight: recordForm.elements.modalWeight.value || existingVitalSigns.weight || "5.0",
 },
 prescription: preservedPrescription,
 doctorAdvice: recordForm.elements.modalAdvice.value || "Chăm sóc bé cưng và giữ ấm.",
 nextAppointment: recordForm.elements.modalNextAppointment.value || "",
 totalCost: recordForm.elements.modalCost.value || "250.000đ",
 createdAt: existingRecord?.createdAt || Date.now(),
 isEditing: Boolean(editingRecordId),
 };

 if (idx >= 0) {
 records[idx] = { ...records[idx], ...recordData };
 } else {
 records.unshift(recordData);
 }
 setStoredMedicalRecords(records);

 try {
 await apiSaveMedicalRecord(recordData);
 } catch (err) {}

 const wasEditing = !!editingRecordId;
 closeRecordModal();
 currentPetId = pId;
 renderAll();
 showToast(wasEditing ? "Cập nhật bệnh án thành công!" : "Đã tạo đợt khám & bệnh án mới thành công!");
 });
 }

 async function confirmDeleteRecord(recordId) {
 if (confirm("Bạn có chắc chắn muốn xóa hồ sơ bệnh án này không? Thao tác không thể hoàn tác.")) {
 let records = getStoredMedicalRecords();
 records = records.filter((r) => (r.id || r.recordCode) !== recordId);
 setStoredMedicalRecords(records);

 try {
 await apiDeleteMedicalRecord(recordId);
 } catch (e) {
 console.warn("[MedicalRecord] Lỗi khi xóa bệnh án trên server:", e);
 }

 renderAll();
 showToast("Đã xóa hồ sơ bệnh án.", "info");
 }
 }

 /* ===== MODAL 2: CẬP NHẬT CHỈ SỐ Y TẾ NỀN ===== */
 const healthModal = document.getElementById("healthProfileModal");
 const healthForm = document.getElementById("healthProfileForm");

 function openHealthProfileModal() {
 if (!healthModal || !healthForm) return;

 const pet = pets.find((p) => p.id === currentPetId);
 const profiles = getStoredHealthProfiles();
 const h = (pet && profiles[pet.id]) || {};

 if (healthForm.elements.profileBloodType) healthForm.elements.profileBloodType.value = h.bloodType || "DEA 1.1 (+)";
 if (healthForm.elements.profileMicrochip) healthForm.elements.profileMicrochip.value = h.microchip || "";
 if (healthForm.elements.profileAllergies) healthForm.elements.profileAllergies.value = h.allergies || "";
 if (healthForm.elements.profileChronic) healthForm.elements.profileChronic.value = h.chronicConditions || "Không có";
 if (healthForm.elements.profileVaccine) healthForm.elements.profileVaccine.value = h.vaccinationStatus || "Đã tiêm phòng đủ";
 if (healthForm.elements.profileDeworm) healthForm.elements.profileDeworm.value = h.dewormingStatus || "Đã tẩy giun định kỳ";
 if (healthForm.elements.profileStatus) healthForm.elements.profileStatus.value = h.overallStatus || "Khỏe mạnh";

 healthModal.hidden = false;
 }

 function closeHealthProfileModal() {
 if (healthModal) healthModal.hidden = true;
 }

 document.getElementById("btnHealthModalClose")?.addEventListener("click", closeHealthProfileModal);
 document.getElementById("btnCancelHealthModal")?.addEventListener("click", closeHealthProfileModal);

 if (healthForm) {
 healthForm.addEventListener("submit", async (e) => {
 e.preventDefault();

 const pet = pets.find((p) => p.id === currentPetId);
 if (!pet) return;

 const profileData = {
 bloodType: healthForm.elements.profileBloodType.value || "DEA 1.1 (+)",
 microchip: healthForm.elements.profileMicrochip.value || "Chưa có",
 allergies: healthForm.elements.profileAllergies.value || "Không ghi nhận",
 chronicConditions: healthForm.elements.profileChronic.value || "Không có",
 vaccinationStatus: healthForm.elements.profileVaccine.value || "Đã tiêm phòng đủ",
 dewormingStatus: healthForm.elements.profileDeworm.value || "Đã tẩy giun",
 overallStatus: healthForm.elements.profileStatus.value || "Khỏe mạnh",
 };

 const profiles = getStoredHealthProfiles();
 profiles[pet.id] = profileData;
 setStoredHealthProfiles(profiles);

 try {
 await apiSavePetHealthProfile(pet.id, profileData);
 } catch (err) {}

 closeHealthProfileModal();
 renderHealthIdentityCard();
 showToast("Cập nhật chỉ số y tế nền của bé cưng thành công!");
 });
 }

 /* ===== MODAL 3: IN PHIẾU KHÁM ===== */
 const printModal = document.getElementById("printRecordModal");
 const printSheetContent = document.getElementById("printSheetContent");

 function openPrintModal(recordId) {
 if (!printModal || !printSheetContent) return;

 const records = getStoredMedicalRecords();
 const target = records.find((r) => r.id === recordId);
 if (!target) return;

 const pet = pets.find((p) => p.id === target.petId) || { name: target.petName, species: target.petSpecies };
 const rxHtml = (target.prescription || [])
 .map((rx, idx) => `<tr><td>${idx + 1}. ${escapeHTML(rx.name)}</td><td>${escapeHTML(rx.dosage)}</td><td>${escapeHTML(rx.duration)}</td><td>${escapeHTML(rx.notes || "")}</td></tr>`)
 .join("");

 printSheetContent.innerHTML = `
 <div class="print-cert-sheet">
 <div class="print-cert-head">
 <h1>HỆ THỐNG PHÒNG KHÁM THÚ Y PAWNCARE ĐÀ NẴNG</h1>
 <p>123 Nguyễn Văn Linh, P. Hải Châu, TP. Đà Nẵng • Hotline: 0900 123 456 • Website: pawncare.vn</p>
 <h2 style="font-size:18px; color:#4E2A14; margin-top:12px;">PHIẾU KHÁM BỆNH &amp; KẾT QUẢ CHẨN ĐOÁN Y KHOA</h2>
 </div>

 <div class="print-cert-meta">
 <div>
 <p><strong>Mã Bệnh Án:</strong> ${escapeHTML(target.id)}</p>
 <p><strong>Ngày khám:</strong> ${escapeHTML(target.date)}</p>
 <p><strong>Chủ nuôi:</strong> ${escapeHTML(pets[0]?.ownerName || "Khách hàng")}</p>
 </div>
 <div>
 <p><strong>Tên thú cưng:</strong> ${escapeHTML(pet.name)}</p>
 <p><strong>Loài &amp; Giống:</strong> ${escapeHTML(pet.species)} (${escapeHTML(pet.breed || "Thuần chủng")})</p>
 <p><strong>Cân nặng:</strong> ${escapeHTML(target.vitalSigns?.weight || "--")} kg • <strong>Thân nhiệt:</strong> ${escapeHTML(target.vitalSigns?.temperature || "--")}°C</p>
 <p><strong>Bác sĩ phụ trách:</strong> ${escapeHTML(target.veterinarian)}</p>
 </div>
 </div>

 <div style="margin-bottom:16px;">
 <p><strong>1. Lý do thăm khám:</strong> ${escapeHTML(target.reason)}</p>
 <p><strong>2. Triệu chứng lâm sàng:</strong> ${(target.symptoms || []).map(escapeHTML).join(", ")}</p>
 <p style="margin-top:6px;"><strong>3. Chẩn đoán xác định:</strong> <span style="font-weight:700; color:#4E2A14;">${escapeHTML(target.confirmedDiagnosis || target.title)}</span></p>
 </div>

 <div style="margin-bottom:16px;">
 <p><strong>4. Đơn thuốc kê toa:</strong></p>
 <table style="width:100%; border-collapse:collapse; font-size:12px; margin-top:6px;" border="1" cellpadding="6">
 <thead>
 <tr style="background:#f2f2f2;">
 <th>Tên thuốc</th><th>Liều dùng</th><th>Thời gian</th><th>Hướng dẫn</th>
 </tr>
 </thead>
 <tbody>
 ${rxHtml || '<tr><td colspan="4">Không có thuốc</td></tr>'}
 </tbody>
 </table>
 </div>

 <div style="margin-bottom:24px;">
 <p><strong>5. Lời dặn theo dõi:</strong> ${escapeHTML(target.doctorAdvice || "Chăm sóc theo hướng dẫn.")}</p>
 ${target.nextAppointment ? `<p><strong>6. Lịch hẹn tái khám:</strong> Ngày ${escapeHTML(target.nextAppointment)}</p>` : ""}
 </div>

 <div style="display:flex; justify-content:space-between; margin-top:32px; text-align:center;">
 <div>
 <p style="font-weight:700;">Chủ thú cưng xác nhận</p>
 <p style="font-size:11px; color:#888;">(Ký và ghi rõ họ tên)</p>
 </div>
 <div>
 <p style="font-weight:700;">Bác sĩ khám bệnh</p>
 <p style="font-size:11px; color:#888;">(Ký, đóng dấu)</p>
 <p style="margin-top:36px; font-weight:700;">${escapeHTML(target.veterinarian)}</p>
 </div>
 </div>
 </div>
 `;

 printModal.hidden = false;
 }

 document.getElementById("btnPrintModalClose")?.addEventListener("click", () => {
 if (printModal) printModal.hidden = true;
 });

 document.getElementById("btnTriggerPrint")?.addEventListener("click", () => {
 window.print();
 });

 // Khởi động
 renderAll();
 syncFromDatabase();
}
