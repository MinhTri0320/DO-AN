/* ============================================================
   receptionist-dashboard.js
   Cổng thông tin nghiệp vụ dành riêng cho Lễ Tân (role_id = 3)
   Không hiển thị giao diện trang chủ của khách hàng
   Bao gồm 4 Tab:
   1. Hóa Đơn & Thanh Toán (payment)
   2. Lịch Khám Khách Hàng (chỉ hiện ca chờ xác nhận, click duyệt/hủy & phân công BS)
   3. Hóa Đơn Thuốc Sau Khám (cấp thuốc trừ kho & xuất hóa đơn)
   4. Quản Lý Kho Thuốc (tủ thuốc, thêm/sửa/xóa, cảnh báo hết hàng/hết hạn)
   ============================================================ */

import { getCurrentUser, logoutUser } from "./auth.js";
import { API_BASE_URL } from "./config.js";
import { escapeHTML } from "./storage.js";

const esc = (v) => escapeHTML(v == null ? "" : String(v));
const escAttr = (v) => esc(v).replace(/"/g, "&quot;").replace(/'/g, "&#39;");

function getLookupStatusBadge(status) {
  if (status === "Hoàn thành" || status === "completed") {
    return { cls: "status-completed", label: "Hoàn thành" };
  }
  if (status === "Đã xác nhận") {
    return { cls: "status-confirmed", label: "Đã xác nhận" };
  }
  if (status === "in_progress" || status === "Đang làm") {
    return { cls: "status-confirmed", label: "Đang làm" };
  }
  if (status === "Đã hủy" || status === "cancelled") {
    return { cls: "status-cancelled", label: "Đã hủy" };
  }
  return {
    cls: "status-pending",
    label: status === "pending" || !status ? "Chờ xác nhận" : status,
  };
}

let doctorListCache = [];

function checkReceptionistAuth() {
  const user = getCurrentUser();
  if (!user || (Number(user.role_id) !== 3 && user.role !== "receptionist")) {
    alert("Quyền truy cập bị từ chối! Trang này chỉ dành riêng cho Nhân viên Lễ tân (role_id = 3).");
    window.location.href = "./index.html";
    return null;
  }

  const greetingEl = document.getElementById("receptionistGreeting");
  if (greetingEl) greetingEl.textContent = `Lễ tân: ${user.name}`;
  return user;
}

// Tải danh sách bác sĩ phục vụ phân công ca khám
async function loadDoctors() {
  try {
    const res = await fetch(`${API_BASE_URL}/doctors`);
    if (res.ok) {
      const data = await res.json();
      doctorListCache = data.doctors || [];
    }
  } catch (err) {
    console.warn("Không thể tải danh sách bác sĩ:", err);
  }
}

// 1. TẢI VÀ THANH TOÁN HÓA ĐƠN
async function loadInvoices(status = "") {
  const user = getCurrentUser();
  if (!user) return;

  const tbody = document.getElementById("recepInvoicesTableBody");
  tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #888; padding: 30px;">Đang tải danh sách hóa đơn...</td></tr>`;

  try {
    const params = new URLSearchParams();
    if (status) params.append("status", status);

    const res = await fetch(`${API_BASE_URL}/invoices?${params.toString()}`, {
      headers: { "x-user-id": user.id || user._id },
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Không thể tải danh sách hóa đơn.");

    const list = data.invoices || [];
    const countEl = document.getElementById("recepInvoicesCount");
    if (countEl) countEl.textContent = list.length;

    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #888; padding: 30px;">Không có hóa đơn nào phù hợp.</td></tr>`;
      return;
    }

    tbody.innerHTML = list
      .map((inv) => {
        const isPaid = inv.status === "paid";
        const customerName = inv.customerName || inv.customerId?.name || "Khách hàng";
        const customerPhone = inv.customerPhone || inv.customerId?.phone || "";
        const customerLabel = customerPhone ? `${customerName} (${customerPhone})` : customerName;
        const actionBtn = isPaid
          ? `<span style="color: #15803D; font-size: 12px; font-weight: 600;">✓ Đã thu tiền</span>`
          : `<button type="button" class="btn-action-small btn-pay" data-invoice-id="${escAttr(inv._id)}" data-invoice-code="${escAttr(inv.invoiceCode)}" data-customer="${escAttr(customerLabel)}" data-amount="${inv.totalAmount || 0}">Thanh toán</button>`;

        return `
          <tr>
            <td><strong>${esc(inv.invoiceCode)}</strong></td>
            <td>
              ${esc(customerName)}<br/>
              <small style="color: #666;">${esc(customerPhone)}</small>
            </td>
            <td><strong style="color: #1E429F;">${(inv.totalAmount || 0).toLocaleString("vi-VN")}đ</strong></td>
            <td>
              <span class="invoice-tag ${isPaid ? "paid" : ""}">
                ${isPaid ? "Đã thanh toán" : "Chưa thanh toán"}
              </span>
            </td>
            <td><small style="color: #888;">${new Date(inv.createdAt).toLocaleString("vi-VN")}</small></td>
            <td>${actionBtn}</td>
          </tr>
        `;
      })
      .join("");

    tbody.querySelectorAll(".btn-pay").forEach((btn) => {
      btn.addEventListener("click", () => {
        openPaymentModal({
          invoiceId: btn.dataset.invoiceId,
          invoiceCode: btn.dataset.invoiceCode,
          customer: btn.dataset.customer,
          amount: Number(btn.dataset.amount) || 0,
        });
      });
    });
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #c53030; padding: 30px;">${esc(err.message)}</td></tr>`;
  }
}

// Modal Thanh Toán hóa đơn (#modalRecepPayment)
function openPaymentModal({ invoiceId, invoiceCode, customer, amount }) {
  const modal = document.getElementById("modalRecepPayment");
  if (!modal) return;

  document.getElementById("recepPayInvoiceId").value = invoiceId || "";
  document.getElementById("recepPayAmountRaw").value = String(amount || 0);
  document.getElementById("recepPayInvoiceCode").textContent = invoiceCode || "—";
  document.getElementById("recepPayCustomer").textContent = customer || "Khách hàng";
  document.getElementById("recepPayAmountDisplay").textContent = `${Number(amount || 0).toLocaleString("vi-VN")} đ`;

  const cashRadio = modal.querySelector('input[name="recepPayMethod"][value="cash"]');
  if (cashRadio) cashRadio.checked = true;

  const notesInput = document.getElementById("recepPayNotes");
  if (notesInput) notesInput.value = "";

  modal.style.display = "flex";
}

function closePaymentModal() {
  const modal = document.getElementById("modalRecepPayment");
  if (modal) modal.style.display = "none";
}

function initPaymentModal() {
  const modal = document.getElementById("modalRecepPayment");
  const closeBtn = document.getElementById("btnCloseRecepPayModal");
  const cancelBtn = document.getElementById("btnCancelRecepPayModal");
  const form = document.getElementById("formRecepPayment");

  if (!modal) return;

  if (closeBtn) closeBtn.addEventListener("click", closePaymentModal);
  if (cancelBtn) cancelBtn.addEventListener("click", closePaymentModal);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closePaymentModal();
  });

  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const user = getCurrentUser();
      if (!user) return;

      const invoiceId = document.getElementById("recepPayInvoiceId").value;
      const amount = Number(document.getElementById("recepPayAmountRaw").value) || 0;
      const checkedMethod = form.querySelector('input[name="recepPayMethod"]:checked');
      const paymentMethod = checkedMethod ? checkedMethod.value : "cash";
      const notes = (document.getElementById("recepPayNotes")?.value || "").trim();

      const submitBtn = document.getElementById("btnSubmitRecepPayment");
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Đang xử lý...";
      }

      try {
        const payRes = await fetch(`${API_BASE_URL}/payments`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-user-id": user.id || user._id,
          },
          body: JSON.stringify({
            invoiceId,
            amount,
            paymentMethod,
            cashier: user.name || "Lễ tân",
            notes,
          }),
        });
        const payData = await payRes.json().catch(() => ({}));
        if (!payRes.ok) throw new Error(payData.message || "Thanh toán thất bại.");

        closePaymentModal();
        alert(payData.message || "Thanh toán thành công!");
        const statusFilter = document.getElementById("recepInvoiceStatusFilter");
        await loadInvoices(statusFilter ? statusFilter.value : "");
      } catch (err) {
        alert("Lỗi thanh toán: " + err.message);
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = "✓ Xác nhận thu tiền";
        }
      }
    });
  }
}

