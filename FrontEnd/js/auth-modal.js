/* ============================================================
   auth-modal.js
   Hệ thống Modal Đăng nhập / Đăng ký dùng chung cho toàn bộ website:
   - Hiển thị popup modal sắc nét theo đúng mẫu ảnh thiết kế
   - Mascot 4 ô cute (Mèo, Chân thú, Chó)
   - Chuyển tab "Đăng nhập / Đăng ký / Quên mật khẩu" tức thì không reload trang
   - Hỗ trợ xem/ẩn mật khẩu bằng icon con mắt
   - Checkbox "Ghi nhớ đăng nhập" và chức năng "Quên mật khẩu?"
   - Validate form, kết nối API và tự động đồng bộ trạng thái đăng nhập
   ============================================================ */

import { loginUser, registerUser } from "./auth.js";
import { isValidPhone } from "./validators.js";

const MODAL_ID = "pawncareAuthModal";
const REMEMBER_KEY = "pawncare_remembered_phone";

// Mã SVG Mascot 4 ô thú cưng chuẩn thiết kế
const MASCOT_SVG = `
<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="64" height="64" rx="16" fill="#F4EEE7"/>
  <!-- 1. Ô trên trái: Mèo nâu đậm -->
  <g transform="translate(6, 6)">
    <rect width="24" height="24" rx="7" fill="#4D3427"/>
    <path d="M4 8.5 L7 4 L10 8" fill="#4D3427" stroke="#4D3427" stroke-width="1" stroke-linejoin="round"/>
    <path d="M20 8.5 L17 4 L14 8" fill="#4D3427" stroke="#4D3427" stroke-width="1" stroke-linejoin="round"/>
    <circle cx="8" cy="11.5" r="1.3" fill="#F4EEE7"/>
    <circle cx="16" cy="11.5" r="1.3" fill="#F4EEE7"/>
    <polygon points="12,13.5 10.8,15.2 13.2,15.2" fill="#F4EEE7"/>
    <line x1="4" y1="13.5" x2="8" y2="14" stroke="#F4EEE7" stroke-width="0.8" stroke-linecap="round"/>
    <line x1="4" y1="15.5" x2="8" y2="15" stroke="#F4EEE7" stroke-width="0.8" stroke-linecap="round"/>
    <line x1="20" y1="13.5" x2="16" y2="14" stroke="#F4EEE7" stroke-width="0.8" stroke-linecap="round"/>
    <line x1="20" y1="15.5" x2="16" y2="15" stroke="#F4EEE7" stroke-width="0.8" stroke-linecap="round"/>
  </g>
  <!-- 2. Ô trên phải: Bàn chân thú trắng trên nền kem ấm -->
  <g transform="translate(34, 6)">
    <rect width="24" height="24" rx="7" fill="#D7C3B1"/>
    <path d="M7 16 C7 13.5 9 12 12 12 C15 12 17 13.5 17 16 C17 18 15 19 12 19 C9 19 7 18 7 16 Z" fill="#FFFFFF"/>
    <circle cx="7.2" cy="9.5" r="1.6" fill="#FFFFFF"/>
    <circle cx="10.4" cy="7.5" r="1.7" fill="#FFFFFF"/>
    <circle cx="13.8" cy="7.8" r="1.7" fill="#FFFFFF"/>
    <circle cx="16.8" cy="10" r="1.6" fill="#FFFFFF"/>
  </g>
  <!-- 3. Ô dưới trái: Bàn chân thú trắng trên nền kem ấm -->
  <g transform="translate(6, 34)">
    <rect width="24" height="24" rx="7" fill="#D7C3B1"/>
    <path d="M7 16 C7 13.5 9 12 12 12 C15 12 17 13.5 17 16 C17 18 15 19 12 19 C9 19 7 18 7 16 Z" fill="#FFFFFF"/>
    <circle cx="7.2" cy="9.5" r="1.6" fill="#FFFFFF"/>
    <circle cx="10.4" cy="7.5" r="1.7" fill="#FFFFFF"/>
    <circle cx="13.8" cy="7.8" r="1.7" fill="#FFFFFF"/>
    <circle cx="16.8" cy="10" r="1.6" fill="#FFFFFF"/>
  </g>
  <!-- 4. Ô dưới phải: Cún nâu đậm tai cụp -->
  <g transform="translate(34, 34)">
    <rect width="24" height="24" rx="7" fill="#4D3427"/>
    <path d="M4 6 C2.5 8.5 2.5 13.5 4.5 15 C5.8 15 6 12 5.5 8 Z" fill="#3D291F"/>
    <path d="M20 6 C21.5 8.5 21.5 13.5 19.5 15 C18.2 15 18 12 18.5 8 Z" fill="#3D291F"/>
    <circle cx="8.5" cy="11" r="1.3" fill="#F4EEE7"/>
    <circle cx="15.5" cy="11" r="1.3" fill="#F4EEE7"/>
    <ellipse cx="12" cy="15" rx="3.5" ry="2.2" fill="#F4EEE7"/>
    <ellipse cx="12" cy="14.2" rx="1.5" ry="0.9" fill="#4D3427"/>
  </g>
</svg>
`;

