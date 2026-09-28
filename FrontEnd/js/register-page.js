/* ============================================================
   register-page.js
   Task "Register": xử lý form ở register.html — validate rồi
   gọi registerUser() thật từ auth.js.
   ============================================================ */

import { registerUser } from "./auth.js";
import { isValidEmail, isValidPhone, showFieldError, clearFieldError } from "./validators.js";

export function initRegisterPage() {
  const form = document.getElementById("registerForm");
  if (!form) return; // không ở trang register thì bỏ qua

  const msgEl = document.getElementById("registerMessage");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    let valid = true;

    const fields = ["name", "email", "phone", "password", "confirmPassword"];
    fields.forEach((f) => clearFieldError(form.querySelector(`[data-field="${f}"]`)));

    const name = form.elements.name.value.trim();
    const email = form.elements.email.value.trim();
    const phone = form.elements.phone.value.trim();
    const password = form.elements.password.value;
    const confirmPassword = form.elements.confirmPassword.value;
    const agree = form.elements.agree.checked;

    if (name.length < 2) {
      showFieldError(form.querySelector('[data-field="name"]'), "Vui lòng nhập họ tên hợp lệ.");
      valid = false;
    }
    if (!isValidEmail(email)) {
      showFieldError(form.querySelector('[data-field="email"]'), "Email không hợp lệ.");
      valid = false;
    }
    if (!isValidPhone(phone)) {
      showFieldError(form.querySelector('[data-field="phone"]'), "Số điện thoại không hợp lệ.");
      valid = false;
    }
    if (password.length < 6) {
      showFieldError(form.querySelector('[data-field="password"]'), "Mật khẩu tối thiểu 6 ký tự.");
      valid = false;
    }
    if (confirmPassword !== password) {
      showFieldError(form.querySelector('[data-field="confirmPassword"]'), "Mật khẩu nhập lại không khớp.");
      valid = false;
    }
    if (!valid) return;

    if (!agree) {
      msgEl.textContent = "Vui lòng đồng ý với điều khoản sử dụng.";
      msgEl.classList.remove("success");
      msgEl.classList.add("show", "error");
      return;
    }

    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = "Đang đăng ký...";

    try {
      await registerUser({ name, email, phone, password });
      window.location.href = "./login.html?registered=1";
    } catch (err) {
      msgEl.textContent = err.message;
      msgEl.classList.remove("success");
      msgEl.classList.add("show", "error");
      submitBtn.disabled = false;
      submitBtn.textContent = "Đăng ký";
    }
  });
}
