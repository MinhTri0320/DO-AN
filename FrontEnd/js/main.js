/* ============================================================
   main.js
   Điểm khởi chạy DUY NHẤT được nhúng vào mọi trang HTML:
     <script type="module" src="./js/main.js"></script>

   Mỗi module tự kiểm tra xem phần tử DOM nó cần có tồn tại
   trên trang hiện tại hay không (vd forum.js kiểm tra #postList),
   nên gọi hết init() ở đây không sợ lỗi dù đang ở trang nào.
   ============================================================ */

import { initHeader } from "./header.js";
import { initAuthModal } from "./auth-modal.js";
import { initLoginPage } from "./login-page.js";
import { initRegisterPage } from "./register-page.js";
import { initForumPage } from "./forum.js";
import { initNotificationsPage } from "./notifications.js";
import { initCampaignsPage } from "./campaigns.js";
import { initContactForm } from "./contact.js";
import { initPasswordToggles } from "./password-toggle.js";
import { initCustomerProfilePage } from "./customer-profile.js";
import { initPetProfilePage } from "./pet-profile.js";
import { initBookingPage } from "./booking.js";

document.addEventListener("DOMContentLoaded", () => {
  initHeader(); // luôn chạy — header có ở mọi trang
  initAuthModal(); // modal popup đăng nhập / đăng ký chạy toàn site
  initLoginPage(); // tự bỏ qua nếu không ở login.html
  initRegisterPage(); // tự bỏ qua nếu không ở register.html
  initForumPage(); // tự bỏ qua nếu không ở forum.html
  initNotificationsPage(); // tự bỏ qua nếu không ở notifications.html
  initCampaignsPage(); // tự bỏ qua nếu không ở campaigns.html
  initContactForm(); // tự bỏ qua nếu không có #contactForm
  initPasswordToggles(); // gắn cho mọi nút con mắt hiện/ẩn mật khẩu
  initCustomerProfilePage(); // tự bỏ qua nếu không ở customer-profile
  initPetProfilePage(); // tự bỏ qua nếu không ở pet-profile
  initBookingPage(); // tự bỏ qua nếu không ở booking.html
});
