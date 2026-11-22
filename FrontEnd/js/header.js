/* ============================================================
   header.js
   Mọi thứ liên quan đến HEADER, có ở tất cả các trang:
   - Ẩn/hiện khối "Đăng nhập/Đăng ký" (authGuest) hay
     "chuông + avatar" (authUser) tuỳ đã đăng nhập hay chưa
   - Nút hamburger cho mobile
   - Dropdown avatar theo từng Role (Admin 1, Bác sĩ 2, Lễ tân 3, Khách 4)
   - Tích hợp các Modal nghiệp vụ Bác sĩ & Lễ tân
   - Xử lý nút "Đăng xuất"
   - Auth Guard: yêu cầu đăng nhập khi truy cập các tính năng bảo mật
   ============================================================ */

import { getCurrentUser, logoutUser } from "./auth.js";
import { renderNotifBadge } from "./notifications.js";
import {
  openRoleModal,
  loadDoctorAppointments,
  loadDoctorDiagnoses,
  loadDoctorMedicalRecords,
  loadRecepInvoices,
  loadRecepAllAppointments,
  loadRecepPrescriptions,
  loadRecepPharmacy,
  initModalFilters,
} from "./roleModals.js";

// Khôi phục dropdown khách hàng mặc định
function resetCustomerNavAndDropdown() {
  const dropdown = document.getElementById("userDropdown");
  if (!dropdown) return;
  dropdown.innerHTML = `
    <p class="dropdown-name" id="userName">—</p>
    <a href="./customer-profile.html" class="dropdown-link">👤 Hồ sơ khách hàng</a>
    <a href="./pet-profile.html" class="dropdown-link">🐾 Hồ sơ thú cưng</a>
    <a href="./medical-record.html" class="dropdown-link">🩺 Hồ sơ y tế &amp; Bệnh án</a>
    <a href="./cage-management.html" class="dropdown-link">🏨 Lưu chuồng &amp; Khách sạn</a>
    <a href="./booking.html#my-appts" class="dropdown-link">📅 Lịch hẹn của tôi</a>
    <a href="#" class="dropdown-link" id="logoutBtn">🚪 Đăng xuất</a>
  `;
  initLogoutButton();
}

// Render Dropdown và Navbar theo từng vai trò (role_id)
function renderRoleSpecificNavAndDropdown(user) {
  const dropdown = document.getElementById("userDropdown");
  const menuNav = document.getElementById("menu");
  if (!dropdown) return;

  const roleId =
    Number(user.role_id) ||
    (user.role === "admin"
      ? 1
      : user.role === "doctor"
      ? 2
      : user.role === "receptionist"
      ? 3
      : 4);

  // 1. ADMIN (role_id === 1): CHỈ HIỂN THỊ PHÂN QUYỀN + ĐĂNG XUẤT
  if (roleId === 1) {
    dropdown.innerHTML = `
      <p class="dropdown-name" id="userName">${user.name} <span style="font-size: 11px; background: #FDE8E8; color: #9B1C1C; padding: 2px 6px; border-radius: 6px; margin-left: 4px; font-weight: 600;">Admin</span></p>
      <a href="./admin-roles.html" class="dropdown-link">⚙️ Quản lý phân quyền</a>
      <a href="#" class="dropdown-link" id="logoutBtn">🚪 Đăng xuất</a>
    `;

    if (menuNav) {
      menuNav.innerHTML = `
        <a href="./admin-roles.html" class="link active" style="color: #FFF; background: #7A4E2D; font-weight: 700; border-radius: 20px; padding: 6px 14px;">⚙️ Quản lý phân quyền</a>
      `;
    }
  }
  // 2. BÁC SĨ (role_id === 2): CHUYỂN VÀO BÀN LÀM VIỆC BÁC SĨ + ĐĂNG XUẤT
  else if (roleId === 2) {
    dropdown.innerHTML = `
      <p class="dropdown-name" id="userName">${user.name} <span style="font-size: 11px; background: #DEF7EC; color: #03543F; padding: 2px 6px; border-radius: 6px; margin-left: 4px; font-weight: 600;">Bác sĩ</span></p>
      <a href="./doctor-dashboard.html" class="dropdown-link">👨‍⚕️ Bàn làm việc Bác sĩ</a>
      <a href="#" class="dropdown-link" id="logoutBtn">🚪 Đăng xuất</a>
    `;

    if (menuNav) {
      menuNav.innerHTML = `
        <a href="./doctor-dashboard.html" class="link active">👨‍⚕️ Bàn làm việc Bác sĩ</a>
      `;
    }
  }
  // 3. LỄ TÂN (role_id === 3): CHUYỂN VÀO CỔNG NGHIỆP VỤ LỄ TÂN + ĐĂNG XUẤT
  else if (roleId === 3) {
    dropdown.innerHTML = `
      <p class="dropdown-name" id="userName">${user.name} <span style="font-size: 11px; background: #E1EFFE; color: #1E429F; padding: 2px 6px; border-radius: 6px; margin-left: 4px; font-weight: 600;">Lễ tân</span></p>
      <a href="./receptionist-dashboard.html" class="dropdown-link">🛎️ Cổng nghiệp vụ Lễ tân</a>
      <a href="./cage-management.html" class="dropdown-link">🏨 Lưu chuồng &amp; Khách sạn</a>
      <a href="./grooming-schedule.html" class="dropdown-link">✂️ Lịch Chăm Sóc Grooming</a>
      <a href="./medicine-dispensing.html" class="dropdown-link">💊 Kho Thuốc &amp; Cấp Thuốc</a>
      <a href="./invoice-payment.html" class="dropdown-link">💳 Hóa Đơn &amp; Thanh Toán</a>
      <a href="#" class="dropdown-link" id="logoutBtn">🚪 Đăng xuất</a>
    `;

    if (menuNav) {
      menuNav.innerHTML = `
        <a href="./receptionist-dashboard.html" class="link active">🛎️ Cổng nghiệp vụ Lễ tân</a>
        <a href="./cage-management.html" class="link">🏨 Khách Sạn</a>
        <a href="./grooming-schedule.html" class="link">✂️ Grooming</a>
        <a href="./medicine-dispensing.html" class="link">💊 Kho Thuốc</a>
        <a href="./invoice-payment.html" class="link">💳 Hóa Đơn</a>
      `;
    }
  }
  // 4. KHÁCH HÀNG (role_id === 4): GIỮ NGUYÊN 100% GIAO DIỆN
  else {
    dropdown.innerHTML = `
      <p class="dropdown-name" id="userName">${user.name}</p>
      <a href="./customer-profile.html" class="dropdown-link">👤 Hồ sơ khách hàng</a>
      <a href="./pet-profile.html" class="dropdown-link">🐾 Hồ sơ thú cưng</a>
      <a href="./medical-record.html" class="dropdown-link">🩺 Hồ sơ y tế &amp; Bệnh án</a>
      <a href="./cage-management.html" class="dropdown-link">🏨 Lưu chuồng &amp; Khách sạn</a>
      <a href="./grooming-schedule.html" class="dropdown-link">✂️ Lịch Chăm Sóc Grooming</a>
      <a href="./invoice-payment.html" class="dropdown-link">💳 Hóa Đơn Của Tôi</a>
      <a href="./booking.html#my-appts" class="dropdown-link">📅 Lịch hẹn của tôi</a>
      <a href="#" class="dropdown-link" id="logoutBtn">🚪 Đăng xuất</a>
    `;
  }

  initLogoutButton();
}

