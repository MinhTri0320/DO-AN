import { getCurrentUser } from "./auth.js";

export function initContactForm() {
  const form = document.getElementById("contactForm");
  if (!form) return;
  const msgEl = document.getElementById("contactMessage");

  // Tự động điền thông tin nếu tài khoản đã đăng nhập
  const user = getCurrentUser();
  if (user) {
    const nameInput = form.querySelector('input[name="name"]');
    const phoneInput = form.querySelector('input[name="phone"]');
    if (nameInput && !nameInput.value && user.name) nameInput.value = user.name;
    if (phoneInput && !phoneInput.value && user.phone) phoneInput.value = user.phone;
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const nameInput = form.querySelector('input[name="name"]');
    const nameVal = nameInput ? nameInput.value.trim() : "bạn";

    msgEl.textContent = `Cảm ơn ${nameVal}! Yêu cầu tư vấn của bạn đã được chuyển đến chuyên viên PawnCare Đà Nẵng. Chúng tôi sẽ liên hệ lại với bạn qua số điện thoại sớm nhất!`;
    msgEl.classList.remove("error");
    msgEl.classList.add("show", "success");
    form.reset();

    // Giữ lại tên và SĐT nếu đang đăng nhập
    if (user) {
      const nameInput = form.querySelector('input[name="name"]');
      const phoneInput = form.querySelector('input[name="phone"]');
      if (nameInput && user.name) nameInput.value = user.name;
      if (phoneInput && user.phone) phoneInput.value = user.phone;
    }
  });
}