// 2. TẢI LỊCH KHÁM & GROOMING KÈM THÔNG TIN HÓA ĐƠN
async function loadAppointments(search = "", customStatus = null) {
  const user = getCurrentUser();
  if (!user) return;

  const tbody = document.getElementById("recepAllApptsTableBody");
  tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #888; padding: 30px;">Đang tải danh sách lịch khám &amp; hóa đơn...</td></tr>`;

  try {
    const params = new URLSearchParams();
    if (search) params.append("search", search);

    const statusFilterEl = document.getElementById("recepApptStatusFilter");
    const activeStatus = customStatus !== null ? customStatus : (statusFilterEl ? statusFilterEl.value : "");

    if (activeStatus) {
      params.append("status", activeStatus);
    } else {
      // Mặc định hoặc Tất cả: gửi showAll=true để hiển thị đầy đủ lịch và hóa đơn đi kèm
      params.append("showAll", "true");
    }

    const res = await fetch(`${API_BASE_URL}/receptionist/appointments?${params.toString()}`, {
      headers: { "x-user-id": user.id || user._id },
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Không thể tải lịch khám.");

    const list = data.appointments || [];
    const countEl = document.getElementById("recepApptsCount");
    if (countEl) countEl.textContent = list.length;

    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #666; padding: 30px; font-weight: 600;">Không có ca lịch hẹn nào trong bộ lọc này.</td></tr>`;
      return;
    }

    tbody.innerHTML = list
      .map((item) => {
        const invoicesHtml = (item.invoices || [])
          .map(
            (inv) => `
            <div style="margin-bottom: 3px;">
              <span class="invoice-tag ${inv.status === "paid" ? "paid" : ""}">
                ${esc(inv.invoiceCode)} - ${(inv.totalAmount || 0).toLocaleString("vi-VN")}đ (${inv.status === "paid" ? "Đã TT" : "Chưa TT"})
              </span>
            </div>`
          )
          .join("") || '<span style="color: #999; font-size: 12px;">Chưa xuất HĐ</span>';

        const itemDataAttr = escAttr(JSON.stringify(item));
        let statusHtml = "";
        if (item.status === "Chờ xác nhận" || item.status === "pending") {
          statusHtml = `<span class="status-pill status-pending status-clickable btn-open-confirm" data-item='${itemDataAttr}' title="Nhấp để Duyệt hoặc Hủy đơn khám">Chờ xác nhận 👆</span>`;
        } else if (item.status === "Đã xác nhận" || item.status === "in_progress" || item.status === "Đang làm") {
          const confirmedLabel = item.status === "Đã xác nhận" ? "Đã xác nhận" : "Đang làm";
          statusHtml = `<span class="status-pill status-confirmed status-clickable btn-open-confirm" data-item='${itemDataAttr}' title="Nhấp để phân công lại bác sĩ hoặc hủy lịch">${confirmedLabel}</span>`;
        } else if (item.status === "Hoàn thành" || item.status === "completed") {
          statusHtml = `<span class="status-pill status-completed">✓ Hoàn thành</span>`;
        } else if (item.status === "Đã hủy" || item.status === "cancelled") {
          statusHtml = `<span class="status-pill status-cancelled">Đã hủy</span>`;
        } else {
          statusHtml = `<span class="status-pill status-pending">${esc(item.status || "Chờ xác nhận")}</span>`;
        }

        return `
          <tr>
            <td>
              <strong>${esc(item.date)}</strong><br/>
              <span style="color: #1E429F; font-weight: 700;">${esc(item.time || "--:--")}</span>
            </td>
            <td>
              <strong>${esc(item.serviceName)}</strong><br/>
              <small style="color: #888;">${esc(item.typeName)}</small>
            </td>
            <td><strong>${esc(item.petName)}</strong></td>
            <td>
              ${esc(item.customerName)}<br/>
              <small style="color: #666;">${esc(item.customerPhone)}</small>
            </td>
            <td><small style="color: #555;">${esc(item.doctorName)}</small></td>
            <td>${statusHtml}</td>
            <td>${invoicesHtml}</td>
          </tr>
        `;
      })
      .join("");

    // Gắn sự kiện click mở pop-up xác nhận phiếu khám
    tbody.querySelectorAll(".btn-open-confirm").forEach((el) => {
      el.addEventListener("click", () => {
        const item = JSON.parse(el.dataset.item);
        openConfirmPopup(item);
      });
    });
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #c53030; padding: 30px;">${esc(err.message)}</td></tr>`;
  }
}

// Mở Pop-up Xác nhận phiếu khám
function openConfirmPopup(item) {
  const popup = document.getElementById("popupConfirmAppt");
  if (!popup) return;

  document.getElementById("confirmApptId").value = item.id;
  document.getElementById("confirmApptType").value = item.type;
  document.getElementById("confirmApptCode").textContent = item.code;
  document.getElementById("confirmApptDateTime").textContent = `${item.date} lúc ${item.time || "--:--"}`;
  document.getElementById("confirmApptCustomer").textContent = `${item.customerName} (${item.customerPhone})`;
  document.getElementById("confirmApptPetService").textContent = `${item.petName} — ${item.serviceName}`;
  document.getElementById("confirmCancelReason").value = "";

  // Điền danh sách Bác sĩ vào dropdown (Bắt buộc chọn 1 BS)
  const selectDoc = document.getElementById("confirmSelectDoctor");
  if (doctorListCache.length > 0) {
    selectDoc.innerHTML = `<option value="">-- Chọn Bác sĩ phụ trách ca khám --</option>` +
      doctorListCache
        .map((d) => `<option value="${escAttr(d.id_bac_sy)}">BS. ${esc(d.name)} (${esc(d.id_bac_sy)}) - ${esc(d.specialty || "Thú y")}</option>`)
        .join("");
  } else {
    selectDoc.innerHTML = `<option value="">Chưa có dữ liệu bác sĩ trong hệ thống</option>`;
  }

  popup.style.display = "flex";
}

function closeConfirmPopup() {
  const popup = document.getElementById("popupConfirmAppt");
  if (popup) popup.style.display = "none";
}

// 3. TẢI ĐƠN THUỐC SAU KHÁM & CẤP THUỐC
async function loadPrescriptions(search = "") {
  const user = getCurrentUser();
  if (!user) return;

  const tbody = document.getElementById("recepPrescriptionsTableBody");
  tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #888; padding: 30px;">Đang tải đơn thuốc sau khám...</td></tr>`;

  try {
    const params = new URLSearchParams();
    if (search) params.append("search", search);

    const res = await fetch(`${API_BASE_URL}/receptionist/prescriptions?${params.toString()}`, {
      headers: { "x-user-id": user.id || user._id },
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Không thể tải đơn thuốc.");

    const list = data.prescriptions || [];
    const countEl = document.getElementById("recepPrescriptionsCount");
    if (countEl) countEl.textContent = list.length;

    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #888; padding: 30px;">Không có đơn thuốc nào.</td></tr>`;
      return;
    }

    tbody.innerHTML = list
      .map((p) => {
        const medListHtml = (p.medicines || [])
          .map((m) => `• <strong>${esc(m.name)}</strong> (${esc(m.quantity || "1")}): ${esc(m.dosage || "")}`)
          .join("<br/>") || '<span style="color: #999;">Không có thuốc</span>';

        const dispenseAction = p.isDispensed
          ? `<span style="color: #166534; font-weight: 600; font-size: 12px;">✓ Đã cấp [${esc(p.dispensing?.dispensingCode || "DISP")}]</span>`
          : `<button type="button" class="btn-action-small btn-dispense" data-pres-code="${escAttr(p.prescriptionCode)}">Cấp thuốc &amp; Xuất HĐ</button>`;

        const invoiceHtml = p.invoice
          ? `<span class="invoice-tag ${p.invoice.status === "paid" ? "paid" : ""}">
              ${esc(p.invoice.invoiceCode)} - ${(p.invoice.totalAmount || 0).toLocaleString("vi-VN")}đ (${p.invoice.status === "paid" ? "Đã TT" : "Chưa TT"})
            </span>`
          : '<span style="color: #888; font-size: 12px;">Chưa lập hóa đơn</span>';

        return `
          <tr>
            <td>
              <strong>${esc(p.prescriptionCode)}</strong><br/>
              <small style="color: #777;">${esc(p.date)}</small>
            </td>
            <td>
              <strong>${esc(p.petName)}</strong><br/>
              <small style="color: #888;">${esc(p.petSpecies)}</small>
            </td>
            <td>
              <strong>${esc(p.diagnosis)}</strong><br/>
              <small style="color: #555;">${esc(p.veterinarian)}</small>
            </td>
            <td style="font-size: 12.5px;">${medListHtml}</td>
            <td>${dispenseAction}</td>
            <td>${invoiceHtml}</td>
          </tr>
        `;
      })
      .join("");

    tbody.querySelectorAll(".btn-dispense").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const presCode = btn.dataset.presCode;
        if (!confirm(`Xác nhận cấp thuốc và lập hóa đơn cho đơn [${presCode}]? (Hệ thống sẽ tự động trừ số lượng tồn kho)`)) return;

        try {
          btn.disabled = true;
          btn.textContent = "Đang cấp...";

          const dispRes = await fetch(`${API_BASE_URL}/dispensing`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-user-id": user.id || user._id,
            },
            body: JSON.stringify({
              prescriptionCode: presCode,
              dispensedBy: user.name || "Dược sĩ Lễ tân",
            }),
          });
          const dispData = await dispRes.json();
          if (!dispRes.ok) throw new Error(dispData.message || "Cấp thuốc thất bại.");

          const dispensingId = dispData.dispensing?._id;
          if (dispensingId) {
            const invRes = await fetch(`${API_BASE_URL}/invoices/from-dispensing/${dispensingId}`, {
              method: "POST",
              headers: { "x-user-id": user.id || user._id },
            });
            const invData = await invRes.json().catch(() => ({}));
            if (!invRes.ok) {
              alert("Đã cấp thuốc thành công nhưng lập hóa đơn tự động thất bại: " + (invData.message || invRes.status));
              loadPrescriptions(search);
              return;
            }
          }

          alert("Cấp thuốc thành công và đã xuất hóa đơn tiền thuốc!");
          loadPrescriptions(search);
        } catch (err) {
          alert("Lỗi cấp thuốc: " + err.message);
          btn.disabled = false;
          btn.textContent = "Cấp thuốc & Xuất HĐ";
        }
      });
    });
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #c53030; padding: 30px;">${esc(err.message)}</td></tr>`;
  }
}

