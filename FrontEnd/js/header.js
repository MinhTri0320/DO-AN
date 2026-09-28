/* ============================================================
   header.js
   Mọi thứ liên quan đến HEADER, có ở tất cả các trang:
   - Ẩn/hiện khối "Đăng nhập/Đăng ký" (authGuest) hay
     "chuông + avatar" (authUser) tuỳ đã đăng nhập hay chưa
   - Nút hamburger cho mobile
   - Dropdown avatar + xử lý nút "Đăng xuất" (task "Logout")
   ============================================================ */

import { getCurrentUser, logoutUser } from "./auth.js";
import { renderNotifBadge } from "./notifications.js";

function renderHeaderAuth() {
  const guestBox = document.getElementById("authGuest");
  const userBox = document.getElementById("authUser");
  if (!guestBox || !userBox) return;

  const user = getCurrentUser();
  if (user) {
    guestBox.hidden = true;
    userBox.hidden = false;
    const initialEl = document.getElementById("userInitial");
    const nameEl = document.getElementById("userName");
    if (initialEl) initialEl.textContent = user.name.trim().charAt(0).toUpperCase();
    if (nameEl) nameEl.textContent = user.name;
  } else {
    guestBox.hidden = false;
    userBox.hidden = true;
  }
}

function initMobileMenu() {
  const menuToggle = document.getElementById("menuToggle");
  const menu = document.getElementById("menu");
  if (!menuToggle || !menu) return;

  menuToggle.addEventListener("click", () => {
    const isOpen = menu.classList.toggle("open");
    menuToggle.setAttribute("aria-expanded", String(isOpen));
  });
}

function initAvatarDropdown() {
  const avatarBtn = document.getElementById("avatarBtn");
  const dropdown = document.getElementById("userDropdown");
  if (!avatarBtn || !dropdown) return;

  avatarBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    dropdown.hidden = !dropdown.hidden;
  });
  document.addEventListener("click", () => {
    dropdown.hidden = true;
  });
}

function initLogoutButton() {
  const logoutBtn = document.getElementById("logoutBtn");
  if (!logoutBtn) return;

  logoutBtn.addEventListener("click", (e) => {
    e.preventDefault();
    logoutUser();
    window.location.href = "./index.html";
  });
}

// Hàm duy nhất mà main.js cần gọi — chạy trên MỌI trang
export function initHeader() {
  renderHeaderAuth();
  renderNotifBadge();
  initMobileMenu();
  initAvatarDropdown();
  initLogoutButton();
}
