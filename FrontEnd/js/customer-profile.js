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
import { apiGetUserProfile, apiUpdateProfile } from "./api.js";

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

  // 1. Hiển thị ngay từ phiên hiện tại/cache để UI không bị giật
  populateForm(user);

  // 2. Fetch dữ liệu trực tiếp từ MongoDB thông qua API GET BackEnd
  async function loadProfileFromDatabase() {
    const currentUser = getCurrentUser() || user;
    const identifier = currentUser?.id || currentUser?._id || currentUser?.email || currentUser?.phone;
    if (!identifier) return;

    try {
      console.log(`[CustomerProfile] Đang gửi GET lấy dữ liệu hồ sơ từ MongoDB cho: ${identifier}...`);
      const mongoUser = await apiGetUserProfile(identifier);
      if (mongoUser && typeof mongoUser === "object") {
        console.log("[CustomerProfile] Đã nhận dữ liệu hồ sơ từ MongoDB:", mongoUser);
        const mergedUser = {
          ...(currentUser || {}),
          ...mongoUser,
          id: mongoUser._id || mongoUser.id || currentUser?.id,
          name: mongoUser.name || currentUser?.name,
          phone: mongoUser.phone || currentUser?.phone,
          email: mongoUser.email || currentUser?.email,
          dob: mongoUser.dob || currentUser?.dob || "2000-05-15",
          gender: mongoUser.gender || currentUser?.gender || "female",
          address: {
            ...(currentUser?.address || {}),
            ...(mongoUser.address || {}),
          },
        };

        // Điền dữ liệu từ MongoDB vào form & sidebar
        populateForm(mergedUser);
        // Đồng bộ cache lưu trữ cục bộ
        updateCurrentUser(mergedUser);
      }
    } catch (err) {
      console.warn("[CustomerProfile] Không thể lấy profile từ MongoDB, dùng fallback cục bộ:", err);
    }
  }

  loadProfileFromDatabase();

  // Xử lý submit lưu thông tin lên máy chủ MongoDB
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const selectedGender = form.querySelector('input[name="gender"]:checked');
    const currentUser = getCurrentUser() || user;
    const userId = currentUser.id || currentUser._id || currentUser.email;

    const updatedData = {
      id: userId,
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

    const submitBtn = form.querySelector('button[type="submit"]');
    const originalBtnHtml = submitBtn ? submitBtn.innerHTML : "";
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<span>⏳</span> <span>Đang lưu...</span>`;
    }

    try {
      // 1. Gửi fetch API cập nhật hồ sơ tới BackEnd/MongoDB
      const apiResult = await apiUpdateProfile(updatedData, userId);
      const finalUser = (apiResult && typeof apiResult === "object") ? { ...updatedData, ...apiResult } : updatedData;

      // 2. Lưu vào auth & localStorage đồng bộ
      const saved = updateCurrentUser(finalUser);
      updateSidebarCard(saved);
      showToast("Cập nhật thông tin hồ sơ lên cơ sở dữ liệu thành công!");
    } catch (err) {
      console.warn("[CustomerProfile] Lỗi khi lưu profile tới BackEnd, fallback cục bộ:", err);
      const saved = updateCurrentUser(updatedData);
      updateSidebarCard(saved);
      showToast("Đã lưu thông tin hồ sơ (chế độ cục bộ)!");
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnHtml;
      }
    }
  });

  // Nút Hủy khôi phục lại giá trị hiện tại
  const cancelBtn = document.getElementById("btnCancelCustomerEdit");
  if (cancelBtn) {
    cancelBtn.addEventListener("click", async () => {
      const currentUser = getCurrentUser();
      const identifier = currentUser?.id || currentUser?._id || currentUser?.email;
      if (identifier) {
        const mongoUser = await apiGetUserProfile(identifier);
        if (mongoUser) {
          populateForm({ ...currentUser, ...mongoUser });
          showToast("Đã khôi phục thông tin từ máy chủ.", "info");
          return;
        }
      }
      populateForm(currentUser || user);
      showToast("Đã khôi phục thông tin ban đầu.", "info");
    });
  }
}