// 4. QUẢN LÝ KHO THUỐC
async function loadPharmacy(search = "", stockStatus = "") {
  const user = getCurrentUser();
  if (!user) return;

  const tbody = document.getElementById("pharmacyTableBody");
  tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #888; padding: 30px;">Đang tải danh sách kho thuốc...</td></tr>`;

  try {
    const params = new URLSearchParams();
    if (search) params.append("search", search);
    if (stockStatus) params.append("stockStatus", stockStatus);

    const res = await fetch(`${API_BASE_URL}/medicines?${params.toString()}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Không thể tải kho thuốc.");

    const list = data.medicines || [];
    const countEl = document.getElementById("pharmacyMedicinesCount");
    if (countEl) countEl.textContent = list.length;

    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #888; padding: 30px;">Không có thuốc nào trong kho.</td></tr>`;
      return;
    }

    tbody.innerHTML = list
      .map((m) => {
        let statusBadge = `<span style="color: #15803D; font-weight: 600; font-size: 12px;">✓ Còn hàng</span>`;
        if (m.isExpired) {
          statusBadge = `<span class="stock-badge-exp">Hết hạn</span>`;
        } else if (m.isOutOfStock) {
          statusBadge = `<span class="stock-badge-out">Hết hàng</span>`;
        }

        const expDateStr = m.expiryDate ? new Date(m.expiryDate).toLocaleDateString("vi-VN") : "--/--/----";

        return `
          <tr data-med-id="${escAttr(m._id)}">
            <td>
              <strong>${esc(m.name)}</strong><br/>
              <small style="color: #888;">${esc(m.medicineCode || "")} ${m.activeIngredient ? `(${esc(m.activeIngredient)})` : ""}</small>
            </td>
            <td>${esc(m.unit)}</td>
            <td><strong style="color: #1E429F;">${(m.price || 0).toLocaleString("vi-VN")}đ</strong></td>
            <td>
              <strong>${esc(m.quantity)}</strong> ${esc(m.unit)}
              ${m.isOutOfStock ? `<br/><span class="stock-badge-out">Hết hàng</span>` : ""}
            </td>
            <td>
              ${expDateStr}
              ${m.isExpired ? `<br/><span class="stock-badge-exp">Hết hạn</span>` : ""}
            </td>
            <td>${statusBadge}</td>
            <td>
              <button type="button" class="btn-action-small btn-edit-med" data-json="${escAttr(JSON.stringify(m))}">Sửa</button>
              <button type="button" class="btn-action-small btn-delete-med" data-id="${escAttr(m._id)}" data-name="${escAttr(m.name)}">Xóa</button>
            </td>
          </tr>
        `;
      })
      .join("");

    tbody.querySelectorAll(".btn-edit-med").forEach((btn) => {
      btn.addEventListener("click", () => {
        const m = JSON.parse(btn.dataset.json);
        openMedicineForm(m);
      });
    });

    tbody.querySelectorAll(".btn-delete-med").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const medId = btn.dataset.id;
        const medName = btn.dataset.name;
        if (!confirm(`Bạn có chắc chắn muốn xóa thuốc "${medName}" khỏi kho không?`)) return;

        try {
          const delRes = await fetch(`${API_BASE_URL}/medicines/${encodeURIComponent(medId)}`, {
            method: "DELETE",
            headers: { "x-user-id": user.id || user._id },
          });
          const delData = await delRes.json();
          if (!delRes.ok) throw new Error(delData.message || "Xóa thuốc thất bại.");
          alert(delData.message || "Đã xóa thuốc thành công!");
          loadPharmacy(search, stockStatus);
        } catch (err) {
          alert("Lỗi: " + err.message);
        }
      });
    });
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #c53030; padding: 30px;">${esc(err.message)}</td></tr>`;
  }
}

