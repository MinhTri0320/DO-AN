/* ============================================================
   header.js
   Mọi thứ liên quan đến HEADER, có ở tất cả các trang:
   - Ẩn/hiện khối "Đăng nhập/Đăng ký" (authGuest) hay
     "chuông + avatar" (authUser) tuỳ đã đăng nhập hay chưa
   - Nút hamburger cho mobile
   - Dropdown avatar + xử lý nút "Đăng xuất"
   - Auth Guard: yêu cầu đăng nhập khi truy cập dịch vụ Khách Sạn & Thú Y
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
  if (logoutBtn) {
    logoutBtn.addEventListener("click", (e) => {
      e.preventDefault();
      logoutUser();
      window.location.href = "./index.html";
    });
  }

  const sidebarLogout = document.getElementById("sidebarLogoutLink");
  if (sidebarLogout) {
    sidebarLogout.addEventListener("click", (e) => {
      e.preventDefault();
      logoutUser();
      window.location.href = "./index.html";
    });
  }
}

function initAuthProtectedLinks() {
  const protectedKeywords = [
    "cage-management.html",
    "pet-checkin.html",
    "pet-checkout.html",
    "medical-record.html",
    "pet-medical-history.html",
    "diagnosis.html",
    "re-examination-history.html",
    "prescription.html",
    "customer-profile.html",
    "pet-profile.html",
  ];

  // 1. Chặn click vào link bảo mật nếu chưa đăng nhập
  document.addEventListener("click", (e) => {
    const link = e.target.closest("a");
    if (!link || !link.getAttribute("href")) return;
    const href = link.getAttribute("href");

    if (href.startsWith("#") || href.includes("login.html") || href.includes("register.html")) return;

    const isProtected = protectedKeywords.some((kw) => href.includes(kw));
    if (isProtected && !getCurrentUser()) {
      e.preventDefault();
      window.pendingRedirectUrl = href;
      if (typeof window.openAuthModal === "function") {
        window.openAuthModal("login");
      } else {
        window.location.href = `./login.html?redirect=${encodeURIComponent(href)}`;
      }
    }
  });

  // 2. Kiểm tra nếu đang truy cập trực tiếp trang bảo mật khi chưa đăng nhập
  const currentPath = window.location.pathname;
  const isDirectProtected = protectedKeywords.some((kw) => currentPath.endsWith(kw));
  if (isDirectProtected && !getCurrentUser()) {
    setTimeout(() => {
      if (typeof window.openAuthModal === "function") {
        window.openAuthModal("login");
      }
    }, 350);
  }
}

// Hàm duy nhất mà main.js cần gọi — chạy trên MỌI trang
export function initHeader() {
  renderHeaderAuth();
  renderNotifBadge();
  initMobileMenu();
  initAvatarDropdown();
  initLogoutButton();
  initAuthProtectedLinks();

  // Tự động re-render header ngay khi đăng nhập / đăng ký / đăng xuất
  window.addEventListener("pawncare:auth-changed", () => {
    renderHeaderAuth();
  });
}
