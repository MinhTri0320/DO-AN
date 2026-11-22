/* ============================================================
 pet-medical-history.js
 Controller riêng cho tính năng: Pet Medical History (Lịch sử bệnh thú cưng)
 Chuẩn bảng màu Pawmily.vn, tích hợp đồng bộ dữ liệu với Medical Record
 ============================================================ */

import { escapeHTML } from "./storage.js";
import { getPetsList, fetchPetsFromDatabase } from "./pet-profile.js";
import { getStoredMedicalRecords, setStoredMedicalRecords, updateSidebarInfo } from "./medical-data.js";
import { apiGetMedicalRecords } from "./api.js";

export function initPetMedicalHistoryPage() {
 const pageContainer = document.getElementById("petMedicalHistoryPage");
 if (!pageContainer) return;

 console.log("[PetMedicalHistory] Khởi chạy trang Lịch Sử Bệnh Thú Cưng...");

 // Cập nhật thông tin sidebar người dùng
 updateSidebarInfo();

 // Xác định bé cưng đang được chọn từ URL param ?petId=...
 const urlParams = new URLSearchParams(window.location.search);
 let currentPetId = urlParams.get("petId") || null;

 const petSwitchList = document.getElementById("petSwitchList");
 const historySummaryRibbon = document.getElementById("historySummaryRibbon");
 const medicalTimelineContainer = document.getElementById("medicalTimelineContainer");
 const weightTimelineBars = document.getElementById("weightTimelineBars");

 /**
 * Render danh sách nút chuyển thú cưng (Pet Switcher)
 */
 function renderPetSwitcher(pets) {
 if (!petSwitchList) return;
 if (!pets || pets.length === 0) {
 petSwitchList.innerHTML = `<span style="font-size:13px; color:var(--ink-faint); padding:6px 0;">Chưa có hồ sơ thú cưng nào.</span>`;
 return;
 }

 // Nếu currentPetId chưa hợp lệ thì mặc định lấy pet đầu tiên
 if (!currentPetId || !pets.some((p) => p.id === currentPetId)) {
 currentPetId = pets[0].id;
 }

 petSwitchList.innerHTML = pets
 .map((p) => {
 const isActive = p.id === currentPetId;
 const avatarSrc = p.avatar || (p.species === "Mèo" ? "../assets/img/frenchie.jpg" : "../assets/img/golden.jpg");
 return `
 <button type="button" class="pet-switch-btn ${isActive ? "active" : ""}" data-pet-id="${p.id}">
 <img class="pet-switch-avatar" src="${escapeHTML(avatarSrc)}" alt="${escapeHTML(p.name)}" />
 <div class="pet-switch-info">
 <span class="pet-switch-name">${escapeHTML(p.name)}</span>
 <span class="pet-switch-meta">${escapeHTML(p.species || "Thú cưng")} • ${escapeHTML(p.breed || "Giống thuần")}</span>
 </div>
 </button>
 `;
 })
 .join("");

 petSwitchList.querySelectorAll(".pet-switch-btn").forEach((btn) => {
 btn.addEventListener("click", () => {
 currentPetId = btn.dataset.petId;
 renderPetSwitcher(pets);
 renderHistoryForCurrentPet(pets);
 });
 });
 }

 /**
 * Render toàn bộ lịch sử bệnh của thú cưng đang chọn
 */
 function renderHistoryForCurrentPet(pets) {
 const allRecords = getStoredMedicalRecords();
 const petRecords = allRecords
 .filter((r) => r.petId === currentPetId)
 .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

 const currentPet = pets.find((p) => p.id === currentPetId) || { name: "Bé cưng" };

 // 1. Render Summary Ribbon
 renderSummaryRibbon(petRecords, currentPet);

 // 2. Render Timeline
 renderTimeline(petRecords, currentPet);

 // 3. Render Weight Trend
 renderWeightTrend(petRecords);
 }

 /**
 * Render thanh tóm tắt nhanh chỉ số
 */
 function renderSummaryRibbon(records, pet) {
 if (!historySummaryRibbon) return;

 const totalCount = records.length;
 const completedCount = records.filter((r) => r.status === "Đã hoàn thành").length;
 const recoveryRate = totalCount> 0 ? Math.round((completedCount / totalCount) * 100) : 100;
 const latestDate = totalCount> 0 ? records[0].date : "Chưa có";
 const primaryDoctor = totalCount> 0 ? records[0].veterinarian : "BS. CKI. Nguyễn Văn Hùng";

 historySummaryRibbon.innerHTML = `
 <div class="history-ribbon-item">
 <div class="ribbon-icon">🩺</div>
 <div class="ribbon-text">
 <strong>${totalCount} Đợt Khám</strong>
 <span>Tổng số lần khám bệnh của ${escapeHTML(pet.name)}</span>
 </div>
 </div>
 <div class="history-ribbon-item">
 <div class="ribbon-icon">🛡️</div>
 <div class="ribbon-text">
 <strong style="color:#2E5C38;">${recoveryRate}% Hồi Phục</strong>
 <span>Tỷ lệ hoàn thành điều trị</span>
 </div>
 </div>
 <div class="history-ribbon-item">
 <div class="ribbon-icon">📅</div>
 <div class="ribbon-text">
 <strong>${latestDate}</strong>
 <span>Lần khám bệnh gần nhất</span>
 </div>
 </div>
 <div class="history-ribbon-item">
 <div class="ribbon-icon">👨‍⚕️</div>
 <div class="ribbon-text">
 <strong style="font-size:15px;">${escapeHTML(primaryDoctor)}</strong>
 <span>Bác sĩ phụ trách chính</span>
 </div>
 </div>
 `;
 }

 /**
 * Render Dòng thời gian bệnh án (Timeline)
 */
 function renderTimeline(records, pet) {
 if (!medicalTimelineContainer) return;

 if (records.length === 0) {
 medicalTimelineContainer.innerHTML = `
 <div style="background:var(--surface); border:1.5px dashed var(--line); border-radius:18px; padding:48px 24px; text-align:center;">
 <div style="font-size:42px; margin-bottom:12px;">🌱</div>
 <h3 style="font-family:var(--font-display); font-size:20px; color:var(--brown); margin-bottom:8px;">Bé ${escapeHTML(pet.name)} Chưa Có Tiền Sử Bệnh Án</h3>
 <p style="font-size:14px; color:var(--ink-soft); max-width:480px; margin:0 auto 16px;">
 Chúc mừng bạn! Hiện tại bé chưa ghi nhận đợt bệnh hoặc điều trị nào. Hãy duy trì chế độ dinh dưỡng và tiêm phòng định kỳ nhé.
 </p>
 <a href="./medical-record.html?petId=${currentPetId}" class="btn-cta" style="display:inline-flex;">
 <span>➕ Thêm bệnh án mới</span>
 </a>
 </div>
 `;
 return;
 }

 medicalTimelineContainer.innerHTML = records
 .map((r, idx) => {
 let nodeClass = "general";
 let nodeIcon = "🩺";
 if (r.category === "Tiêm chủng") {
 nodeClass = "vaccine";
 nodeIcon = "💉";
 } else if (r.category === "Ngoại khoa" || r.category === "Phẫu thuật") {
 nodeClass = "surgery";
 nodeIcon = "✂️";
 } else if (r.category === "Da liễu") {
 nodeIcon = "🔬";
 }

 const isCompleted = r.status === "Đã hoàn thành";
 const statusStyle = isCompleted
 ? "background:#E8F5E9; color:#2E5C38;"
 : r.status === "Đang điều trị"
 ? "background:#FFF3E0; color:#E65100;"
 : "background:var(--cream-latte); color:var(--espresso); border:1px solid var(--accent-border);";

 const symptomsText = Array.isArray(r.symptoms) ? r.symptoms.join(", ") : (r.symptoms || "Không có");
 const prescriptionSummary = Array.isArray(r.prescription) && r.prescription.length> 0
 ? r.prescription.map((rx) => rx.name).join(" • ")
 : "Không kê đơn thuốc";

 return `
 <div class="timeline-item">
 <div class="timeline-node ${nodeClass}">${nodeIcon}</div>
 <div class="timeline-content-card">
 <div class="timeline-header">
 <span class="timeline-date-chip">📅 ${escapeHTML(r.date)}</span>
 <span class="med-status-pill" style="${statusStyle}">
 <span>${isCompleted ? "✓" : "⏳"}</span>
 <span>${escapeHTML(r.status)}</span>
 </span>
 </div>

 <div class="timeline-title-row">
 <h4>${escapeHTML(r.title)}</h4>
 <span class="med-category-tag">${escapeHTML(r.category || "Tổng quát")}</span>
 </div>

 <div class="timeline-body">
 <p><strong>Lý do khám:</strong> ${escapeHTML(r.reason || "Khám định kỳ")}</p>
 
 <div class="timeline-details-table">
 <div class="timeline-details-row">
 <span class="timeline-details-label">👨‍⚕️ Bác sĩ điều trị:</span>
 <span class="timeline-details-val">${escapeHTML(r.veterinarian || "PawnCare Vet")}</span>
 </div>
 <div class="timeline-details-row">
 <span class="timeline-details-label">🌡️ Chỉ số sinh hiệu:</span>
 <span class="timeline-details-val">Thân nhiệt ${r.vitalSigns?.temperature || "--"}°C • Cân nặng ${r.vitalSigns?.weight || "--"} kg</span>
 </div>
 <div class="timeline-details-row">
 <span class="timeline-details-label">🔬 Triệu chứng phát hiện:</span>
 <span class="timeline-details-val">${escapeHTML(symptomsText)}</span>
 </div>
 <div class="timeline-details-row">
 <span class="timeline-details-label">🎯 Chẩn đoán xác định:</span>
 <span class="timeline-details-val" style="color:var(--accent-dark);">${escapeHTML(r.confirmedDiagnosis || r.title)}</span>
 </div>
 <div class="timeline-details-row">
 <span class="timeline-details-label">💊 Thuốc chỉ định:</span>
 <span class="timeline-details-val">${escapeHTML(prescriptionSummary)}</span>
 </div>
 <div class="timeline-details-row">
 <span class="timeline-details-label">💰 Chi phí đợt khám:</span>
 <span class="timeline-details-val" style="color:#2E5C38;">${escapeHTML(r.totalCost || "0đ")}</span>
 </div>
 </div>

 ${
 r.doctorAdvice
 ? `<div style="background:var(--cream-latte); border-left:3px solid var(--caramel-dark); padding:10px 14px; border-radius:0 10px 10px 0; font-size:13px; color:var(--brown); margin-bottom:14px;">
 <strong>Lời dặn bác sĩ:</strong> "${escapeHTML(r.doctorAdvice)}"
 </div>`
 : ""
 }

 <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px; margin-top:12px;">
 <a href="./diagnosis.html?petId=${r.petId}&recordId=${r.id}" class="btn-timeline-action">
 <span>🔬</span>
 <span>Xem Chi Tiết Chẩn Đoán & Xét Nghiệm</span>
 </a>
 <a href="./medical-record.html?petId=${r.petId}" style="font-size:12.5px; color:var(--brown); text-decoration:underline;">
 Quản lý hồ sơ bệnh án
 </a>
 </div>
 </div>
 </div>
 </div>
 `;
 })
 .join("");
 }

 /**
 * Render Diễn tiến cân nặng qua các lần khám
 */
 function renderWeightTrend(records) {
 if (!weightTimelineBars) return;

 // Lọc ra các đợt khám có ghi nhận cân nặng
 const weightRecords = records
 .filter((r) => r.vitalSigns && r.vitalSigns.weight && !isNaN(parseFloat(r.vitalSigns.weight)))
 .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

 if (weightRecords.length === 0) {
 weightTimelineBars.innerHTML = `<span style="font-size:13px; color:var(--ink-faint); padding:12px 0;">Chưa đủ dữ liệu cân nặng từ các lần khám.</span>`;
 return;
 }

 weightTimelineBars.innerHTML = weightRecords
 .map((r, idx) => {
 const weightVal = parseFloat(r.vitalSigns.weight);
 let tagText = "Chuẩn thể trạng";
 if (idx> 0) {
 const prevWeight = parseFloat(weightRecords[idx - 1].vitalSigns.weight);
 const diff = weightVal - prevWeight;
 if (diff> 0.3) tagText = `+${diff.toFixed(1)}kg (Tăng)`;
 else if (diff < -0.3) tagText = `${diff.toFixed(1)}kg (Giảm)`;
 else tagText = "Duy trì ổn định";
 }

 return `
 <div class="weight-bar-item">
 <div class="weight-bar-date">${escapeHTML(r.date)}</div>
 <div class="weight-bar-val">${weightVal} kg</div>
 <span class="weight-bar-tag">${tagText}</span>
 </div>
 `;
 })
 .join("");
 }

 // Khởi động render
 const initialPets = getPetsList();
 renderPetSwitcher(initialPets);
 renderHistoryForCurrentPet(initialPets);

 // Đồng bộ thêm nếu có dữ liệu từ BackEnd
 fetchPetsFromDatabase().then((dbPets) => {
 if (dbPets && Array.isArray(dbPets) && dbPets.length> 0) {
 renderPetSwitcher(dbPets);
 renderHistoryForCurrentPet(dbPets);
 }
 });

 // Đồng bộ hồ sơ bệnh án từ MongoDB
 apiGetMedicalRecords().then((dbRecords) => {
 if (dbRecords && Array.isArray(dbRecords) && dbRecords.length> 0) {
 const normalizedDbRecords = dbRecords.map((r) => ({
 ...r,
 id: r.id || r.recordCode || (r._id ? String(r._id) : ""),
 recordCode: r.recordCode || r.id || (r._id ? String(r._id) : ""),
 }));

 const dbKeySet = new Set();
 normalizedDbRecords.forEach((r) => {
 if (r.id) dbKeySet.add(r.id);
 if (r.recordCode) dbKeySet.add(r.recordCode);
 });

 const local = getStoredMedicalRecords();
 const merged = [...normalizedDbRecords];
 local.forEach((loc) => {
 const key = loc.id || loc.recordCode || "";
 if (key && !dbKeySet.has(key)) {
 merged.push(loc);
 }
 });
 setStoredMedicalRecords(merged);
 const currentPets = getPetsList();
 renderHistoryForCurrentPet(currentPets);
 }
 });
}