export function createModalHTML() {
  return `
  <div class="auth-modal-overlay" id="${MODAL_ID}" aria-hidden="true" role="dialog" aria-modal="true">
    <div class="auth-modal-dialog">
      <!-- Nút đóng X -->
      <button type="button" class="auth-modal-close" id="authModalCloseBtn" aria-label="Đóng popup">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>

      <!-- Badge Mascot -->
      <div class="auth-mascot-badge">
        ${MASCOT_SVG}
      </div>

      <!-- Tiêu đề & Phụ đề thay đổi theo Tab -->
      <h2 class="auth-modal-title" id="authModalTitle">Thành Viên PawnCare</h2>
      <p class="auth-modal-sub" id="authModalSub">Đăng ký miễn phí để nhận ngay ưu đãi 20% cho lần đầu đặt dịch vụ</p>

      <!-- Switcher Tab Pill -->
      <div class="auth-tab-switch" id="authTabSwitcher" role="tablist">
        <button type="button" class="auth-tab-btn" data-auth-tab="login" role="tab">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path>
            <polyline points="10 17 15 12 10 7"></polyline>
            <line x1="15" y1="12" x2="3" y2="12"></line>
          </svg>
          <span>Đăng nhập</span>
        </button>
        <button type="button" class="auth-tab-btn active" data-auth-tab="register" role="tab">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
            <circle cx="8.5" cy="7" r="4"></circle>
            <line x1="20" y1="8" x2="20" y2="14"></line>
            <line x1="23" y1="11" x2="17" y2="11"></line>
          </svg>
          <span>Đăng ký</span>
        </button>
      </div>

      <!-- Thông báo alert -->
      <div class="auth-alert" id="authModalAlert"></div>

      <!-- ===== 1. PANEL ĐĂNG NHẬP ===== -->
      <div class="auth-form-panel" id="authLoginPanel">
        <form id="modalLoginForm" novalidate>
          <!-- Email hoặc Số điện thoại -->
          <div class="auth-field" data-field="phoneOrEmail">
            <label class="auth-label">EMAIL / SỐ ĐIỆN THOẠI</label>
            <div class="auth-input-wrap">
              <span class="auth-input-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                  <polyline points="22,6 12,13 2,6"></polyline>
                </svg>
              </span>
              <input type="text" name="phoneOrEmail" class="auth-input" placeholder="Email hoặc số điện thoại" required />
            </div>
            <span class="auth-field-error"></span>
          </div>

          <!-- Mật khẩu -->
          <div class="auth-field" data-field="password">
            <label class="auth-label">MẬT KHẨU</label>
            <div class="auth-input-wrap">
              <span class="auth-input-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                  <rect x="5" y="11" width="14" height="10" rx="2"/>
                  <path d="M8 11V7a4 4 0 0 1 8 0v4"/>
                </svg>
              </span>
              <input type="password" name="password" class="auth-input" placeholder="Nhập mật khẩu của bạn" required />
              <button type="button" class="auth-eye-btn" aria-label="Hiện/ẩn mật khẩu">
                <svg class="icon-eye" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                  <circle cx="12" cy="12" r="3"></circle>
                </svg>
                <svg class="icon-eye-off" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                  <line x1="1" y1="1" x2="23" y2="23"></line>
                </svg>
              </button>
            </div>
            <span class="auth-field-error"></span>
          </div>

          <!-- Ghi nhớ đăng nhập & Quên mật khẩu -->
          <div class="auth-options-row">
            <label class="auth-checkbox-wrap">
              <input type="checkbox" name="remember" id="modalRememberLogin" />
              <span>Ghi nhớ đăng nhập</span>
            </label>
            <a href="#" class="auth-forgot-link" id="modalForgotPassLink">Quên mật khẩu?</a>
          </div>

          <button type="submit" class="auth-submit-btn">ĐĂNG NHẬP NGAY</button>
        </form>
      </div>

      <!-- ===== 2. PANEL QUÊN MẬT KHẨU ===== -->
      <div class="auth-form-panel" id="authForgotPanel">
        <form id="modalForgotForm" novalidate>
          <div class="auth-field" data-field="forgotAccount">
            <label class="auth-label">SỐ ĐIỆN THOẠI HOẶC EMAIL</label>
            <div class="auth-input-wrap">
              <span class="auth-input-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                  <polyline points="22,6 12,13 2,6"></polyline>
                </svg>
              </span>
              <input type="text" name="forgotAccount" class="auth-input" placeholder="Email hoặc số điện thoại" required />
            </div>
            <span class="auth-field-error"></span>
          </div>

          <button type="submit" class="auth-submit-btn">GỬI YÊU CẦU ĐẶT LẠI</button>

          <div style="text-align: center; margin-top: 14px;">
            <a href="#" class="auth-forgot-link" id="authBackToLoginBtn">← Quay lại Đăng nhập</a>
          </div>
        </form>
      </div>

      <!-- ===== 3. PANEL ĐĂNG KÝ ===== -->
      <div class="auth-form-panel active" id="authRegisterPanel">
        <form id="modalRegisterForm" novalidate>
          <!-- Tên của bạn -->
          <div class="auth-field" data-field="name">
            <label class="auth-label">TÊN CỦA BẠN</label>
            <div class="auth-input-wrap">
              <span class="auth-input-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                  <circle cx="12" cy="8" r="4"/>
                  <path d="M4 20c0-4 4-6 8-6s8 2 8 6"/>
                </svg>
              </span>
              <input type="text" name="name" class="auth-input" placeholder="Họ và tên của bạn" required />
            </div>
            <span class="auth-field-error"></span>
          </div>

          <!-- Số điện thoại -->
          <div class="auth-field" data-field="phone">
            <label class="auth-label">SỐ ĐIỆN THOẠI</label>
            <div class="auth-input-wrap">
              <span class="auth-input-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                </svg>
              </span>
              <input type="tel" name="phone" class="auth-input" placeholder="Số điện thoại của bạn" required />
            </div>
            <span class="auth-field-error"></span>
          </div>

          <!-- Địa chỉ Email -->
          <div class="auth-field" data-field="email">
            <label class="auth-label">ĐỊA CHỈ EMAIL</label>
            <div class="auth-input-wrap">
              <span class="auth-input-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                  <polyline points="22,6 12,13 2,6"></polyline>
                </svg>
              </span>
              <input type="email" name="email" class="auth-input" placeholder="Địa chỉ email của bạn" required />
            </div>
            <span class="auth-field-error"></span>
          </div>

          <!-- Mật khẩu -->
          <div class="auth-field" data-field="password">
            <label class="auth-label">MẬT KHẨU</label>
            <div class="auth-input-wrap">
              <span class="auth-input-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                  <rect x="5" y="11" width="14" height="10" rx="2"/>
                  <path d="M8 11V7a4 4 0 0 1 8 0v4"/>
                </svg>
              </span>
              <input type="password" name="password" class="auth-input" placeholder="Tối thiểu 6 ký tự" required />
              <button type="button" class="auth-eye-btn" aria-label="Hiện/ẩn mật khẩu">
                <svg class="icon-eye" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                  <circle cx="12" cy="12" r="3"></circle>
                </svg>
                <svg class="icon-eye-off" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                  <line x1="1" y1="1" x2="23" y2="23"></line>
                </svg>
              </button>
            </div>
            <!-- Yêu cầu mật khẩu tối thiểu 6 ký tự -->
            <div class="auth-hint-box">
              <span>🔒</span>
              <span>Yêu cầu: Tối thiểu 6 ký tự</span>
            </div>
            <span class="auth-field-error"></span>
          </div>

          <!-- Tên thú cưng (nếu có) -->
          <div class="auth-field" data-field="petName">
            <label class="auth-label">TÊN THÚ CƯNG (NẾU CÓ)</label>
            <div class="auth-input-wrap">
              <span class="auth-input-icon">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <ellipse cx="12" cy="15" rx="4.2" ry="3.5" />
                  <circle cx="7" cy="9.5" r="1.6" />
                  <circle cx="10.3" cy="7.2" r="1.6" />
                  <circle cx="13.7" cy="7.2" r="1.6" />
                  <circle cx="17" cy="9.5" r="1.6" />
                </svg>
              </span>
              <input type="text" name="petName" class="auth-input" placeholder="Ví dụ: Bin Corgi" />
            </div>
          </div>

          <!-- Địa chỉ nhà (Khu vực Đà Nẵng) -->
          <div class="auth-field">
            <label class="auth-label">
              <span class="auth-label-icon">🏠</span>
              <span>ĐỊA CHỈ NHÀ (KHU VỰC ĐÀ NẴNG)</span>
            </label>
            <div class="auth-address-grid">
              <div class="auth-address-field">
                <span class="auth-sublabel">Số nhà</span>
                <input type="text" name="houseNumber" class="auth-input-sm" placeholder="Ví dụ: 123/4" />
              </div>
              <div class="auth-address-field">
                <span class="auth-sublabel">Đường</span>
                <input type="text" name="street" class="auth-input-sm" placeholder="Ví dụ: Nguyễn Văn Linh" />
              </div>
              <div class="auth-address-field">
                <span class="auth-sublabel">Phường/Xã</span>
                <input type="text" name="ward" class="auth-input-sm" placeholder="Ví dụ: Hải Châu" />
              </div>
              <div class="auth-address-field">
                <span class="auth-sublabel">Thành phố</span>
                <input type="text" name="city" class="auth-input-sm" value="TP. Đà Nẵng" placeholder="TP. Đà Nẵng" />
              </div>
            </div>
          </div>

          <!-- Điều khoản sử dụng -->
          <div class="auth-options-row" style="margin-top: 6px; margin-bottom: 8px;">
            <label class="auth-checkbox-wrap">
              <input type="checkbox" name="agree" id="modalAgreeTerms" checked />
              <span>Tôi đồng ý với <a href="#" class="auth-forgot-link" style="color:#4d3427; text-decoration:underline;">Điều khoản dịch vụ</a></span>
            </label>
          </div>

          <button type="submit" class="auth-submit-btn">ĐĂNG KÝ THÀNH VIÊN</button>
        </form>
      </div>
    </div>
  </div>
  `;
}

