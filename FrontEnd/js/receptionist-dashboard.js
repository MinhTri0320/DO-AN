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
        const actionBtn = isPaid
          ? `<span style="color: #15803D; font-size: 12px; font-weight: 600;">✓ Đã thu tiền</span>`
          : `<button class="btn-action-small btn-pay" data-invoice-id="${inv._id}" data-amount="${inv.totalAmount}">Thanh toán</button>`;

        return `
          <tr>
            <td><strong>${inv.invoiceCode}</strong></td>
            <td>
              ${inv.customerName || inv.customerId?.name || "Khách hàng"}<br/>
              <small style="color: #666;">${inv.customerPhone || inv.customerId?.phone || ""}</small>
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
      btn.addEventListener("click", async () => {
        const invId = btn.dataset.invoiceId;
        const amount = Number(btn.dataset.amount);
        const method = confirm(`Xác nhận thanh toán ${(amount).toLocaleString("vi-VN")}đ bằng TIỀN MẶT? (Chọn Cancel nếu Chuyển khoản)`) ? "cash" : "transfer";

        try {
          btn.disabled = true;
          btn.textContent = "Đang xử lý...";
          const payRes = await fetch(`${API_BASE_URL}/payments`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-user-id": user.id || user._id,
            },
            body: JSON.stringify({
              invoiceId: invId,
              amount: amount,
              paymentMethod: method,
              cashier: user.name || "Lễ tân",
            }),
          });
          const payData = await payRes.json();
          if (!payRes.ok) throw new Error(payData.message || "Thanh toán thất bại.");
          alert(payData.message || "Thanh toán thành công!");
          loadInvoices(status);
        } catch (err) {
          alert("Lỗi thanh toán: " + err.message);
          btn.disabled = false;
          btn.textContent = "Thanh toán";
        }
      });
    });
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #c53030; padding: 30px;">${err.message}</td></tr>`;
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
                ${inv.invoiceCode} - ${(inv.totalAmount || 0).toLocaleString("vi-VN")}đ (${inv.status === "paid" ? "Đã TT" : "Chưa TT"})
              </span>
            </div>`
          )
          .join("") || '<span style="color: #999; font-size: 12px;">Chưa xuất HĐ</span>';

        return `
          <tr>
            <td>
              <strong>${item.date}</strong><br/>
              <span style="color: #1E429F; font-weight: 700;">${item.time || "--:--"}</span>
            </td>
            <td>
              <strong>${item.serviceName}</strong><br/>
              <small style="color: #888;">${item.typeName}</small>
            </td>
            <td><strong>${item.petName}</strong></td>
            <td>
              ${item.customerName}<br/>
              <small style="color: #666;">${item.customerPhone}</small>
            </td>
            <td><small style="color: #555;">${item.doctorName}</small></td>
            <td>
              <span class="status-pill status-pending status-clickable btn-open-confirm" data-item='${JSON.stringify(item).replace(/'/g, "&#39;")}' title="Nhấp để Duyệt hoặc Hủy đơn khám">
                Chờ xác nhận 👆
              </span>
            </td>
            <td>${invoicesHtml}</td>
          </tr>
        `;
      })
      .join("");

    // Gắn sự kiện click mở pop-up xác nhận phiếu khám
    tbody.querySelectorAll(".btn-open-confirm").forEach((el) => {
      el.addEventListener("click", () => {
        const item = JSON.parse(el.dataset.item.replace(/&#39;/g, "'"));
        openConfirmPopup(item);
      });
    });
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #c53030; padding: 30px;">${err.message}</td></tr>`;
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
        .map((d) => `<option value="${d.id_bac_sy}">BS. ${d.name} (${d.id_bac_sy}) - ${d.specialty || "Thú y"}</option>`)
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
          .map((m) => `• <strong>${m.name}</strong> (${m.quantity || "1"}): ${m.dosage || ""}`)
          .join("<br/>") || '<span style="color: #999;">Không có thuốc</span>';

        const dispenseAction = p.isDispensed
          ? `<span style="color: #166534; font-weight: 600; font-size: 12px;">✓ Đã cấp [${p.dispensing.dispensingCode}]</span>`
          : `<button class="btn-action-small btn-dispense" data-pres-code="${p.prescriptionCode}">Cấp thuốc &amp; Xuất HĐ</button>`;

        const invoiceHtml = p.invoice
          ? `<span class="invoice-tag ${p.invoice.status === "paid" ? "paid" : ""}">
              ${p.invoice.invoiceCode} - ${(p.invoice.totalAmount || 0).toLocaleString("vi-VN")}đ (${p.invoice.status === "paid" ? "Đã TT" : "Chưa TT"})
            </span>`
          : '<span style="color: #888; font-size: 12px;">Chưa lập hóa đơn</span>';

        return `
          <tr>
            <td>
              <strong>${p.prescriptionCode}</strong><br/>
              <small style="color: #777;">${p.date}</small>
            </td>
            <td>
              <strong>${p.petName}</strong><br/>
              <small style="color: #888;">${p.petSpecies}</small>
            </td>
            <td>
              <strong>${p.diagnosis}</strong><br/>
              <small style="color: #555;">${p.veterinarian}</small>
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
            await fetch(`${API_BASE_URL}/invoices/from-dispensing/${dispensingId}`, {
              method: "POST",
              headers: { "x-user-id": user.id || user._id },
            });
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
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #c53030; padding: 30px;">${err.message}</td></tr>`;
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
          <tr data-med-id="${m._id}">
            <td>
              <strong>${m.name}</strong><br/>
              <small style="color: #888;">${m.medicineCode || ""} ${m.activeIngredient ? `(${m.activeIngredient})` : ""}</small>
            </td>
            <td>${m.unit}</td>
            <td><strong style="color: #1E429F;">${(m.price || 0).toLocaleString("vi-VN")}đ</strong></td>
            <td>
              <strong>${m.quantity}</strong> ${m.unit}
              ${m.isOutOfStock ? `<br/><span class="stock-badge-out">Hết hàng</span>` : ""}
            </td>
            <td>
              ${expDateStr}
              ${m.isExpired ? `<br/><span class="stock-badge-exp">Hết hạn</span>` : ""}
            </td>
            <td>${statusBadge}</td>
            <td>
              <button class="btn-action-small btn-edit-med" data-json='${JSON.stringify(m).replace(/'/g, "&#39;")}'>Sửa</button>
              <button class="btn-action-small btn-delete-med" data-id="${m._id}" data-name="${m.name}">Xóa</button>
            </td>
          </tr>
        `;
      })
      .join("");

    tbody.querySelectorAll(".btn-edit-med").forEach((btn) => {
      btn.addEventListener("click", () => {
        const m = JSON.parse(btn.dataset.json.replace(/&#39;/g, "'"));
        openMedicineForm(m);
      });
    });

    tbody.querySelectorAll(".btn-delete-med").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const medId = btn.dataset.id;
        const medName = btn.dataset.name;
        if (!confirm(`Bạn có chắc chắn muốn xóa thuốc "${medName}" khỏi kho không?`)) return;

        try {
          const delRes = await fetch(`${API_BASE_URL}/medicines/${medId}`, { method: "DELETE" });
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
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #c53030; padding: 30px;">${err.message}</td></tr>`;
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
      const res = await fetch(`${API_BASE_URL}/grooming-meta/customers`);
      const data = await res.json();
      recepCustomersCache = data.customers || [];
      if (customerSelect) {
        customerSelect.innerHTML = `<option value="">-- Chọn khách hàng --</option>` +
          recepCustomersCache.map(c => `<option value="${c.id}">${escapeHTML(c.name)} (${c.phone || "Chưa có SĐT"})</option>`).join("");
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
          cust.pets.map(p => `<option value="${p.id}">${escapeHTML(p.name)} (${p.species || "Thú cưng"})</option>`).join("");
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
        await loadInvoices();
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
                  <td><strong>${inv.invoiceCode}</strong></td>
                  <td>${inv.customerName || "—"}</td>
                  <td>${inv.customerPhone || "—"}</td>
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
              ${appointments.map(a => `
                <tr>
                  <td><strong>${a.bookingCode}</strong></td>
                  <td>${a.serviceName}</td>
                  <td>${a.petName}</td>
                  <td>${a.ownerName} (${a.ownerPhone})</td>
                  <td>${a.date} - ${a.time}</td>
                  <td><span class="status-pill status-${a.status === 'Đã xác nhận' ? 'completed' : 'pending'}">${a.status}</span></td>
                </tr>
              `).join("")}
              ${groomings.map(g => `
                <tr>
                  <td><strong>${g.groomingCode}</strong></td>
                  <td>${g.serviceName}</td>
                  <td>${g.petName}</td>
                  <td>${g.customerName} (${g.customerPhone})</td>
                  <td>${g.date} - ${g.startTime}</td>
                  <td><span class="status-pill status-${g.status === 'completed' ? 'completed' : 'pending'}">${g.status}</span></td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      `;
    }

    // 3. Khách hàng & Thú cưng
    if (customers.length > 0 || pets.length > 0) {
      html += `
        <div style="display: flex; gap: 20px; flex-wrap: wrap;">
          ${customers.length > 0 ? `
            <div style="flex: 1; min-width: 280px;">
              <h4 style="margin: 0 0 10px 0; color: #1E429F;">👤 Khách Hàng (${customers.length})</h4>
              <ul style="padding-left: 20px; line-height: 1.8;">
                ${customers.map(c => `<li><strong>${c.name || c.fullName}</strong> - SĐT: ${c.phone || "Chưa có"}</li>`).join("")}
              </ul>
            </div>
          ` : ""}
          ${pets.length > 0 ? `
            <div style="flex: 1; min-width: 280px;">
              <h4 style="margin: 0 0 10px 0; color: #1E429F;">🐾 Thú Cưng (${pets.length})</h4>
              <ul style="padding-left: 20px; line-height: 1.8;">
                ${pets.map(p => `<li><strong>${p.name}</strong> (${p.species || "Thú cưng"} ${p.breed ? "- " + p.breed : ""})</li>`).join("")}
              </ul>
            </div>
          ` : ""}
        </div>
      `;
    }

    container.innerHTML = html;
  } catch (err) {
    container.innerHTML = `<div style="text-align: center; color: #c53030; padding: 30px;">Lỗi: ${err.message}</div>`;
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

      if (targetTab === "tabRecepInvoices") loadInvoices();
      else if (targetTab === "tabRecepAppts") loadAppointments();
      else if (targetTab === "tabRecepPrescriptions") loadPrescriptions();
      else if (targetTab === "tabRecepPharmacy") loadPharmacy();
      else if (targetTab === "tabRecepLookup") {
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

  // Khởi tạo Modal Lập Hóa Đơn Mới
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
        loadAppointments();
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
        loadAppointments();
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

        const method = id ? "PUT" : "POST";
        const url = id ? `${API_BASE_URL}/medicines/${id}` : `${API_BASE_URL}/medicines`;

        const res = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Không thể lưu thuốc.");

        alert(data.message || "Lưu thuốc thành công!");
        document.getElementById("medicineFormPanel").style.display = "none";
        loadPharmacy();
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
