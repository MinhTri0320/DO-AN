/* ============================================================
   invoice-payment.js
   Sprint 4: Invoice & Payment (Toàn phụ trách)
   1. Giao diện Invoice: danh sách, chi tiết hóa đơn (mục, đơn giá cố định, tổng tiền)
   2. Giao diện Payment: form thanh toán, chọn phương thức cash/transfer
   3. Nhãn trạng thái unpaid/paid, nút thanh toán, thông báo lỗi nếu sai số tiền hoặc thanh toán lại
   ============================================================ */

import {
  apiGetInvoices,
  apiGetInvoiceById,
  apiProcessPayment,
} from "./api.js";
import { getCurrentUser } from "./auth.js";
import { escapeHTML } from "./storage.js";
import { API_BASE_URL } from "./config.js";

let allInvoices = [];
let currentFilterStatus = ""; // "" = all | "unpaid" | "paid"
let currentSearchTerm = "";
let selectedInvoice = null;

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

// 1. TẢI DANH SÁCH HÓA ĐƠN
async function loadInvoices() {
  const tbody = document.getElementById("invoicesTableBody");
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 30px; color: var(--ink-faint);">⌛ Đang tải danh sách hóa đơn...</td></tr>`;

  try {
    const user = getCurrentUser();
    // Fallback cho lễ tân test: dùng ID lễ tân mặc định
    const callerId = user ? (user.id || user._id) : "6b02d69ab16ab5c38159c4ed";

    if (!user) {
      showToast("Vui lòng đăng nhập để xem hóa đơn!", "warning");
      tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 30px; color: #DC2626;">⚠️ Vui lòng <a href="./login.html" style="color: #1E429F; font-weight: 600;">đăng nhập</a> để xem danh sách hóa đơn.</td></tr>`;
      return;
    }

    const options = { userId: callerId };
    if (currentFilterStatus) options.status = currentFilterStatus;

    const res = await apiGetInvoices(options);
    allInvoices = res?.invoices || [];

    updateInvoiceKPIs();
    renderInvoicesTable();
  } catch (err) {
    console.error("Lỗi tải danh sách hóa đơn:", err);
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #DC2626; padding: 30px;">Lỗi tải dữ liệu: ${escapeHTML(err.message)}</td></tr>`;
  }
}

// 2. CẬP NHẬT KPI THỐNG KÊ
function updateInvoiceKPIs() {
  const statTotal = document.getElementById("statTotalInvoices");
  const statUnpaid = document.getElementById("statUnpaidInvoices");
  const statPaid = document.getElementById("statPaidInvoices");
  const statRevenue = document.getElementById("statTotalRevenue");

  let unpaidCount = 0;
  let paidCount = 0;
  let totalRevenue = 0;

  allInvoices.forEach((inv) => {
    if (inv.status === "paid") {
      paidCount++;
      totalRevenue += Number(inv.totalAmount) || 0;
    } else {
      unpaidCount++;
    }
  });

  if (statTotal) statTotal.textContent = allInvoices.length;
  if (statUnpaid) statUnpaid.textContent = unpaidCount;
  if (statPaid) statPaid.textContent = paidCount;
  if (statRevenue) statRevenue.textContent = formatVND(totalRevenue);
}

