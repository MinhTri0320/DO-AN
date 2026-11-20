/* ============================================================
   re-examination-history.js
   Controller riêng cho tính năng: Re-examination History (Lịch sử tái khám)
   Chuẩn bảng màu Pawmily.vn, tích hợp đồng bộ dữ liệu với Medical Record
   ============================================================ */

import { escapeHTML } from "./storage.js";
import { getPetsList, fetchPetsFromDatabase } from "./pet-profile.js";
import {
  getStoredReExaminations,
  setStoredReExaminations,
  getStoredMedicalRecords,
  showToast,
  updateSidebarInfo,
} from "./medical-data.js";

export function initReExaminationHistoryPage() {
  const pageContainer = document.getElementById("reExamPage");
  if (!pageContainer) return;

  console.log("[ReExaminationHistory] Khởi chạy trang Lịch Sử Tái Khám...");

  // Cập nhật thông tin sidebar người dùng
  updateSidebarInfo();

  // Đọc params từ URL
  const urlParams = new URLSearchParams(window.location.search);
  let currentPetId = urlParams.get("petId") || null;
  let editingReExamId = null;

  const petSwitchList = document.getElementById("petSwitchList");
  const reExamListContainer = document.getElementById("reExamListContainer");
  const reExamSearchInput = document.getElementById("reExamSearchInput");
  const reExamStatusFilter = document.getElementById("reExamStatusFilter");
  const btnOpenAddReExam = document.getElementById("btnOpenAddReExam");

  // Elements thống kê
  const statUpcomingCount = document.getElementById("statUpcomingCount");
  const statCompletedCount = document.getElementById("statCompletedCount");
  const statAvgRecovery = document.getElementById("statAvgRecovery");
  const statPrimaryVet = document.getElementById("statPrimaryVet");

  // Modal elements
  const reExamModal = document.getElementById("reExamModal");
  const reExamForm = document.getElementById("reExamForm");
  const btnReExamModalClose = document.getElementById("btnReExamModalClose");
  const btnCancelReExamModal = document.getElementById("btnCancelReExamModal");
  const modalReExamTitle = document.getElementById("modalReExamTitle");
  const modalReExamRecordSelect = document.getElementById("modalReExamRecordSelect");

  // Print modal
  const printReExamModal = document.getElementById("printReExamModal");
  const btnPrintReExamClose = document.getElementById("btnPrintReExamClose");
  const btnTriggerPrintReExam = document.getElementById("btnTriggerPrintReExam");
  const printReExamContent = document.getElementById("printReExamContent");

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
        renderPetSwitcher(pets);
        renderReExamsForCurrentPet(pets);
      });
    });
  }

  /**
   * Cập nhật số liệu thống kê nhanh
   */
  function updateQuickStats(reExams) {
    const upcoming = reExams.filter((r) => r.status === "Sắp tới").length;
    const completed = reExams.filter((r) => r.status === "Đã hoàn thành").length;

    if (statUpcomingCount) statUpcomingCount.textContent = upcoming;
    if (statCompletedCount) statCompletedCount.textContent = completed;

    // Tỷ lệ phục hồi trung bình
    if (reExams.length > 0) {
      const totalRate = reExams.reduce((sum, r) => sum + (Number(r.recoveryRate) || 85), 0);
      const avg = Math.round(totalRate / reExams.length);
      if (statAvgRecovery) statAvgRecovery.textContent = `${avg}%`;
    } else {
      if (statAvgRecovery) statAvgRecovery.textContent = "100%";
    }

    // Bác sĩ phụ trách chính
    if (reExams.length > 0 && reExams[0].veterinarian) {
      if (statPrimaryVet) statPrimaryVet.textContent = reExams[0].veterinarian;
    }
  }

  /**
   * Render danh sách các lần tái khám của thú cưng đang chọn
   */
  function renderReExamsForCurrentPet(pets) {
    const allReExams = getStoredReExaminations();
    let petReExams = allReExams.filter((r) => r.petId === currentPetId);

    // Cập nhật thống kê
    updateQuickStats(petReExams);

    // Áp dụng bộ lọc tìm kiếm & trạng thái
    const searchQuery = (reExamSearchInput?.value || "").trim().toLowerCase();
    const statusFilter = reExamStatusFilter?.value || "all";

    if (statusFilter !== "all") {
      petReExams = petReExams.filter((r) => r.status === statusFilter);
    }

    if (searchQuery) {
      petReExams = petReExams.filter((r) => {
        const textToSearch = [
          r.originalDiagnosis,
          r.veterinarian,
          r.date,
          r.findings,
          r.treatmentAdjustment,
          r.category,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return textToSearch.includes(searchQuery);
      });
    }

    if (!reExamListContainer) return;

    if (petReExams.length === 0) {
      reExamListContainer.innerHTML = `
        <div style="background:var(--surface); border:1.5px dashed var(--line); border-radius:18px; padding:44px 20px; text-align:center;">
          <span style="font-size:38px; display:block; margin-bottom:12px;">🔄</span>
          <h3 style="font-family:var(--font-heading); font-size:17px; color:var(--brown); margin-bottom:6px;">Chưa có dữ liệu tái khám phù hợp</h3>
          <p style="font-size:13.5px; color:var(--ink-faint); max-width:380px; margin:0 auto 16px;">
            Bé cưng chưa có lần tái khám nào được ghi nhận hoặc không khớp với bộ lọc tìm kiếm.
          </p>
          <button type="button" class="btn-cta" id="btnEmptyAddReExam">
            <span>➕ Ghi Nhận Lần Tái Khám Mới</span>
          </button>
        </div>
      `;
      const btnEmptyAdd = document.getElementById("btnEmptyAddReExam");
      if (btnEmptyAdd) {
        btnEmptyAdd.addEventListener("click", () => openAddModal());
      }
      return;
    }

    // Render danh sách các card tái khám
    reExamListContainer.innerHTML = petReExams
      .map((r) => {
        const isCompleted = r.status === "Đã hoàn thành";
        const statusClass = isCompleted ? "completed" : "upcoming";
        const statusText = isCompleted ? "✓ Đã hoàn thành tái khám" : "⏳ Lịch tái khám sắp tới";
        const rate = Math.min(Math.max(Number(r.recoveryRate) || 85, 0), 100);

        // Chuẩn bị khối so sánh (Trước vs Sau)
        const comp = r.comparison || {};
        const before = comp.before || {};
        const after = comp.after || {};

        return `
        <article class="reexam-card" data-reexam-id="${r.id}">
          <div class="reexam-card-head">
            <div class="reexam-head-left">
              <span class="reexam-date-badge">
                <span>📅</span>
                <span>${escapeHTML(r.date)} ${r.time ? "• " + escapeHTML(r.time) : ""}</span>
              </span>
              <span class="reexam-status-pill ${statusClass}">
                ${statusText}
              </span>
              ${
                r.recordId
                  ? `<a href="./medical-record.html?petId=${encodeURIComponent(r.petId)}&recordId=${encodeURIComponent(r.recordId)}" class="reexam-record-link">
                      Mã bệnh án: ${escapeHTML(r.recordId)}
                    </a>`
                  : ""
              }
            </div>
            <span style="font-size:12px; font-weight:700; color:var(--caramel-dark); background:var(--cream-latte); padding:4px 10px; border-radius:6px; border:1px solid var(--accent-border);">
              Chuyên khoa: ${escapeHTML(r.category || "Thú y")}
            </span>
          </div>

          <div class="reexam-card-body">
            <h3>${escapeHTML(r.originalDiagnosis || "Tái khám theo dõi sức khỏe")}</h3>
            <div class="reexam-vet-line">
              <span>🩺 Bác sĩ phụ trách: <strong>${escapeHTML(r.veterinarian || "Bác sĩ PawnCare")}</strong></span>
              <span>•</span>
              <span>📍 Cơ sở: ${escapeHTML(r.clinicBranch || "PawnCare 123 Nguyễn Văn Linh")}</span>
            </div>

            <!-- Thanh tiến trình phục hồi -->
            <div class="reexam-progress-wrap">
              <div class="reexam-progress-header">
                <span class="reexam-progress-title">
                  <span>📈</span>
                  <span>Đánh giá tiến triển hồi phục của bé:</span>
                </span>
                <span class="reexam-progress-badge">${rate}% Hồi phục</span>
              </div>
              <div class="reexam-progress-bar-bg">
                <div class="reexam-progress-bar-fill" style="width: ${rate}%;"></div>
              </div>
              <span class="reexam-progress-status-desc">
                Trạng thái: <strong>${escapeHTML(r.recoveryStatus || "Đang phục hồi rất tốt")}</strong>
              </span>
            </div>

            <!-- Bảng đối chiếu Trước vs Sau -->
            <div class="reexam-compare-grid">
              <div class="reexam-compare-col col-before">
                <div class="reexam-compare-head">
                  <span>⚠️</span>
                  <span>Tình trạng trước khi tái khám</span>
                </div>
                ${Object.entries(before)
                  .map(
                    ([k, v]) => `
                  <div class="reexam-compare-item">
                    <span class="reexam-compare-label">${formatCompareLabel(k)}:</span>
                    <span class="reexam-compare-val">${escapeHTML(String(v))}</span>
                  </div>
                `
                  )
                  .join("")}
              </div>

              <div class="reexam-compare-col col-after">
                <div class="reexam-compare-head">
                  <span>✨</span>
                  <span>Ghi nhận sau khi tái khám</span>
                </div>
                ${Object.entries(after)
                  .map(
                    ([k, v]) => `
                  <div class="reexam-compare-item">
                    <span class="reexam-compare-label">${formatCompareLabel(k)}:</span>
                    <span class="reexam-compare-val">${escapeHTML(String(v))}</span>
                  </div>
                `
                  )
                  .join("")}
              </div>
            </div>

            <!-- Khối kết quả lâm sàng & Hướng điều trị tiếp theo -->
            <div class="reexam-detail-section">
              <div class="reexam-detail-box">
                <strong><span>🔬</span> Kết quả kiểm tra &amp; Đánh giá lâm sàng:</strong>
                <p>${escapeHTML(r.findings || "Thể trạng bé ổn định, các dấu hiệu lâm sàng tiến triển khả quan.")}</p>
              </div>

              <div class="reexam-detail-box">
                <strong><span>💊</span> Điều chỉnh phác đồ &amp; Đơn thuốc tiếp theo:</strong>
                <p>${escapeHTML(r.treatmentAdjustment || "Tiếp tục duy trì phác đồ điều trị hiện tại theo chỉ định.")}</p>
              </div>

              <div class="reexam-detail-box" style="background:var(--cream-latte); border-left:4px solid var(--caramel-dark);">
                <strong style="color:var(--espresso);"><span>🏡</span> Lời dặn dò chăm sóc tại nhà:</strong>
                <p style="color:var(--brown);">${escapeHTML(r.homeCareAdvice || "Cho bé uống nhiều nước, ăn thức ăn dễ tiêu và giữ môi trường sinh hoạt khô thoáng.")}</p>
              </div>
            </div>
          </div>

          <div class="reexam-card-foot">
            <span class="reexam-next-note">
              📅 Kế hoạch tiếp theo: <strong>${escapeHTML(r.nextFollowup || "Theo dõi định kỳ")}</strong>
            </span>
            <div class="reexam-btn-group">
              <button type="button" class="btn-reexam-action btn-reexam-print" data-action="print" data-id="${r.id}">
                <span>🖨️</span>
                <span>In Phiếu</span>
              </button>
              <button type="button" class="btn-reexam-action btn-reexam-edit" data-action="edit" data-id="${r.id}">
                <span>✏️</span>
                <span>Sửa</span>
              </button>
              <button type="button" class="btn-reexam-action btn-reexam-delete" data-action="delete" data-id="${r.id}">
                <span>🗑️</span>
              </button>
            </div>
          </div>
        </article>
      `;
      })
      .join("");

    // Gắn sự kiện các nút hành động trong card
    reExamListContainer.querySelectorAll("[data-action]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const action = btn.dataset.action;
        const id = btn.dataset.id;
        if (action === "print") {
          openPrintModal(id);
        } else if (action === "edit") {
          openEditModal(id);
        } else if (action === "delete") {
          deleteReExam(id, pets);
        }
      });
    });
  }

  function formatCompareLabel(key) {
    const map = {
      temp: "Thân nhiệt",
      weight: "Cân nặng",
      itchLevel: "Mức độ ngứa",
      skinCondition: "Tình trạng da",
      stool: "Tính chất phân",
      appetite: "Cảm giác thèm ăn",
      urination: "Hoạt động tiểu tiện",
      ultrasound: "Hình ảnh siêu âm",
      status: "Thể trạng chung",
    };
    return map[key] || key;
  }

  /**
   * Nạp options danh sách bệnh án vào modal select
   */
  function populateRecordSelect() {
    if (!modalReExamRecordSelect) return;
    const allRecords = getStoredMedicalRecords().filter((r) => r.petId === currentPetId);
    if (allRecords.length === 0) {
      modalReExamRecordSelect.innerHTML = `<option value="">-- Đợt khám tổng quát chung --</option>`;
      return;
    }
    modalReExamRecordSelect.innerHTML =
      `<option value="">-- Chọn bệnh án liên quan --</option>` +
      allRecords
        .map(
          (r) =>
            `<option value="${r.id}" data-title="${escapeHTML(r.title)}" data-vet="${escapeHTML(r.veterinarian)}">
              [${r.id}] ${escapeHTML(r.title)} (${escapeHTML(r.date)})
            </option>`
        )
        .join("");
  }

  /**
   * Mở modal thêm mới
   */
  function openAddModal() {
    editingReExamId = null;
    if (modalReExamTitle) modalReExamTitle.textContent = "Ghi Nhận Lần Tái Khám Mới";
    if (reExamForm) reExamForm.reset();

    populateRecordSelect();

    // Điền mặc định ngày hôm nay
    const today = new Date();
    const dateStr = `${String(today.getDate()).padStart(2, "0")}/${String(today.getMonth() + 1).padStart(2, "0")}/${today.getFullYear()}`;
    if (reExamForm?.elements["modalReExamDate"]) reExamForm.elements["modalReExamDate"].value = dateStr;
    if (reExamForm?.elements["modalReExamTime"]) reExamForm.elements["modalReExamTime"].value = "09:30";
    if (reExamForm?.elements["modalReExamVet"]) reExamForm.elements["modalReExamVet"].value = "BS. CKI. Nguyễn Văn Hùng";

    if (reExamModal) reExamModal.hidden = false;
  }

  /**
   * Mở modal chỉnh sửa
   */
  function openEditModal(id) {
    const allReExams = getStoredReExaminations();
    const item = allReExams.find((r) => r.id === id);
    if (!item) return;

    editingReExamId = id;
    if (modalReExamTitle) modalReExamTitle.textContent = "Cập Nhật Lần Tái Khám";
    populateRecordSelect();

    if (reExamForm) {
      reExamForm.elements["modalReExamId"].value = item.id;
      if (modalReExamRecordSelect) modalReExamRecordSelect.value = item.recordId || "";
      reExamForm.elements["modalReExamVet"].value = item.veterinarian || "";
      reExamForm.elements["modalReExamDate"].value = item.date || "";
      reExamForm.elements["modalReExamTime"].value = item.time || "";
      reExamForm.elements["modalReExamStatus"].value = item.status || "Đã hoàn thành";
      reExamForm.elements["modalReExamRate"].value = item.recoveryRate || 90;
      reExamForm.elements["modalReExamRecoveryStatus"].value = item.recoveryStatus || "Phục hồi rất tốt";

      const after = item.comparison?.after || {};
      reExamForm.elements["modalReExamTemp"].value = after.temp ? String(after.temp).replace("°C", "").trim() : "38.3";
      reExamForm.elements["modalReExamWeight"].value = after.weight ? String(after.weight).replace("kg", "").trim() : "19.5";

      reExamForm.elements["modalReExamFindings"].value = item.findings || "";
      reExamForm.elements["modalReExamAdjustment"].value = item.treatmentAdjustment || "";
      reExamForm.elements["modalReExamAdvice"].value = item.homeCareAdvice || "";
      reExamForm.elements["modalReExamNext"].value = item.nextFollowup || "";
    }

    if (reExamModal) reExamModal.hidden = false;
  }

  /**
   * Xóa một lần tái khám
   */
  function deleteReExam(id, pets) {
    if (!confirm("Bạn có chắc chắn muốn xóa bản ghi lần tái khám này không?")) return;
    const allReExams = getStoredReExaminations().filter((r) => r.id !== id);
    setStoredReExaminations(allReExams);
    showToast("Đã xóa bản ghi lần tái khám thành công!");
    renderReExamsForCurrentPet(pets);
  }

  /**
   * Mở modal in phiếu tái khám
   */
  function openPrintModal(id) {
    const allReExams = getStoredReExaminations();
    const item = allReExams.find((r) => r.id === id);
    if (!item) return;

    const pets = getPetsList();
    const pet = pets.find((p) => p.id === item.petId) || { name: item.petName || "Bé cưng" };

    if (printReExamContent) {
      printReExamContent.innerHTML = `
        <div class="print-cert-sheet">
          <div class="print-cert-head">
            <h1>BỆNH VIỆN &amp; SPA THÚ CƯNG PAWNCARE ĐÀ NẴNG</h1>
            <p>123 Nguyễn Văn Linh, P. Hải Châu, TP. Đà Nẵng • Hotline 24/7: 0900 123 456</p>
            <h2 style="font-family:var(--font-display); font-size:18px; margin-top:14px; color:var(--brown);">
              PHIẾU THEO DÕI &amp; KẾT QUẢ TÁI KHÁM Y KHOA
            </h2>
          </div>

          <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:16px; font-size:13.5px;">
            <div><strong>Tên bé cưng:</strong> ${escapeHTML(pet.name)} (${escapeHTML(pet.species || "Thú cưng")})</div>
            <div><strong>Mã phiếu:</strong> ${escapeHTML(item.id)}</div>
            <div><strong>Ngày tái khám:</strong> ${escapeHTML(item.date)} ${item.time ? " • " + escapeHTML(item.time) : ""}</div>
            <div><strong>Bác sĩ phụ trách:</strong> ${escapeHTML(item.veterinarian || "Bác sĩ PawnCare")}</div>
            <div><strong>Đợt bệnh án gốc:</strong> ${escapeHTML(item.originalDiagnosis || "Tái khám theo dõi")}</div>
            <div><strong>Tiến triển hồi phục:</strong> ${escapeHTML(item.recoveryStatus || "Phục hồi tốt")} (${item.recoveryRate || 90}%)</div>
          </div>

          <div style="margin-bottom:14px; font-size:13.5px; line-height:1.6;">
            <strong>Kết quả kiểm tra &amp; Đánh giá lâm sàng:</strong>
            <p style="margin:4px 0 10px;">${escapeHTML(item.findings || "Bé hồi phục tích cực.")}</p>

            <strong>Điều chỉnh phác đồ &amp; Đơn thuốc tiếp tục:</strong>
            <p style="margin:4px 0 10px;">${escapeHTML(item.treatmentAdjustment || "Tiếp tục duy trì chăm sóc.")}</p>

            <strong>Lời dặn dò cho chủ nuôi:</strong>
            <p style="margin:4px 0 10px;">${escapeHTML(item.homeCareAdvice || "Theo dõi tình trạng bé tại nhà.")}</p>

            <strong>Kế hoạch tiếp theo:</strong>
            <p style="margin:4px 0 0;">${escapeHTML(item.nextFollowup || "Tái khám khi có dấu hiệu bất thường.")}</p>
          </div>

          <div style="display:flex; justify-content:space-between; margin-top:36px; padding-top:16px; border-top:1px dashed var(--brown);">
            <div style="text-align:center;">
              <p style="font-size:12px; color:#666;">Chủ nuôi xác nhận</p>
              <div style="height:48px;"></div>
              <p style="font-weight:700;">(Đã đọc &amp; nắm rõ dặn dò)</p>
            </div>
            <div style="text-align:center;">
              <p style="font-size:12px; color:#666;">Bác sĩ phụ trách tái khám</p>
              <div style="height:48px;"></div>
              <p style="font-weight:700;">${escapeHTML(item.veterinarian || "BS. Thú y PawnCare")}</p>
            </div>
          </div>
        </div>
      `;
    }

    if (printReExamModal) printReExamModal.hidden = false;
  }

  // Sự kiện nút in trực tiếp
  if (btnTriggerPrintReExam) {
    btnTriggerPrintReExam.addEventListener("click", () => {
      window.print();
    });
  }

  if (btnPrintReExamClose) {
    btnPrintReExamClose.addEventListener("click", () => {
      if (printReExamModal) printReExamModal.hidden = true;
    });
  }

  // Sự kiện nút thêm mới
  if (btnOpenAddReExam) {
    btnOpenAddReExam.addEventListener("click", () => openAddModal());
  }

  if (btnReExamModalClose) {
    btnReExamModalClose.addEventListener("click", () => {
      if (reExamModal) reExamModal.hidden = true;
    });
  }

  if (btnCancelReExamModal) {
    btnCancelReExamModal.addEventListener("click", () => {
      if (reExamModal) reExamModal.hidden = true;
    });
  }

  // Tự động điền thông tin bác sĩ khi chọn đợt khám bệnh
  if (modalReExamRecordSelect) {
    modalReExamRecordSelect.addEventListener("change", () => {
      const selectedOption = modalReExamRecordSelect.options[modalReExamRecordSelect.selectedIndex];
      if (selectedOption && selectedOption.dataset.vet) {
        if (reExamForm?.elements["modalReExamVet"]) {
          reExamForm.elements["modalReExamVet"].value = selectedOption.dataset.vet;
        }
      }
    });
  }

  // Submit form lưu tái khám
  if (reExamForm) {
    reExamForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const allReExams = getStoredReExaminations();
      const pets = getPetsList();
      const currentPet = pets.find((p) => p.id === currentPetId) || { name: "Bé cưng", species: "Thú cưng" };

      const selectedOption = modalReExamRecordSelect?.options[modalReExamRecordSelect.selectedIndex];
      const recordTitle = selectedOption?.dataset?.title || "Tái khám theo dõi sức khỏe";

      const tempVal = (reExamForm.elements["modalReExamTemp"]?.value || "").trim();
      const weightVal = (reExamForm.elements["modalReExamWeight"]?.value || "").trim();

      const newReExam = {
        id: editingReExamId || `RE-${new Date().getFullYear()}-${String(allReExams.length + 1).padStart(3, "0")}`,
        recordId: modalReExamRecordSelect?.value || "",
        petId: currentPetId,
        petName: currentPet.name,
        petSpecies: currentPet.species || "Thú cưng",
        petBreed: currentPet.breed || "",
        date: reExamForm.elements["modalReExamDate"]?.value || "",
        time: reExamForm.elements["modalReExamTime"]?.value || "",
        originalDiagnosis: recordTitle,
        category: "Thú y",
        status: reExamForm.elements["modalReExamStatus"]?.value || "Đã hoàn thành",
        veterinarian: reExamForm.elements["modalReExamVet"]?.value || "BS. CKI. Nguyễn Văn Hùng",
        clinicBranch: "PawnCare 123 Nguyễn Văn Linh, Hải Châu, Đà Nẵng",
        recoveryRate: Number(reExamForm.elements["modalReExamRate"]?.value) || 90,
        recoveryStatus: reExamForm.elements["modalReExamRecoveryStatus"]?.value || "Phục hồi rất tốt",
        comparison: {
          before: {
            temp: "38.6°C",
            weight: "19.5 kg",
            status: "Triệu chứng ban đầu đang điều trị",
          },
          after: {
            temp: tempVal ? `${tempVal}°C` : "38.3°C",
            weight: weightVal ? `${weightVal} kg` : "19.8 kg",
            status: reExamForm.elements["modalReExamRecoveryStatus"]?.value || "Tiến triển tốt",
          },
        },
        findings: reExamForm.elements["modalReExamFindings"]?.value || "Thể trạng bé ổn định.",
        treatmentAdjustment: reExamForm.elements["modalReExamAdjustment"]?.value || "Duy trì phác đồ hiện tại.",
        homeCareAdvice: reExamForm.elements["modalReExamAdvice"]?.value || "Chăm sóc theo hướng dẫn của bác sĩ.",
        nextFollowup: reExamForm.elements["modalReExamNext"]?.value || "Theo dõi định kỳ",
        createdAt: Date.now(),
      };

      if (editingReExamId) {
        const index = allReExams.findIndex((r) => r.id === editingReExamId);
        if (index !== -1) {
          allReExams[index] = { ...allReExams[index], ...newReExam };
        }
        showToast("Đã cập nhật thông tin lần tái khám thành công!");
      } else {
        allReExams.unshift(newReExam);
        showToast("Đã ghi nhận lần tái khám mới cho bé!");
      }

      setStoredReExaminations(allReExams);
      if (reExamModal) reExamModal.hidden = true;
      renderReExamsForCurrentPet(pets);
    });
  }

  // Tìm kiếm & bộ lọc
  if (reExamSearchInput) {
    reExamSearchInput.addEventListener("input", () => {
      const pets = getPetsList();
      renderReExamsForCurrentPet(pets);
    });
  }

  if (reExamStatusFilter) {
    reExamStatusFilter.addEventListener("change", () => {
      const pets = getPetsList();
      renderReExamsForCurrentPet(pets);
    });
  }

  // Khởi động dữ liệu ban đầu
  let pets = getPetsList();
  renderPetSwitcher(pets);
  renderReExamsForCurrentPet(pets);

  // Thử đồng bộ từ MongoDB nếu có
  fetchPetsFromDatabase().then((dbPets) => {
    if (dbPets && dbPets.length > 0) {
      pets = dbPets;
      renderPetSwitcher(pets);
      renderReExamsForCurrentPet(pets);
    }
  });
}