function openMedicineForm(medicine = null) {
  const panel = document.getElementById("medicineFormPanel");
  if (!panel) return;
  panel.style.display = "block";

  const title = document.getElementById("medFormTitle");
  const idInput = document.getElementById("medFormId");
  const nameInput = document.getElementById("medInputName");
  const unitInput = document.getElementById("medInputUnit");
  const priceInput = document.getElementById("medInputPrice");
  const qtyInput = document.getElementById("medInputQty");
  const expInput = document.getElementById("medInputExpiry");
  const descInput = document.getElementById("medInputDesc");

  if (medicine) {
    title.textContent = `✏️ Chỉnh Sửa Thuốc: ${medicine.name}`;
    idInput.value = medicine._id;
    nameInput.value = medicine.name || "";
    unitInput.value = medicine.unit || "";
    priceInput.value = medicine.price || "";
    qtyInput.value = medicine.quantity !== undefined ? medicine.quantity : "";
    expInput.value = medicine.expiryDate ? new Date(medicine.expiryDate).toISOString().split("T")[0] : "";
    descInput.value = medicine.description || "";
  } else {
    title.textContent = "➕ Thêm Thuốc Mới Vào Kho";
    idInput.value = "";
    nameInput.value = "";
    unitInput.value = "viên";
    priceInput.value = "";
    qtyInput.value = "";
    expInput.value = "";
    descInput.value = "";
  }
  panel.scrollIntoView({ behavior: "smooth" });
}