// 3. RENDER BẢNG HÓA ĐƠN
function renderInvoicesTable() {
  const tbody = document.getElementById("invoicesTableBody");
  const countDisplay = document.getElementById("invoicesCountDisplay");
  if (!tbody) return;

  // Lọc theo tìm kiếm client-side
  let filtered = allInvoices.slice();
  if (currentSearchTerm) {
    const term = currentSearchTerm.toLowerCase();
    filtered = filtered.filter(
      (inv) =>
        (inv.invoiceCode && inv.invoiceCode.toLowerCase().includes(term)) ||
        (inv.customerName && inv.customerName.toLowerCase().includes(term)) ||
        (inv.customerPhone && inv.customerPhone.includes(term)) ||
        (inv.customerId?.name && inv.customerId.name.toLowerCase().includes(term))
    );
  }

  if (countDisplay) countDisplay.textContent = filtered.length;

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 30px; color: var(--ink-faint);">Không tìm thấy hóa đơn nào phù hợp.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered
    .map((inv) => {
      const isPaid = inv.status === "paid";
      const statusBadge = isPaid
        ? `<span class="status-badge-invoice paid">✓ Đã thanh toán (paid)</span>`
        : `<span class="status-badge-invoice unpaid">⏳ Chưa thanh toán (unpaid)</span>`;

      const actionButtons = isPaid
        ? `<button type="button" class="btn-inv-detail" data-id="${inv._id}">📄 Xem chi tiết</button>
           <span class="paid-locked-text">✓ Đã thu tiền</span>`
        : `<button type="button" class="btn-inv-detail" data-id="${inv._id}">📄 Xem chi tiết</button>
           <button type="button" class="btn-inv-pay" data-id="${inv._id}">💳 Thanh toán</button>`;

      const custName = inv.customerName || inv.customerId?.name || "Khách hàng";
      const custPhone = inv.customerPhone || inv.customerId?.phone || "";
      const itemsCount = inv.items ? inv.items.length : 0;
      const createdStr = inv.createdAt ? new Date(inv.createdAt).toLocaleString("vi-VN") : "--";

      return `
        <tr data-id="${escapeHTML(inv._id)}">
          <td>
            <strong style="color: var(--espresso); font-size: 14px;">${escapeHTML(inv.invoiceCode)}</strong>
          </td>
          <td>
            <strong>${escapeHTML(custName)}</strong><br/>
            <small style="color: var(--ink-faint);">${escapeHTML(custPhone)}</small>
          </td>
          <td><strong>${itemsCount}</strong> mục</td>
          <td>
            <strong style="color: #1E429F; font-size: 14.5px;">${formatVND(inv.totalAmount)}</strong>
          </td>
          <td>${statusBadge}</td>
          <td><small style="color: var(--ink-faint);">${createdStr}</small></td>
          <td>${actionButtons}</td>
        </tr>
      `;
    })
    .join("");

  // Gắn sự kiện nút xem chi tiết & thanh toán
  tbody.querySelectorAll(".btn-inv-detail").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-id");
      openInvoiceDetailModal(id);
    });
  });

  tbody.querySelectorAll(".btn-inv-pay").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-id");
      const inv = allInvoices.find((i) => String(i._id) === String(id));
      if (inv) openPaymentModal(inv);
    });
  });
}

// 4. MODAL CHI TIẾT HÓA ĐƠN
async function openInvoiceDetailModal(invoiceId) {
  const modal = document.getElementById("invoiceDetailModal");
  const detailInvCode = document.getElementById("detailInvCode");
  const detailCustomerName = document.getElementById("detailCustomerName");
  const detailCustomerPhone = document.getElementById("detailCustomerPhone");
  const detailCreatedAt = document.getElementById("detailCreatedAt");
  const detailStatusBadge = document.getElementById("detailStatusBadge");
  const detailItemsBody = document.getElementById("detailItemsBody");
  const detailTotalAmount = document.getElementById("detailTotalAmount");
  const detailPaymentInfo = document.getElementById("detailPaymentInfo");
  const detailPaymentContent = document.getElementById("detailPaymentContent");
  const btnPayFromDetail = document.getElementById("btnPayFromDetail");

  if (!modal) return;

  try {
    const res = await apiGetInvoiceById(invoiceId);
    const inv = res?.invoice || allInvoices.find((i) => String(i._id) === String(invoiceId));
    if (!inv) throw new Error("Không tìm thấy thông tin chi tiết hóa đơn.");

    selectedInvoice = inv;

    detailInvCode.textContent = inv.invoiceCode;
    detailCustomerName.textContent = inv.customerName || inv.customerId?.name || "Khách hàng";
    detailCustomerPhone.textContent = inv.customerPhone || inv.customerId?.phone || "Chưa có";
    detailCreatedAt.textContent = inv.createdAt ? new Date(inv.createdAt).toLocaleString("vi-VN") : "--";

    const isPaid = inv.status === "paid";
    detailStatusBadge.innerHTML = isPaid
      ? `<span class="status-badge-invoice paid">✓ Đã thanh toán (paid)</span>`
      : `<span class="status-badge-invoice unpaid">⏳ Chưa thanh toán (unpaid)</span>`;

    // Render danh sách mục với đơn giá cố định tại thời điểm lập
    const items = inv.items || [];
    detailItemsBody.innerHTML = items
      .map(
        (it) => `
        <tr>
          <td><strong>${escapeHTML(it.name || it.itemType || "Thuốc/Dịch vụ")}</strong></td>
          <td>${it.quantity}</td>
          <td>${formatVND(it.unitPrice)}</td>
          <td><strong>${formatVND(it.subtotal || it.unitPrice * it.quantity)}</strong></td>
        </tr>
      `
      )
      .join("");

    detailTotalAmount.textContent = formatVND(inv.totalAmount);

    // Thông tin thanh toán (nếu đã paid)
    if (isPaid) {
      detailPaymentInfo.style.display = "block";
      btnPayFromDetail.style.display = "none";

      try {
        const payRes = await fetch(`${API_BASE_URL}/payments/invoice/${inv._id}`);
        const payData = await payRes.json();
        const p = payData.payment;
        if (p) {
          const methodStr = p.paymentMethod === "cash" ? "💵 Tiền mặt" : "🏦 Chuyển khoản";
          detailPaymentContent.innerHTML = `
            Mã GD: <strong>${escapeHTML(p.paymentCode || "")}</strong> | 
            Số tiền: <strong>${formatVND(p.amount)}</strong> | 
            Phương thức: <strong>${methodStr}</strong> | 
            Thời điểm: <strong>${p.paidAt ? new Date(p.paidAt).toLocaleString("vi-VN") : ""}</strong>
          `;
        } else {
          detailPaymentContent.textContent = "Đã ghi nhận thanh toán đầy đủ.";
        }
      } catch (e) {
        detailPaymentContent.textContent = "Đã ghi nhận thanh toán.";
      }
    } else {
      detailPaymentInfo.style.display = "none";
      btnPayFromDetail.style.display = "inline-flex";
    }

    modal.style.display = "flex";
  } catch (err) {
    showToast(err.message || "Lỗi mở chi tiết hóa đơn.", "error");
  }
}

