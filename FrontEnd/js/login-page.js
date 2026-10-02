/* ============================================================
   login-page.js
   Xử lý trang login.html độc lập (khớp với giao diện mẫu):
   - Đăng nhập bằng Số điện thoại (hoặc Email) & Mật khẩu
   - Validate thông tin
   - Ghi nhớ đăng nhập bằng checkbox
   - Quên mật khẩu qua SMS / OTP
   - Gọi loginUser() từ auth.js
   - Điều hướng về trang chủ khi thành công
   ============================================================ */

import { loginUser } from "./auth.js";

const REMEMBER_KEY = "pawncare_remembered_phone";

export function initLoginPage() {
  const form = document.getElementById("loginForm");
  if (!form) return;

  const alertEl = document.getElementById("loginAlert") || document.getElementById("loginMessage");
  const phoneOrEmailInput = form.elements.phoneOrEmail || form.elements.phone || form.elements.email;
  const rememberBox = form.elements.remember || document.getElementById("rememberLogin");

  // Tự động điền số điện thoại nếu người dùng từng tích "Ghi nhớ đăng nhập"
  const savedPhone = localStorage.getItem(REMEMBER_KEY);
  if (savedPhone && phoneOrEmailInput) {
    phoneOrEmailInput.value = savedPhone;
    if (rememberBox) rememberBox.checked = true;
  }

  // Xử lý nút "Quên mật khẩu?"
  const forgotLink = document.getElementById("forgotPassLink");
  if (forgotLink) {
    forgotLink.addEventListener("click", (e) => {
      e.preventDefault();
      const currentPhone = phoneOrEmailInput ? phoneOrEmailInput.value.trim() : "";

      if (!currentPhone) {
        if (alertEl) {
          alertEl.textContent = "Vui lòng nhập số điện thoại ở trên rồi bấm 'Quên mật khẩu?' để nhận mã OTP.";
          alertEl.className = "auth-alert show error";
        }
        if (phoneOrEmailInput) phoneOrEmailInput.focus();
        return;
      }

      if (alertEl) {
        alertEl.textContent = `Mã OTP khôi phục mật khẩu đã được gửi tới ${currentPhone}. Vui lòng kiểm tra SMS / Zalo!`;
        alertEl.className = "auth-alert show success";
      }
    });
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const phoneField = form.querySelector('[data-field="phoneOrEmail"]');
    const passField = form.querySelector('[data-field="password"]');

    if (phoneField) phoneField.classList.remove("has-error");
    if (passField) passField.classList.remove("has-error");

    const phoneOrEmail = phoneOrEmailInput ? phoneOrEmailInput.value.trim() : "";
    const password = form.elements.password ? form.elements.password.value : "";
    const isRemember = rememberBox ? rememberBox.checked : false;

    let valid = true;
    if (!phoneOrEmail) {
      if (phoneField) {
        phoneField.classList.add("has-error");
        const err = phoneField.querySelector(".auth-field-error");
        if (err) err.textContent = "Vui lòng nhập số điện thoại hoặc email.";
      }
      valid = false;
    }

    if (!password) {
      if (passField) {
        passField.classList.add("has-error");
        const err = passField.querySelector(".auth-field-error");
        if (err) err.textContent = "Vui lòng nhập mật khẩu.";
      }
      valid = false;
    }

    if (!valid) return;

    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "ĐANG ĐĂNG NHẬP...";
    }

    try {
      const user = await loginUser({ phoneOrEmail, password });

      // Lưu hoặc xóa số điện thoại ghi nhớ
      if (isRemember) {
        localStorage.setItem(REMEMBER_KEY, phoneOrEmail);
      } else {
        localStorage.removeItem(REMEMBER_KEY);
      }

      if (alertEl) {
        alertEl.textContent = `Đăng nhập thành công! Chào mừng ${user.name}...`;
        alertEl.className = "auth-alert show success";
      }
      setTimeout(() => {
        window.location.href = "./index.html";
      }, 700);
    } catch (err) {
      if (alertEl) {
        alertEl.textContent = err.message;
        alertEl.className = "auth-alert show error";
      }
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = "ĐĂNG NHẬP NGAY";
      }
    }
  });

  // Thông báo nếu vừa từ trang đăng ký chuyển sang
  const params = new URLSearchParams(window.location.search);
  if (params.get("registered") === "1" && alertEl) {
    alertEl.textContent = "Đăng ký thành công! Vui lòng đăng nhập.";
    alertEl.className = "auth-alert show success";
  }
}
