/* ============================================================
 diagnosis.js
 Controller riêng cho tính năng: Diagnosis (Kết quả chẩn đoán bệnh thú cưng)
 Chuẩn bảng màu Pawmily.vn, tích hợp đồng bộ dữ liệu với Medical Record
 ============================================================ */

import { escapeHTML } from "./storage.js";
import { getPetsList, fetchPetsFromDatabase } from "./pet-profile.js";
import { getStoredMedicalRecords, updateSidebarInfo } from "./medical-data.js";

export function initDiagnosisPage() {
 const pageContainer = document.getElementById("diagnosisPage");
 if (!pageContainer) return;

 console.log("[Diagnosis] Khởi chạy trang Kết Quả Chẩn Đoán Bệnh...");

 // Cập nhật thông tin sidebar người dùng
 updateSidebarInfo();

 // Đọc params từ URL
 const urlParams = new URLSearchParams(window.location.search);
 let currentPetId = urlParams.get("petId") || null;
 let currentRecordId = urlParams.get("recordId") || null;

 const petSwitchList = document.getElementById("petSwitchList");
 const diagSelectRecord = document.getElementById("diagSelectRecord");
 const diagnosisSheetContainer = document.getElementById("diagnosisSheetContainer");
 const btnPrintDiagnosis = document.getElementById("btnPrintDiagnosis");

 // Nút in phiếu kết quả chẩn đoán
 if (btnPrintDiagnosis) {
 btnPrintDiagnosis.addEventListener("click", () => {
 window.print();
 });
 }

 /**
 * Render danh sách nút chuyển thú cưng (Pet Switcher)
 */
 function renderPetSwitcher(pets) {
 if (!petSwitchList) return;
 if (!pets || pets.length === 0) {
 petSwitchList.innerHTML = `<span style="font-size:13px; color:var(--ink-faint); padding:6px 0;">Chưa có hồ sơ thú cưng nào.</span>`;
 return;
 }

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
 currentRecordId = null; // Đổi thú cưng thì reset về đợt khám mới nhất của bé đó
 renderPetSwitcher(pets);
 loadRecordsForCurrentPet(pets);
 });
 });
 }

 /**
 * Tải danh sách đợt khám của bé cưng vào select box và render Sheet
 */
 function loadRecordsForCurrentPet(pets) {
 const allRecords = getStoredMedicalRecords();
 const petRecords = allRecords
 .filter((r) => r.petId === currentPetId)
 .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

 const currentPet = pets.find((p) => p.id === currentPetId) || { name: "Bé cưng", species: "Thú cưng" };

 if (!diagSelectRecord) return;

 if (petRecords.length === 0) {
 diagSelectRecord.innerHTML = `<option value="">(Chưa có đợt khám nào)</option>`;
 renderEmptySheet(currentPet);
 return;
 }

 // Populate dropdown
 diagSelectRecord.innerHTML = petRecords
 .map((r) => {
 const selected = r.id === currentRecordId ? "selected" : "";
 return `<option value="${r.id}" ${selected}>${r.date} — ${r.title} (${r.status})</option>`;
 })
 .join("");

 // Nếu currentRecordId chưa chọn hoặc không thuộc pet này, lấy cái đầu tiên
 if (!currentRecordId || !petRecords.some((r) => r.id === currentRecordId)) {
 currentRecordId = petRecords[0].id;
 diagSelectRecord.value = currentRecordId;
 }

 const activeRecord = petRecords.find((r) => r.id === currentRecordId) || petRecords[0];
 renderDiagnosisSheet(activeRecord, currentPet);
 }

 // Sự kiện khi người dùng chọn đợt khám khác từ select box
 if (diagSelectRecord) {
 diagSelectRecord.addEventListener("change", (e) => {
 currentRecordId = e.target.value;
 const allRecords = getStoredMedicalRecords();
 const currentPet = getPetsList().find((p) => p.id === currentPetId) || { name: "Bé cưng" };
 const activeRecord = allRecords.find((r) => r.id === currentRecordId);
 if (activeRecord) {
 renderDiagnosisSheet(activeRecord, currentPet);
 }
 });
 }

 /**
 * Render Trạng thái trống khi chưa có bệnh án
 */
 function renderEmptySheet(pet) {
 if (!diagnosisSheetContainer) return;
 diagnosisSheetContainer.innerHTML = `
 <div style="background:var(--surface); border:1.5px dashed var(--line); border-radius:20px; padding:60px 24px; text-align:center;">
 <div style="font-size:48px; margin-bottom:14px;">🔬</div>
 <h3 style="font-family:var(--font-display); font-size:22px; color:var(--brown); margin-bottom:8px;">
 Chưa Có Kết Quả Chẩn Đoán Nào Cho Bé ${escapeHTML(pet.name)}
 </h3>
 <p style="font-size:14px; color:var(--ink-soft); max-width:500px; margin:0 auto 20px;">
 Bé cưng hiện chưa ghi nhận đợt khám hay kết quả chẩn đoán bệnh nào từ hệ thống phòng khám thú y PawnCare.
 </p>
 <a href="./medical-record.html?petId=${currentPetId}" class="btn-cta" style="display:inline-flex;">
 <span>➕ Tạo hồ sơ bệnh án mới</span>
 </a>
 </div>
 `;
 }

 /**
 * Render Phiếu Kết Quả Chẩn Đoán Chi Tiết (Clinical Diagnosis Sheet)
 */
 function renderDiagnosisSheet(record, pet) {
 if (!diagnosisSheetContainer) return;

 const vs = record.vitalSigns || {};
 const symptoms = Array.isArray(record.symptoms)
 ? record.symptoms
 : typeof record.symptoms === "string"
 ? record.symptoms.split(",").map((s) => s.trim())
 : [];

 const tests = Array.isArray(record.testResults) ? record.testResults : [];
 const prescriptions = Array.isArray(record.prescription) ? record.prescription : [];

 diagnosisSheetContainer.innerHTML = `
 <article class="diag-sheet">
 <div class="diag-sheet-watermark">PAWNCARE VET</div>

 <!-- 1. HEADER BỆNH VIỆN & MÃ PHIẾU -->
 <div class="diag-sheet-head">
 <div class="diag-hospital-brand">
 <div class="diag-hospital-logo">🐾</div>
 <div class="diag-hospital-info">
 <h2>HỆ THỐNG THÚ Y CHUYÊN KHOA PAWNCARE</h2>
 <p>📍 123 Nguyễn Văn Linh, Q. Hải Châu, TP. Đà Nẵng</p>
 <p>📞 Hotline cấp cứu: 0900 123 456 • Giấy phép HĐ số: 48/SNN-TY-ĐN</p>
 </div>
 </div>
 <div class="diag-doc-meta">
 <div class="diag-doc-title">Phiếu Chẩn Đoán &amp; Điều Trị</div>
 <div class="diag-doc-id">MÃ HS: ${escapeHTML(record.id || "MED-2026-001")}</div>
 <div class="diag-doc-date">Ngày lập: ${escapeHTML(record.date || "Hôm nay")}</div>
 </div>
 </div>

 <!-- 2. THÔNG TIN BỆNH NHÂN THÚ CƯNG -->
 <div class="diag-patient-card">
 <div class="diag-patient-item">
 <span class="diag-patient-label">Bệnh nhân thú cưng</span>
 <span class="diag-patient-val">🐾 ${escapeHTML(pet.name || record.petName)}</span>
 </div>
 <div class="diag-patient-item">
 <span class="diag-patient-label">Loài &amp; Giống</span>
 <span class="diag-patient-val">${escapeHTML(pet.species || record.petSpecies || "Chó")} • ${escapeHTML(pet.breed || record.petBreed || "Thuần chủng")}</span>
 </div>
 <div class="diag-patient-item">
 <span class="diag-patient-label">Độ tuổi / Giới tính</span>
 <span class="diag-patient-val">${escapeHTML(pet.age || "2 tuổi")} • ${escapeHTML(pet.gender || "Đực")}</span>
 </div>
 <div class="diag-patient-item">
 <span class="diag-patient-label">Chuyên khoa thăm khám</span>
 <span class="diag-patient-val" style="color:var(--caramel-dark);">${escapeHTML(record.category || "Khám tổng quát")}</span>
 </div>
 </div>

 <!-- 3. CHỈ SỐ SINH HIỆU LÂM SÀNG (VITAL SIGNS) -->
 <div class="diag-section-title">
 <span>📊</span>
 <span>1. Chỉ Số Sinh Hiệu &amp; Thể Trạng Khi Nhập Viện</span>
 </div>
 <div class="diag-vitals-grid">
 <div class="diag-vital-card">
 <div class="diag-vital-label">Thân nhiệt</div>
 <div class="diag-vital-value">${escapeHTML(vs.temperature || "38.5")} °C</div>
 </div>
 <div class="diag-vital-card">
 <div class="diag-vital-label">Cân nặng</div>
 <div class="diag-vital-value">${escapeHTML(vs.weight || pet.weight || "19.5")} kg</div>
 </div>
 <div class="diag-vital-card">
 <div class="diag-vital-label">Nhịp tim</div>
 <div class="diag-vital-value">${escapeHTML(vs.heartRate || "110")} bpm</div>
 </div>
 <div class="diag-vital-card">
 <div class="diag-vital-label">Nhịp thở</div>
 <div class="diag-vital-value">${escapeHTML(vs.respiratoryRate || "24")} l/p</div>
 </div>
 <div class="diag-vital-card">
 <div class="diag-vital-label">Niêm mạc</div>
 <div class="diag-vital-value" style="font-size:14px; padding-top:4px;">${escapeHTML(vs.mucousMembranes || "Hồng tươi")}</div>
 </div>
 </div>

 <!-- 4. LÝ DO KHÁM & TRIỆU CHỨNG LÂM SÀNG -->
 <div class="diag-section-title">
 <span>🔍</span>
 <span>2. Lý Do Khám &amp; Triệu Chứng Lâm Sàng Ghi Nhận</span>
 </div>
 <div style="background:var(--cream-soft); padding:14px 18px; border-radius:12px; margin-bottom:14px; font-size:14px; color:var(--brown);">
 <strong>Lý do tiếp nhận:</strong> ${escapeHTML(record.reason || "Khám định kỳ và kiểm tra sức khỏe")}
 </div>
 <div class="diag-symptoms-chips">
 ${
 symptoms.length> 0
 ? symptoms.map((s) => `<span class="diag-symptom-tag">⚠️ ${escapeHTML(s)}</span>`).join("")
 : `<span style="font-size:13px; color:var(--ink-faint);">Không có triệu chứng bất thường</span>`
 }
 </div>

 <!-- 5. SO SÁNH CHẨN ĐOÁN SƠ BỘ VS XÁC ĐỊNH -->
 <div class="diag-section-title">
 <span>🎯</span>
 <span>3. Kết Quả Chẩn Đoán Y Khoa</span>
 </div>
 <div class="diag-comparison-grid">
 <div class="diag-card diag-card-preliminary">
 <h4>
 <span>📋</span>
 <span>Chẩn Đoán Sơ Bộ (Preliminary Diagnosis)</span>
 </h4>
 <p>${escapeHTML(record.preliminaryDiagnosis || "Nghi ngờ theo biểu hiện lâm sàng ban đầu")}</p>
 </div>

 <div class="diag-card diag-card-confirmed">
 <h4>
 <span>✅</span>
 <span>Chẩn Đoán Xác Định (Confirmed Diagnosis)</span>
 </h4>
 <p style="font-size:15px; color:var(--espresso); font-weight:800;">
 ${escapeHTML(record.confirmedDiagnosis || record.title || "Đang chờ kết luận")}
 </p>
 </div>
 </div>

 <!-- 6. KẾT QUẢ XÉT NGHIỆM CẬN LÂM SÀNG -->
 ${
 tests.length> 0
 ? `
 <div class="diag-section-title">
 <span>🔬</span>
 <span>4. Kết Quả Xét Nghiệm &amp; Cận Lâm Sàng</span>
 </div>
 <table class="diag-table">
 <thead>
 <tr>
 <th style="width:28%;">Tên xét nghiệm</th>
 <th style="width:24%;">Mẫu bệnh phẩm</th>
 <th>Kết quả phân tích y khoa</th>
 <th style="width:15%; text-align:center;">Đánh giá</th>
 </tr>
 </thead>
 <tbody>
 ${tests
 .map((t) => {
 const isNormal = t.status === "Bình thường";
 return `
 <tr>
 <td><strong>${escapeHTML(t.name)}</strong></td>
 <td>${escapeHTML(t.sample || "Lâm sàng")}</td>
 <td>${escapeHTML(t.result)}</td>
 <td style="text-align:center;">
 <span class="diag-test-status ${isNormal ? "normal" : "abnormal"}">
 ${isNormal ? "✓ Bình thường" : "⚠️ Bất thường"}
 </span>
 </td>
 </tr>
 `;
 })
 .join("")}
 </tbody>
 </table>
 `
 : ""
 }

 <!-- 7. ĐƠN THUỐC ĐIỀU TRỊ CHỈ ĐỊNH -->
 ${
 prescriptions.length> 0
 ? `
 <div class="diag-section-title">
 <span>💊</span>
 <span>5. Phác Đồ Điều Trị &amp; Đơn Thuốc Chỉ Định</span>
 </div>
 <div class="diag-prescription-box">
 ${prescriptions
 .map(
 (rx) => `
 <div class="diag-rx-item">
 <div>
 <div class="diag-rx-name">💊 ${escapeHTML(rx.name)}</div>
 <div class="diag-rx-active">Hoạt chất: ${escapeHTML(rx.active || "Theo đơn thú y")}</div>
 <div style="font-size:12.5px; color:var(--ink-soft); margin-top:3px;">Ghi chú: ${escapeHTML(rx.notes || "Dùng đúng hướng dẫn")}</div>
 </div>
 <div class="diag-rx-usage">
 <div><strong>Liều dùng:</strong> ${escapeHTML(rx.dosage)}</div>
 <div class="diag-rx-duration">Thời gian: ${escapeHTML(rx.duration)}</div>
 </div>
 </div>
 `
 )
 .join("")}
 </div>
 `
 : ""
 }

 <!-- 8. LỜI DẶN THEO DÕI CỦA BÁC SĨ -->
 <div class="diag-advice-banner">
 <strong>📝 Hướng Dẫn Chăm Sóc &amp; Lời Dặn Của Bác Sĩ Điều Trị:</strong>
 <p>${escapeHTML(record.doctorAdvice || "Tiếp tục theo dõi ăn uống và vận động của bé. Nếu có dấu hiệu sốt cao, bỏ ăn hoặc nôn mửa, xin vui lòng liên hệ ngay với bệnh viện.")}</p>
 ${
 record.nextAppointment
 ? `<p style="margin-top:8px; font-weight:700; color:var(--espresso);">
 📅 Hẹn tái khám định kỳ vào ngày: ${escapeHTML(record.nextAppointment)}
 </p>`
 : ""
 }
 </div>

 <!-- 9. CHỮ KÝ VÀ CON DẤU BỆNH VIỆN -->
 <div class="diag-sheet-foot">
 <div class="diag-clinic-seal">
 <div class="seal-circle">
 <span>PAWNCARE</span>
 <span>ĐÀ NẴNG</span>
 <span>ĐÃ XÁC NHẬN</span>
 </div>
 <div class="seal-text">
 <strong>HỆ THỐNG BỆNH VIỆN THÚ Y PAWNCARE</strong><br />
 Phiếu chẩn đoán có giá trị theo dõi y tế toàn hệ thống
 </div>
 </div>

 <div class="diag-signature-box">
 <div class="diag-sign-title">BÁC SĨ ĐIỀU TRỊ CHÍNH</div>
 <div class="diag-sign-name">${escapeHTML(record.veterinarian || "BS. CKI. Nguyễn Văn Hùng")}</div>
 </div>
 </div>
 </article>
 `;
 }

 // Khởi động render
 const initialPets = getPetsList();
 renderPetSwitcher(initialPets);
 loadRecordsForCurrentPet(initialPets);

 // Đồng bộ thêm nếu có dữ liệu từ BackEnd
 fetchPetsFromDatabase().then((dbPets) => {
 if (dbPets && Array.isArray(dbPets) && dbPets.length> 0) {
 renderPetSwitcher(dbPets);
 loadRecordsForCurrentPet(dbPets);
 }
 });
}