// Chuyển đổi giữa các tab: "login", "register", hoặc "forgot"
export function switchAuthTab(tab = "login", contextEl = document) {
  const isLogin = tab === "login";
  const isRegister = tab === "register";
  const isForgot = tab === "forgot";

  // Cập nhật tab buttons
  contextEl.querySelectorAll("[data-auth-tab]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.authTab === tab);
  });

  // Ẩn/hiện thanh Tab Switcher nếu đang ở màn hình Quên mật khẩu
  const tabSwitcher = contextEl.querySelector("#authTabSwitcher");
  if (tabSwitcher) {
    tabSwitcher.style.display = isForgot ? "none" : "flex";
  }

  // Cập nhật panels
  const loginPanel = contextEl.querySelector("#authLoginPanel");
  const registerPanel = contextEl.querySelector("#authRegisterPanel");
  const forgotPanel = contextEl.querySelector("#authForgotPanel");

  if (loginPanel) loginPanel.classList.toggle("active", isLogin);
  if (registerPanel) registerPanel.classList.toggle("active", isRegister);
  if (forgotPanel) forgotPanel.classList.toggle("active", isForgot);

  // Cập nhật tiêu đề & mô tả
  const titleEl = contextEl.querySelector("#authModalTitle");
  const subEl = contextEl.querySelector("#authModalSub");

  if (isLogin) {
    if (titleEl) titleEl.textContent = "Chào Mừng Trở Lại";
    if (subEl)
      subEl.textContent =
        "Đăng nhập để xem lịch hẹn, tích điểm & quản lý bé cưng";
  } else if (isRegister) {
    if (titleEl) titleEl.textContent = "Thành Viên PawnCare";
    if (subEl)
      subEl.textContent =
        "Đăng ký miễn phí để nhận ngay ưu đãi 20% cho lần đầu đặt dịch vụ";
  } else if (isForgot) {
    if (titleEl) titleEl.textContent = "Khôi Phục Mật Khẩu";
    if (subEl)
      subEl.textContent =
        "Nhập số điện thoại hoặc email đã đăng ký để nhận mã OTP cấp lại mật khẩu";
  }

  // Xóa thông báo cũ
  const alertEl = contextEl.querySelector("#authModalAlert");
  if (alertEl) {
    alertEl.textContent = "";
    alertEl.className = "auth-alert";
  }
}