let recepCustomersCache = [];

// 5. Khởi tạo Modal Lập Hóa Đơn Mới cho Lễ Tân
function initCreateInvoiceModal() {
  const modal = document.getElementById("modalCreateInvoice");
  const openBtn = document.getElementById("btnOpenCreateInvoiceModal");
  const closeBtn = document.getElementById("btnCloseCreateInvModal");
  const cancelBtn = document.getElementById("btnCancelCreateInvModal");
  const form = document.getElementById("formCreateNewInvoice");

  const customerSelect = document.getElementById("newInvCustomerSelect");
  const petSelect = document.getElementById("newInvPetSelect");
  const qtyInput = document.getElementById("newInvItemQty");
  const priceInput = document.getElementById("newInvItemPrice");
  const totalPreview = document.getElementById("newInvTotalPreview");

  if (!modal) return;

  function updateTotal() {
    const qty = Number(qtyInput?.value) || 0;
    const price = Number(priceInput?.value) || 0;
    if (totalPreview) totalPreview.textContent = (qty * price).toLocaleString("vi-VN") + " đ";
  }

  if (qtyInput) qtyInput.addEventListener("input", updateTotal);
  if (priceInput) priceInput.addEventListener("input", updateTotal);

  async function openModal() {
    modal.style.display = "flex";
    updateTotal();

    // Tải danh sách khách hàng nếu chưa có
    try {
      const user = getCurrentUser();
      const res = await fetch(`${API_BASE_URL}/grooming-meta/customers`, {
        headers: user ? { "x-user-id": user.id || user._id } : {},
      });
      const data = await res.json();
      recepCustomersCache = data.customers || [];
      if (customerSelect) {
        customerSelect.innerHTML = `<option value="">-- Chọn khách hàng --</option>` +
          recepCustomersCache.map(c => `<option value="${escAttr(c.id)}">${esc(c.name)} (${esc(c.phone || "Chưa có SĐT")})</option>`).join("");
      }
    } catch (e) {
      console.warn("Không thể nạp khách hàng:", e);
    }
  }

  function closeModal() {
    modal.style.display = "none";
  }

  if (openBtn) openBtn.addEventListener("click", openModal);
  if (closeBtn) closeBtn.addEventListener("click", closeModal);
  if (cancelBtn) cancelBtn.addEventListener("click", closeModal);

  if (customerSelect) {
    customerSelect.addEventListener("change", () => {
      const custId = customerSelect.value;
      const cust = recepCustomersCache.find(c => String(c.id) === String(custId));
      if (!cust || !cust.pets || cust.pets.length === 0) {
        petSelect.innerHTML = `<option value="">-- Khách này chưa có thú cưng --</option>`;
      } else {
        petSelect.innerHTML = `<option value="">-- Chọn thú cưng --</option>` +
          cust.pets.map(p => `<option value="${escAttr(p.id)}">${esc(p.name)} (${esc(p.species || "Thú cưng")})</option>`).join("");
      }
    });
  }

  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const customerId = customerSelect.value;
      const petId = petSelect.value || null;
      const itemName = document.getElementById("newInvItemName").value.trim();
      const qty = Number(qtyInput.value) || 1;
      const price = Number(priceInput.value) || 0;
      const notes = document.getElementById("newInvNotes").value.trim();

      if (!customerId || !itemName || price <= 0) {
        alert("Vui lòng chọn khách hàng, nhập tên mục và đơn giá lớn hơn 0!");
        return;
      }

      const submitBtn = document.getElementById("btnSubmitCreateInv");
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Đang lập HĐ...";
      }

      try {
        const user = getCurrentUser();
        const payload = {
          customerId,
          petId,
          items: [{ name: itemName, quantity: qty, unitPrice: price, amount: qty * price }],
          notes: notes || "Lập trực tiếp tại quầy Lễ tân",
        };

        const res = await fetch(`${API_BASE_URL}/invoices`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-user-id": user.id || user._id,
          },
          body: JSON.stringify(payload),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Không thể tạo hóa đơn.");

        alert(`✓ Thành công!\n${data.message}`);
        closeModal();
        form.reset();
        if (petSelect) {
          petSelect.innerHTML = `<option value="">-- Chọn khách hàng trước --</option>`;
        }
        if (totalPreview) {
          totalPreview.textContent = "0 đ";
        }
        const statusFilter = document.getElementById("recepInvoiceStatusFilter");
        await loadInvoices(statusFilter ? statusFilter.value : "");
      } catch (err) {
        alert("Lỗi lập hóa đơn: " + err.message);
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = "✓ Lập Hóa Đơn";
        }
      }
    });
  }
}