function closeInvoiceDetailModal() {
  const modal = document.getElementById("invoiceDetailModal");
  if (modal) modal.style.display = "none";
}

// 5. MODAL THANH TOÁN (PAYMENT FORM)
function openPaymentModal(inv) {
  // RÀNG BUỘC: Không thanh toán lại hóa đơn đã paid
  if (inv.status === "paid") {
    showToast("Hóa đơn này đã được thanh toán (paid), không thể thanh toán lại!", "warning");
    return;
  }

  selectedInvoice = inv;

  const modal = document.getElementById("paymentModal");
  const payId = document.getElementById("payInvoiceId");
  const payExpected = document.getElementById("payExpectedAmount");
  const payCode = document.getElementById("paySummaryCode");
  const payCust = document.getElementById("paySummaryCustomer");
  const payTotal = document.getElementById("paySummaryTotal");
  const payInput = document.getElementById("payInputAmount");
  const alertBox = document.getElementById("paymentAlertBox");

  if (!modal) return;

  alertBox.style.display = "none";
  alertBox.innerHTML = "";

  payId.value = inv._id;
  payExpected.value = inv.totalAmount;
  payCode.textContent = inv.invoiceCode;
  payCust.textContent = `${inv.customerName || inv.customerId?.name || "Khách hàng"} (${inv.customerPhone || ""})`;
  payTotal.textContent = formatVND(inv.totalAmount);

  // Mặc định điền đúng số tiền hóa đơn
  payInput.value = inv.totalAmount;

  modal.style.display = "flex";
}

function closePaymentModal() {
  const modal = document.getElementById("paymentModal");
  if (modal) modal.style.display = "none";
}

// 6. XỬ LÝ THANH TOÁN (SUBMIT PAYMENT FORM)
async function handleProcessPayment(e) {
  e.preventDefault();

  const alertBox = document.getElementById("paymentAlertBox");
  alertBox.style.display = "none";
  alertBox.innerHTML = "";

  if (!selectedInvoice) return;

  // Kiểm tra trạng thái: Không thanh toán lại
  if (selectedInvoice.status === "paid") {
    alertBox.style.display = "flex";
    alertBox.innerHTML = "<span>🚫</span> <span>Hóa đơn này đã được thanh toán rồi, không thể thanh toán lại!</span>";
    return;
  }

  const expectedAmount = Number(document.getElementById("payExpectedAmount").value);
  const inputAmount = Number(document.getElementById("payInputAmount").value);
  const methodRadios = document.getElementsByName("paymentMethod");
  let paymentMethod = "cash";
  for (const r of methodRadios) {
    if (r.checked) {
      paymentMethod = r.value;
      break;
    }
  }
  const note = document.getElementById("payInputNote").value.trim();
  const btnSubmit = document.getElementById("btnSubmitPayment");

  // RÀNG BUỘC THEO ĐỀ BÀI:
  // "Số tiền phải bằng tổng tiền hóa đơn (chưa hỗ trợ trả góp)"
  if (inputAmount !== expectedAmount) {
    alertBox.style.display = "flex";
    alertBox.innerHTML = `<span>⚠️</span> <span><strong>Số tiền không hợp lệ!</strong> Số tiền thanh toán phải bằng chính xác tổng tiền hóa đơn: <strong>${formatVND(expectedAmount)}</strong> (Hệ thống chưa hỗ trợ trả góp hoặc thanh toán thiếu).</span>`;
    return;
  }

  btnSubmit.disabled = true;
  btnSubmit.textContent = "⏳ Đang xử lý thanh toán...";

  try {
    const user = getCurrentUser();
    const payload = {
      invoiceId: selectedInvoice._id,
      amount: inputAmount,
      paymentMethod,
      cashier: user ? (user.name || "Lễ tân thu ngân") : "Lễ tân thu ngân",
      note,
    };

    const res = await apiProcessPayment(payload);

    if (!res || !res.success) {
      throw new Error(res?.message || "Thanh toán thất bại.");
    }

    showToast(`Thanh toán hóa đơn [${selectedInvoice.invoiceCode}] thành công! Hóa đơn đã chuyển sang Paid.`, "success");
    closePaymentModal();
    closeInvoiceDetailModal();

    await loadInvoices();
  } catch (err) {
    console.error("Lỗi khi xử lý thanh toán:", err);
    alertBox.style.display = "flex";
    alertBox.innerHTML = `<span>🚫</span> <span>${escapeHTML(err.message || "Thanh toán thất bại.")}</span>`;
  } finally {
    btnSubmit.disabled = false;
    btnSubmit.textContent = "✓ Xác Nhận Thu Tiền & Đổi Sang Paid";
  }
}