export function openAuthModal(tab = "login") {
  const modal = document.getElementById(MODAL_ID);
  if (!modal) return;

  switchAuthTab(tab, modal);

  // Nếu có số điện thoại đã ghi nhớ, tự điền vào form đăng nhập
  const savedPhone = localStorage.getItem(REMEMBER_KEY);
  if (savedPhone) {
    const phoneInput = modal.querySelector('#modalLoginForm [name="phoneOrEmail"]');
    const remBox = modal.querySelector('#modalRememberLogin');
    if (phoneInput && !phoneInput.value) phoneInput.value = savedPhone;
    if (remBox) remBox.checked = true;
  }

  modal.classList.add("active");
  modal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";

  // Focus ô đầu tiên
  setTimeout(() => {
    const activePanel = modal.querySelector(".auth-form-panel.active");
    const firstInput = activePanel ? activePanel.querySelector("input") : null;
    if (firstInput) firstInput.focus();
  }, 100);
}

export function closeAuthModal() {
  const modal = document.getElementById(MODAL_ID);
  if (!modal) return;

  modal.classList.remove("active");
  modal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

function showFieldErr(wrap, msg) {
  if (!wrap) return;
  wrap.classList.add("has-error");
  const errEl = wrap.querySelector(".auth-field-error");
  if (errEl) errEl.textContent = msg;
}

function clearFieldErr(wrap) {
  if (!wrap) return;
  wrap.classList.remove("has-error");
}

function showAlert(container, message, type = "error") {
  if (!container) return;
  container.textContent = message;
  container.className = `auth-alert show ${type}`;
}

// Khởi tạo các sự kiện cho Modal
export function initAuthModal() {
  // Tự động kiểm tra và nạp auth.css nếu trang hiện tại chưa link tới nó
  if (!document.querySelector('link[href*="auth.css"]')) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = window.location.pathname.includes("/html/") ? "../css/auth.css" : "./css/auth.css";
    document.head.appendChild(link);
  }

  // 1. Tạo modal trong DOM nếu chưa có
  if (!document.getElementById(MODAL_ID)) {
    const div = document.createElement("div");
    div.innerHTML = createModalHTML();
    document.body.appendChild(div.firstElementChild);
  }

  const modal = document.getElementById(MODAL_ID);
  if (!modal) return;

  // 2. Nút đóng
  const closeBtn = modal.querySelector("#authModalCloseBtn");
  if (closeBtn) {
    closeBtn.addEventListener("click", closeAuthModal);
  }

  // Click ra vùng tối bên ngoài để đóng
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeAuthModal();
  });

  // Phím Esc để đóng
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal.classList.contains("active")) {
      closeAuthModal();
    }
  });

  // 3. Chuyển Tab (Đăng nhập / Đăng ký)
  modal.querySelectorAll("[data-auth-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      switchAuthTab(btn.dataset.authTab, modal);
    });
  });

  // Nút chuyển sang Quên mật khẩu & quay lại
  const forgotLink = modal.querySelector("#modalForgotPassLink");
  if (forgotLink) {
    forgotLink.addEventListener("click", (e) => {
      e.preventDefault();
      switchAuthTab("forgot", modal);
    });
  }

  const backLoginBtn = modal.querySelector("#authBackToLoginBtn");
  if (backLoginBtn) {
    backLoginBtn.addEventListener("click", (e) => {
      e.preventDefault();
      switchAuthTab("login", modal);
    });
  }

  // 4. Bật/tắt hiện mật khẩu (nút con mắt)
  modal.querySelectorAll(".auth-eye-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const wrap = btn.closest(".auth-input-wrap");
      const input = wrap ? wrap.querySelector("input") : null;
      if (!input) return;
      const isPass = input.type === "password";
      input.type = isPass ? "text" : "password";
      btn.classList.toggle("showing", isPass);
    });
  });

  // 5. Submit Form Đăng nhập
  const loginForm = modal.querySelector("#modalLoginForm");
  const alertEl = modal.querySelector("#authModalAlert");

  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const phoneWrap = loginForm.querySelector('[data-field="phoneOrEmail"]');
      const passWrap = loginForm.querySelector('[data-field="password"]');
      clearFieldErr(phoneWrap);
      clearFieldErr(passWrap);

      const phoneOrEmail = loginForm.elements.phoneOrEmail.value.trim();
      const password = loginForm.elements.password.value;
      const rememberChecked = loginForm.elements.remember ? loginForm.elements.remember.checked : false;

      let valid = true;
      if (!phoneOrEmail) {
        showFieldErr(phoneWrap, "Vui lòng nhập số điện thoại hoặc email.");
        valid = false;
      }
      if (!password) {
        showFieldErr(passWrap, "Vui lòng nhập mật khẩu.");
        valid = false;
      }
      if (!valid) return;

      const submitBtn = loginForm.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      submitBtn.textContent = "ĐANG ĐĂNG NHẬP...";

      try {
        const user = await loginUser({ phone: phoneOrEmail, password });  

        // Xử lý ghi nhớ đăng nhập
        if (rememberChecked) {
          localStorage.setItem(REMEMBER_KEY, phoneOrEmail);
        } else {
          localStorage.removeItem(REMEMBER_KEY);
        }

        showAlert(alertEl, `Chào mừng trở lại, ${user.name}!`, "success");
        setTimeout(() => {
          closeAuthModal();
          submitBtn.disabled = false;
          submitBtn.textContent = "ĐĂNG NHẬP NGAY";
        }, 600);
      } catch (err) {
        showAlert(alertEl, err.message, "error");
        submitBtn.disabled = false;
        submitBtn.textContent = "ĐĂNG NHẬP NGAY";
      }
    });
  }

  // 6. Submit Form Quên mật khẩu
  const forgotForm = modal.querySelector("#modalForgotForm");
  if (forgotForm) {
    forgotForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const accountWrap = forgotForm.querySelector('[data-field="forgotAccount"]');
      clearFieldErr(accountWrap);
      const account = forgotForm.elements.forgotAccount.value.trim();

      if (!account) {
        showFieldErr(accountWrap, "Vui lòng nhập số điện thoại hoặc email đã đăng ký.");
        return;
      }

      const submitBtn = forgotForm.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      submitBtn.textContent = "ĐANG GỬI MÃ...";

      setTimeout(() => {
        showAlert(
          alertEl,
          "Mã xác thực khôi phục mật khẩu đã được gửi qua SMS / Zalo tới " + account + ". Vui lòng kiểm tra tin nhắn!",
          "success"
        );
        submitBtn.disabled = false;
        submitBtn.textContent = "GỬI YÊU CẦU ĐẶT LẠI";

        // Tự động chuyển về đăng nhập sau 2.5s
        setTimeout(() => {
          switchAuthTab("login", modal);
        }, 2500);
      }, 700);
    });
  }

  // 7. Submit Form Đăng ký
  const regForm = modal.querySelector("#modalRegisterForm");
  if (regForm) {
    regForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const nameWrap = regForm.querySelector('[data-field="name"]');
      const phoneWrap = regForm.querySelector('[data-field="phone"]');
      const emailWrap = regForm.querySelector('[data-field="email"]');
      const passWrap = regForm.querySelector('[data-field="password"]');
      clearFieldErr(nameWrap);
      clearFieldErr(phoneWrap);
      if (emailWrap) clearFieldErr(emailWrap);
      clearFieldErr(passWrap);

      const name = regForm.elements.name.value.trim();
      const phone = regForm.elements.phone.value.trim();
      const email = regForm.elements.email ? regForm.elements.email.value.trim() : "";
      const password = regForm.elements.password.value;
      const petName = regForm.elements.petName.value.trim();
      const houseNumber = regForm.elements.houseNumber.value.trim();
      const street = regForm.elements.street.value.trim();
      const ward = regForm.elements.ward.value.trim();
      const city = regForm.elements.city.value.trim() || "TP. Đà Nẵng";
      const agree = regForm.elements.agree ? regForm.elements.agree.checked : true;

      let valid = true;
      if (name.length < 2) {
        showFieldErr(nameWrap, "Vui lòng nhập họ và tên của bạn.");
        valid = false;
      }
      if (!isValidPhone(phone)) {
        showFieldErr(phoneWrap, "Số điện thoại không hợp lệ (10 chữ số).");
        valid = false;
      }
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        if (emailWrap) showFieldErr(emailWrap, "Vui lòng nhập địa chỉ email hợp lệ.");
        valid = false;
      }
      if (password.length < 6) {
        showFieldErr(passWrap, "Mật khẩu yêu cầu tối thiểu 6 ký tự.");
        valid = false;
      }
      if (!agree) {
        showAlert(alertEl, "Vui lòng đồng ý với Điều khoản dịch vụ để tiếp tục.", "error");
        valid = false;
      }
      if (!valid) return;

      const submitBtn = regForm.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      submitBtn.textContent = "ĐANG TẠO TÀI KHOẢN...";

      try {
        await registerUser({
          name,
          email,
          phone,
          password,
          petName,
          address: { houseNumber, street, ward, city },
        });

        showAlert(alertEl, "Đăng ký thành viên PawnCare thành công!", "success");
        setTimeout(() => {
          closeAuthModal();
          submitBtn.disabled = false;
          submitBtn.textContent = "ĐĂNG KÝ THÀNH VIÊN";
        }, 700);
      } catch (err) {
        showAlert(alertEl, err.message, "error");
        submitBtn.disabled = false;
        submitBtn.textContent = "ĐĂNG KÝ THÀNH VIÊN";
      }
    });
  }

  // 8. Tự động lắng nghe mọi nút "Đăng nhập" / "Đăng ký" trên trang
  document.addEventListener("click", (e) => {
    // Nếu click vào nút có data-auth-modal
    const trigger = e.target.closest("[data-auth-modal]");
    if (trigger) {
      e.preventDefault();
      const targetTab = trigger.dataset.authModal || "login";
      openAuthModal(targetTab);
      return;
    }

    // Nếu click vào nút .btn-login hoặc .btn-signup ở header
    const loginBtn = e.target.closest(".btn-login, a[href*='login.html']");
    if (loginBtn && !window.location.pathname.endsWith("login.html") && !window.location.pathname.endsWith("register.html")) {
      e.preventDefault();
      openAuthModal("login");
      return;
    }

    const signupBtn = e.target.closest(".btn-signup, a[href*='register.html']");
    if (signupBtn && !window.location.pathname.endsWith("login.html") && !window.location.pathname.endsWith("register.html")) {
      e.preventDefault();
      openAuthModal("register");
      return;
    }
  });

  // Expose global để bất cứ trang nào cũng có thể gọi
  window.openAuthModal = openAuthModal;
  window.closeAuthModal = closeAuthModal;
}