// 6. Tra cứu thông tin toàn diện cho Lễ Tân (Tab 5)
async function executeReceptionistLookup(query) {
  const container = document.getElementById("recepLookupResultsContainer");
  if (!container) return;

  if (!query) {
    container.innerHTML = `<div style="text-align: center; color: #888; padding: 40px 20px;">Vui lòng nhập từ khóa tra cứu.</div>`;
    return;
  }

  container.innerHTML = `<div style="text-align: center; color: #888; padding: 40px 20px;">⏳ Đang tra cứu thông tin cho "${escapeHTML(query)}"...</div>`;

  try {
    const user = getCurrentUser();
    const res = await fetch(`${API_BASE_URL}/receptionist/lookup?q=${encodeURIComponent(query)}`, {
      headers: { "x-user-id": user.id || user._id },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Không thể tra cứu thông tin.");

    const {
      customers = [],
      pets = [],
      appointments = [],
      groomings = [],
      invoices = [],
      prescriptions = [],
    } = data.results || {};

    const totalFound = customers.length + pets.length + appointments.length + groomings.length + invoices.length + prescriptions.length;

    if (totalFound === 0) {
      container.innerHTML = `<div style="text-align: center; color: #666; padding: 40px 20px;">Không tìm thấy dữ liệu nào phù hợp với "<strong>${escapeHTML(query)}</strong>".</div>`;
      return;
    }

    let html = `<div style="margin-bottom: 16px; font-weight: 700; color: #1E429F;">🔍 Kết quả tra cứu cho "${escapeHTML(query)}" (${totalFound} mục tìm thấy):</div>`;

    // 1. Hóa đơn
    if (invoices.length > 0) {
      html += `
        <div style="margin-bottom: 24px;">
          <h4 style="margin: 0 0 10px 0; color: #1E429F;">💳 Hóa Đơn Khách Hàng (${invoices.length})</h4>
          <table class="portal-table" style="margin-bottom: 0;">
            <thead>
              <tr><th>Mã HĐ</th><th>Khách hàng</th><th>SĐT</th><th>Tổng tiền</th><th>Trạng thái</th><th>Ngày lập</th></tr>
            </thead>
            <tbody>
              ${invoices.map(inv => `
                <tr>
                  <td><strong>${esc(inv.invoiceCode)}</strong></td>
                  <td>${esc(inv.customerName || "—")}</td>
                  <td>${esc(inv.customerPhone || "—")}</td>
                  <td><strong style="color: #1E429F;">${(inv.totalAmount || 0).toLocaleString("vi-VN")}đ</strong></td>
                  <td><span class="invoice-tag ${inv.status === "paid" ? "paid" : ""}">${inv.status === "paid" ? "Đã thanh toán" : "Chưa thanh toán"}</span></td>
                  <td><small style="color: #666;">${new Date(inv.createdAt).toLocaleString("vi-VN")}</small></td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      `;
    }

    // 2. Lịch khám & Grooming
    if (appointments.length > 0 || groomings.length > 0) {
      html += `
        <div style="margin-bottom: 24px;">
          <h4 style="margin: 0 0 10px 0; color: #1E429F;">📅 Lịch Khám &amp; Grooming (${appointments.length + groomings.length})</h4>
          <table class="portal-table" style="margin-bottom: 0;">
            <thead>
              <tr><th>Mã lịch</th><th>Dịch vụ</th><th>Thú cưng</th><th>Khách hàng</th><th>Thời gian</th><th>Trạng thái</th></tr>
            </thead>
            <tbody>
              ${appointments.map(a => {
                const badge = getLookupStatusBadge(a.status);
                return `
                <tr>
                  <td><strong>${esc(a.bookingCode)}</strong></td>
                  <td>${esc(a.serviceName)}</td>
                  <td>${esc(a.petName)}</td>
                  <td>${esc(a.ownerName)} (${esc(a.ownerPhone)})</td>
                  <td>${esc(a.date)} - ${esc(a.time)}</td>
                  <td><span class="status-pill ${badge.cls}">${esc(badge.label)}</span></td>
                </tr>
              `;
              }).join("")}
              ${groomings.map(g => {
                const badge = getLookupStatusBadge(g.status);
                return `
                <tr>
                  <td><strong>${esc(g.groomingCode)}</strong></td>
                  <td>${esc(g.serviceName)}</td>
                  <td>${esc(g.petName)}</td>
                  <td>${esc(g.customerName)} (${esc(g.customerPhone)})</td>
                  <td>${esc(g.date)} - ${esc(g.startTime)}</td>
                  <td><span class="status-pill ${badge.cls}">${esc(badge.label)}</span></td>
                </tr>
              `;
              }).join("")}
            </tbody>
          </table>
        </div>
      `;
    }

    // 3. Đơn thuốc
    if (prescriptions.length > 0) {
      html += `
        <div style="margin-bottom: 24px;">
          <h4 style="margin: 0 0 10px 0; color: #1E429F;">💊 Đơn Thuốc (${prescriptions.length})</h4>
          <table class="portal-table" style="margin-bottom: 0;">
            <thead>
              <tr><th>Mã đơn</th><th>Thú cưng</th><th>Chẩn đoán</th><th>Bác sĩ kê</th><th>Số loại thuốc</th><th>Ngày kê</th><th>Ghi chú</th></tr>
            </thead>
            <tbody>
              ${prescriptions.map(p => `
                <tr>
                  <td><strong>${esc(p.prescriptionCode)}</strong></td>
                  <td>${esc(p.petName || "Bé cưng")}${p.petSpecies ? ` (${esc(p.petSpecies)})` : ""}</td>
                  <td>${esc(p.diagnosis || "—")}</td>
                  <td>${esc(p.veterinarian || "—")}</td>
                  <td><strong>${(p.medicines || []).length}</strong> loại thuốc</td>
                  <td>${esc(p.date || "—")}</td>
                  <td><small style="color: #666;">${esc(p.notes || p.doctorAdvice || "—")}</small></td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      `;
    }

    // 4. Khách hàng & Thú cưng
    if (customers.length > 0 || pets.length > 0) {
      html += `
        <div style="display: flex; gap: 20px; flex-wrap: wrap;">
          ${customers.length > 0 ? `
            <div style="flex: 1; min-width: 280px;">
              <h4 style="margin: 0 0 10px 0; color: #1E429F;">👤 Khách Hàng (${customers.length})</h4>
              <ul style="padding-left: 20px; line-height: 1.8;">
                ${customers.map(c => `<li><strong>${esc(c.name || c.fullName)}</strong> - SĐT: ${esc(c.phone || "Chưa có")}</li>`).join("")}
              </ul>
            </div>
          ` : ""}
          ${pets.length > 0 ? `
            <div style="flex: 1; min-width: 280px;">
              <h4 style="margin: 0 0 10px 0; color: #1E429F;">🐾 Thú Cưng (${pets.length})</h4>
              <ul style="padding-left: 20px; line-height: 1.8;">
                ${pets.map(p => `<li><strong>${esc(p.name)}</strong> (${esc(p.species || "Thú cưng")}${p.breed ? " - " + esc(p.breed) : ""})</li>`).join("")}
              </ul>
            </div>
          ` : ""}
        </div>
      `;
    }

    container.innerHTML = html;
  } catch (err) {
    container.innerHTML = `<div style="text-align: center; color: #c53030; padding: 30px;">Lỗi: ${esc(err.message)}</div>`;
  }
}

// KHỞI TẠO DASHBOARD LỄ TÂN
document.addEventListener("DOMContentLoaded", async () => {
  const currentUser = checkReceptionistAuth();
  if (!currentUser) return;

  const logoutBtn = document.getElementById("receptionistLogoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", (e) => {
      e.preventDefault();
      logoutUser();
      window.location.href = "./index.html";
    });
  }

  await loadDoctors();

  // Chuyển Tab 4 chức năng
  const tabButtons = document.querySelectorAll(".tab-btn");
  const tabContents = document.querySelectorAll(".tab-content");

  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetTab = btn.dataset.tab;
      tabButtons.forEach((b) => b.classList.remove("active"));
      tabContents.forEach((c) => (c.style.display = "none"));

      btn.classList.add("active");
      const activeContent = document.getElementById(targetTab);
      if (activeContent) activeContent.style.display = "block";

      if (targetTab === "tabRecepInvoices") {
        const statusEl = document.getElementById("recepInvoiceStatusFilter");
        loadInvoices(statusEl ? statusEl.value : "");
      } else if (targetTab === "tabRecepAppts") {
        const searchEl = document.getElementById("recepApptSearch");
        const statusEl = document.getElementById("recepApptStatusFilter");
        loadAppointments(searchEl ? searchEl.value.trim() : "", statusEl ? statusEl.value : "");
      } else if (targetTab === "tabRecepPrescriptions") {
        const presSearchEl = document.getElementById("recepPrescriptionSearch");
        loadPrescriptions(presSearchEl ? presSearchEl.value.trim() : "");
      } else if (targetTab === "tabRecepPharmacy") {
        const pharmSearchEl = document.getElementById("pharmacySearch");
        const pharmStockEl = document.getElementById("pharmacyStockFilter");
        loadPharmacy(pharmSearchEl ? pharmSearchEl.value.trim() : "", pharmStockEl ? pharmStockEl.value : "");
      } else if (targetTab === "tabRecepLookup") {
        const input = document.getElementById("recepLookupInput");
        if (input && input.value.trim()) executeReceptionistLookup(input.value.trim());
      }
    });
  });

  // Tab 1: Lọc trạng thái hóa đơn & Nút Lập Hóa Đơn Mới
  const invoiceStatusFilter = document.getElementById("recepInvoiceStatusFilter");
  if (invoiceStatusFilter) {
    invoiceStatusFilter.addEventListener("change", () => {
      loadInvoices(invoiceStatusFilter.value);
    });
  }

  // Khởi tạo Modal Thanh Toán Hóa Đơn & Modal Lập Hóa Đơn Mới
  initPaymentModal();
  initCreateInvoiceModal();

  // Tab 2: Tìm kiếm & Lọc trạng thái lịch khám
  const apptSearch = document.getElementById("recepApptSearch");
  const btnApptSearch = document.getElementById("btnRecepApptSearch");
  const apptStatusFilter = document.getElementById("recepApptStatusFilter");

  if (apptStatusFilter) {
    apptStatusFilter.addEventListener("change", () => {
      loadAppointments(apptSearch ? apptSearch.value.trim() : "", apptStatusFilter.value);
    });
  }

  if (btnApptSearch && apptSearch) {
    btnApptSearch.addEventListener("click", () => {
      loadAppointments(apptSearch.value.trim());
    });
    apptSearch.addEventListener("keydown", (e) => {
      if (e.key === "Enter") loadAppointments(apptSearch.value.trim());
    });
  }

  // Tab 5: Tra cứu thông tin Lễ tân (Lookup)
  const recepLookupInput = document.getElementById("recepLookupInput");
  const btnRecepLookup = document.getElementById("btnRecepLookupExecute");
  if (btnRecepLookup && recepLookupInput) {
    btnRecepLookup.addEventListener("click", () => {
      executeReceptionistLookup(recepLookupInput.value.trim());
    });
    recepLookupInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") executeReceptionistLookup(recepLookupInput.value.trim());
    });
  }

  // Pop-up Xác nhận phiếu khám
  const btnClosePopup = document.getElementById("btnClosePopupConfirm");
  if (btnClosePopup) {
    btnClosePopup.addEventListener("click", closeConfirmPopup);
  }

  // Nút DUYỆT ĐƠN KHÁM (Bắt buộc chọn 1 BS)
  const btnExecuteConfirm = document.getElementById("btnExecuteConfirm");
  if (btnExecuteConfirm) {
    btnExecuteConfirm.addEventListener("click", async () => {
      const apptId = document.getElementById("confirmApptId").value;
      const apptType = document.getElementById("confirmApptType").value;
      const selectedDocId = document.getElementById("confirmSelectDoctor").value;

      if (!selectedDocId) {
        alert("Vui lòng chọn 1 Bác sĩ phụ trách từ danh sách để duyệt đơn khám!");
        return;
      }

      btnExecuteConfirm.disabled = true;
      btnExecuteConfirm.textContent = "Đang duyệt...";

      try {
        const res = await fetch(`${API_BASE_URL}/receptionist/appointments/${apptId}/confirm`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "x-user-id": currentUser.id || currentUser._id,
          },
          body: JSON.stringify({
            action: "confirm",
            type: apptType,
            id_bac_sy: selectedDocId,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Duyệt đơn khám thất bại.");

        alert(data.message || "Đã duyệt đơn khám và phân công bác sĩ thành công!");
        closeConfirmPopup();
        loadAppointments(apptSearch ? apptSearch.value.trim() : "", apptStatusFilter ? apptStatusFilter.value : "");
      } catch (err) {
        alert("Lỗi: " + err.message);
      } finally {
        btnExecuteConfirm.disabled = false;
        btnExecuteConfirm.textContent = "✓ Duyệt đơn khám";
      }
    });
  }

  // Nút HỦY ĐƠN KHÁM
  const btnExecuteCancel = document.getElementById("btnExecuteCancel");
  if (btnExecuteCancel) {
    btnExecuteCancel.addEventListener("click", async () => {
      const apptId = document.getElementById("confirmApptId").value;
      const apptType = document.getElementById("confirmApptType").value;
      const cancelReason = document.getElementById("confirmCancelReason").value.trim();

      if (!confirm("Bạn có chắc chắn muốn HỦY đơn khám này không?")) return;

      btnExecuteCancel.disabled = true;
      btnExecuteCancel.textContent = "Đang hủy...";

      try {
        const res = await fetch(`${API_BASE_URL}/receptionist/appointments/${apptId}/confirm`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "x-user-id": currentUser.id || currentUser._id,
          },
          body: JSON.stringify({
            action: "cancel",
            type: apptType,
            cancelReason: cancelReason || "Lễ tân hủy đơn",
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Hủy đơn khám thất bại.");

        alert(data.message || "Đã hủy đơn khám thành công.");
        closeConfirmPopup();
        loadAppointments(apptSearch ? apptSearch.value.trim() : "", apptStatusFilter ? apptStatusFilter.value : "");
      } catch (err) {
        alert("Lỗi: " + err.message);
      } finally {
        btnExecuteCancel.disabled = false;
        btnExecuteCancel.textContent = "✕ Hủy đơn khám";
      }
    });
  }

  // Tab 3: Tìm kiếm đơn thuốc
  const presSearch = document.getElementById("recepPrescriptionSearch");
  const btnPresSearch = document.getElementById("btnRecepPrescriptionSearch");
  if (btnPresSearch && presSearch) {
    btnPresSearch.addEventListener("click", () => {
      loadPrescriptions(presSearch.value.trim());
    });
    presSearch.addEventListener("keydown", (e) => {
      if (e.key === "Enter") loadPrescriptions(presSearch.value.trim());
    });
  }

  // Tab 4: Tủ thuốc / Kho thuốc
  const pharmSearch = document.getElementById("pharmacySearch");
  const pharmStockFilter = document.getElementById("pharmacyStockFilter");
  if (pharmSearch) {
    pharmSearch.addEventListener("input", () => {
      loadPharmacy(pharmSearch.value.trim(), pharmStockFilter?.value || "");
    });
  }
  if (pharmStockFilter) {
    pharmStockFilter.addEventListener("change", () => {
      loadPharmacy(pharmSearch?.value.trim() || "", pharmStockFilter.value);
    });
  }

  const btnAddMed = document.getElementById("btnAddNewMedicine");
  if (btnAddMed) {
    btnAddMed.addEventListener("click", () => openMedicineForm(null));
  }

  const btnCancelMed = document.getElementById("btnCancelMedicine");
  if (btnCancelMed) {
    btnCancelMed.addEventListener("click", () => {
      const panel = document.getElementById("medicineFormPanel");
      if (panel) panel.style.display = "none";
    });
  }

  const btnSaveMed = document.getElementById("btnSaveMedicine");
  if (btnSaveMed) {
    btnSaveMed.addEventListener("click", async () => {
      const id = document.getElementById("medFormId").value;
      const name = document.getElementById("medInputName").value.trim();
      const unit = document.getElementById("medInputUnit").value.trim();
      const price = document.getElementById("medInputPrice").value;
      const quantity = document.getElementById("medInputQty").value;
      const expiryDate = document.getElementById("medInputExpiry").value;
      const description = document.getElementById("medInputDesc").value.trim();

      if (!name || !unit || !price || quantity === "" || !expiryDate) {
        alert("Vui lòng điền đầy đủ: Tên thuốc, đơn vị, giá bán, số lượng tồn và hạn dùng!");
        return;
      }

      const body = {
        name,
        unit,
        price: Number(price),
        quantity: Number(quantity),
        expiryDate,
        description,
      };

      try {
        btnSaveMed.disabled = true;
        btnSaveMed.textContent = "Đang lưu...";

        const user = getCurrentUser() || currentUser;
        const method = id ? "PUT" : "POST";
        const url = id ? `${API_BASE_URL}/medicines/${encodeURIComponent(id)}` : `${API_BASE_URL}/medicines`;

        const res = await fetch(url, {
          method,
          headers: {
            "Content-Type": "application/json",
            "x-user-id": user.id || user._id,
          },
          body: JSON.stringify(body),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Không thể lưu thuốc.");

        alert(data.message || "Lưu thuốc thành công!");
        document.getElementById("medicineFormPanel").style.display = "none";
        loadPharmacy(pharmSearch ? pharmSearch.value.trim() : "", pharmStockFilter ? pharmStockFilter.value : "");
      } catch (err) {
        alert("Lỗi lưu thuốc: " + err.message);
      } finally {
        btnSaveMed.disabled = false;
        btnSaveMed.textContent = "Lưu thuốc";
      }
    });
  }

  // Tải dữ liệu ban đầu cho Tab 1
  await loadInvoices();
});