function renderHeaderAuth() {
  const guestBox = document.getElementById("authGuest");
  const userBox = document.getElementById("authUser");
  if (!guestBox || !userBox) return;

  const user = getCurrentUser();
  if (user) {
    const roleId =
      Number(user.role_id) ||
      (user.role === "admin"
        ? 1
        : user.role === "doctor"
        ? 2
        : user.role === "receptionist"
        ? 3
        : 4);

    const path = window.location.pathname.toLowerCase();
    const isHomePage =
      path.endsWith("index.html") ||
      path.endsWith("/frontend/") ||
      path.endsWith("/frontend") ||
      path.endsWith("/frontend/html/") ||
      path.endsWith("/frontend/html") ||
      path.endsWith("/html/") ||
      path.endsWith("/html") ||
      path === "" ||
      path === "/";

    // Xóa trang chủ đối với 3 vai trò nội bộ: Admin (1), Bác sĩ (2), Lễ tân (3)
    if (isHomePage) {
      if (roleId === 1) {
        window.location.replace("./admin-roles.html");
        return;
      } else if (roleId === 2) {
        window.location.replace("./doctor-dashboard.html");
        return;
      } else if (roleId === 3) {
        window.location.replace("./receptionist-dashboard.html");
        return;
      }
    }

    guestBox.hidden = true;
    userBox.hidden = false;
    const initialEl = document.getElementById("userInitial");
    const nameEl = document.getElementById("userName");
    if (initialEl) initialEl.textContent = user.name.trim().charAt(0).toUpperCase();
    if (nameEl) nameEl.textContent = user.name;

    // Cập nhật thẻ người dùng ở sidebar nếu trang hiện tại có
    const sideInitial = document.getElementById("sidebarUserInitial");
    const sideName = document.getElementById("sidebarUserName");
    const sidePhone = document.getElementById("sidebarUserPhone");
    if (sideInitial && user.name) sideInitial.textContent = user.name.trim().charAt(0).toUpperCase();
    if (sideName && user.name) sideName.textContent = user.name;
    if (sidePhone && (user.phone || user.email)) sidePhone.textContent = user.phone || user.email;

    renderRoleSpecificNavAndDropdown(user);
  } else {
    guestBox.hidden = false;
    userBox.hidden = true;
    resetCustomerNavAndDropdown();
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

  const adminOnlyKeywords = ["admin-roles.html"];

  // 1. Chặn click vào link bảo mật nếu chưa đăng nhập hoặc không đủ quyền
  document.addEventListener("click", (e) => {
    const link = e.target.closest("a");
    if (!link || !link.getAttribute("href")) return;
    const href = link.getAttribute("href");

    if (href.startsWith("#") || href.includes("login.html") || href.includes("register.html")) return;

    const user = getCurrentUser();

    // Chặn trang admin-roles.html nếu không phải admin
    if (adminOnlyKeywords.some((kw) => href.includes(kw))) {
      if (!user || (Number(user.role_id) !== 1 && user.role !== "admin")) {
        e.preventDefault();
        alert("Chức năng chỉ dành cho Quản trị viên (Admin).");
        return;
      }
    }

    const isProtected = protectedKeywords.some((kw) => href.includes(kw));
    if (isProtected && !user) {
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
