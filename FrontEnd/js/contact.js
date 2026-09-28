/* ============================================================
   contact.js
   Form liên hệ ở trang chủ (index.html#contact).
   ============================================================ */

export function initContactForm() {
  const form = document.getElementById("contactForm");
  if (!form) return;
  const msgEl = document.getElementById("contactMessage");

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    msgEl.textContent = "Cảm ơn bạn! Chúng tôi sẽ liên hệ lại sớm nhất.";
    msgEl.classList.remove("error");
    msgEl.classList.add("show", "success");
    form.reset();
  });
}