// Khởi chạy khi DOM load
document.addEventListener("DOMContentLoaded", async () => {
  const page = document.getElementById("invoicePaymentPage");
  if (!page) return;

  // Tải danh sách hóa đơn ban đầu
  await loadInvoices();

  // Tìm kiếm hóa đơn
  const searchInput = document.getElementById("searchInvoiceInput");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      currentSearchTerm = e.target.value.trim();
      renderInvoicesTable();
    });
  }

  // Lọc theo trạng thái unpaid / paid
  const filterPills = document.querySelectorAll(".invoice-pill-btn");
  filterPills.forEach((pill) => {
    pill.addEventListener("click", () => {
      filterPills.forEach((p) => p.classList.remove("active"));
      pill.classList.add("active");
      currentFilterStatus = pill.getAttribute("data-status");
      loadInvoices();
    });
  });

  // Modal chi tiết
  const btnCloseDetail = document.getElementById("btnCloseDetailModal");
  const btnCloseDetailBtn = document.getElementById("btnCloseDetailModalBtn");
  const btnPayFromDetail = document.getElementById("btnPayFromDetail");

  if (btnCloseDetail) btnCloseDetail.addEventListener("click", closeInvoiceDetailModal);
  if (btnCloseDetailBtn) btnCloseDetailBtn.addEventListener("click", closeInvoiceDetailModal);
  if (btnPayFromDetail) {
    btnPayFromDetail.addEventListener("click", () => {
      if (selectedInvoice) {
        closeInvoiceDetailModal();
        openPaymentModal(selectedInvoice);
      }
    });
  }

  // Modal thanh toán
  const btnClosePay = document.getElementById("btnClosePayModal");
  const btnCancelPay = document.getElementById("btnCancelPayModal");
  const payForm = document.getElementById("paymentForm");

  if (btnClosePay) btnClosePay.addEventListener("click", closePaymentModal);
  if (btnCancelPay) btnCancelPay.addEventListener("click", closePaymentModal);
  if (payForm) payForm.addEventListener("submit", handleProcessPayment);

  // Radio styling click
  const cardCash = document.getElementById("cardMethodCash");
  const cardTransfer = document.getElementById("cardMethodTransfer");
  if (cardCash && cardTransfer) {
    cardCash.addEventListener("click", () => {
      cardCash.classList.add("active");
      cardTransfer.classList.remove("active");
      cardCash.querySelector("input").checked = true;
    });
    cardTransfer.addEventListener("click", () => {
      cardTransfer.classList.add("active");
      cardCash.classList.remove("active");
      cardTransfer.querySelector("input").checked = true;
    });
  }

  // Nút Refresh
  const btnRefresh = document.getElementById("btnRefreshInvoices");
  if (btnRefresh) {
    btnRefresh.addEventListener("click", async () => {
      await loadInvoices();
      showToast("Đã cập nhật danh sách hóa đơn mới nhất!", "success");
    });
  }

  // Nút lập hóa đơn mới (chỉ cho Lễ tân/Admin)
  const btnCreateNew = document.getElementById("btnCreateNewInvoice");
  if (btnCreateNew) {
    const user = getCurrentUser();
    const canCreate = user && [1, 3].includes(Number(user.role_id));
    if (!canCreate) btnCreateNew.style.display = "none";

    btnCreateNew.addEventListener("click", () => {
      showToast("Tính năng lập hóa đơn mới từ giao diện - đang phát triển. Hiện tại hóa đơn được tạo tự động từ đơn thuốc được cấp phát.", "warning");
    });
  }

  // Sidebar logout handler
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
