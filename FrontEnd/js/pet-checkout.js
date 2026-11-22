/* ============================================================
   pet-checkout.js
   Sprint 4: Task 3 - Pet Check-out & Boarding History
   - Cho phép nhân viên trả thú cưng cho khách khi kết thúc lưu chuồng.
   - Nhân viên chọn lượt đang checked_in:
     + Hệ thống ghi ngày trả thực tế
     + Tình trạng sức khỏe lúc trả (healthNote khi trả)
     + Tự tính số ngày lưu cùng tổng tiền (số ngày × giá chuồng, tối thiểu 1 ngày) để dùng cho hóa đơn.
   - RÀNG BUỘC: Chỉ lượt đang checked_in mới check-out được và không check-out hai lần.
   - Check-out thành công: lượt chuyển sang checked_out và chuồng tự chuyển về available.
   - Xem lịch sử lưu chuồng (các lượt checked_out), có thể lọc theo khách hoặc thú cưng.
   - In hóa đơn / xuất phiếu thanh toán Pawmily tiêu chuẩn.
   ============================================================ */

import {
  getHotelStays,
  setHotelStays,
  getHotelCages,
  setHotelCages,
  getHotelCustomers,
  calculateStayDurationAndFee,
  showHotelToast,
  formatVND,
} from "./hotel-data.js";
import { escapeHTML } from "./storage.js";

