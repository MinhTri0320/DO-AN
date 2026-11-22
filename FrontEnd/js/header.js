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
        <a href="./index.html" class="link active">Trang chủ</a>
        <a href="./admin-roles.html" class="link" style="color: #FFF; background: #7A4E2D; font-weight: 700; border-radius: 20px; padding: 6px 14px;">⚙️ Quản lý phân quyền</a>
      `;
    }
  }
  // 2. BÁC SĨ (role_id === 2): HIỂN THỊ 3 CHỨC NĂNG BÁC SĨ + ĐĂNG XUẤT
  else if (roleId === 2) {
    dropdown.innerHTML = `
      <p class="dropdown-name" id="userName">${user.name} <span style="font-size: 11px; background: #DEF7EC; color: #03543F; padding: 2px 6px; border-radius: 6px; margin-left: 4px; font-weight: 600;">Bác sĩ</span></p>
      <a href="#" class="dropdown-link" id="btnDoctorApptsModal">📅 Lịch hẹn (cá nhân)</a>
      <a href="#" class="dropdown-link" id="btnDoctorDiagnosesModal">📋 Phiếu khám (cá nhân)</a>
      <a href="#" class="dropdown-link" id="btnDoctorRecordsModal">📁 Hồ sơ khám bệnh nhân</a>
      <a href="#" class="dropdown-link" id="logoutBtn">🚪 Đăng xuất</a>
    `;

    if (menuNav) {
      menuNav.innerHTML = `
        <a href="./index.html" class="link active">Trang chủ</a>
        <a href="#" class="link" id="navDoctorAppts">📅 Lịch hẹn cá nhân</a>
        <a href="#" class="link" id="navDoctorDiagnoses">📋 Phiếu khám bệnh</a>
        <a href="#" class="link" id="navDoctorRecords">📁 Hồ sơ khám bệnh nhân</a>
      `;
    }

    setTimeout(() => {
      initModalFilters();
      const openAppts = (e) => {
        e.preventDefault();
        openRoleModal("modalDoctorAppts");
        loadDoctorAppointments();
      };
      const openDiag = (e) => {
        e.preventDefault();
        openRoleModal("modalDoctorDiagnoses");
        loadDoctorDiagnoses();
      };
      const openRecs = (e) => {
        e.preventDefault();
        openRoleModal("modalDoctorRecords");
        loadDoctorMedicalRecords();
      };

      const btn1 = document.getElementById("btnDoctorApptsModal");
      const btn2 = document.getElementById("btnDoctorDiagnosesModal");
      const btn3 = document.getElementById("btnDoctorRecordsModal");
      const nav1 = document.getElementById("navDoctorAppts");
      const nav2 = document.getElementById("navDoctorDiagnoses");
      const nav3 = document.getElementById("navDoctorRecords");

      if (btn1) btn1.addEventListener("click", openAppts);
      if (btn2) btn2.addEventListener("click", openDiag);
      if (btn3) btn3.addEventListener("click", openRecs);
      if (nav1) nav1.addEventListener("click", openAppts);
      if (nav2) nav2.addEventListener("click", openDiag);
      if (nav3) nav3.addEventListener("click", openRecs);
    }, 100);
  }
  // 3. LỄ TÂN (role_id === 3): HIỂN THỊ 4 CHỨC NĂNG LỄ TÂN + ĐĂNG XUẤT
  else if (roleId === 3) {
    dropdown.innerHTML = `
      <p class="dropdown-name" id="userName">${user.name} <span style="font-size: 11px; background: #E1EFFE; color: #1E429F; padding: 2px 6px; border-radius: 6px; margin-left: 4px; font-weight: 600;">Lễ tân</span></p>
      <a href="#" class="dropdown-link" id="btnRecepInvoicesModal">💳 Hóa đơn &amp; Thanh toán (payment)</a>
      <a href="#" class="dropdown-link" id="btnRecepAllApptsModal">📅 Lịch khám tất cả khách hàng</a>
      <a href="#" class="dropdown-link" id="btnRecepPrescriptionsModal">💊 Hóa đơn thuốc sau khám</a>
      <a href="#" class="dropdown-link" id="btnRecepPharmacyModal">📦 Quản lý kho thuốc</a>
      <a href="#" class="dropdown-link" id="logoutBtn">🚪 Đăng xuất</a>
    `;

    if (menuNav) {
      menuNav.innerHTML = `
        <a href="./index.html" class="link active">Trang chủ</a>
        <a href="#" class="link" id="navRecepInvoices">💳 Hóa đơn &amp; Thanh toán</a>
        <a href="#" class="link" id="navRecepAllAppts">📅 Lịch khám khách hàng</a>
        <a href="#" class="link" id="navRecepPrescriptions">💊 Hóa đơn thuốc</a>
        <a href="#" class="link" id="navRecepPharmacy">📦 Quản lý kho thuốc</a>
      `;
    }

    setTimeout(() => {
      initModalFilters();

      const openInv = (e) => {
        e.preventDefault();
        openRoleModal("modalRecepInvoices");
        loadRecepInvoices();
      };
      const openAppts = (e) => {
        e.preventDefault();
        openRoleModal("modalRecepAllAppts");
        loadRecepAllAppointments();
      };
      const openPres = (e) => {
        e.preventDefault();
        openRoleModal("modalRecepPrescriptions");
        loadRecepPrescriptions();
      };
      const openPharm = (e) => {
        e.preventDefault();
        openRoleModal("modalRecepPharmacy");
        loadRecepPharmacy();
      };

      const btn1 = document.getElementById("btnRecepInvoicesModal");
      const btn2 = document.getElementById("btnRecepAllApptsModal");
      const btn3 = document.getElementById("btnRecepPrescriptionsModal");
      const btn4 = document.getElementById("btnRecepPharmacyModal");

      const nav1 = document.getElementById("navRecepInvoices");
      const nav2 = document.getElementById("navRecepAllAppts");
      const nav3 = document.getElementById("navRecepPrescriptions");
      const nav4 = document.getElementById("navRecepPharmacy");

      if (btn1) btn1.addEventListener("click", openInv);
      if (btn2) btn2.addEventListener("click", openAppts);
      if (btn3) btn3.addEventListener("click", openPres);
      if (btn4) btn4.addEventListener("click", openPharm);

      if (nav1) nav1.addEventListener("click", openInv);
      if (nav2) nav2.addEventListener("click", openAppts);
      if (nav3) nav3.addEventListener("click", openPres);
      if (nav4) nav4.addEventListener("click", openPharm);
    }, 100);
  }
  // 4. KHÁCH HÀNG (role_id === 4): GIỮ NGUYÊN 100% GIAO DIỆN
  else {
    dropdown.innerHTML = `
      <p class="dropdown-name" id="userName">${user.name}</p>
      <a href="./customer-profile.html" class="dropdown-link">👤 Hồ sơ khách hàng</a>
      <a href="./pet-profile.html" class="dropdown-link">🐾 Hồ sơ thú cưng</a>
      <a href="./medical-record.html" class="dropdown-link">🩺 Hồ sơ y tế &amp; Bệnh án</a>
      <a href="./cage-management.html" class="dropdown-link">🏨 Lưu chuồng &amp; Khách sạn</a>
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
    guestBox.hidden = true;
    userBox.hidden = false;
    const initialEl = document.getElementById("userInitial");
    const nameEl = document.getElementById("userName");
    if (initialEl) initialEl.textContent = user.name.trim().charAt(0).toUpperCase();
    if (nameEl) nameEl.textContent = user.name;

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
