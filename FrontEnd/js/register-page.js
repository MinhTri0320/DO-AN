/* ============================================================
   register-page.js
   Xử lý trang register.html độc lập (khớp với giao diện mẫu):
   - Đăng ký thành viên với Tên, SĐT, Mật khẩu, Thú cưng, Địa chỉ
   - Validate thông tin
   - Gọi registerUser() từ auth.js
   - Tự động chuyển về login hoặc trang chủ
   ============================================================ */

import { registerUser } from "./auth.js";
import { isValidPhone } from "./validators.js";

export function initRegisterPage() {
  const form = document.getElementById("registerForm");
  if (!form) return;

  const alertEl = document.getElementById("registerAlert") || document.getElementById("registerMessage");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const nameField = form.querySelector('[data-field="name"]');
    const phoneField = form.querySelector('[data-field="phone"]');
    const passField = form.querySelector('[data-field="password"]');

    if (nameField) nameField.classList.remove("has-error");
    if (phoneField) phoneField.classList.remove("has-error");
    if (passField) passField.classList.remove("has-error");

    const name = form.elements.name ? form.elements.name.value.trim() : "";
    const phone = form.elements.phone ? form.elements.phone.value.trim() : "";
    const password = form.elements.password ? form.elements.password.value : "";
    const petName = form.elements.petName ? form.elements.petName.value.trim() : "";
    const houseNumber = form.elements.houseNumber ? form.elements.houseNumber.value.trim() : "";
    const street = form.elements.street ? form.elements.street.value.trim() : "";
    const ward = form.elements.ward ? form.elements.ward.value.trim() : "";
    const city = form.elements.city ? form.elements.city.value.trim() : "TP. Đà Nẵng";

    let valid = true;
    if (name.length < 2) {
      if (nameField) {
        nameField.classList.add("has-error");
        const err = nameField.querySelector(".auth-field-error");
        if (err) err.textContent = "Vui lòng nhập họ và tên của bạn.";
      }
      valid = false;
    }

    if (!isValidPhone(phone)) {
      if (phoneField) {
        phoneField.classList.add("has-error");
        const err = phoneField.querySelector(".auth-field-error");
        if (err) err.textContent = "Số điện thoại không hợp lệ (10 chữ số).";
      }
      valid = false;
    }

    if (password.length < 6) {
      if (passField) {
        passField.classList.add("has-error");
        const err = passField.querySelector(".auth-field-error");
        if (err) err.textContent = "Mật khẩu yêu cầu tối thiểu 6 ký tự.";
      }
      valid = false;
    }

    if (!valid) return;

    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "ĐANG TẠO TÀI KHOẢN...";
    }

    try {
      await registerUser({
        name,
        phone,
        password,
        petName,
        address: { houseNumber, street, ward, city },
      });

      if (alertEl) {
        alertEl.textContent = "Đăng ký thành viên PawnCare thành công! Đang chuyển hướng...";
        alertEl.className = "auth-alert show success";
      }

      setTimeout(() => {
        window.location.href = "./index.html";
      }, 800);
    } catch (err) {
      if (alertEl) {
        alertEl.textContent = err.message;
        alertEl.className = "auth-alert show error";
      }
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = "ĐĂNG KÝ THÀNH VIÊN";
      }
    }
  });
}
