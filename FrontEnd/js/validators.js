/* ============================================================
   validators.js
   Hàm kiểm tra dữ liệu form (email, số điện thoại) và hiển thị/
   ẩn lỗi từng ô input. Dùng chung cho login.html & register.html.
   ============================================================ */

export function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function isValidPhone(value) {
  return /^(0|\+84)\d{9,10}$/.test(value.replace(/\s/g, ""));
}

// fieldWrap là thẻ <label data-field="..."> bọc quanh input + .field-error
export function showFieldError(fieldWrap, message) {
  fieldWrap.classList.add("invalid");
  const errEl = fieldWrap.querySelector(".field-error");
  if (errEl) errEl.textContent = message;
}

export function clearFieldError(fieldWrap) {
  fieldWrap.classList.remove("invalid");
}