export function initPetCheckOutPage() {
  const container = document.getElementById("petCheckOutPage");
  if (!container) return; // Không ở trang Pet Check-out

  // View switcher buttons
  const btnTabActive = document.getElementById("btnTabActiveStays");
  const btnTabHistory = document.getElementById("btnTabHistoryStays");
  const sectionActive = document.getElementById("sectionActiveStays");
  const sectionHistory = document.getElementById("sectionHistoryStays");

  // Counter badges
  const badgeActiveCount = document.getElementById("badgeActiveCount");
  const badgeHistoryCount = document.getElementById("badgeHistoryCount");

  // Active Stays elements
  const activeStaysGrid = document.getElementById("activeStaysGrid");

  // History Stays elements
  const historyTableBody = document.getElementById("historyTableBody");
  const historyCustomerFilter = document.getElementById("historyCustomerFilter");
  const historyPetFilter = document.getElementById("historyPetFilter");
  const historySearchInput = document.getElementById("historySearchInput");

  // Modal Check-out elements
  const checkoutModal = document.getElementById("checkoutModal");
  const btnCloseCheckoutModal = document.getElementById("btnCloseCheckoutModal");
  const btnCancelCheckoutModal = document.getElementById("btnCancelCheckoutModal");
  const checkoutForm = document.getElementById("checkoutForm");

  const checkoutStayId = document.getElementById("checkoutStayId");
  const checkoutPetName = document.getElementById("checkoutPetName");
  const checkoutCustomer = document.getElementById("checkoutCustomer");
  const checkoutCage = document.getElementById("checkoutCage");
  const checkoutDateIn = document.getElementById("checkoutDateIn");
  const checkoutDateOutActual = document.getElementById("checkoutDateOutActual");
  const checkoutHealthNote = document.getElementById("checkoutHealthNote");

  // Calculation in modal
  const calcRatePerDay = document.getElementById("calcRatePerDay");
  const calcDays = document.getElementById("calcDays");
  const calcTotalAmount = document.getElementById("calcTotalAmount");

  // Modal Invoice elements
  const invoiceModal = document.getElementById("invoiceModal");
  const btnCloseInvoiceModal = document.getElementById("btnCloseInvoiceModal");
  const btnPrintInvoice = document.getElementById("btnPrintInvoice");
  const invoiceSheetContainer = document.getElementById("invoiceSheetContainer");

  let currentOperatingStay = null;

  function updateCounts() {
    const stays = getHotelStays();
    const activeCount = stays.filter((s) => s.status === "checked_in").length;
    const historyCount = stays.filter((s) => s.status === "checked_out").length;

    if (badgeActiveCount) badgeActiveCount.textContent = activeCount;
    if (badgeHistoryCount) badgeHistoryCount.textContent = historyCount;
  }

  // Chuyển đổi giữa 2 tab: Đang lưu trú & Lịch sử
  function switchView(tab) {
    if (tab === "active") {
      btnTabActive.classList.add("active");
      btnTabHistory.classList.remove("active");
      sectionActive.style.display = "block";
      sectionHistory.style.display = "none";
      renderActiveStays();
    } else {
      btnTabActive.classList.remove("active");
      btnTabHistory.classList.add("active");
      sectionActive.style.display = "none";
      sectionHistory.style.display = "block";
      populateHistoryFilters();
      renderHistoryStays();
    }
  }

  // ===== 1. RENDER ACTIVE STAYS (ĐANG LƯU CHUỒNG) =====
  function renderActiveStays() {
    const stays = getHotelStays();
    const activeList = stays.filter((s) => s.status === "checked_in");
    updateCounts();

    if (activeList.length === 0) {
      activeStaysGrid.innerHTML = `
        <div class="cage-empty-state" style="grid-column: 1 / -1;">
          <div class="cage-empty-icon">🏖️</div>
          <h4>Hiện Không Có Bé Cưng Nào Đang Lưu Trú</h4>
          <p>Tất cả bé cưng đã được đón về hoặc chưa có lượt check-in mới nào.</p>
          <a href="./pet-checkin.html" class="btn-proceed-checkout" style="width:auto; display:inline-flex; margin-top:14px; text-decoration:none;">
            + Tiếp nhận thú cưng mới (Check-in)
          </a>
        </div>
      `;
      return;
    }

    activeStaysGrid.innerHTML = activeList
      .map((s) => {
        return `
          <div class="stay-card" data-stay-id="${escapeHTML(s.id)}">
            <div>
              <div class="stay-card-header">
                <div>
                  <span class="stay-card-code">${escapeHTML(s.code || s.id)}</span>
                  <h4 class="stay-pet-name">🐾 ${escapeHTML(s.petName)}</h4>
                  <span style="font-size:12px; color:var(--ink-faint);">${escapeHTML(s.petSpecies || "Thú cưng")} - ${escapeHTML(s.petBreed || "Chưa rõ giống")}</span>
                </div>
                <span class="stay-badge-active">Đang Lưu Chuồng</span>
              </div>

              <div class="stay-info-box">
                <div class="stay-info-row">
                  <span>Chủ nuôi:</span>
                  <strong>${escapeHTML(s.customerName)} (${escapeHTML(s.customerPhone)})</strong>
                </div>
                <div class="stay-info-row">
                  <span>Chuồng:</span>
                  <strong>${escapeHTML(s.cageName)}</strong>
                </div>
                <div class="stay-info-row">
                  <span>Đơn giá:</span>
                  <strong>${formatVND(s.pricePerDay)}/ngày</strong>
                </div>
                <div class="stay-info-row">
                  <span>Ngày vào:</span>
                  <strong>${escapeHTML(s.checkInDate)}</strong>
                </div>
                <div class="stay-info-row">
                  <span>Dự kiến trả:</span>
                  <strong>${escapeHTML(s.expectedCheckOutDate)}</strong>
                </div>
              </div>

              <div class="stay-text-block">
                <strong>🎒 Tư trang:</strong> ${escapeHTML(s.belongings || "Không có")}
              </div>

              <div class="stay-text-block">
                <strong>🩺 Sức khỏe lúc nhận:</strong> ${escapeHTML(s.healthNote || "Bình thường")}
              </div>
            </div>

            <button type="button" class="btn-proceed-checkout btn-open-checkout" data-id="${escapeHTML(s.id)}">
              <span>📤</span>
              <span>Thực Hiện Trả Bé (Check-out)</span>
            </button>
          </div>
        `;
      })
      .join("");

    // Gắn sự kiện click mở modal checkout
    activeStaysGrid.querySelectorAll(".btn-open-checkout").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        openCheckoutModal(id);
      });
    });
  }

  // ===== 2. MỞ MODAL CHECK-OUT & TÍNH TOÁN TIỀN TỰ ĐỘNG =====
  function openCheckoutModal(stayId) {
    const stays = getHotelStays();
    const stay = stays.find((s) => s.id === stayId);

    // RÀNG BUỘC: Chỉ lượt đang checked_in mới check-out được!
    if (!stay || stay.status !== "checked_in") {
      showHotelToast("Lượt lưu trú này không ở trạng thái sẵn sàng để Check-out!", "error");
      return;
    }

    currentOperatingStay = stay;

    checkoutStayId.value = stay.id;
    checkoutPetName.textContent = `${stay.petName} (${stay.petBreed || "Thú cưng"})`;
    checkoutCustomer.textContent = `${stay.customerName} - ${stay.customerPhone}`;
    checkoutCage.textContent = `${stay.cageName} (${formatVND(stay.pricePerDay)}/ngày)`;
    checkoutDateIn.textContent = stay.checkInDate;

    // Mặc định ngày trả thực tế = ngày hôm nay (hoặc ngày dự kiến trả nếu hôm nay nhỏ hơn)
    const todayStr = new Date().toISOString().split("T")[0];
    checkoutDateOutActual.value = todayStr > stay.checkInDate ? todayStr : stay.expectedCheckOutDate;

    checkoutHealthNote.value = "Bé khỏe mạnh, ăn uống bình thường, tinh thần hoạt bát, bàn giao đủ tư trang đồ dùng.";

    recalculateModalBill();
    checkoutModal.classList.add("open");
  }

  function recalculateModalBill() {
    if (!currentOperatingStay) return;

    const actualDateOut = checkoutDateOutActual.value;
    const dateIn = currentOperatingStay.checkInDate;
    const price = currentOperatingStay.pricePerDay;

    // Tự động tính số ngày lưu cùng tổng tiền (số ngày × giá chuồng, tối thiểu 1 ngày)
    let days = 1;
    if (actualDateOut && dateIn) {
      const parseDate = (str) => {
        if (str.includes("/")) {
          const parts = str.split("/");
          return new Date(parts[2], parts[1] - 1, parts[0]);
        }
        return new Date(str);
      };
      const d1 = parseDate(dateIn);
      const d2 = parseDate(actualDateOut);
      d1.setHours(0, 0, 0, 0);
      d2.setHours(0, 0, 0, 0);
      const diffMs = d2.getTime() - d1.getTime();
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      days = Math.max(1, diffDays); // Tối thiểu 1 ngày theo đúng yêu cầu
    }

    const total = days * price;

    if (calcRatePerDay) calcRatePerDay.textContent = formatVND(price);
    if (calcDays) calcDays.textContent = `${days} ngày`;
    if (calcTotalAmount) calcTotalAmount.textContent = formatVND(total);
  }

  checkoutDateOutActual.addEventListener("change", recalculateModalBill);

  function closeCheckoutModal() {
    checkoutModal.classList.remove("open");
    currentOperatingStay = null;
  }

  if (btnCloseCheckoutModal) btnCloseCheckoutModal.addEventListener("click", closeCheckoutModal);
  if (btnCancelCheckoutModal) btnCancelCheckoutModal.addEventListener("click", closeCheckoutModal);

  // ===== 3. XÁC NHẬN CHECK-OUT =====
  checkoutForm.addEventListener("submit", (e) => {
    e.preventDefault();

    if (!currentOperatingStay) return;

    const stayId = checkoutStayId.value;
    const stays = getHotelStays();
    const stayIdx = stays.findIndex((s) => s.id === stayId);

    if (stayIdx === -1) {
      showHotelToast("Không tìm thấy dữ liệu lượt lưu chuồng!", "error");
      return;
    }

    const stay = stays[stayIdx];

    // RÀNG BUỘC QUAN TRỌNG:
    // "Chỉ lượt đang checked_in mới check-out được và không check-out hai lần."
    if (stay.status === "checked_out") {
      showHotelToast("Lượt này đã được check-out trước đó. Nghiêm cấm check-out lặp hai lần!", "error");
      closeCheckoutModal();
      return;
    }

    if (stay.status !== "checked_in") {
      showHotelToast("Lượt lưu chuồng không hợp lệ để trả bé!", "error");
      closeCheckoutModal();
      return;
    }

    const actualDateOut = checkoutDateOutActual.value || new Date().toISOString().split("T")[0];
    const returnHealthNote = checkoutHealthNote.value.trim() || "Bé bình thường, khỏe mạnh khi xuất chuồng.";

    // Tính toán số ngày và tổng tiền chính xác
    const parseDate = (str) => {
      if (str.includes("/")) {
        const parts = str.split("/");
        return new Date(parts[2], parts[1] - 1, parts[0]);
      }
      return new Date(str);
    };
    const d1 = parseDate(stay.checkInDate);
    const d2 = parseDate(actualDateOut);
    d1.setHours(0, 0, 0, 0);
    d2.setHours(0, 0, 0, 0);
    const diffMs = d2.getTime() - d1.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    const totalDays = Math.max(1, diffDays); // Tối thiểu 1 ngày
    const totalFee = totalDays * stay.pricePerDay;

    // 1. CẬP NHẬT LƯỢT LƯU TRÚ SANG 'checked_out'
    stay.status = "checked_out";
    stay.actualCheckOutDate = actualDateOut;
    stay.checkoutHealthNote = returnHealthNote;
    stay.totalDays = totalDays;
    stay.totalFee = totalFee;
    stay.checkedOutAt = new Date().toISOString();

    stays[stayIdx] = stay;
    setHotelStays(stays);

    // 2. TỰ ĐỘNG CHUYỂN CHUỒNG VỀ 'available'
    const cages = getHotelCages();
    const cageIdx = cages.findIndex((c) => c.id === stay.cageId);
    if (cageIdx >= 0) {
      cages[cageIdx].status = "available";
      cages[cageIdx].lastCleaned = new Date().toISOString().replace("T", " ").substring(0, 16);
      setHotelCages(cages);
    }

    // 3. THÔNG BÁO THÀNH CÔNG & MỞ HÓA ĐƠN
    showHotelToast(`Check-out thành công cho bé ${stay.petName}! Chuồng ${cages[cageIdx]?.code || ""} đã được giải phóng (Available).`, "success");

    closeCheckoutModal();
    renderActiveStays();
    updateCounts();

    // Mở phiếu hóa đơn in thanh toán
    openInvoiceModal(stay);
  });

  // ===== 4. POPULATE & RENDER LỊCH SỬ LƯU CHUỒNG =====
  function populateHistoryFilters() {
    const stays = getHotelStays();
    const historyList = stays.filter((s) => s.status === "checked_out");

    // Lọc danh sách khách hàng duy nhất trong lịch sử
    const uniqueCustomers = Array.from(new Set(historyList.map((s) => JSON.stringify({ id: s.customerId, name: s.customerName }))))
      .map((str) => JSON.parse(str));

    historyCustomerFilter.innerHTML = `<option value="all">Tất cả khách hàng</option>` +
      uniqueCustomers
        .map((c) => `<option value="${escapeHTML(c.id)}">${escapeHTML(c.name)}</option>`)
        .join("");

    // Lọc danh sách thú cưng duy nhất trong lịch sử
    const uniquePets = Array.from(new Set(historyList.map((s) => JSON.stringify({ id: s.petId, name: s.petName }))))
      .map((str) => JSON.parse(str));

    historyPetFilter.innerHTML = `<option value="all">Tất cả thú cưng</option>` +
      uniquePets
        .map((p) => `<option value="${escapeHTML(p.id)}">${escapeHTML(p.name)}</option>`)
        .join("");
  }

  function renderHistoryStays() {
    const stays = getHotelStays();
    const historyList = stays.filter((s) => s.status === "checked_out");
    updateCounts();

    const selectedCust = historyCustomerFilter?.value || "all";
    const selectedPet = historyPetFilter?.value || "all";
    const query = (historySearchInput?.value || "").trim().toLowerCase();

    const filtered = historyList.filter((s) => {
      const matchCust = selectedCust === "all" || s.customerId === selectedCust;
      const matchPet = selectedPet === "all" || s.petId === selectedPet;
      const matchSearch =
        !query ||
        s.petName.toLowerCase().includes(query) ||
        s.customerName.toLowerCase().includes(query) ||
        s.cageName.toLowerCase().includes(query) ||
        (s.code && s.code.toLowerCase().includes(query));

      return matchCust && matchPet && matchSearch;
    });

    if (filtered.length === 0) {
      historyTableBody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align:center; padding:36px; color:var(--ink-faint);">
            <div style="font-size:32px; margin-bottom:8px;">📜</div>
            <strong>Chưa có dữ liệu lịch sử lưu chuồng</strong>
            <p style="font-size:12.5px; margin-top:4px;">Không tìm thấy đợt lưu chuồng nào phù hợp với bộ lọc hiện tại.</p>
          </td>
        </tr>
      `;
      return;
    }

    historyTableBody.innerHTML = filtered
      .map((s) => {
        return `
          <tr>
            <td>
              <span style="font-family:var(--font-body); font-weight:700; color:var(--espresso);">${escapeHTML(s.code || s.id)}</span>
            </td>
            <td>
              <div class="history-pet-cell">
                <span>🐾</span>
                <div>
                  <strong>${escapeHTML(s.petName)}</strong>
                  <div style="font-size:11.5px; color:var(--ink-faint);">${escapeHTML(s.petSpecies || "Thú cưng")} - ${escapeHTML(s.petBreed || "")}</div>
                </div>
              </div>
            </td>
            <td>
              <strong>${escapeHTML(s.customerName)}</strong>
              <div style="font-size:11.5px; color:var(--ink-faint);">${escapeHTML(s.customerPhone)}</div>
            </td>
            <td>
              <span>${escapeHTML(s.cageName)}</span>
              <div style="font-size:11.5px; color:var(--ink-faint);">${formatVND(s.pricePerDay)}/ngày</div>
            </td>
            <td>
              <div>${escapeHTML(s.checkInDate)} → <strong>${escapeHTML(s.actualCheckOutDate || s.expectedCheckOutDate)}</strong></div>
              <div style="font-size:11.5px; color:var(--sage-green); font-weight:700;">${s.totalDays || 1} ngày lưu trú</div>
            </td>
            <td>
              <span class="history-fee">${formatVND(s.totalFee || 0)}</span>
              <span class="stay-badge-completed" style="display:inline-block; margin-top:4px; font-size:10.5px;">Đã thanh toán</span>
            </td>
            <td>
              <button type="button" class="btn-view-bill btn-open-invoice" data-id="${escapeHTML(s.id)}">
                📄 Xem Phiếu
              </button>
            </td>
          </tr>
        `;
      })
      .join("");

    historyTableBody.querySelectorAll(".btn-open-invoice").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        const found = historyList.find((item) => item.id === id);
        if (found) {
          openInvoiceModal(found);
        }
      });
    });
  }

  // ===== 5. MODAL HÓA ĐƠN / PHIẾU THANH TOÁN (INVOICE SHEET) =====
  function openInvoiceModal(stay) {
    if (!stay || !invoiceSheetContainer) return;

    invoiceSheetContainer.innerHTML = `
      <div class="invoice-sheet">
        <div class="invoice-brand">
          <h2>PAWNCARE PET CLINIC &amp; HOTEL</h2>
          <p>123 Nguyễn Văn Linh, P. Hải Châu, TP. Đà Nẵng | Hotline: 0900 123 456</p>
          <div style="font-size:16px; font-weight:700; color:var(--espresso); margin-top:8px;">
            PHIẾU THANH TOÁN DỊCH VỤ LƯU CHUỒNG THÚ CƯNG
          </div>
          <span style="font-size:11.5px; color:var(--ink-faint);">Mã giao dịch: ${escapeHTML(stay.code || stay.id)} | Thời gian xuất: ${new Date().toLocaleString("vi-VN")}</span>
        </div>

        <div class="invoice-meta-grid">
          <div>
            <strong>Khách Hàng (Chủ Nuôi):</strong> ${escapeHTML(stay.customerName)}<br>
            <strong>Số điện thoại:</strong> ${escapeHTML(stay.customerPhone)}
          </div>
          <div style="text-align:right;">
            <strong>Bé Cưng:</strong> ${escapeHTML(stay.petName)} (${escapeHTML(stay.petSpecies || "Chó/Mèo")})<br>
            <strong>Giống:</strong> ${escapeHTML(stay.petBreed || "Thú cưng")}
          </div>
        </div>

        <table class="invoice-item-table">
          <thead>
            <tr>
              <th>Dịch Vụ &amp; Loại Phòng</th>
              <th>Đơn Giá / Ngày</th>
              <th>Thời Gian Lưu</th>
              <th>Số Ngày</th>
              <th style="text-align:right;">Thành Tiền</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <strong>Lưu Chuồng Nghỉ Dưỡng 5 Sao</strong><br>
                <span style="font-size:11.5px; color:var(--ink-faint);">${escapeHTML(stay.cageName)}</span>
              </td>
              <td>${formatVND(stay.pricePerDay)}</td>
              <td>${escapeHTML(stay.checkInDate)} → ${escapeHTML(stay.actualCheckOutDate || stay.expectedCheckOutDate)}</td>
              <td><strong>${stay.totalDays || 1} ngày</strong></td>
              <td style="text-align:right; font-weight:700;">${formatVND(stay.totalFee || 0)}</td>
            </tr>
          </tbody>
        </table>

        <div style="background:var(--cream-soft); padding:10px 14px; border-radius:var(--radius-md); font-size:12px; margin-bottom:14px;">
          <div><strong>🎒 Tư trang hoàn trả:</strong> ${escapeHTML(stay.belongings || "Không có")}</div>
          <div style="margin-top:4px;"><strong>🩺 Thể trạng lúc trả:</strong> ${escapeHTML(stay.checkoutHealthNote || "Bé bình thường, sức khỏe tốt")}</div>
        </div>

        <div class="invoice-total-row">
          <span>TỔNG CỘNG THANH TOÁN:</span>
          <span>${formatVND(stay.totalFee || 0)}</span>
        </div>

        <div style="text-align:center; font-size:12px; color:var(--ink-faint); margin-top:20px;">
          Pawmily cảm ơn ba mẹ đã tin tưởng gửi gắm bé cưng tại PawnCare Đà Nẵng! 🐾
        </div>
      </div>
    `;

    invoiceModal.classList.add("open");
  }

  function closeInvoiceModal() {
    invoiceModal.classList.remove("open");
  }

  if (btnCloseInvoiceModal) btnCloseInvoiceModal.addEventListener("click", closeInvoiceModal);
  if (btnPrintInvoice) {
    btnPrintInvoice.addEventListener("click", () => {
      window.print();
    });
  }

  // Sự kiện tab
  btnTabActive.addEventListener("click", () => switchView("active"));
  btnTabHistory.addEventListener("click", () => switchView("history"));

  // Sự kiện bộ lọc lịch sử
  if (historyCustomerFilter) historyCustomerFilter.addEventListener("change", renderHistoryStays);
  if (historyPetFilter) historyPetFilter.addEventListener("change", renderHistoryStays);
  if (historySearchInput) historySearchInput.addEventListener("input", renderHistoryStays);

  // Render khởi tạo (Mặc định ở tab Active)
  switchView("active");
}
