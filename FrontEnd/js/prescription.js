/* ============================================================
   prescription.js
   Controller riêng cho tính năng: Prescription (Đơn thuốc thú cưng)
   Chuẩn bảng màu Pawmily.vn, tích hợp đồng bộ dữ liệu với Medical Record
   ============================================================ */

import { escapeHTML } from "./storage.js";
import { getPetsList, fetchPetsFromDatabase } from "./pet-profile.js";
import {
  getStoredPrescriptions,
  setStoredPrescriptions,
  getStoredHealthProfiles,
  showToast,
  updateSidebarInfo,
} from "./medical-data.js";

export function initPrescriptionPage() {
  const pageContainer = document.getElementById("prescriptionPage");
  if (!pageContainer) return;

  console.log("[Prescription] Khởi chạy trang Đơn Thuốc Thú Cưng...");

  // Cập nhật thông tin sidebar người dùng
  updateSidebarInfo();

  // Đọc params từ URL
  const urlParams = new URLSearchParams(window.location.search);
  let currentPetId = urlParams.get("petId") || null;
  let editingRxId = null;

  const petSwitchList = document.getElementById("petSwitchList");
  const prescriptionListContainer = document.getElementById("prescriptionListContainer");
  const rxSearchInput = document.getElementById("rxSearchInput");
  const rxStatusFilter = document.getElementById("rxStatusFilter");
  const btnOpenAddRxModal = document.getElementById("btnOpenAddRxModal");
  const btnOpenPrintAllRx = document.getElementById("btnOpenPrintAllRx");
  const rxDosesGrid = document.getElementById("rxDosesGrid");
  const rxDailyDateText = document.getElementById("rxDailyDateText");

  // Elements thống kê
  const statRxTotal = document.getElementById("statRxTotal");
  const statRxActive = document.getElementById("statRxActive");
  const statRxDosesToday = document.getElementById("statRxDosesToday");
  const statRxAllergyNotice = document.getElementById("statRxAllergyNotice");

  // Modal elements
  const rxModal = document.getElementById("rxModal");
  const rxForm = document.getElementById("rxForm");
  const btnRxModalClose = document.getElementById("btnRxModalClose");
  const btnCancelRxModal = document.getElementById("btnCancelRxModal");
  const modalRxTitle = document.getElementById("modalRxTitle");

  // Print modal
  const printRxModal = document.getElementById("printRxModal");
  const btnPrintRxClose = document.getElementById("btnPrintRxClose");
  const btnTriggerPrintRx = document.getElementById("btnTriggerPrintRx");
  const printRxContent = document.getElementById("printRxContent");

  // Ngày hôm nay
  const today = new Date();
  const dateStr = `${String(today.getDate()).padStart(2, "0")}/${String(today.getMonth() + 1).padStart(2, "0")}/${today.getFullYear()}`;
  if (rxDailyDateText) {
    rxDailyDateText.textContent = `Hôm nay, ngày ${dateStr}`;
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
        renderPetSwitcher(pets);
        renderPrescriptionsForCurrentPet(pets);
      });
    });
  }

  /**
   * Cập nhật số liệu thống kê & Tiền sử dị ứng
   */
  function updateQuickStats(prescriptions) {
    const total = prescriptions.length;
    const active = prescriptions.filter((r) => r.status === "Đang sử dụng").length;

    let totalDosesToday = 0;
    prescriptions
      .filter((r) => r.status === "Đang sử dụng")
      .forEach((r) => {
        if (r.schedule?.morning) totalDosesToday++;
        if (r.schedule?.afternoon) totalDosesToday++;
        if (r.schedule?.evening) totalDosesToday++;
      });

    if (statRxTotal) statRxTotal.textContent = total;
    if (statRxActive) statRxActive.textContent = active;
    if (statRxDosesToday) statRxDosesToday.textContent = `${totalDosesToday} cữ/ngày`;

    // Cảnh báo dị ứng từ hồ sơ y tế nền
    const profiles = getStoredHealthProfiles();
    const petProfile = profiles[currentPetId];
    if (statRxAllergyNotice) {
      if (petProfile && petProfile.allergies && !petProfile.allergies.toLowerCase().includes("chưa")) {
        statRxAllergyNotice.textContent = petProfile.allergies;
        statRxAllergyNotice.style.color = "#C95A34";
      } else {
        statRxAllergyNotice.textContent = "Không ghi nhận dị ứng";
        statRxAllergyNotice.style.color = "var(--sage-green)";
      }
    }
  }

  /**
   * Render Lịch Nhắc Uống Thuốc Trong Ngày
   */
  function renderDailySchedule(activePrescriptions) {
    if (!rxDosesGrid) return;

    const morningMeds = activePrescriptions.filter((r) => r.schedule?.morning);
    const afternoonMeds = activePrescriptions.filter((r) => r.schedule?.afternoon);
    const eveningMeds = activePrescriptions.filter((r) => r.schedule?.evening);

    function renderColumn(title, icon, timeRange, meds, timeKey) {
      return `
        <div class="rx-dose-column">
          <div class="rx-dose-col-header">
            <span class="rx-dose-col-title">
              <span>${icon}</span>
              <span>${title}</span>
            </span>
            <span class="rx-dose-col-time">${timeRange}</span>
          </div>

          <div class="rx-dose-items-list">
            ${
              meds.length === 0
                ? `<span style="font-size:12px; color:var(--ink-faint); padding:10px 0; display:block; text-align:center;">Không có thuốc cữ này</span>`
                : meds
                    .map((m) => {
                      const storageKey = `dose_${m.id}_${timeKey}_${dateStr}`;
                      const isTaken = localStorage.getItem(storageKey) === "true";
                      return `
                      <div class="rx-dose-mini-item ${isTaken ? "taken" : ""}">
                        <div class="rx-dose-mini-info">
                          <strong>${escapeHTML(m.medicineName)}</strong>
                          <span>${escapeHTML(m.dosage)} • ${escapeHTML(m.timing || "")}</span>
                        </div>
                        <button type="button" class="btn-mark-dose ${isTaken ? "active" : ""}" title="Đánh dấu đã uống" data-storage-key="${storageKey}">
                          ${isTaken ? "✓" : "○"}
                        </button>
                      </div>
                    `;
                    })
                    .join("")
            }
          </div>
        </div>
      `;
    }

    rxDosesGrid.innerHTML = `
      ${renderColumn("Cữ Sáng", "🌅", "07:00 - 09:00", morningMeds, "morning")}
      ${renderColumn("Cữ Chiều", "☀️", "12:00 - 15:00", afternoonMeds, "afternoon")}
      ${renderColumn("Cữ Tối", "🌙", "19:00 - 21:00", eveningMeds, "evening")}
    `;

    // Gắn sự kiện đánh dấu đã uống
    rxDosesGrid.querySelectorAll(".btn-mark-dose").forEach((btn) => {
      btn.addEventListener("click", () => {
        const key = btn.dataset.storageKey;
        const current = localStorage.getItem(key) === "true";
        localStorage.setItem(key, String(!current));
        renderDailySchedule(activePrescriptions);
        showToast(!current ? "Đã đánh dấu cữ thuốc thành công!" : "Đã hủy đánh dấu cữ thuốc.");
      });
    });
  }

  /**
   * Chọn icon tương ứng theo loại thuốc
   */
  function getMedicineIcon(category = "", form = "") {
    const combined = `${category} ${form}`.toLowerCase();
    if (combined.includes("tắm")) return "🧴";
    if (combined.includes("nhỏ") || combined.includes("giọt") || combined.includes("tai") || combined.includes("mắt")) return "💧";
    if (combined.includes("tiêm") || combined.includes("vaccine") || combined.includes("gáy")) return "💉";
    if (combined.includes("gel") || combined.includes("siro") || combined.includes("uống")) return "🥄";
    return "💊";
  }

  /**
   * Render danh sách các loại thuốc
   */
  function renderPrescriptionsForCurrentPet(pets) {
    const allPrescriptions = getStoredPrescriptions();
    let petPrescriptions = allPrescriptions.filter((r) => r.petId === currentPetId);

    // Cập nhật thống kê
    updateQuickStats(petPrescriptions);

    // Lịch trình thuốc đang sử dụng
    const activePrescriptions = petPrescriptions.filter((r) => r.status === "Đang sử dụng");
    renderDailySchedule(activePrescriptions);

    // Áp dụng bộ lọc tìm kiếm & trạng thái
    const searchQuery = (rxSearchInput?.value || "").trim().toLowerCase();
    const statusFilter = rxStatusFilter?.value || "all";

    if (statusFilter !== "all") {
      petPrescriptions = petPrescriptions.filter((r) => r.status === statusFilter);
    }

    if (searchQuery) {
      petPrescriptions = petPrescriptions.filter((r) => {
        const textToSearch = [
          r.medicineName,
          r.activeIngredient,
          r.category,
          r.form,
          r.prescribedBy,
          r.diseaseTitle,
          r.notes,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return textToSearch.includes(searchQuery);
      });
    }

    if (!prescriptionListContainer) return;

    if (petPrescriptions.length === 0) {
      prescriptionListContainer.innerHTML = `
        <div style="background:var(--surface); border:1.5px dashed var(--line); border-radius:18px; padding:44px 20px; text-align:center;">
          <span style="font-size:38px; display:block; margin-bottom:12px;">💊</span>
          <h3 style="font-family:var(--font-heading); font-size:17px; color:var(--brown); margin-bottom:6px;">Chưa có đơn thuốc nào phù hợp</h3>
          <p style="font-size:13.5px; color:var(--ink-faint); max-width:380px; margin:0 auto 16px;">
            Bé cưng chưa có đơn thuốc nào hoặc không khớp với bộ lọc tìm kiếm.
          </p>
          <button type="button" class="btn-cta" id="btnEmptyAddRx">
            <span>➕ Thêm Đơn Thuốc Mới</span>
          </button>
        </div>
      `;
      const btnEmptyAdd = document.getElementById("btnEmptyAddRx");
      if (btnEmptyAdd) {
        btnEmptyAdd.addEventListener("click", () => openAddModal());
      }
      return;
    }

    // Render danh sách các thẻ thuốc
    prescriptionListContainer.innerHTML = petPrescriptions
      .map((m) => {
        const statusMap = {
          "Đang sử dụng": { class: "active", text: "🟢 Đang sử dụng" },
          "Đã hoàn thành": { class: "completed", text: "✓ Đã hoàn thành đợt thuốc" },
          "Định kỳ": { class: "periodic", text: "⏰ Thuốc dự phòng định kỳ" },
        };
        const statusInfo = statusMap[m.status] || { class: "completed", text: m.status };
        const icon = getMedicineIcon(m.category, m.form);

        return `
        <article class="rx-card" data-rx-id="${m.id}">
          <div class="rx-card-head">
            <div class="rx-head-badges">
              <span class="rx-status-pill ${statusInfo.class}">
                ${statusInfo.text}
              </span>
              <span class="rx-category-badge">
                ${escapeHTML(m.category || "Dược phẩm thú y")}
              </span>
              ${m.form ? `<span style="font-size:12px; color:var(--ink-faint);">${escapeHTML(m.form)}</span>` : ""}
            </div>
            ${
              m.diseaseTitle
                ? `<span class="rx-disease-link">Đợt bệnh: <strong>${escapeHTML(m.diseaseTitle)}</strong></span>`
                : ""
            }
          </div>

          <div class="rx-card-body">
            <div class="rx-icon-box">
              <span>${icon}</span>
            </div>

            <div class="rx-main-info">
              <h3>${escapeHTML(m.medicineName)}</h3>
              <div class="rx-active-ingredient">
                <span>Hoạt chất:</span>
                <strong>${escapeHTML(m.activeIngredient || "Theo chỉ định")}</strong>
              </div>

              <!-- Chi tiết liều lượng & thời điểm -->
              <div class="rx-dosage-box">
                <div class="rx-dosage-item">
                  <span class="rx-dosage-label">Liều lượng &amp; Số lần:</span>
                  <span class="rx-dosage-val">${escapeHTML(m.dosage)}</span>
                </div>
                <div class="rx-dosage-item">
                  <span class="rx-dosage-label">Thời điểm dùng:</span>
                  <span class="rx-dosage-val">${escapeHTML(m.timing || "Sau bữa ăn")}</span>
                </div>
                <div class="rx-dosage-item">
                  <span class="rx-dosage-label">Thời gian điều trị:</span>
                  <span class="rx-dosage-val" style="color:var(--espresso);">${escapeHTML(m.duration || "Theo phác đồ")}</span>
                </div>
              </div>

              <!-- Chips cữ uống trong ngày -->
              <div class="rx-schedule-chips">
                <span style="font-size:12px; font-weight:700; color:var(--ink-faint);">Cữ uống:</span>
                <span class="rx-schedule-chip ${m.schedule?.morning ? "active" : ""}">🌅 Sáng</span>
                <span class="rx-schedule-chip ${m.schedule?.afternoon ? "active" : ""}">☀️ Chiều</span>
                <span class="rx-schedule-chip ${m.schedule?.evening ? "active" : ""}">🌙 Tối</span>
              </div>

              <!-- Ghi chú & Lời dặn -->
              ${
                m.notes
                  ? `
                <div class="rx-notes-box">
                  <strong>💡 Hướng dẫn &amp; Lưu ý:</strong> ${escapeHTML(m.notes)}
                </div>`
                  : ""
              }

              <!-- Cảnh báo chống chỉ định -->
              ${
                m.warnings
                  ? `
                <div class="rx-warning-box">
                  <strong>⚠️ Cảnh báo an toàn:</strong> ${escapeHTML(m.warnings)}
                </div>`
                  : ""
              }
            </div>
          </div>

          <div class="rx-card-foot">
            <div class="rx-prescriber-info">
              <span>Bác sĩ kê đơn: <strong>${escapeHTML(m.prescribedBy || "Bác sĩ thú y PawnCare")}</strong></span>
              ${m.recordId ? `<span> • Mã đợt khám: <strong>${escapeHTML(m.recordId)}</strong></span>` : ""}
            </div>

            <div class="rx-btn-group">
              <button type="button" class="btn-rx-action btn-rx-toggle" data-action="toggle-status" data-id="${m.id}" title="Đổi trạng thái sử dụng">
                <span>🔄</span>
                <span>${m.status === "Đang sử dụng" ? "Đã uống xong" : "Dùng lại"}</span>
              </button>
              <button type="button" class="btn-rx-action btn-rx-edit" data-action="edit" data-id="${m.id}">
                <span>✏️ Sửa</span>
              </button>
              <button type="button" class="btn-rx-action btn-rx-delete" data-action="delete" data-id="${m.id}" title="Xóa thuốc">
                <span>🗑️</span>
              </button>
            </div>
          </div>
        </article>
      `;
      })
      .join("");

    // Gắn sự kiện hành động cho thẻ thuốc
    prescriptionListContainer.querySelectorAll("[data-action]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const action = btn.dataset.action;
        const id = btn.dataset.id;
        if (action === "toggle-status") {
          toggleRxStatus(id, pets);
        } else if (action === "edit") {
          openEditModal(id);
        } else if (action === "delete") {
          deleteRx(id, pets);
        }
      });
    });
  }

  /**
   * Chuyển đổi nhanh trạng thái thuốc
   */
  function toggleRxStatus(id, pets) {
    const allPrescriptions = getStoredPrescriptions();
    const item = allPrescriptions.find((r) => r.id === id);
    if (!item) return;

    if (item.status === "Đang sử dụng") {
      item.status = "Đã hoàn thành";
      showToast(`Đã chuyển thuốc "${item.medicineName}" sang Đã hoàn thành!`);
    } else {
      item.status = "Đang sử dụng";
      showToast(`Đã chuyển thuốc "${item.medicineName}" sang Đang sử dụng!`);
    }

    setStoredPrescriptions(allPrescriptions);
    renderPrescriptionsForCurrentPet(pets);
  }

  /**
   * Xóa một loại thuốc
   */
  function deleteRx(id, pets) {
    if (!confirm("Bạn có chắc chắn muốn xóa thuốc này khỏi đơn không?")) return;
    const allPrescriptions = getStoredPrescriptions().filter((r) => r.id !== id);
    setStoredPrescriptions(allPrescriptions);
    showToast("Đã xóa loại thuốc thành công!");
    renderPrescriptionsForCurrentPet(pets);
  }

  /**
   * Mở modal thêm thuốc
   */
  function openAddModal() {
    editingRxId = null;
    if (modalRxTitle) modalRxTitle.textContent = "Thêm Đơn Thuốc Mới";
    if (rxForm) rxForm.reset();

    if (rxForm?.elements["modalRxPrescribedBy"]) {
      rxForm.elements["modalRxPrescribedBy"].value = "BS. CKI. Nguyễn Văn Hùng";
    }
    if (rxForm?.elements["modalRxStatus"]) {
      rxForm.elements["modalRxStatus"].value = "Đang sử dụng";
    }
    if (rxModal) rxModal.hidden = false;
  }

  /**
   * Mở modal sửa thuốc
   */
  function openEditModal(id) {
    const allPrescriptions = getStoredPrescriptions();
    const item = allPrescriptions.find((r) => r.id === id);
    if (!item) return;

    editingRxId = id;
    if (modalRxTitle) modalRxTitle.textContent = "Cập Nhật Thông Tin Thuốc";

    if (rxForm) {
      rxForm.elements["modalRxId"].value = item.id;
      rxForm.elements["modalRxName"].value = item.medicineName || "";
      rxForm.elements["modalRxActive"].value = item.activeIngredient || "";
      rxForm.elements["modalRxCategory"].value = item.category || "Kháng sinh đường uống";
      rxForm.elements["modalRxForm"].value = item.form || "";
      rxForm.elements["modalRxStatus"].value = item.status || "Đang sử dụng";
      rxForm.elements["modalRxDosage"].value = item.dosage || "";
      rxForm.elements["modalRxTiming"].value = item.timing || "";
      rxForm.elements["modalRxDuration"].value = item.duration || "";
      rxForm.elements["modalRxPrescribedBy"].value = item.prescribedBy || "";
      rxForm.elements["modalRxDiseaseTitle"].value = item.diseaseTitle || "";
      rxForm.elements["modalRxNotes"].value = item.notes || "";
      rxForm.elements["modalRxWarnings"].value = item.warnings || "";

      if (rxForm.elements["modalRxMorning"]) rxForm.elements["modalRxMorning"].checked = !!item.schedule?.morning;
      if (rxForm.elements["modalRxAfternoon"]) rxForm.elements["modalRxAfternoon"].checked = !!item.schedule?.afternoon;
      if (rxForm.elements["modalRxEvening"]) rxForm.elements["modalRxEvening"].checked = !!item.schedule?.evening;
    }

    if (rxModal) rxModal.hidden = false;
  }

  /**
   * Mở modal in toàn bộ đơn thuốc
   */
  function openPrintAllModal() {
    const allPrescriptions = getStoredPrescriptions().filter((r) => r.petId === currentPetId);
    const pets = getPetsList();
    const pet = pets.find((p) => p.id === currentPetId) || { name: "Bé cưng" };

    if (printRxContent) {
      printRxContent.innerHTML = `
        <div class="print-cert-sheet">
          <div class="print-cert-head">
            <h1>BỆNH VIỆN &amp; PHÒNG KHÁM THÚ Y PAWNCARE ĐÀ NẴNG</h1>
            <p>123 Nguyễn Văn Linh, P. Hải Châu, TP. Đà Nẵng • Hotline 24/7: 0900 123 456</p>
            <h2 style="font-family:var(--font-display); font-size:18px; margin-top:14px; color:var(--brown);">
              ĐƠN THUỐC ĐIỀU TRỊ THÚ CƯNG
            </h2>
          </div>

          <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:18px; font-size:13.5px;">
            <div><strong>Tên bé cưng:</strong> ${escapeHTML(pet.name)} (${escapeHTML(pet.species || "Thú cưng")})</div>
            <div><strong>Ngày kê đơn:</strong> ${dateStr}</div>
            <div><strong>Tiền sử dị ứng:</strong> ${statRxAllergyNotice?.textContent || "Không dị ứng"}</div>
            <div><strong>Cơ sở cấp phát:</strong> Nhà thuốc Thú y PawnCare Hải Châu</div>
          </div>

          <table style="width:100%; border-collapse:collapse; margin-bottom:20px; font-size:13px;">
            <thead>
              <tr style="background:#FAF4ED; border-bottom:2px solid var(--brown); text-align:left;">
                <th style="padding:10px 8px;">STT</th>
                <th style="padding:10px 8px;">Tên thuốc &amp; Hoạt chất</th>
                <th style="padding:10px 8px;">Liều dùng &amp; Hướng dẫn</th>
                <th style="padding:10px 8px;">Thời gian</th>
                <th style="padding:10px 8px;">Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              ${
                allPrescriptions.length === 0
                  ? `<tr><td colspan="5" style="text-align:center; padding:16px;">Chưa có đơn thuốc nào</td></tr>`
                  : allPrescriptions
                      .map(
                        (m, idx) => `
                    <tr style="border-bottom:1px solid #eee;">
                      <td style="padding:10px 8px;">${idx + 1}</td>
                      <td style="padding:10px 8px;">
                        <strong>${escapeHTML(m.medicineName)}</strong><br/>
                        <span style="font-size:11.5px; color:#666;">${escapeHTML(m.activeIngredient || "")}</span>
                      </td>
                      <td style="padding:10px 8px;">
                        ${escapeHTML(m.dosage)}<br/>
                        <span style="font-size:11.5px; color:#555;">${escapeHTML(m.timing || "")}</span>
                      </td>
                      <td style="padding:10px 8px;">${escapeHTML(m.duration || "")}</td>
                      <td style="padding:10px 8px; font-weight:700;">${escapeHTML(m.status)}</td>
                    </tr>
                  `
                      )
                      .join("")
              }
            </tbody>
          </table>

          <div style="font-size:12.5px; color:#444; line-height:1.5; margin-bottom:24px;">
            <strong>Lưu ý chung của Bác sĩ:</strong>
            <p style="margin:4px 0 0;">
              Cho thú cưng uống thuốc đúng liều và thời gian đã quy định. Nếu phát hiện phản ứng mẫn cảm hoặc bất thường sau khi dùng thuốc, ngưng thuốc ngay lập tức và liên hệ đường dây nóng 24/7 của PawnCare để được hỗ trợ.
            </p>
          </div>

          <div style="display:flex; justify-content:space-between; margin-top:36px; padding-top:16px; border-top:1px dashed var(--brown);">
            <div style="text-align:center;">
              <p style="font-size:12px; color:#666;">Dược sĩ cấp phát</p>
              <div style="height:48px;"></div>
              <p style="font-weight:700;">(Ký &amp; ghi rõ họ tên)</p>
            </div>
            <div style="text-align:center;">
              <p style="font-size:12px; color:#666;">Bác sĩ Thú y kê đơn</p>
              <div style="height:48px;"></div>
              <p style="font-weight:700;">BS. CKI. Nguyễn Văn Hùng</p>
            </div>
          </div>
        </div>
      `;
    }

    if (printRxModal) printRxModal.hidden = false;
  }

  // Sự kiện nút in
  if (btnOpenPrintAllRx) {
    btnOpenPrintAllRx.addEventListener("click", () => openPrintAllModal());
  }

  if (btnTriggerPrintRx) {
    btnTriggerPrintRx.addEventListener("click", () => {
      window.print();
    });
  }

  if (btnPrintRxClose) {
    btnPrintRxClose.addEventListener("click", () => {
      if (printRxModal) printRxModal.hidden = true;
    });
  }

  // Sự kiện modal thêm/sửa
  if (btnOpenAddRxModal) {
    btnOpenAddRxModal.addEventListener("click", () => openAddModal());
  }

  if (btnRxModalClose) {
    btnRxModalClose.addEventListener("click", () => {
      if (rxModal) rxModal.hidden = true;
    });
  }

  if (btnCancelRxModal) {
    btnCancelRxModal.addEventListener("click", () => {
      if (rxModal) rxModal.hidden = true;
    });
  }

  // Submit form lưu thuốc
  if (rxForm) {
    rxForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const allPrescriptions = getStoredPrescriptions();
      const pets = getPetsList();

      const newRx = {
        id: editingRxId || `RX-${new Date().getFullYear()}-${String(allPrescriptions.length + 1).padStart(3, "0")}`,
        petId: currentPetId,
        diseaseTitle: rxForm.elements["modalRxDiseaseTitle"]?.value || "Chăm sóc & Điều trị y tế",
        medicineName: rxForm.elements["modalRxName"]?.value || "",
        activeIngredient: rxForm.elements["modalRxActive"]?.value || "",
        category: rxForm.elements["modalRxCategory"]?.value || "Kháng sinh đường uống",
        form: rxForm.elements["modalRxForm"]?.value || "Viên nén",
        dosage: rxForm.elements["modalRxDosage"]?.value || "",
        schedule: {
          morning: !!rxForm.elements["modalRxMorning"]?.checked,
          afternoon: !!rxForm.elements["modalRxAfternoon"]?.checked,
          evening: !!rxForm.elements["modalRxEvening"]?.checked,
        },
        timing: rxForm.elements["modalRxTiming"]?.value || "Sau khi ăn",
        duration: rxForm.elements["modalRxDuration"]?.value || "7 ngày",
        status: rxForm.elements["modalRxStatus"]?.value || "Đang sử dụng",
        prescribedBy: rxForm.elements["modalRxPrescribedBy"]?.value || "BS. CKI. Nguyễn Văn Hùng",
        notes: rxForm.elements["modalRxNotes"]?.value || "",
        warnings: rxForm.elements["modalRxWarnings"]?.value || "",
      };

      if (editingRxId) {
        const index = allPrescriptions.findIndex((r) => r.id === editingRxId);
        if (index !== -1) {
          allPrescriptions[index] = { ...allPrescriptions[index], ...newRx };
        }
        showToast("Đã cập nhật thông tin thuốc thành công!");
      } else {
        allPrescriptions.unshift(newRx);
        showToast("Đã thêm thuốc mới vào đơn cho bé!");
      }

      setStoredPrescriptions(allPrescriptions);
      if (rxModal) rxModal.hidden = true;
      renderPrescriptionsForCurrentPet(pets);
    });
  }

  // Tìm kiếm & bộ lọc
  if (rxSearchInput) {
    rxSearchInput.addEventListener("input", () => {
      const pets = getPetsList();
      renderPrescriptionsForCurrentPet(pets);
    });
  }

  if (rxStatusFilter) {
    rxStatusFilter.addEventListener("change", () => {
      const pets = getPetsList();
      renderPrescriptionsForCurrentPet(pets);
    });
  }

  // Khởi động dữ liệu ban đầu
  let pets = getPetsList();
  renderPetSwitcher(pets);
  renderPrescriptionsForCurrentPet(pets);

  // Thử đồng bộ từ MongoDB nếu có
  fetchPetsFromDatabase().then((dbPets) => {
    if (dbPets && dbPets.length > 0) {
      pets = dbPets;
      renderPetSwitcher(pets);
      renderPrescriptionsForCurrentPet(pets);
    }
  });
}
