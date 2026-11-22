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
import { initMedicalRecordPage } from "./medical-record.js";
import { initPetMedicalHistoryPage } from "./pet-medical-history.js";
import { initDiagnosisPage } from "./diagnosis.js";
import { initReExaminationHistoryPage } from "./re-examination-history.js";
import { initPrescriptionPage } from "./prescription.js";
import { initBookingPage } from "./booking.js";
import { initHomePawmilyFeatures } from "./home-pawmily.js";
import { initCageManagementPage } from "./cage-management.js";
import { initPetCheckInPage } from "./pet-checkin.js";
import { initPetCheckOutPage } from "./pet-checkout.js";

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
  initMedicalRecordPage(); // tự bỏ qua nếu không ở medical-record.html
  initPetMedicalHistoryPage(); // tự bỏ qua nếu không ở pet-medical-history.html
  initDiagnosisPage(); // tự bỏ qua nếu không ở diagnosis.html
  initReExaminationHistoryPage(); // tự bỏ qua nếu không ở re-examination-history.html
  initPrescriptionPage(); // tự bỏ qua nếu không ở prescription.html
  initCageManagementPage(); // tự bỏ qua nếu không ở cage-management.html
  initPetCheckInPage(); // tự bỏ qua nếu không ở pet-checkin.html
  initPetCheckOutPage(); // tự bỏ qua nếu không ở pet-checkout.html
  initBookingPage(); // tự bỏ qua nếu không ở booking.html
  initHomePawmilyFeatures(); // tương tác sao chép voucher & tính thử chi phí kiểu Pawmily
});
