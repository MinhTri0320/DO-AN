/* ============================================================
   password-toggle.js
   Nút "con mắt" hiện/ẩn mật khẩu — dùng chung cho MỌI ô password
   trong site (login, register...). Tách riêng file để không phải
   lặp code trong login-page.js và register-page.js.
   ============================================================ */

export function initPasswordToggles() {
  document.querySelectorAll("[data-toggle-password]").forEach((btn) => {
    const wrap = btn.closest(".input-icon-wrap");
    const input = wrap ? wrap.querySelector("input") : null;
    if (!input) return;

    btn.addEventListener("click", () => {
      const showing = input.type === "text";
      input.type = showing ? "password" : "text";
      btn.classList.toggle("is-visible", !showing);
    });
  });
}
