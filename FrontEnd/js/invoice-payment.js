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
} from "./api.js";
import { getCurrentUser } from "./auth.js";
import { escapeHTML } from "./storage.js";
import { API_BASE_URL } from "./config.js";

let masterInvoices = [];
let invoiceCustomersList = [];
let currentFilterStatus = ""; // "" = all | "unpaid" | "paid"
let currentSearchTerm = "";
let selectedInvoice = null;

// Helper phân quyền: chỉ Lễ tân (3) & Quản trị viên (1) mới được lập hóa đơn & thu tiền
function isStaffCashier(user = getCurrentUser()) {
  if (!user) return false;
  const roleId = Number(user.role_id);
  return [1, 3].includes(roleId) || user.role === "admin" || user.role === "receptionist";
}

function getCallerId(user = getCurrentUser()) {
  return user ? (user.id || user._id || null) : null;
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

// 1. TẢI TOÀN BỘ DANH SÁCH HÓA ĐƠN CỦA USER / PHÒNG KHÁM (masterInvoices)
async function loadInvoices() {
  const tbody = document.getElementById("invoicesTableBody");
  if (!tbody) return;

  const user = getCurrentUser();
  const callerId = getCallerId(user);

  if (!user || !callerId) {
    masterInvoices = [];
    updateInvoiceKPIs();
    const countDisplay = document.getElementById("invoicesCountDisplay");
    if (countDisplay) countDisplay.textContent = "0";
    showToast("Vui lòng đăng nhập để xem hóa đơn!", "warning");
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 30px; color: #DC2626;">⚠️ Vui lòng <a href="./login.html" style="color: #1E429F; font-weight: 600;">đăng nhập</a> để xem danh sách hóa đơn.</td></tr>`;
    return;
  }

  tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 30px; color: var(--ink-faint);">⌛ Đang tải danh sách hóa đơn...</td></tr>`;

  try {
    // Tải toàn bộ danh sách hóa đơn (không lọc status từ server) để KPI luôn giữ chính xác khi lọc pill
    const res = await apiGetInvoices({ userId: callerId });
    if (!res || res.success === false) {
      throw new Error(res?.message || "Không thể tải danh sách hóa đơn.");
    }
    masterInvoices = res.invoices || [];

    updateInvoiceKPIs();
    renderInvoicesTable();
  } catch (err) {
    console.error("Lỗi tải danh sách hóa đơn:", err);
    masterInvoices = [];
    updateInvoiceKPIs();
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #DC2626; padding: 30px;">Lỗi tải dữ liệu: ${escapeHTML(err.message)}</td></tr>`;
  }
}

// 2. CẬP NHẬT KPI THỐNG KÊ (LUÔN TÍNH TỪ masterInvoices)
function updateInvoiceKPIs() {
  const statTotal = document.getElementById("statTotalInvoices");
  const statUnpaid = document.getElementById("statUnpaidInvoices");
  const statPaid = document.getElementById("statPaidInvoices");
  const statRevenue = document.getElementById("statTotalRevenue");

  let unpaidCount = 0;
  let paidCount = 0;
  let totalRevenue = 0;

  masterInvoices.forEach((inv) => {
    if (inv.status === "paid") {
      paidCount++;
      totalRevenue += Number(inv.totalAmount) || 0;
    } else if (inv.status !== "cancelled") {
      unpaidCount++;
    }
  });

  if (statTotal) statTotal.textContent = masterInvoices.length;
  if (statUnpaid) statUnpaid.textContent = unpaidCount;
  if (statPaid) statPaid.textContent = paidCount;
  if (statRevenue) statRevenue.textContent = formatVND(totalRevenue);
}

// 3. RENDER BẢNG HÓA ĐƠN (LỌC TRẠNG THÁI & TÌM KIẾM TRÊN CLIENT TỪ masterInvoices)
function renderInvoicesTable() {
  const tbody = document.getElementById("invoicesTableBody");
  const countDisplay = document.getElementById("invoicesCountDisplay");
  if (!tbody) return;

  const canManagePayment = isStaffCashier();

  let filtered = masterInvoices.slice();

  if (currentFilterStatus) {
    filtered = filtered.filter((inv) => inv.status === currentFilterStatus);
  }

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
      const isCancelled = inv.status === "cancelled";
      let statusBadge;
      if (isPaid) {
        statusBadge = `<span class="status-badge-invoice paid">✓ Đã thanh toán (paid)</span>`;
      } else if (isCancelled) {
        statusBadge = `<span class="status-badge-invoice cancelled" style="background: #FEE2E2; color: #B91C1C; border: 1.5px solid #FCA5A5;">✕ Đã hủy (cancelled)</span>`;
      } else {
        statusBadge = `<span class="status-badge-invoice unpaid">⏳ Chưa thanh toán (unpaid)</span>`;
      }

      let actionButtons = `<button type="button" class="btn-inv-detail" data-id="${escapeHTML(inv._id)}">📄 Xem chi tiết</button>`;
      if (isPaid) {
        actionButtons += `<span class="paid-locked-text">✓ Đã thu tiền</span>`;
      } else if (isCancelled) {
        actionButtons += `<span class="paid-locked-text" style="color: #B91C1C;">✕ Đã hủy</span>`;
      } else if (canManagePayment) {
        actionButtons += `<button type="button" class="btn-inv-pay" data-id="${escapeHTML(inv._id)}">💳 Thanh toán</button>`;
      }

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
      const inv = masterInvoices.find((i) => String(i._id) === String(id));
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

  const user = getCurrentUser();
  const callerId = getCallerId(user);
  const canManagePayment = isStaffCashier(user);

  if (!callerId) {
    showToast("Vui lòng đăng nhập để xem chi tiết hóa đơn!", "warning");
    return;
  }

  try {
    const res = await apiGetInvoiceById(invoiceId, callerId);
    const inv = res?.invoice || masterInvoices.find((i) => String(i._id) === String(invoiceId));
    if (!inv) throw new Error("Không tìm thấy thông tin chi tiết hóa đơn.");

    selectedInvoice = inv;

    detailInvCode.textContent = inv.invoiceCode;
    detailCustomerName.textContent = inv.customerName || inv.customerId?.name || "Khách hàng";
    detailCustomerPhone.textContent = inv.customerPhone || inv.customerId?.phone || "Chưa có";
    detailCreatedAt.textContent = inv.createdAt ? new Date(inv.createdAt).toLocaleString("vi-VN") : "--";

    const isPaid = inv.status === "paid";
    const isCancelled = inv.status === "cancelled";
    if (isPaid) {
      detailStatusBadge.innerHTML = `<span class="status-badge-invoice paid">✓ Đã thanh toán (paid)</span>`;
    } else if (isCancelled) {
      detailStatusBadge.innerHTML = `<span class="status-badge-invoice cancelled" style="background: #FEE2E2; color: #B91C1C; border: 1.5px solid #FCA5A5;">✕ Đã hủy (cancelled)</span>`;
    } else {
      detailStatusBadge.innerHTML = `<span class="status-badge-invoice unpaid">⏳ Chưa thanh toán (unpaid)</span>`;
    }

    // Render danh sách mục với đơn giá cố định tại thời điểm lập
    const items = inv.items || [];
    detailItemsBody.innerHTML = items
      .map((it) => {
        const lineTotal =
          it.amount ?? it.subtotal ?? Number(it.quantity || 1) * Number(it.unitPrice || 0);
        return `
        <tr>
          <td><strong>${escapeHTML(it.name || it.itemType || "Thuốc/Dịch vụ")}</strong></td>
          <td>${escapeHTML(String(it.quantity ?? 1))}</td>
          <td>${formatVND(it.unitPrice)}</td>
          <td><strong>${formatVND(lineTotal)}</strong></td>
        </tr>
      `;
      })
      .join("");

    detailTotalAmount.textContent = formatVND(inv.totalAmount);

    // Thông tin thanh toán (nếu đã paid)
    if (isPaid) {
      detailPaymentInfo.style.display = "block";
      btnPayFromDetail.style.display = "none";

      try {
        const payRes = await fetch(`${API_BASE_URL}/payments/invoice/${encodeURIComponent(inv._id)}`, {
          headers: { "x-user-id": callerId },
        });
        const payData = payRes.ok ? await payRes.json().catch(() => ({})) : {};
        const rawPayment = payData?.payment;
        let p = Array.isArray(rawPayment) ? rawPayment[0] : rawPayment;
        if ((!p || !p.paymentCode) && inv.paymentId && typeof inv.paymentId === "object") {
          p = inv.paymentId;
        }

        if (p && p.paymentCode) {
          const methodStr = p.paymentMethod === "cash" ? "💵 Tiền mặt" : "🏦 Chuyển khoản";
          detailPaymentContent.innerHTML = `
            Mã GD: <strong>${escapeHTML(p.paymentCode)}</strong> |
            Số tiền: <strong>${formatVND(p.amount)}</strong> |
            Phương thức: <strong>${methodStr}</strong> |
            Thời điểm: <strong>${p.paidAt ? new Date(p.paidAt).toLocaleString("vi-VN") : ""}</strong>
          `;
        } else {
          detailPaymentContent.textContent = "Đã ghi nhận thanh toán đầy đủ.";
        }
      } catch (e) {
        detailPaymentContent.textContent = "Đã ghi nhận thanh toán đầy đủ.";
      }
    } else if (isCancelled) {
      detailPaymentInfo.style.display = "none";
      btnPayFromDetail.style.display = "none";
    } else {
      detailPaymentInfo.style.display = "none";
      btnPayFromDetail.style.display = canManagePayment ? "inline-flex" : "none";
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
  if (!isStaffCashier()) {
    showToast("Chức năng ghi nhận thanh toán chỉ dành cho Lễ tân / Quản trị viên!", "error");
    return;
  }

  // RÀNG BUỘC: Không thanh toán lại hóa đơn đã paid hoặc đã hủy
  if (inv.status === "paid") {
    showToast("Hóa đơn này đã được thanh toán (paid), không thể thanh toán lại!", "warning");
    return;
  }
  if (inv.status === "cancelled") {
    showToast("Hóa đơn này đã bị hủy (cancelled), không thể thanh toán!", "warning");
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
  const payNoteInput = document.getElementById("payInputNote");
  const cardCash = document.getElementById("cardMethodCash");
  const cardTransfer = document.getElementById("cardMethodTransfer");
  const alertBox = document.getElementById("paymentAlertBox");

  if (!modal) return;

  alertBox.style.display = "none";
  alertBox.innerHTML = "";
  if (payNoteInput) payNoteInput.value = "";

  // Reset phương thức mặc định về tiền mặt
  if (cardCash && cardTransfer) {
    cardCash.classList.add("active");
    cardTransfer.classList.remove("active");
    const cashRadio = cardCash.querySelector("input");
    if (cashRadio) cashRadio.checked = true;
  }

  payId.value = inv._id;
  payExpected.value = inv.totalAmount;
  payCode.textContent = inv.invoiceCode;
  payCust.textContent = `${inv.customerName || inv.customerId?.name || "Khách hàng"} (${inv.customerPhone || inv.customerId?.phone || ""})`;
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

  const user = getCurrentUser();
  const callerId = getCallerId(user);
  if (!isStaffCashier(user) || !callerId) {
    alertBox.style.display = "flex";
    alertBox.innerHTML = "<span>🚫</span> <span>Chức năng này chỉ dành cho Lễ tân / Quản trị viên!</span>";
    return;
  }

  if (!selectedInvoice) return;

  // Kiểm tra trạng thái: Không thanh toán lại hoặc hóa đơn đã hủy
  if (selectedInvoice.status === "paid") {
    alertBox.style.display = "flex";
    alertBox.innerHTML = "<span>🚫</span> <span>Hóa đơn này đã được thanh toán rồi, không thể thanh toán lại!</span>";
    return;
  }
  if (selectedInvoice.status === "cancelled") {
    alertBox.style.display = "flex";
    alertBox.innerHTML = "<span>🚫</span> <span>Hóa đơn này đã bị hủy, không thể thanh toán!</span>";
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
  const notes = document.getElementById("payInputNote").value.trim();
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
    const payload = {
      invoiceId: selectedInvoice._id,
      amount: inputAmount,
      paymentMethod,
      cashier: user.name || "Lễ tân thu ngân",
      notes,
    };

    const response = await fetch(`${API_BASE_URL}/payments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": callerId,
      },
      body: JSON.stringify(payload),
    });

    const res = await response.json().catch(() => ({}));
    if (!response.ok || !res.success) {
      throw new Error(res?.message || `Thanh toán thất bại (HTTP ${response.status}).`);
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

// 7. MODAL LẬP HÓA ĐƠN MỚI (CREATE INVOICE)
function updateCreateInvoiceTotalPreview() {
  const qtyEl = document.getElementById("createInvItemQty");
  const priceEl = document.getElementById("createInvItemPrice");
  const previewEl = document.getElementById("createInvTotalPreview");
  if (!previewEl) return;

  const qty = Math.max(0, Number(qtyEl?.value) || 0);
  const price = Math.max(0, Number(priceEl?.value) || 0);
  previewEl.textContent = formatVND(qty * price);
}

function populateCreateInvPets(customerId) {
  const petSelect = document.getElementById("createInvPet");
  if (!petSelect) return;

  if (!customerId) {
    petSelect.innerHTML = `<option value="">-- Chọn khách hàng trước --</option>`;
    petSelect.disabled = true;
    return;
  }

  const cust = invoiceCustomersList.find((c) => String(c.id) === String(customerId));
  const pets = cust?.pets || [];

  petSelect.disabled = false;
  if (pets.length === 0) {
    petSelect.innerHTML = `<option value="">-- Khách hàng chưa có thú cưng (Tùy chọn) --</option>`;
    return;
  }

  petSelect.innerHTML =
    `<option value="">-- Không chọn thú cưng cụ thể --</option>` +
    pets
      .map(
        (p) =>
          `<option value="${escapeHTML(p.id)}">${escapeHTML(p.name)} (${escapeHTML(p.species || "Thú cưng")})</option>`
      )
      .join("");
}

async function openCreateInvoiceModal() {
  const user = getCurrentUser();
  const callerId = getCallerId(user);
  if (!isStaffCashier(user) || !callerId) {
    showToast("Chức năng lập hóa đơn chỉ dành cho Lễ tân / Quản trị viên!", "error");
    return;
  }

  const modal = document.getElementById("createInvoiceModal");
  const form = document.getElementById("createInvoiceForm");
  const alertBox = document.getElementById("createInvoiceAlertBox");
  const customerSelect = document.getElementById("createInvCustomer");
  const petSelect = document.getElementById("createInvPet");
  const qtyInput = document.getElementById("createInvItemQty");

  if (!modal) return;

  if (form) form.reset();
  if (qtyInput) qtyInput.value = "1";
  if (alertBox) {
    alertBox.style.display = "none";
    alertBox.innerHTML = "";
  }
  updateCreateInvoiceTotalPreview();

  if (customerSelect) {
    customerSelect.innerHTML = `<option value="">⏳ Đang tải danh sách khách hàng...</option>`;
    customerSelect.disabled = true;
  }
  if (petSelect) {
    petSelect.innerHTML = `<option value="">-- Chọn khách hàng trước --</option>`;
    petSelect.disabled = true;
  }

  modal.style.display = "flex";

  try {
    const res = await fetch(`${API_BASE_URL}/grooming-meta/customers`, {
      headers: { "x-user-id": callerId },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      throw new Error(data.message || "Không tải được danh sách khách hàng.");
    }

    invoiceCustomersList = data.customers || [];
    if (customerSelect) {
      customerSelect.disabled = false;
      if (invoiceCustomersList.length === 0) {
        customerSelect.innerHTML = `<option value="">-- Chưa có khách hàng nào trong hệ thống --</option>`;
      } else {
        customerSelect.innerHTML =
          `<option value="">-- Chọn khách hàng --</option>` +
          invoiceCustomersList
            .map(
              (c) =>
                `<option value="${escapeHTML(c.id)}">${escapeHTML(c.name)} (${escapeHTML(c.phone || "Chưa có SĐT")})</option>`
            )
            .join("");
      }
    }
  } catch (err) {
    console.error("Lỗi tải danh sách khách hàng lập hóa đơn:", err);
    if (customerSelect) {
      customerSelect.disabled = false;
      customerSelect.innerHTML = `<option value="">-- Lỗi tải khách hàng --</option>`;
    }
    if (alertBox) {
      alertBox.style.display = "flex";
      alertBox.innerHTML = `<span>🚫</span> <span>${escapeHTML(err.message)}</span>`;
    }
  }
}

function closeCreateInvoiceModal() {
  const modal = document.getElementById("createInvoiceModal");
  if (modal) modal.style.display = "none";
}

async function handleCreateInvoice(e) {
  e.preventDefault();

  const alertBox = document.getElementById("createInvoiceAlertBox");
  if (alertBox) {
    alertBox.style.display = "none";
    alertBox.innerHTML = "";
  }

  const user = getCurrentUser();
  const callerId = getCallerId(user);
  if (!isStaffCashier(user) || !callerId) {
    if (alertBox) {
      alertBox.style.display = "flex";
      alertBox.innerHTML = "<span>🚫</span> <span>Chức năng lập hóa đơn chỉ dành cho Lễ tân / Quản trị viên!</span>";
    }
    return;
  }

  const customerId = document.getElementById("createInvCustomer")?.value || "";
  const petId = document.getElementById("createInvPet")?.value || "";
  const itemName = (document.getElementById("createInvItemName")?.value || "").trim();
  const quantity = Number(document.getElementById("createInvItemQty")?.value);
  const unitPrice = Number(document.getElementById("createInvItemPrice")?.value);
  const notes = (document.getElementById("createInvNotes")?.value || "").trim();
  const btnSubmit = document.getElementById("btnSubmitCreateInvoice");

  if (!customerId) {
    if (alertBox) {
      alertBox.style.display = "flex";
      alertBox.innerHTML = "<span>⚠️</span> <span>Vui lòng chọn khách hàng!</span>";
    }
    return;
  }

  if (!itemName) {
    if (alertBox) {
      alertBox.style.display = "flex";
      alertBox.innerHTML = "<span>⚠️</span> <span>Vui lòng nhập tên dịch vụ hoặc thuốc!</span>";
    }
    return;
  }

  if (!quantity || quantity < 1) {
    if (alertBox) {
      alertBox.style.display = "flex";
      alertBox.innerHTML = "<span>⚠️</span> <span>Số lượng tối thiểu phải là 1!</span>";
    }
    return;
  }

  if (isNaN(unitPrice) || unitPrice <= 0) {
    if (alertBox) {
      alertBox.style.display = "flex";
      alertBox.innerHTML = "<span>⚠️</span> <span>Đơn giá phải lớn hơn 0 VNĐ!</span>";
    }
    return;
  }

  if (btnSubmit) {
    btnSubmit.disabled = true;
    btnSubmit.textContent = "⏳ Đang tạo hóa đơn...";
  }

  try {
    const payload = {
      customerId,
      petId: petId || null,
      items: [
        {
          name: itemName,
          quantity,
          unitPrice,
        },
      ],
      notes,
    };

    const response = await fetch(`${API_BASE_URL}/invoices`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": callerId,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.success) {
      throw new Error(data.message || `Tạo hóa đơn thất bại (HTTP ${response.status}).`);
    }

    const code = data.invoice?.invoiceCode || "";
    showToast(
      code ? `Lập hóa đơn [${code}] thành công!` : "Lập hóa đơn mới thành công!",
      "success"
    );
    closeCreateInvoiceModal();
    await loadInvoices();
  } catch (err) {
    console.error("Lỗi tạo hóa đơn:", err);
    if (alertBox) {
      alertBox.style.display = "flex";
      alertBox.innerHTML = `<span>🚫</span> <span>${escapeHTML(err.message || "Không thể lập hóa đơn mới.")}</span>`;
    }
  } finally {
    if (btnSubmit) {
      btnSubmit.disabled = false;
      btnSubmit.textContent = "✓ Tạo Hóa Đơn (unpaid)";
    }
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

  // Lọc theo trạng thái unpaid / paid trên client (giữ nguyên KPI từ masterInvoices)
  const filterPills = document.querySelectorAll(".invoice-pill-btn");
  filterPills.forEach((pill) => {
    pill.addEventListener("click", () => {
      filterPills.forEach((p) => p.classList.remove("active"));
      pill.classList.add("active");
      currentFilterStatus = pill.getAttribute("data-status") || "";
      renderInvoicesTable();
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

  // Nút lập hóa đơn mới & Modal Tạo Hóa Đơn (chỉ cho Lễ tân / Admin)
  const btnCreateNew = document.getElementById("btnCreateNewInvoice");
  if (btnCreateNew) {
    if (!isStaffCashier()) {
      btnCreateNew.style.display = "none";
    }
    btnCreateNew.addEventListener("click", openCreateInvoiceModal);
  }

  const btnCloseCreateInv = document.getElementById("btnCloseCreateInvModal");
  const btnCancelCreateInv = document.getElementById("btnCancelCreateInvModal");
  const createInvForm = document.getElementById("createInvoiceForm");
  const createInvCustomer = document.getElementById("createInvCustomer");
  const createInvQty = document.getElementById("createInvItemQty");
  const createInvPrice = document.getElementById("createInvItemPrice");

  if (btnCloseCreateInv) btnCloseCreateInv.addEventListener("click", closeCreateInvoiceModal);
  if (btnCancelCreateInv) btnCancelCreateInv.addEventListener("click", closeCreateInvoiceModal);
  if (createInvForm) createInvForm.addEventListener("submit", handleCreateInvoice);
  if (createInvCustomer) {
    createInvCustomer.addEventListener("change", (e) => populateCreateInvPets(e.target.value));
  }
  if (createInvQty) createInvQty.addEventListener("input", updateCreateInvoiceTotalPreview);
  if (createInvPrice) createInvPrice.addEventListener("input", updateCreateInvoiceTotalPreview);
});
