/* ============================================================
   roleModals.js
   Hệ thống Modal chuyên biệt theo vai trò người dùng:
   - Bác sĩ (role_id = 2):
     1. Lịch hẹn cá nhân (lọc theo khung tháng, xem lịch tiếp theo, kèm hóa đơn)
     2. Phiếu khám bệnh cá nhân (tổng hợp hóa đơn cá nhân)
     3. Hồ sơ khám bệnh nhân dùng chung
   - Lễ tân (role_id = 3):
     1. Hóa đơn & Thanh toán (payment)
     2. Lịch khám tất cả khách hàng (dựa trên hóa đơn khách hàng)
     3. Hóa đơn thuốc bệnh nhân sau khám & Cấp thuốc theo đơn
     4. Quản lý kho thuốc (Tủ thuốc phòng khám)
   ============================================================ */

import { getCurrentUser } from "./auth.js";
import { API_BASE_URL } from "./config.js";

// Đảm bảo CSS cho các modal vai trò được nạp vào trang
function ensureModalStyles() {
  if (document.getElementById("role-modals-style")) return;
  const style = document.createElement("style");
  style.id = "role-modals-style";
  style.textContent = `
    .role-modal-overlay {
      position: fixed;
      top: 0; left: 0; width: 100vw; height: 100vh;
      background: rgba(45, 30, 20, 0.65);
      backdrop-filter: blur(4px);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 99999;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.25s ease;
    }
    .role-modal-overlay.open {
      opacity: 1;
      pointer-events: auto;
    }
    .role-modal-card {
      background: #FFFFFF;
      width: 95%;
      max-width: 1050px;
      max-height: 88vh;
      border-radius: 18px;
      box-shadow: 0 20px 45px rgba(50, 30, 15, 0.25);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      animation: modalSlideUp 0.25s ease forwards;
    }
    @keyframes modalSlideUp {
      from { transform: translateY(20px); }
      to { transform: translateY(0); }
    }
    .role-modal-header {
      background: linear-gradient(135deg, #7A4E2D 0%, #B5835A 100%);
      color: #FFF;
      padding: 16px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .role-modal-header h3 {
      margin: 0;
      font-size: 19px;
      font-family: "Lora", serif;
      color: #FFF7EE;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .role-modal-close {
      background: rgba(255,255,255,0.2);
      border: none;
      color: #FFF;
      font-size: 22px;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.2s;
    }
    .role-modal-close:hover {
      background: rgba(255,255,255,0.4);
    }
    .role-modal-toolbar {
      padding: 12px 24px;
      background: #FDFBF9;
      border-bottom: 1px solid #EFE6DD;
      display: flex;
      align-items: center;
      gap: 14px;
      flex-wrap: wrap;
    }
    .role-modal-body {
      padding: 20px 24px;
      overflow-y: auto;
      flex: 1;
    }
    .role-data-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13.5px;
    }
    .role-data-table th {
      background: #F8F4F0;
      padding: 12px 14px;
      text-align: left;
      font-weight: 700;
      color: #6B462B;
      border-bottom: 2px solid #E6D8CD;
    }
    .role-data-table td {
      padding: 12px 14px;
      border-bottom: 1px solid #F0EAE4;
      vertical-align: middle;
    }
    .role-data-table tr:hover {
      background-color: #FAF7F4;
    }
    .status-pill {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 600;
    }
    .status-pending { background: #FEF08A; color: #854D0E; }
    .status-in_progress { background: #BAE6FD; color: #0369A1; }
    .status-completed { background: #BBF7D0; color: #166534; }
    .status-cancelled { background: #FEE2E2; color: #991B1B; }
    .invoice-tag {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 6px;
      font-size: 11.5px;
      font-weight: 600;
      background: #F3E8FF;
      color: #6B21A8;
      border: 1px solid #D8B4FE;
    }
    .invoice-tag.paid {
      background: #DCFCE7;
      color: #15803D;
      border-color: #86EFAC;
    }
    .stock-badge-out {
      background: #FEE2E2;
      color: #991B1B;
      border: 1px solid #F87171;
      padding: 3px 8px;
      border-radius: 6px;
      font-size: 11.5px;
      font-weight: 700;
    }
    .stock-badge-exp {
      background: #FEF3C7;
      color: #92400E;
      border: 1px solid #FCD34D;
      padding: 3px 8px;
      border-radius: 6px;
      font-size: 11.5px;
      font-weight: 700;
    }
    .btn-action-small {
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      border: none;
      cursor: pointer;
      transition: background 0.2s;
    }
    .btn-pay { background: #16A34A; color: #fff; }
    .btn-pay:hover { background: #15803D; }
    .btn-dispense { background: #2563EB; color: #fff; }
    .btn-dispense:hover { background: #1D4ED8; }
    .btn-edit-med { background: #D97706; color: #fff; margin-right: 6px; }
    .btn-delete-med { background: #DC2626; color: #fff; }
    .admin-input, .admin-select {
      padding: 7px 12px;
      border-radius: 8px;
      border: 1.5px solid #E6D8CD;
      font-size: 13.5px;
      background: #FDFBF9;
      outline: none;
    }
    .admin-input:focus, .admin-select:focus {
      border-color: #B5835A;
    }
  `;
  document.head.appendChild(style);
}

