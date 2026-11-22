/* ============================================================
   cage-management.js
   Sprint 4: Task 1 - Cage List & Status
   - Quản lý danh sách chuồng phòng khám & theo dõi trạng thái từng chuồng:
     + Mã chuồng, kích cỡ (nhỏ, vừa, lớn), giá theo ngày, trạng thái
     + Nhãn màu trạng thái: available (trống), occupied (đang dùng), maintenance (bảo trì)
     + Thêm, sửa, xóa chuồng & lọc theo trạng thái/kích cỡ
     + RÀNG BUỘC: Chuồng đang occupied KHÔNG ĐƯỢC XÓA!
     + Trạng thái tự cập nhật khi Check-in/Check-out, nhân viên chỉ chỉnh tay khi chuyển sang/ra khỏi maintenance.
   ============================================================ */

import {
  getHotelCages,
  setHotelCages,
  getActiveStayForCage,
  showHotelToast,
  formatVND,
} from "./hotel-data.js";
import { escapeHTML } from "./storage.js";

export function initCageManagementPage() {
  const container = document.getElementById("cageManagementPage");
  if (!container) return; // Không ở trang Quản lý chuồng

  const cageGrid = document.getElementById("cageGrid");
  const searchInput = document.getElementById("cageSearchInput");
  const filterStatus = document.getElementById("filterCageStatus");
  const filterSize = document.getElementById("filterCageSize");

  // KPI elements
  const statTotal = document.getElementById("statTotalCages");
  const statAvailable = document.getElementById("statAvailableCages");
  const statOccupied = document.getElementById("statOccupiedCages");
  const statMaintenance = document.getElementById("statMaintenanceCages");

  // Modal elements
  const btnOpenAddModal = document.getElementById("btnOpenAddCageModal");
  const cageModal = document.getElementById("cageModal");
  const btnCloseModal = document.getElementById("btnCloseCageModal");
  const btnCancelModal = document.getElementById("btnCancelCageModal");
  const cageForm = document.getElementById("cageForm");
  const modalTitle = document.getElementById("cageModalTitle");
  const formCageId = document.getElementById("formCageId");
  const formCageCode = document.getElementById("formCageCode");
  const formCageName = document.getElementById("formCageName");
  const formCageSize = document.getElementById("formCageSize");
  const formCagePrice = document.getElementById("formCagePrice");
  const formCageStatus = document.getElementById("formCageStatus");
  const formCageDesc = document.getElementById("formCageDesc");

  let cagesData = getHotelCages();

  function updateKPIs(cages) {
    if (!statTotal) return;
    const total = cages.length;
    const available = cages.filter((c) => c.status === "available").length;
    const occupied = cages.filter((c) => c.status === "occupied").length;
    const maintenance = cages.filter((c) => c.status === "maintenance").length;

    statTotal.textContent = total;
    statAvailable.textContent = available;
    statOccupied.textContent = occupied;
    statMaintenance.textContent = maintenance;
  }

  function getStatusBadge(status) {
    switch (status) {
      case "available":
        return `<span class="cage-badge-status available"><span class="status-dot"></span>Trống (Available)</span>`;
      case "occupied":
        return `<span class="cage-badge-status occupied"><span class="status-dot"></span>Đang dùng (Occupied)</span>`;
      case "maintenance":
        return `<span class="cage-badge-status maintenance"><span class="status-dot"></span>Bảo trì (Maintenance)</span>`;
      default:
        return `<span class="cage-badge-status available"><span class="status-dot"></span>${escapeHTML(status)}</span>`;
    }
  }

  function renderCages() {
    cagesData = getHotelCages();
    updateKPIs(cagesData);

    const query = (searchInput?.value || "").trim().toLowerCase();
    const statusVal = filterStatus?.value || "all";
    const sizeVal = filterSize?.value || "all";

    const filtered = cagesData.filter((c) => {
      const matchSearch =
        !query ||
        c.code.toLowerCase().includes(query) ||
        c.name.toLowerCase().includes(query) ||
        (c.sizeLabel && c.sizeLabel.toLowerCase().includes(query));

      const matchStatus = statusVal === "all" || c.status === statusVal;
      const matchSize = sizeVal === "all" || c.size === sizeVal;

      return matchSearch && matchStatus && matchSize;
    });

    if (filtered.length === 0) {
      cageGrid.innerHTML = `
        <div class="cage-empty-state">
          <div class="cage-empty-icon">🏨</div>
          <h4>Không tìm thấy chuồng nào</h4>
          <p>Không có kết quả khớp với bộ lọc tìm kiếm. Hãy thử đổi trạng thái hoặc kích cỡ.</p>
        </div>
      `;
      return;
    }

    cageGrid.innerHTML = filtered
      .map((c) => {
        const isOccupied = c.status === "occupied";
        const isMaintenance = c.status === "maintenance";
        const stayInfo = isOccupied ? getActiveStayForCage(c.id) : null;

        let guestSnippetHtml = "";
        if (isOccupied && stayInfo) {
          guestSnippetHtml = `
            <div class="cage-guest-snippet">
              <div class="cage-guest-header">
                <span class="cage-guest-name">🐾 ${escapeHTML(stayInfo.petName)} (${escapeHTML(stayInfo.petBreed)})</span>
                <span style="font-size:11px; color:#B25000; font-weight:700;">Đang lưu</span>
              </div>
              <div class="cage-guest-detail">
                Chủ nuôi: <strong>${escapeHTML(stayInfo.customerName)}</strong> - ${escapeHTML(stayInfo.customerPhone)}
              </div>
              <div class="cage-guest-time">
                Vào: <strong>${escapeHTML(stayInfo.checkInDate)}</strong> → Dự kiến ra: <strong>${escapeHTML(stayInfo.expectedCheckOutDate)}</strong>
              </div>
            </div>
          `;
        }

        const maintToggleText = isMaintenance ? "Mở hoạt động" : "Bảo trì";
        const maintToggleIcon = isMaintenance ? "🔄" : "🛠️";

        return `
          <div class="cage-card status-${escapeHTML(c.status)}" data-cage-id="${escapeHTML(c.id)}">
            <div class="cage-card-header">
              <div>
                <span class="cage-card-code">${escapeHTML(c.code)}</span>
                <h4 class="cage-card-title">${escapeHTML(c.name)}</h4>
              </div>
              ${getStatusBadge(c.status)}
            </div>

            <div class="cage-specs-row">
              <span class="cage-spec-pill">📐 ${escapeHTML(c.sizeLabel || c.size)}</span>
              ${c.lastCleaned ? `<span class="cage-spec-pill" style="font-size:11px;">✨ VS: ${escapeHTML(c.lastCleaned.split(" ")[0])}</span>` : ""}
            </div>

            <div class="cage-price-banner">
              <span class="cage-price-amount">${formatVND(c.price)}</span>
              <span class="cage-price-unit">/ ngày</span>
            </div>

            <p class="cage-desc">${escapeHTML(c.description || "Đầy đủ tiện nghi, khử khuẩn định kỳ an toàn tuyệt đối cho bé cưng.")}</p>

            ${guestSnippetHtml}

            <div class="cage-actions-row">
              <button type="button" class="btn-cage-action btn-edit-cage" data-id="${escapeHTML(c.id)}" title="Chỉnh sửa thông tin">
                ✏️ Sửa
              </button>

              ${
                !isOccupied
                  ? `<button type="button" class="btn-cage-action btn-toggle-maint" data-id="${escapeHTML(c.id)}" data-current-status="${escapeHTML(c.status)}" title="Đổi trạng thái bảo trì/sẵn sàng">
                      ${maintToggleIcon} ${maintToggleText}
                    </button>`
                  : `<button type="button" class="btn-cage-action btn-toggle-maint" disabled title="Chuồng đang có bé lưu trú, không thể bảo trì">
                      🔒 Đang dùng
                    </button>`
              }

              <button type="button" 
                      class="btn-cage-action btn-delete btn-delete-cage" 
                      data-id="${escapeHTML(c.id)}" 
                      ${isOccupied ? `disabled title="Chuồng đang có thú cưng lưu trú (Occupied) - Nghiêm cấm xóa!"` : `title="Xóa chuồng này"`}>
                🗑️
              </button>
            </div>
          </div>
        `;
      })
      .join("");

    attachCardEvents();
  }

  function attachCardEvents() {
    // Sửa chuồng
    cageGrid.querySelectorAll(".btn-edit-cage").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        openEditCageModal(id);
      });
    });

    // Chuyển / Thoát Bảo trì
    cageGrid.querySelectorAll(".btn-toggle-maint").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (btn.disabled) return;
        const id = btn.getAttribute("data-id");
        toggleMaintenanceStatus(id);
      });
    });

    // Xóa chuồng
    cageGrid.querySelectorAll(".btn-delete-cage").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        handleDeleteCage(id);
      });
    });
  }

  function toggleMaintenanceStatus(cageId) {
    const list = getHotelCages();
    const target = list.find((c) => c.id === cageId);
    if (!target) return;

    if (target.status === "occupied") {
      showHotelToast("Chuồng đang có thú cưng lưu trú, không thể chuyển sang bảo trì!", "warning");
      return;
    }

    if (target.status === "maintenance") {
      target.status = "available";
      showHotelToast(`Đã mở lại hoạt động cho ${target.code}!`, "success");
    } else {
      target.status = "maintenance";
      showHotelToast(`Đã chuyển ${target.code} sang trạng thái Bảo trì.`, "success");
    }

    setHotelCages(list);
    renderCages();
  }

  function handleDeleteCage(cageId) {
    const list = getHotelCages();
    const target = list.find((c) => c.id === cageId);
    if (!target) return;

    // RÀNG BUỘC NGHIỆP VỤ QUAN TRỌNG:
    // Chuồng đang occupied KHÔNG ĐƯỢC XÓA!
    if (target.status === "occupied") {
      showHotelToast(`Chuồng ${target.code} đang có thú cưng lưu trú (Occupied). Nghiêm cấm xóa!`, "error");
      return;
    }

    if (confirm(`Bạn có chắc chắn muốn xóa chuồng "${target.name} (${target.code})"? Hành động này không thể hoàn tác.`)) {
      const updated = list.filter((c) => c.id !== cageId);
      setHotelCages(updated);
      showHotelToast(`Đã xóa thành công chuồng ${target.code}!`, "success");
      renderCages();
    }
  }

  function openAddCageModal() {
    formCageId.value = "";
    formCageCode.value = "CAGE-" + Math.floor(100 + Math.random() * 900);
    formCageName.value = "";
    formCageSize.value = "medium";
    formCagePrice.value = "200000";
    formCageStatus.value = "available";
    formCageDesc.value = "";
    modalTitle.textContent = "Thêm Chuồng Lưu Trú Mới";
    cageModal.classList.add("open");
  }

  function openEditCageModal(cageId) {
    const list = getHotelCages();
    const cage = list.find((c) => c.id === cageId);
    if (!cage) return;

    formCageId.value = cage.id;
    formCageCode.value = cage.code;
    formCageName.value = cage.name;
    formCageSize.value = cage.size;
    formCagePrice.value = cage.price;
    formCageStatus.value = cage.status;
    formCageDesc.value = cage.description || "";

    // Nếu đang occupied, vô hiệu hóa việc đổi status sang available hoặc maintenance trong modal
    if (cage.status === "occupied") {
      formCageStatus.innerHTML = `<option value="occupied" selected>Đang dùng (Occupied - Hệ thống quản lý)</option>`;
      formCageStatus.disabled = true;
    } else {
      formCageStatus.innerHTML = `
        <option value="available">Trống (Available)</option>
        <option value="maintenance">Bảo trì (Maintenance)</option>
      `;
      formCageStatus.disabled = false;
      formCageStatus.value = cage.status;
    }

    modalTitle.textContent = `Chỉnh Sửa Chuồng ${cage.code}`;
    cageModal.classList.add("open");
  }

  function closeModal() {
    cageModal.classList.remove("open");
  }

  // Submit form thêm/sửa
  cageForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const id = formCageId.value.trim();
    const code = formCageCode.value.trim();
    const name = formCageName.value.trim();
    const size = formCageSize.value;
    const price = parseInt(formCagePrice.value, 10);
    const desc = formCageDesc.value.trim();

    if (!code || !name || isNaN(price) || price <= 0) {
      showHotelToast("Vui lòng điền đầy đủ mã chuồng, tên chuồng và giá hợp lệ!", "warning");
      return;
    }

    let sizeLabel = "Vừa (5kg - 15kg)";
    if (size === "small") sizeLabel = "Nhỏ (Dưới 5kg)";
    if (size === "large") sizeLabel = "Lớn (Trên 15kg)";

    const list = getHotelCages();

    if (id) {
      // Sửa
      const idx = list.findIndex((c) => c.id === id);
      if (idx >= 0) {
        const existing = list[idx];
        const newStatus = existing.status === "occupied" ? "occupied" : formCageStatus.value;
        list[idx] = {
          ...existing,
          code,
          name,
          size,
          sizeLabel,
          price,
          status: newStatus,
          description: desc,
        };
        setHotelCages(list);
        showHotelToast(`Cập nhật thông tin chuồng ${code} thành công!`, "success");
      }
    } else {
      // Thêm mới
      // Kiểm tra trùng mã
      if (list.some((c) => c.code.toLowerCase() === code.toLowerCase())) {
        showHotelToast(`Mã chuồng "${code}" đã tồn tại! Vui lòng chọn mã khác.`, "warning");
        return;
      }

      const newCage = {
        id: "CAGE_" + Date.now(),
        code,
        name,
        size,
        sizeLabel,
        price,
        status: formCageStatus.value || "available",
        description: desc,
        lastCleaned: new Date().toISOString().replace("T", " ").substring(0, 16),
      };
      list.push(newCage);
      setHotelCages(list);
      showHotelToast(`Thêm chuồng mới ${code} thành công!`, "success");
    }

    closeModal();
    renderCages();
  });

  // Sự kiện bộ lọc & tìm kiếm
  if (searchInput) searchInput.addEventListener("input", renderCages);
  if (filterStatus) filterStatus.addEventListener("change", renderCages);
  if (filterSize) filterSize.addEventListener("change", renderCages);

  // Sự kiện mở/đóng modal
  if (btnOpenAddModal) btnOpenAddModal.addEventListener("click", openAddCageModal);
  if (btnCloseModal) btnCloseModal.addEventListener("click", closeModal);
  if (btnCancelModal) btnCancelModal.addEventListener("click", closeModal);

  // Render lần đầu
  renderCages();
}
