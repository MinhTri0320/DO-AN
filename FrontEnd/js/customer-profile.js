/* ============================================================
   customer-profile.js
   Sprint 2 Task: "Customer Profile"
   - Quản lý thông tin hồ sơ khách hàng (thông tin cá nhân & liên hệ)
   - Xem và cập nhật thông tin để đảm bảo dữ liệu luôn chính xác
   - Mặc định địa chỉ khu vực TP. Đà Nẵng
   - Tự động đồng bộ với localStorage & Header toàn trang
   ============================================================ */

import { getCurrentUser, updateCurrentUser } from "./auth.js";
import { escapeHTML } from "./storage.js";
import { apiUpdateProfile } from "./api.js";

function showToast(message, type = "success") {
  let toast = document.getElementById("profileToast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "profileToast";
    toast.className = "toast-notice";
    document.body.appendChild(toast);
  }
  toast.className = `toast-notice ${type} show`;
  toast.innerHTML = `<span>✓</span> <span>${escapeHTML(message)}</span>`;
  setTimeout(() => {
    toast.classList.remove("show");
  }, 3200);
}

export function initCustomerProfilePage() {
  const form = document.getElementById("customerProfileForm");
  if (!form) return; // Không ở trang Customer Profile thì bỏ qua

  const user = getCurrentUser() || {
    id: "guest_" + Date.now(),
    name: "Minh Anh",
    phone: "0900123456",
    email: "minhanh@pawncare.vn",
    dob: "2000-05-15",
    gender: "female",
    memberTier: "Khách hàng Thân thiết",
    joinedDate: "10/2025",
    address: {
      houseNumber: "123",
      street: "Nguyễn Văn Linh",
      ward: "Phường Nam Dương",
      district: "Quận Hải Châu",
      city: "TP. Đà Nẵng",
    },
  };

  // Điền dữ liệu vào form
  function populateForm(data) {
    if (!data) return;
    if (form.elements.fullName) form.elements.fullName.value = data.name || "";
    if (form.elements.phone) form.elements.phone.value = data.phone || "";
    if (form.elements.email) form.elements.email.value = data.email || "";
    if (form.elements.dob) form.elements.dob.value = data.dob || "2000-05-15";

    // Giới tính
    const gender = data.gender || "female";
    const genderInputs = form.querySelectorAll('input[name="gender"]');
    genderInputs.forEach((inp) => {
      inp.checked = inp.value === gender;
    });

    // Địa chỉ (Đà Nẵng)
    const addr = data.address || {};
    if (form.elements.houseNumber) form.elements.houseNumber.value = addr.houseNumber || "123";
    if (form.elements.street) form.elements.street.value = addr.street || "Nguyễn Văn Linh";
    if (form.elements.ward) form.elements.ward.value = addr.ward || "Phường Nam Dương";
    if (form.elements.district) form.elements.district.value = addr.district || "Quận Hải Châu";

    // Cập nhật card sidebar
    updateSidebarCard(data);
  }

  function updateSidebarCard(data) {
    const sideName = document.getElementById("sidebarUserName");
    const sidePhone = document.getElementById("sidebarUserPhone");
    const sideInitial = document.getElementById("sidebarUserInitial");

    if (sideName) sideName.textContent = data.name || "Khách hàng";
    if (sidePhone) sidePhone.textContent = data.phone || data.email || "0900 123 456";
    if (sideInitial) sideInitial.textContent = (data.name || "U").trim().charAt(0).toUpperCase();
  }

  populateForm(user);

  // Xử lý submit lưu thông tin
  form.addEventListener("submit", (e) => {
    e.preventDefault();

    const selectedGender = form.querySelector('input[name="gender"]:checked');

    const updatedData = {
      name: (form.elements.fullName.value || "").trim(),
      phone: (form.elements.phone.value || "").trim(),
      email: (form.elements.email.value || "").trim(),
      dob: form.elements.dob ? form.elements.dob.value : "",
      gender: selectedGender ? selectedGender.value : "other",
      address: {
        houseNumber: (form.elements.houseNumber?.value || "").trim(),
        street: (form.elements.street?.value || "").trim(),
        ward: (form.elements.ward?.value || "").trim(),
        district: (form.elements.district?.value || "").trim(),
        city: "TP. Đà Nẵng",
      },
    };

    if (!updatedData.name) {
      alert("Vui lòng nhập họ và tên của bạn.");
      form.elements.fullName?.focus();
      return;
    }

    if (!updatedData.phone) {
      alert("Vui lòng nhập số điện thoại liên hệ.");
      form.elements.phone?.focus();
      return;
    }

    // Lưu vào auth & localStorage
    const saved = updateCurrentUser(updatedData);
    updateSidebarCard(saved);

    // Gửi fetch API cập nhật hồ sơ tới BackEnd
    try {
      apiUpdateProfile(updatedData);
    } catch (e) {
      // API client đã xử lý fallback
    }

    showToast("Cập nhật thông tin hồ sơ khách hàng thành công!");
  });

  // Nút Hủy khôi phục lại giá trị hiện tại
  const cancelBtn = document.getElementById("btnCancelCustomerEdit");
  if (cancelBtn) {
    cancelBtn.addEventListener("click", () => {
      populateForm(getCurrentUser() || user);
      showToast("Đã khôi phục thông tin ban đầu.", "info");
    });
  }
}