// Tạo cấu trúc HTML các Modal nếu chưa có
function ensureModalDOM() {
  if (document.getElementById("roleModalsContainer")) return;
  const container = document.createElement("div");
  container.id = "roleModalsContainer";
  container.innerHTML = `
    <!-- ==================== BÁC SĨ MODALS ==================== -->
    <!-- 1. LỊCH HẸN BÁC SĨ (CÁ NHÂN) -->
    <div id="modalDoctorAppts" class="role-modal-overlay">
      <div class="role-modal-card">
        <div class="role-modal-header">
          <h3>📅 Lịch Hẹn Khám Cá Nhân (Bác Sĩ)</h3>
          <button class="role-modal-close" data-close="modalDoctorAppts">&times;</button>
        </div>
        <div class="role-modal-toolbar">
          <label style="font-weight: 600; font-size: 13px; color: #5C3A21;">Khung tháng:</label>
          <input type="month" id="docFilterMonth" class="admin-input" />
          <button type="button" class="pill-btn" id="btnDocApptsToday" style="padding: 6px 14px; font-size: 12.5px; background: #7A4E2D; color: #fff;">Hôm nay</button>
          <button type="button" class="pill-btn" id="btnDocApptsUpcoming" style="padding: 6px 14px; font-size: 12.5px; background: #B5835A; color: #fff;">Tất cả ca tiếp theo</button>
          <div style="flex: 1; text-align: right; font-size: 13px; color: #777;">
            Tổng lịch: <strong id="docApptsCount">0</strong>
          </div>
        </div>
        <div class="role-modal-body">
          <table class="role-data-table">
            <thead>
              <tr>
                <th>Ngày &amp; Giờ</th>
                <th>Dịch vụ</th>
                <th>Thú cưng</th>
                <th>Khách hàng</th>
                <th>Trạng thái</th>
                <th>Hóa đơn liên quan</th>
              </tr>
            </thead>
            <tbody id="docApptsTableBody">
              <tr><td colspan="6" style="text-align: center; color: #888; padding: 30px;">Đang tải lịch hẹn...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- 2. PHIẾU KHÁM BỆNH BÁC SĨ (CÁ NHÂN) -->
    <div id="modalDoctorDiagnoses" class="role-modal-overlay">
      <div class="role-modal-card">
        <div class="role-modal-header">
          <h3>📋 Phiếu Khám &amp; Chẩn Đoán Bệnh (Cá Nhân)</h3>
          <button class="role-modal-close" data-close="modalDoctorDiagnoses">&times;</button>
        </div>
        <div class="role-modal-toolbar">
          <span style="font-size: 13px; color: #666;">Tổng hợp các ca chẩn đoán và hóa đơn khám do bác sĩ phụ trách.</span>
          <div style="margin-left: auto; font-size: 13px; color: #777;">
            Tổng phiếu khám: <strong id="docDiagnosesCount">0</strong>
          </div>
        </div>
        <div class="role-modal-body">
          <table class="role-data-table">
            <thead>
              <tr>
                <th>Mã phiếu / Ngày</th>
                <th>Thú cưng</th>
                <th>Chẩn đoán lâm sàng</th>
                <th>Sinh hiệu</th>
                <th>Hóa đơn liên quan</th>
              </tr>
            </thead>
            <tbody id="docDiagnosesTableBody">
              <tr><td colspan="5" style="text-align: center; color: #888; padding: 30px;">Đang tải phiếu khám...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- 3. HỒ SƠ KHÁM BỆNH NHÂN DÙNG CHUNG -->
    <div id="modalDoctorRecords" class="role-modal-overlay">
      <div class="role-modal-card">
        <div class="role-modal-header">
          <h3>📁 Hồ Sơ Bệnh Án Thú Cưng Dùng Chung</h3>
          <button class="role-modal-close" data-close="modalDoctorRecords">&times;</button>
        </div>
        <div class="role-modal-toolbar">
          <input type="text" id="docRecordSearch" placeholder="Tìm theo tên bé, mã bệnh án, chẩn đoán..." class="admin-input" style="flex: 1; max-width: 380px;" />
          <button type="button" class="pill-btn" id="btnDocRecordSearch" style="padding: 6px 14px; font-size: 12.5px; background: #7A4E2D; color: #fff;">Tìm kiếm</button>
          <div style="margin-left: auto; font-size: 13px; color: #777;">
            Tổng hồ sơ: <strong id="docRecordsCount">0</strong>
          </div>
        </div>
        <div class="role-modal-body">
          <table class="role-data-table">
            <thead>
              <tr>
                <th>Mã bệnh án</th>
                <th>Ngày khám</th>
                <th>Thú cưng</th>
                <th>Chẩn đoán xác định</th>
                <th>Hướng điều trị</th>
              </tr>
            </thead>
            <tbody id="docRecordsTableBody">
              <tr><td colspan="5" style="text-align: center; color: #888; padding: 30px;">Đang tải hồ sơ bệnh án...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- ==================== LỄ TÂN MODALS ==================== -->
    <!-- 1. HÓA ĐƠN & THANH TOÁN (PAYMENT) -->
    <div id="modalRecepInvoices" class="role-modal-overlay">
      <div class="role-modal-card">
        <div class="role-modal-header">
          <h3>💳 Quản Lý Hóa Đơn &amp; Thanh Toán (Thu Ngân)</h3>
          <button class="role-modal-close" data-close="modalRecepInvoices">&times;</button>
        </div>
        <div class="role-modal-toolbar">
          <label style="font-weight: 600; font-size: 13px; color: #5C3A21;">Trạng thái:</label>
          <select id="recepInvoiceStatusFilter" class="admin-select">
            <option value="">-- Tất cả hóa đơn --</option>
            <option value="unpaid">Chưa thanh toán (unpaid)</option>
            <option value="paid">Đã thanh toán (paid)</option>
          </select>
          <div style="margin-left: auto; font-size: 13px; color: #777;">
            Tổng hóa đơn: <strong id="recepInvoicesCount">0</strong>
          </div>
        </div>
        <div class="role-modal-body">
          <table class="role-data-table">
            <thead>
              <tr>
                <th>Mã HĐ</th>
                <th>Khách hàng</th>
                <th>Tổng tiền</th>
                <th>Trạng thái</th>
                <th>Thời điểm lập</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody id="recepInvoicesTableBody">
              <tr><td colspan="6" style="text-align: center; color: #888; padding: 30px;">Đang tải danh sách hóa đơn...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- 2. LỊCH KHÁM TẤT CẢ KHÁCH HÀNG (DỰA TRÊN HÓA ĐƠN KHÁCH HÀNG) -->
    <div id="modalRecepAllAppts" class="role-modal-overlay">
      <div class="role-modal-card">
        <div class="role-modal-header">
          <h3>📅 Lịch Khám Tất Cả Khách Hàng (Kèm Hóa Đơn)</h3>
          <button class="role-modal-close" data-close="modalRecepAllAppts">&times;</button>
        </div>
        <div class="role-modal-toolbar">
          <input type="text" id="recepApptSearch" placeholder="Tìm tên khách, SĐT, tên bé, mã lịch..." class="admin-input" style="flex: 1; max-width: 320px;" />
          <button type="button" class="pill-btn" id="btnRecepApptSearch" style="padding: 6px 14px; font-size: 12.5px; background: #7A4E2D; color: #fff;">Tìm kiếm</button>
          <div style="margin-left: auto; font-size: 13px; color: #777;">
            Tổng ca hẹn: <strong id="recepApptsCount">0</strong>
          </div>
        </div>
        <div class="role-modal-body">
          <table class="role-data-table">
            <thead>
              <tr>
                <th>Ngày &amp; Giờ</th>
                <th>Dịch vụ</th>
                <th>Bé cưng</th>
                <th>Khách hàng</th>
                <th>Bác sĩ / Nhân viên</th>
                <th>Trạng thái</th>
                <th>Hóa đơn đi kèm</th>
              </tr>
            </thead>
            <tbody id="recepAllApptsTableBody">
              <tr><td colspan="7" style="text-align: center; color: #888; padding: 30px;">Đang tải lịch khám toàn viện...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- 3. HÓA ĐƠN THUỐC BỆNH NHÂN SAU KHÁM & CẤP THUỐC -->
    <div id="modalRecepPrescriptions" class="role-modal-overlay">
      <div class="role-modal-card">
        <div class="role-modal-header">
          <h3>💊 Hóa Đơn Thuốc Sau Khám &amp; Cấp Thuốc Theo Đơn</h3>
          <button class="role-modal-close" data-close="modalRecepPrescriptions">&times;</button>
        </div>
        <div class="role-modal-toolbar">
          <input type="text" id="recepPrescriptionSearch" placeholder="Tìm mã đơn, tên bé, bác sĩ chẩn đoán..." class="admin-input" style="flex: 1; max-width: 350px;" />
          <button type="button" class="pill-btn" id="btnRecepPrescriptionSearch" style="padding: 6px 14px; font-size: 12.5px; background: #7A4E2D; color: #fff;">Tìm kiếm</button>
          <div style="margin-left: auto; font-size: 13px; color: #777;">
            Tổng đơn thuốc: <strong id="recepPrescriptionsCount">0</strong>
          </div>
        </div>
        <div class="role-modal-body">
          <table class="role-data-table">
            <thead>
              <tr>
                <th>Mã đơn / Ngày</th>
                <th>Bé thú cưng</th>
                <th>Bác sĩ &amp; Chẩn đoán</th>
                <th>Thuốc kê trong đơn</th>
                <th>Cấp thuốc</th>
                <th>Hóa đơn thuốc</th>
              </tr>
            </thead>
            <tbody id="recepPrescriptionsTableBody">
              <tr><td colspan="6" style="text-align: center; color: #888; padding: 30px;">Đang tải danh sách đơn thuốc...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- 4. QUẢN LÝ KHO THUỐC (TỦ THUỐC) -->
    <div id="modalRecepPharmacy" class="role-modal-overlay">
      <div class="role-modal-card" style="max-width: 1100px;">
        <div class="role-modal-header">
          <h3>📦 Quản Lý Kho Thuốc (Tủ Thuốc Phòng Khám)</h3>
          <button class="role-modal-close" data-close="modalRecepPharmacy">&times;</button>
        </div>
        <div class="role-modal-toolbar">
          <input type="text" id="pharmacySearch" placeholder="Tìm tên thuốc, hoạt chất..." class="admin-input" style="flex: 1; max-width: 300px;" />
          <select id="pharmacyStockFilter" class="admin-select">
            <option value="">-- Tất cả kho --</option>
            <option value="Còn hàng">Còn hàng</option>
            <option value="Hết hàng">Hết hàng (Hết tồn kho)</option>
            <option value="Hết hạn">Hết hạn (Quá hạn dùng)</option>
          </select>
          <button type="button" class="pill-btn" id="btnAddNewMedicine" style="padding: 7px 16px; font-size: 12.5px; background: #7A4E2D; color: #fff; font-weight: 700;">
            ➕ Thêm thuốc mới
          </button>
          <div style="margin-left: auto; font-size: 13px; color: #777;">
            Tổng loại thuốc: <strong id="pharmacyMedicinesCount">0</strong>
          </div>
        </div>
        <div class="role-modal-body">
          <!-- Form Thêm / Sửa thuốc (ẩn mặc định) -->
          <div id="medicineFormPanel" style="display: none; background: #F8F4F0; padding: 18px 20px; border-radius: 12px; margin-bottom: 20px; border: 1.5px solid #E6D8CD;">
            <h4 id="medFormTitle" style="margin: 0 0 12px 0; color: #6B462B;">➕ Thêm Thuốc Mới Vào Kho</h4>
            <input type="hidden" id="medFormId" />
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; margin-bottom: 12px;">
              <div>
                <label style="font-size: 12px; font-weight: 600; color: #4A3324;">Tên thuốc *:</label>
                <input type="text" id="medInputName" class="admin-input" style="width: 100%; box-sizing: border-box;" placeholder="vd: Amoxicillin 250mg" />
              </div>
              <div>
                <label style="font-size: 12px; font-weight: 600; color: #4A3324;">Đơn vị *:</label>
                <input type="text" id="medInputUnit" class="admin-input" style="width: 100%; box-sizing: border-box;" placeholder="vd: viên, chai, lọ, ống..." />
              </div>
              <div>
                <label style="font-size: 12px; font-weight: 600; color: #4A3324;">Giá bán (VNĐ) *:</label>
                <input type="number" id="medInputPrice" class="admin-input" style="width: 100%; box-sizing: border-box;" placeholder="vd: 15000" min="1" />
              </div>
              <div>
                <label style="font-size: 12px; font-weight: 600; color: #4A3324;">Số lượng tồn (Quantity) *:</label>
                <input type="number" id="medInputQty" class="admin-input" style="width: 100%; box-sizing: border-box;" placeholder="vd: 100" min="0" />
              </div>
              <div>
                <label style="font-size: 12px; font-weight: 600; color: #4A3324;">Hạn dùng (Expiry Date) *:</label>
                <input type="date" id="medInputExpiry" class="admin-input" style="width: 100%; box-sizing: border-box;" />
              </div>
              <div>
                <label style="font-size: 12px; font-weight: 600; color: #4A3324;">Mô tả / Lưu ý:</label>
                <input type="text" id="medInputDesc" class="admin-input" style="width: 100%; box-sizing: border-box;" placeholder="Mô tả công dụng..." />
              </div>
            </div>
            <div style="display: flex; gap: 10px;">
              <button type="button" id="btnSaveMedicine" class="pill-btn" style="background: #16A34A; color: #fff; padding: 7px 18px; font-size: 13px;">Lưu thuốc</button>
              <button type="button" id="btnCancelMedicine" class="pill-btn" style="background: #9CA3AF; color: #fff; padding: 7px 14px; font-size: 13px;">Hủy bỏ</button>
            </div>
          </div>

          <!-- Bảng danh sách thuốc -->
          <table class="role-data-table">
            <thead>
              <tr>
                <th>Mã &amp; Tên thuốc</th>
                <th>Đơn vị</th>
                <th>Đơn giá</th>
                <th>Tồn kho (Số lượng)</th>
                <th>Hạn dùng</th>
                <th>Trạng thái</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody id="pharmacyTableBody">
              <tr><td colspan="7" style="text-align: center; color: #888; padding: 30px;">Đang tải danh sách kho thuốc...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(container);

  // Gắn sự kiện đóng modal
  container.querySelectorAll(".role-modal-close").forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetId = btn.dataset.close;
      closeRoleModal(targetId);
    });
  });

  // Đóng khi click ngoài backdrop
  container.querySelectorAll(".role-modal-overlay").forEach((overlay) => {
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        overlay.classList.remove("open");
      }
    });
  });
}

export function openRoleModal(modalId) {
  ensureModalStyles();
  ensureModalDOM();
  const el = document.getElementById(modalId);
  if (el) el.classList.add("open");
}

export function closeRoleModal(modalId) {
  const el = document.getElementById(modalId);
  if (el) el.classList.remove("open");
}

/* ============================================================
   BÁC SĨ (role_id = 2) - CÁC HÀM XỬ LÝ DỮ LIỆU
   ============================================================ */

export async function loadDoctorAppointments(filter = {}) {
  const user = getCurrentUser();
  if (!user) return;

  const tbody = document.getElementById("docApptsTableBody");
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #888; padding: 30px;">Đang tải lịch hẹn...</td></tr>`;

  try {
    const params = new URLSearchParams();
    if (filter.month) params.append("month", filter.month);
    if (filter.date) params.append("date", filter.date);
    if (user.id_bac_sy) params.append("id_bac_sy", user.id_bac_sy);

    const res = await fetch(`${API_BASE_URL}/doctor/appointments?${params.toString()}`, {
      headers: { "x-user-id": user.id || user._id },
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Không thể tải lịch hẹn.");

    const list = data.appointments || [];
    const countEl = document.getElementById("docApptsCount");
    if (countEl) countEl.textContent = list.length;

    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #888; padding: 30px;">Chưa có lịch hẹn nào trong khung thời gian này.</td></tr>`;
      return;
    }

    tbody.innerHTML = list
      .map((item) => {
        let statusClass = "status-pending";
        let statusLabel = item.status || "Chờ";
        if (item.status === "in_progress" || item.status === "Đang làm") {
          statusClass = "status-in_progress";
          statusLabel = "Đang làm";
        } else if (item.status === "completed" || item.status === "Đã xác nhận") {
          statusClass = "status-completed";
          statusLabel = "Hoàn thành";
        } else if (item.status === "cancelled" || item.status === "Đã hủy") {
          statusClass = "status-cancelled";
          statusLabel = "Đã hủy";
        }

        const invoicesHtml = (item.invoices || [])
          .map(
            (inv) => `
            <div style="margin-bottom: 4px;">
              <span class="invoice-tag ${inv.status === "paid" ? "paid" : ""}">
                ${inv.invoiceCode} - ${(inv.totalAmount || 0).toLocaleString("vi-VN")}đ (${inv.status === "paid" ? "Đã TT" : "Chưa TT"})
              </span>
            </div>`
          )
          .join("") || '<span style="color: #999; font-size: 12px;">Chưa có HĐ</span>';

        return `
          <tr>
            <td>
              <strong>${item.date}</strong><br/>
              <span style="color: #7A4E2D; font-weight: 600;">${item.startTime || "--:--"}</span>
            </td>
            <td>
              <span style="font-weight: 600;">${item.serviceName}</span><br/>
              <span style="font-size: 12px; color: #888;">${item.type === "grooming" ? "Spa / Grooming" : "Khám thú y"}</span>
            </td>
            <td><strong>${item.petName}</strong></td>
            <td>
              ${item.customerName}<br/>
              <small style="color: #666;">${item.customerPhone}</small>
            </td>
            <td><span class="status-pill ${statusClass}">${statusLabel}</span></td>
            <td>${invoicesHtml}</td>
          </tr>
        `;
      })
      .join("");
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #c53030; padding: 30px;">${err.message}</td></tr>`;
  }
}

export async function loadDoctorDiagnoses() {
  const user = getCurrentUser();
  if (!user) return;

  const tbody = document.getElementById("docDiagnosesTableBody");
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #888; padding: 30px;">Đang tải phiếu khám...</td></tr>`;

  try {
    const res = await fetch(`${API_BASE_URL}/doctor/diagnoses`, {
      headers: { "x-user-id": user.id || user._id },
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Không thể tải phiếu khám.");

    const list = data.diagnoses || [];
    const countEl = document.getElementById("docDiagnosesCount");
    if (countEl) countEl.textContent = list.length;

    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #888; padding: 30px;">Chưa có phiếu khám nào được phân công.</td></tr>`;
      return;
    }

    tbody.innerHTML = list
      .map((d) => {
        const invoicesHtml = (d.invoices || [])
          .map(
            (inv) => `
            <div style="margin-bottom: 3px;">
              <span class="invoice-tag ${inv.status === "paid" ? "paid" : ""}">
                ${inv.invoiceCode} - ${(inv.totalAmount || 0).toLocaleString("vi-VN")}đ (${inv.status === "paid" ? "Đã TT" : "Chưa TT"})
              </span>
            </div>`
          )
          .join("") || '<span style="color: #999; font-size: 12px;">Chưa lập HĐ</span>';

        const vitals = d.vitalSigns || {};
        const vitalsStr = `T: ${vitals.temperature || "--"}°C | W: ${vitals.weight || "--"}kg | HR: ${vitals.heartRate || "--"}`;

        return `
          <tr>
            <td>
              <strong>${d.diagnosisCode}</strong><br/>
              <small style="color: #777;">${d.date || ""}</small>
            </td>
            <td>
              <strong>${d.petName || "Bé cưng"}</strong><br/>
              <small style="color: #888;">${d.petSpecies || "Thú cưng"}</small>
            </td>
            <td>
              <strong>${d.confirmedDiagnosis || d.category || "Khám tổng quát"}</strong><br/>
              <span style="font-size: 12px; color: #666;">${d.treatmentPlan || "Đang theo dõi điều trị"}</span>
            </td>
            <td><small style="color: #555;">${vitalsStr}</small></td>
            <td>${invoicesHtml}</td>
          </tr>
        `;
      })
      .join("");
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #c53030; padding: 30px;">${err.message}</td></tr>`;
  }
}

export async function loadDoctorMedicalRecords(search = "") {
  const user = getCurrentUser();
  if (!user) return;

  const tbody = document.getElementById("docRecordsTableBody");
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #888; padding: 30px;">Đang tải hồ sơ bệnh án...</td></tr>`;

  try {
    const params = new URLSearchParams();
    if (search) params.append("search", search);

    const res = await fetch(`${API_BASE_URL}/doctor/medical-records?${params.toString()}`, {
      headers: { "x-user-id": user.id || user._id },
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Không thể tải hồ sơ.");

    const list = data.records || [];
    const countEl = document.getElementById("docRecordsCount");
    if (countEl) countEl.textContent = list.length;

    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #888; padding: 30px;">Không tìm thấy hồ sơ bệnh án nào.</td></tr>`;
      return;
    }

    tbody.innerHTML = list
      .map(
        (r) => `
        <tr>
          <td><strong>${r.recordCode}</strong></td>
          <td>${r.date || ""}<br/><small style="color: #888;">${r.veterinarian || ""}</small></td>
          <td>
            <strong>${r.petName}</strong><br/>
            <small style="color: #777;">${r.petSpecies || ""}</small>
          </td>
          <td><span style="color: #7A4E2D; font-weight: 600;">${r.confirmedDiagnosis || r.title || "Khám điều trị"}</span></td>
          <td><small style="color: #555;">${r.treatmentPlan || "Theo dõi định kỳ"}</small></td>
        </tr>
      `
      )
      .join("");
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #c53030; padding: 30px;">${err.message}</td></tr>`;
  }
}

/* ============================================================
   LỄ TÂN (role_id = 3) - CÁC HÀM XỬ LÝ DỮ LIỆU
   ============================================================ */

// 1. TẢI VÀ THANH TOÁN HÓA ĐƠN (PAYMENT)
export async function loadRecepInvoices(status = "") {
  const user = getCurrentUser();
  if (!user) return;

  const tbody = document.getElementById("recepInvoicesTableBody");
  if (!tbody) return;
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
            <td><strong style="color: #7A4E2D;">${(inv.totalAmount || 0).toLocaleString("vi-VN")}đ</strong></td>
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

    // Gắn sự kiện thanh toán hóa đơn
    tbody.querySelectorAll(".btn-pay").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const invId = btn.dataset.invoiceId;
        const amount = Number(btn.dataset.amount);
        const method = confirm(`Xác nhận thanh toán ${(amount).toLocaleString("vi-VN")}đ bằng TIỀN MẶT? (Bấm Cancel nếu muốn Chuyển khoản)`) ? "cash" : "transfer";

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
          loadRecepInvoices(status);
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

// 2. TẢI VÀ HIỂN THỊ LỊCH KHÁM TẤT CẢ KHÁCH HÀNG (KÈM HÓA ĐƠN)
export async function loadRecepAllAppointments(search = "") {
  const user = getCurrentUser();
  if (!user) return;

  const tbody = document.getElementById("recepAllApptsTableBody");
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #888; padding: 30px;">Đang tải lịch khám toàn viện...</td></tr>`;

  try {
    const params = new URLSearchParams();
    if (search) params.append("search", search);

    const res = await fetch(`${API_BASE_URL}/receptionist/appointments?${params.toString()}`, {
      headers: { "x-user-id": user.id || user._id },
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Không thể tải lịch khám.");

    const list = data.appointments || [];
    const countEl = document.getElementById("recepApptsCount");
    if (countEl) countEl.textContent = list.length;

    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #888; padding: 30px;">Không có lịch khám nào trong hệ thống.</td></tr>`;
      return;
    }

    tbody.innerHTML = list
      .map((item) => {
        let statusClass = "status-pending";
        let statusLabel = item.status || "Chờ xác nhận";
        if (item.status === "in_progress" || item.status === "Đang làm") {
          statusClass = "status-in_progress";
          statusLabel = "Đang làm";
        } else if (item.status === "completed" || item.status === "Đã xác nhận") {
          statusClass = "status-completed";
          statusLabel = "Đã xác nhận";
        } else if (item.status === "cancelled" || item.status === "Đã hủy") {
          statusClass = "status-cancelled";
          statusLabel = "Đã hủy";
        }

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
              <span style="color: #7A4E2D; font-weight: 600;">${item.time || "--:--"}</span>
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
            <td><span class="status-pill ${statusClass}">${statusLabel}</span></td>
            <td>${invoicesHtml}</td>
          </tr>
        `;
      })
      .join("");
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #c53030; padding: 30px;">${err.message}</td></tr>`;
  }
}

// 3. TẢI VÀ HIỂN THỊ ĐƠN THUỐC SAU KHÁM & CẤP THUỐC
export async function loadRecepPrescriptions(search = "") {
  const user = getCurrentUser();
  if (!user) return;

  const tbody = document.getElementById("recepPrescriptionsTableBody");
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #888; padding: 30px;">Đang tải danh sách đơn thuốc...</td></tr>`;

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

    // Gắn sự kiện Cấp thuốc & Xuất hóa đơn
    tbody.querySelectorAll(".btn-dispense").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const presCode = btn.dataset.presCode;
        if (!confirm(`Xác nhận cấp thuốc và lập hóa đơn cho đơn [${presCode}]? (Hệ thống sẽ tự động trừ số lượng tồn kho)`)) return;

        try {
          btn.disabled = true;
          btn.textContent = "Đang cấp...";

          // 1. Cấp thuốc
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

          // 2. Tự động lập hóa đơn từ lượt cấp thuốc
          if (dispensingId) {
            await fetch(`${API_BASE_URL}/invoices/from-dispensing/${dispensingId}`, {
              method: "POST",
              headers: { "x-user-id": user.id || user._id },
            });
          }

          alert("Cấp thuốc thành công và đã xuất hóa đơn tiền thuốc!");
          loadRecepPrescriptions(search);
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

// 4. QUẢN LÝ KHO THUỐC (TỦ THUỐC)
export async function loadRecepPharmacy(search = "", stockStatus = "") {
  const user = getCurrentUser();
  if (!user) return;

  const tbody = document.getElementById("pharmacyTableBody");
  if (!tbody) return;
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
            <td><strong style="color: #7A4E2D;">${(m.price || 0).toLocaleString("vi-VN")}đ</strong></td>
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

    // Sự kiện Sửa thuốc
    tbody.querySelectorAll(".btn-edit-med").forEach((btn) => {
      btn.addEventListener("click", () => {
        const m = JSON.parse(btn.dataset.json.replace(/&#39;/g, "'"));
        openMedicineForm(m);
      });
    });

    // Sự kiện Xóa thuốc (có xác nhận trước khi xóa)
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
          loadRecepPharmacy(search, stockStatus);
        } catch (err) {
          alert("Lỗi: " + err.message);
        }
      });
    });
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #c53030; padding: 30px;">${err.message}</td></tr>`;
  }
}

// Mở Form Thêm / Sửa thuốc
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
    if (medicine.expiryDate) {
      expInput.value = new Date(medicine.expiryDate).toISOString().split("T")[0];
    } else {
      expInput.value = "";
    }
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

// Khởi tạo các sự kiện lọc và nút trên modal
export function initModalFilters() {
  ensureModalStyles();
  ensureModalDOM();

  // BÁC SĨ: Khung tháng
  const monthInput = document.getElementById("docFilterMonth");
  if (monthInput) {
    const now = new Date();
    const curMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    monthInput.value = curMonth;
    monthInput.addEventListener("change", () => {
      loadDoctorAppointments({ month: monthInput.value });
    });
  }

  // BÁC SĨ: Hôm nay & Tiếp theo
  const btnToday = document.getElementById("btnDocApptsToday");
  if (btnToday) {
    btnToday.addEventListener("click", () => {
      const now = new Date();
      const todayStr = `${String(now.getDate()).padStart(2, "0")}/${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}`;
      loadDoctorAppointments({ date: todayStr });
    });
  }
  const btnUpcoming = document.getElementById("btnDocApptsUpcoming");
  if (btnUpcoming) {
    btnUpcoming.addEventListener("click", () => {
      loadDoctorAppointments({});
    });
  }

  // BÁC SĨ: Tìm kiếm hồ sơ bệnh án
  const recordSearchInput = document.getElementById("docRecordSearch");
  const btnRecordSearch = document.getElementById("btnDocRecordSearch");
  if (btnRecordSearch && recordSearchInput) {
    btnRecordSearch.addEventListener("click", () => {
      loadDoctorMedicalRecords(recordSearchInput.value.trim());
    });
  }

  // LỄ TÂN 1: Hóa đơn
  const recepInvoiceFilter = document.getElementById("recepInvoiceStatusFilter");
  if (recepInvoiceFilter) {
    recepInvoiceFilter.addEventListener("change", () => {
      loadRecepInvoices(recepInvoiceFilter.value);
    });
  }

  // LỄ TÂN 2: Lịch khám tất cả khách hàng
  const apptSearchInput = document.getElementById("recepApptSearch");
  const btnApptSearch = document.getElementById("btnRecepApptSearch");
  if (btnApptSearch && apptSearchInput) {
    btnApptSearch.addEventListener("click", () => {
      loadRecepAllAppointments(apptSearchInput.value.trim());
    });
  }

  // LỄ TÂN 3: Đơn thuốc & Cấp thuốc
  const presSearchInput = document.getElementById("recepPrescriptionSearch");
  const btnPresSearch = document.getElementById("btnRecepPrescriptionSearch");
  if (btnPresSearch && presSearchInput) {
    btnPresSearch.addEventListener("click", () => {
      loadRecepPrescriptions(presSearchInput.value.trim());
    });
  }

  // LỄ TÂN 4: Tủ thuốc / Kho thuốc
  const pharmSearch = document.getElementById("pharmacySearch");
  const pharmFilter = document.getElementById("pharmacyStockFilter");
  if (pharmSearch) {
    pharmSearch.addEventListener("input", () => {
      loadRecepPharmacy(pharmSearch.value.trim(), pharmFilter?.value || "");
    });
  }
  if (pharmFilter) {
    pharmFilter.addEventListener("change", () => {
      loadRecepPharmacy(pharmSearch?.value.trim() || "", pharmFilter.value);
    });
  }

  // Nút Mở form thêm thuốc mới
  const btnAddMed = document.getElementById("btnAddNewMedicine");
  if (btnAddMed) {
    btnAddMed.addEventListener("click", () => {
      openMedicineForm(null);
    });
  }

  // Nút Hủy form thuốc
  const btnCancelMed = document.getElementById("btnCancelMedicine");
  if (btnCancelMed) {
    btnCancelMed.addEventListener("click", () => {
      const panel = document.getElementById("medicineFormPanel");
      if (panel) panel.style.display = "none";
    });
  }

  // Nút Lưu thuốc
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
        loadRecepPharmacy();
      } catch (err) {
        alert("Lỗi lưu thuốc: " + err.message);
      } finally {
        btnSaveMed.disabled = false;
        btnSaveMed.textContent = "Lưu thuốc";
      }
    });
  }
}
