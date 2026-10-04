import { getCurrentUser } from "./auth.js";
import { apiRequest } from "./api.js";

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

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!form.reportValidity()) return;

    const submitButton = form.querySelector('button[type="submit"]');
    if (submitButton) submitButton.disabled = true;
    const nameInput = form.querySelector('input[name="name"]');
    try {
      await apiRequest("/forms", {
        method: "POST",
        body: JSON.stringify({
          name: nameInput.value.trim(),
          phone: form.elements.phone.value.trim(),
          email: user?.email || "",
          topic: form.elements.topic.value,
          message: form.elements.message.value.trim(),
          userId: user?.id,
        }),
      });

      msgEl.textContent = `Cảm ơn ${nameInput.value.trim()}! Yêu cầu của bạn đã được gửi thành công.`;
      msgEl.classList.remove("error");
      msgEl.classList.add("show", "success");
      form.reset();

      if (user) {
        const phoneInput = form.querySelector('input[name="phone"]');
        if (nameInput && user.name) nameInput.value = user.name;
        if (phoneInput && user.phone) phoneInput.value = user.phone;
      }
    } catch (error) {
      msgEl.textContent = error.message || "Không thể gửi biểu mẫu. Vui lòng thử lại.";
      msgEl.classList.remove("success");
      msgEl.classList.add("show", "error");
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  });
}
