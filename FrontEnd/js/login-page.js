/* ============================================================
   login-page.js
   Task "Login": xử lý form ở login.html — validate rồi gọi
   loginUser() thật từ auth.js.
   ============================================================ */

import { loginUser } from "./auth.js";
import { isValidEmail, showFieldError, clearFieldError } from "./validators.js";

export function initLoginPage() {
  const form = document.getElementById("loginForm");
  if (!form) return; // không ở trang login thì bỏ qua

  const msgEl = document.getElementById("loginMessage");

  // Backend hiện chưa có API quên mật khẩu — hiện thông báo tạm,
  // xóa đoạn này khi nhóm làm xong tính năng reset password thật.
  const forgotLink = document.querySelector(".link-inline");
  if (forgotLink) {
    forgotLink.addEventListener("click", (e) => {
      e.preventDefault();
      msgEl.textContent = "Tính năng khôi phục mật khẩu đang được phát triển. Vui lòng liên hệ hotline để được hỗ trợ.";
      msgEl.classList.remove("success");
      msgEl.classList.add("show", "error");
    });
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    let valid = true;

    const emailWrap = form.querySelector('[data-field="email"]');
    const passWrap = form.querySelector('[data-field="password"]');
    clearFieldError(emailWrap);
    clearFieldError(passWrap);

    const email = form.elements.email.value.trim();
    const password = form.elements.password.value;

    if (!isValidEmail(email)) {
      showFieldError(emailWrap, "Email không hợp lệ.");
      valid = false;
    }
    if (!password) {
      showFieldError(passWrap, "Vui lòng nhập mật khẩu.");
      valid = false;
    }
    if (!valid) return;

    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = "Đang đăng nhập...";

    try {
      await loginUser({ email, password });
      msgEl.textContent = "Đăng nhập thành công! Đang chuyển hướng...";
      msgEl.classList.remove("error");
      msgEl.classList.add("show", "success");
      setTimeout(() => (window.location.href = "./index.html"), 700);
    } catch (err) {
      msgEl.textContent = err.message;
      msgEl.classList.remove("success");
      msgEl.classList.add("show", "error");
      submitBtn.disabled = false;
      submitBtn.textContent = "Đăng nhập";
    }
  });

  // Hiện thông báo nếu vừa đăng ký xong (register-page.js chuyển hướng về đây)
  const params = new URLSearchParams(window.location.search);
  if (params.get("registered") === "1") {
    msgEl.textContent = "Đăng ký thành công! Vui lòng đăng nhập để tiếp tục.";
    msgEl.classList.remove("error");
    msgEl.classList.add("show", "success");
  }
}
