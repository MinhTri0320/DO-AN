/* ============================================================
   booking.js
   Sprint 2 Task: "Appointment Booking"
   - Cho phép người dùng đặt lịch hẹn cho thú cưng dựa trên:
     dịch vụ, thú cưng, ngày và giờ mong muốn.
   - Hệ thống kiểm tra thông tin lịch hẹn (validation chặt chẽ).
   - Xử lý yêu cầu và lưu lịch hẹn sau khi đặt thành công vào localStorage.
   - Tự động tạo thông báo trên hệ thống chuông (Notif Badge).
   - Quản lý danh sách lịch hẹn đã đặt (xem và hủy lịch hẹn).
   ============================================================ */

import { STORAGE_KEYS, getData, setData, escapeHTML } from "./storage.js";
import { getCurrentUser } from "./auth.js";
import { getPetsList } from "./pet-profile.js";
import { renderNotifBadge } from "./notifications.js";

export const SERVICES_CATALOG = [
  {
    id: "vet",
    name: "Khám & Điều trị Thú y",
    icon: "🩺",
    price: 120000,
    priceDisplay: "120.000đ",
    duration: "30-45 phút",
    desc: "Khám tổng quát, chẩn đoán, siêu âm và điều trị bởi bác sĩ thú y chuyên khoa.",
  },
  {
    id: "spa",
    name: "Spa & Cắt tỉa tạo kiểu",
    icon: "✂️",
    price: 150000,
    priceDisplay: "Từ 150.000đ",
    duration: "60-90 phút",
    desc: "Tắm thảo dược khử mùi, vệ sinh tai móng, sấy phồng và cắt tỉa form chuẩn.",
  },
  {
    id: "rehab",
    name: "Phục hồi chức năng & Trị liệu",
    icon: "🏃",
    price: 250000,
    priceDisplay: "250.000đ",
    duration: "45-60 phút",
    desc: "Vật lý trị liệu cơ xương khớp, máy chạy bộ thủy liệu chuyên biệt phục hồi.",
  },
  {
    id: "hotel",
    name: "Khách sạn thú cưng cao cấp",
    icon: "🏨",
    price: 200000,
    priceDisplay: "200.000đ/ngày",
    duration: "Lưu trú 24/7",
    desc: "Phòng máy lạnh lọc khí HEPA, camera HD giám sát trực tiếp cho ba mẹ.",
  },
  {
    id: "vaccine",
    name: "Tiêm chủng vaccine & Sổ giun",
    icon: "💉",
    price: 180000,
    priceDisplay: "180.000đ",
    duration: "20-30 phút",
    desc: "Vaccine phòng bệnh dại & 7 bệnh truyền nhiễm nhập khẩu chính hãng.",
  },
];

const DEFAULT_APPOINTMENTS = [
  {
    id: "PC-202610-8821",
    serviceId: "spa",
    serviceName: "Spa & Cắt tỉa tạo kiểu",
    serviceIcon: "✂️",
    petName: "Bé Bơ",
    petSpecies: "Chó",
    petBreed: "Golden Retriever",
    petAvatar: "../assets/img/golden.jpg",
    date: "08/10/2026",
    time: "09:30",
    ownerName: "Minh Anh",
    ownerPhone: "0900123456",
    location: "123 Nguyễn Văn Linh, P. Hải Châu, TP. Đà Nẵng",
    status: "Đã xác nhận",
    feeDisplay: "Từ 150.000đ",
    createdAt: Date.now() - 4 * 3600 * 1000,
  },
];

export function getAppointments() {
  const existing = getData(STORAGE_KEYS.APPOINTMENTS, null);
  if (existing && Array.isArray(existing)) {
    // Lọc bỏ mockup demo cũ nếu có trong localStorage
    return existing.filter((a) => a.id !== "PC-202610-8821");
  }
  return [];
}

export function getUserAppointments() {
  const user = getCurrentUser();
  if (!user) return [];
  const all = getAppointments();
  // Lọc lịch hẹn của tài khoản hiện tại
  return all.filter((a) => {
    return (
      (user.phone && a.ownerPhone === user.phone) ||
      (user.email && a.userEmail === user.email) ||
      (user.name && a.ownerName === user.name)
    );
  });
}

export function saveAppointment(appointment) {
  const list = getAppointments();
  list.unshift(appointment);
  setData(STORAGE_KEYS.APPOINTMENTS, list);

  // Tạo thông báo mới trong hệ thống thông báo
  const notifs = getData(STORAGE_KEYS.NOTIFICATIONS, []);
  notifs.unshift({
    id: Date.now(),
    icon: "📅",
    title: "Đặt lịch hẹn thành công!",
    desc: `Lịch hẹn ${appointment.serviceName} cho ${appointment.petName} vào ${appointment.time} ngày ${appointment.date} đã được ghi nhận. Mã: ${appointment.id}.`,
    time: Date.now(),
    read: false,
  });
  setData(STORAGE_KEYS.NOTIFICATIONS, notifs);
  renderNotifBadge();

  return appointment;
}

export function cancelAppointment(appointmentId) {
  const list = getAppointments();
  const target = list.find((a) => a.id === appointmentId);
  if (target) {
    target.status = "Đã hủy";
    setData(STORAGE_KEYS.APPOINTMENTS, list);
  }
  return list;
}

export function initBookingPage() {
  const bookingForm = document.getElementById("appointmentBookingForm");
  if (!bookingForm) return; // Không ở trang booking thì bỏ qua

  // Các tabs: Đặt lịch mới vs Lịch hẹn của tôi
  const tabNewBooking = document.getElementById("tabNewBooking");
  const tabMyAppointments = document.getElementById("tabMyAppointments");
  const viewBookingForm = document.getElementById("viewBookingForm");
  const viewMyAppointments = document.getElementById("viewMyAppointments");
  const apptBadgeCount = document.getElementById("apptBadgeCount");

  // Elements của phần đặt lịch
  const servicesContainer = document.getElementById("bookingServicesContainer");
  const petsContainer = document.getElementById("bookingPetsContainer");
  const dateInput = document.getElementById("bookingDate");
  const timeSlotsContainer = document.getElementById("timeSlotsContainer");
  const ownerNameInput = document.getElementById("bookingOwnerName");
  const ownerPhoneInput = document.getElementById("bookingOwnerPhone");
  const notesInput = document.getElementById("bookingNotes");

  // Elements của thẻ tóm tắt (Sticky Summary)
  const sumService = document.getElementById("sumService");
  const sumPet = document.getElementById("sumPet");
  const sumDateTime = document.getElementById("sumDateTime");
  const sumLocation = document.getElementById("sumLocation");
  const sumFee = document.getElementById("sumFee");

  // Modal Thành công
  const successModal = document.getElementById("bookingSuccessModal");
  const successModalClose = document.getElementById("bookingSuccessClose");
  const successBookingId = document.getElementById("successBookingId");
  const successRecapService = document.getElementById("successRecapService");
  const successRecapPet = document.getElementById("successRecapPet");
  const successRecapTime = document.getElementById("successRecapTime");
  const btnViewMyAppts = document.getElementById("btnViewMyAppts");

  // Trạng thái form hiện tại
  let currentSelection = {
    service: null,
    pet: null,
    date: "",
    time: "",
  };

  // 1. Khởi tạo danh sách Dịch vụ
  function renderServices() {
    // Đọc query string URL xem có pre-select service không (vd ?service=spa)
    const urlParams = new URLSearchParams(window.location.search);
    const preselectedId = urlParams.get("service") || "vet";

    servicesContainer.innerHTML = SERVICES_CATALOG.map((s) => {
      const isChecked = s.id === preselectedId;
      if (isChecked) currentSelection.service = s;

      return `
        <label class="booking-service-item ${isChecked ? "selected" : ""}" data-id="${s.id}">
          <input type="radio" name="serviceOption" value="${s.id}" ${isChecked ? "checked" : ""} />
          <div class="service-item-top">
            <span class="service-item-icon">${s.icon}</span>
            <span class="service-item-price">${s.priceDisplay}</span>
          </div>
          <div class="service-item-name">${s.name}</div>
          <p class="service-item-desc">${s.desc}</p>
        </label>
      `;
    }).join("");

    servicesContainer.querySelectorAll(".booking-service-item").forEach((card) => {
      card.addEventListener("click", () => {
        servicesContainer.querySelectorAll(".booking-service-item").forEach((c) => c.classList.remove("selected"));
        card.classList.add("selected");
        const radio = card.querySelector('input[type="radio"]');
        if (radio) radio.checked = true;

        const sId = card.dataset.id;
        currentSelection.service = SERVICES_CATALOG.find((s) => s.id === sId);
        updateSummary();
      });
    });
  }

  // 2. Khởi tạo danh sách Thú cưng
  function renderPets() {
    const user = getCurrentUser();
    const petStepSubtitle = document.getElementById("petStepSubtitle");

    if (!user) {
      // Người dùng CHƯA đăng nhập: Hiển thị giao diện nhập thông tin bé cưng cho khách
      if (petStepSubtitle) {
        petStepSubtitle.textContent = "Bạn đang đặt lịch với tư cách Khách (vui lòng điền thông tin bé cưng)";
      }

      petsContainer.innerHTML = `
        <div class="guest-pet-box">
          <div class="guest-auth-callout">
            <div class="callout-icon">💡</div>
            <div class="callout-text">
              <strong>Bạn chưa đăng nhập tài khoản</strong>
              <span>Đăng nhập để chọn nhanh bé cưng từ hồ sơ đã lưu của bạn, hoặc nhập thông tin bé trực tiếp bên dưới:</span>
            </div>
            <a href="./login.html" class="btn-guest-login">Đăng nhập</a>
          </div>

          <div class="form-grid-2">
            <label>
              <span>Tên bé cưng: *</span>
              <div class="input-icon-wrap">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <ellipse cx="12" cy="16" rx="6" ry="5"/>
                  <ellipse cx="5" cy="9" rx="2.2" ry="3"/>
                  <ellipse cx="10" cy="6" rx="2.2" ry="3"/>
                  <ellipse cx="14" cy="6" rx="2.2" ry="3"/>
                  <ellipse cx="19" cy="9" rx="2.2" ry="3"/>
                </svg>
                <input type="text" id="guestPetName" placeholder="VD: Bé Lu, Miu Miu, Cún con..." required />
              </div>
            </label>

            <label>
              <span>Loài &amp; Giống thú cưng:</span>
              <div class="input-icon-wrap">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M12 6v6l4 2"/>
                </svg>
                <input type="text" id="guestPetBreed" placeholder="VD: Chó Poodle, Mèo Anh lông ngắn..." />
              </div>
            </label>
          </div>
        </div>
      `;

      const guestPetNameInput = document.getElementById("guestPetName");
      const guestPetBreedInput = document.getElementById("guestPetBreed");

      const updateGuestPetState = () => {
        const pName = guestPetNameInput ? guestPetNameInput.value.trim() : "";
        const pBreed = guestPetBreedInput ? guestPetBreedInput.value.trim() : "";
        if (pName) {
          currentSelection.pet = {
            id: "guest_pet",
            name: pName,
            species: "Thú cưng",
            breed: pBreed || "Thú cưng gia đình",
            avatar: "../assets/img/golden.jpg",
          };
        } else {
          currentSelection.pet = null;
        }
        updateSummary();
      };

      if (guestPetNameInput) guestPetNameInput.addEventListener("input", updateGuestPetState);
      if (guestPetBreedInput) guestPetBreedInput.addEventListener("input", updateGuestPetState);

      currentSelection.pet = null; // Khách chưa gõ tên bé thì chưa chọn
      return;
    }

    // NGƯỜI DÙNG ĐÃ ĐĂNG NHẬP: Lấy danh sách thú cưng từ hồ sơ của họ
    if (petStepSubtitle) {
      petStepSubtitle.textContent = `Hồ sơ thú cưng đã đăng ký của bạn (${user.name || "Khách hàng"})`;
    }

    const pets = getPetsList();

    let html = pets
      .map((p, idx) => {
        const isChecked = idx === 0;
        if (isChecked && !currentSelection.pet) currentSelection.pet = p;
        const avatarSrc = p.avatar || (p.species === "Mèo" ? "../assets/img/frenchie.jpg" : "../assets/img/golden.jpg");
        const speciesIcon = p.species === "Mèo" ? "🐱" : "🐶";

        return `
        <label class="booking-pet-item ${isChecked ? "selected" : ""}" data-id="${p.id}">
          <input type="radio" name="petOption" value="${p.id}" ${isChecked ? "checked" : ""} />
          <img class="booking-pet-thumb" src="${escapeHTML(avatarSrc)}" alt="${escapeHTML(p.name)}" />
          <div class="booking-pet-info">
            <strong>${escapeHTML(p.name)}</strong>
            <span>${speciesIcon} ${escapeHTML(p.breed || p.species)}</span>
          </div>
        </label>
      `;
      })
      .join("");

    // Thêm nút bé mới
    html += `
      <div class="booking-pet-new-btn" id="btnQuickAddPet">
        <span>➕</span>
        <span>Thêm bé khác</span>
      </div>
    `;

    petsContainer.innerHTML = `
      <div class="booking-pets-grid">
        ${html}
      </div>
    `;

    petsContainer.querySelectorAll(".booking-pet-item").forEach((card) => {
      card.addEventListener("click", () => {
        petsContainer.querySelectorAll(".booking-pet-item").forEach((c) => c.classList.remove("selected"));
        card.classList.add("selected");
        const radio = card.querySelector('input[type="radio"]');
        if (radio) radio.checked = true;

        const pId = card.dataset.id;
        currentSelection.pet = pets.find((p) => p.id === pId);
        updateSummary();
      });
    });

    const btnQuickAdd = document.getElementById("btnQuickAddPet");
    if (btnQuickAdd) {
      btnQuickAdd.addEventListener("click", () => {
        const petName = prompt("Nhập tên bé cưng của bạn:");
        if (petName && petName.trim()) {
          const newPet = {
            id: "pet_" + Date.now(),
            name: petName.trim(),
            species: "Chó",
            breed: "Thú cưng gia đình",
            age: "1 tuổi",
            gender: "Đực",
            avatar: "../assets/img/golden.jpg",
          };
          pets.push(newPet);
          setData(STORAGE_KEYS.PETS, pets);
          currentSelection.pet = newPet;
          renderPets();
          updateSummary();
        }
      });
    }
  }

  // 3. Khởi tạo Ngày & Khung giờ
  function isWithinClinicHours(timeStr) {
    if (!timeStr) return false;
    const parts = timeStr.split(":");
    if (parts.length < 2) return false;
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if (isNaN(h) || isNaN(m)) return false;
    const totalMinutes = h * 60 + m;

    // Sáng: 08:30 (510 phút) đến 11:30 (690 phút)
    const isMorning = totalMinutes >= 8 * 60 + 30 && totalMinutes <= 11 * 60 + 30;
    // Chiều & Tối: 13:30 (810 phút) đến 19:30 (1170 phút)
    const isAfternoon = totalMinutes >= 13 * 60 + 30 && totalMinutes <= 19 * 60 + 30;

    return isMorning || isAfternoon;
  }

  function initDateTime() {
    // Thiết lập ngày tối thiểu là ngày hôm nay
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    const todayStr = `${yyyy}-${mm}-${dd}`;

    if (dateInput) {
      dateInput.min = todayStr;
      dateInput.value = todayStr;
      currentSelection.date = formatDateVN(todayStr);

      dateInput.addEventListener("change", () => {
        currentSelection.date = formatDateVN(dateInput.value);
        updateSummary();
      });
    }

    const customTimeInput = document.getElementById("customTimeInput");
    const customTimeError = document.getElementById("customTimeError");

    // Gắn sự kiện cho các pill time-slot cố định
    if (timeSlotsContainer) {
      const slots = timeSlotsContainer.querySelectorAll(".time-slot-pill");
      slots.forEach((pill) => {
        pill.addEventListener("click", () => {
          slots.forEach((p) => p.classList.remove("selected"));
          pill.classList.add("selected");
          const radio = pill.querySelector('input[type="radio"]');
          if (radio) radio.checked = true;

          // Bỏ custom time khi khách click chọn pill cố định
          if (customTimeInput) {
            customTimeInput.value = "";
            customTimeInput.classList.remove("custom-time-active");
          }
          if (customTimeError) customTimeError.hidden = true;

          currentSelection.time = pill.dataset.time || radio?.value || "08:30";
          updateSummary();
        });
      });

      // Mặc định chọn khung giờ đầu tiên
      const firstSlot = slots[0];
      if (firstSlot) {
        firstSlot.classList.add("selected");
        const radio = firstSlot.querySelector('input[type="radio"]');
        if (radio) radio.checked = true;
        currentSelection.time = firstSlot.dataset.time || "08:30";
      }
    }

    // Gắn sự kiện cho ô TỰ CHỌN GIỜ RIÊNG (Custom Time Picker)
    if (customTimeInput) {
      const handleCustomTimeChange = () => {
        const val = customTimeInput.value;
        if (!val) {
          customTimeInput.classList.remove("custom-time-active");
          if (customTimeError) customTimeError.hidden = true;
          return;
        }

        if (isWithinClinicHours(val)) {
          // Bỏ chọn các pill cố định để khách toàn quyền chọn giờ riêng
          if (timeSlotsContainer) {
            timeSlotsContainer.querySelectorAll(".time-slot-pill").forEach((p) => {
              p.classList.remove("selected");
              const r = p.querySelector('input[type="radio"]');
              if (r) r.checked = false;
            });
          }
          customTimeInput.classList.add("custom-time-active");
          if (customTimeError) customTimeError.hidden = true;

          currentSelection.time = val;
          updateSummary();
        } else {
          customTimeInput.classList.remove("custom-time-active");
          if (customTimeError) {
            customTimeError.textContent = "⚠️ Khung giờ này ngoài ca tiếp nhận. Vui lòng chọn trong khoảng 08:30 – 11:30 (sáng) hoặc 13:30 – 19:30 (chiều tối).";
            customTimeError.hidden = false;
          }
        }
      };

      customTimeInput.addEventListener("input", handleCustomTimeChange);
      customTimeInput.addEventListener("change", handleCustomTimeChange);
    }
  }

  function formatDateVN(dateString) {
    if (!dateString) return "";
    const parts = dateString.split("-");
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateString;
  }

  // 4. Tự động nạp thông tin chủ nuôi
  function prefillUserInfo() {
    const user = getCurrentUser();
    if (user) {
      if (ownerNameInput && !ownerNameInput.value) ownerNameInput.value = user.name || "";
      if (ownerPhoneInput && !ownerPhoneInput.value) ownerPhoneInput.value = user.phone || "";
    } else {
      // Khi là khách (chưa đăng nhập): để trống ô nhập, KHÔNG hardcode
      if (ownerNameInput) ownerNameInput.value = "";
      if (ownerPhoneInput) ownerPhoneInput.value = "";
    }
  }

  // 5. Cập nhật thẻ Tóm tắt theo thời gian thực (Live Summary)
  function updateSummary() {
    if (sumService) {
      sumService.textContent = currentSelection.service
        ? `${currentSelection.service.icon} ${currentSelection.service.name}`
        : "Chưa chọn";
    }
    if (sumPet) {
      sumPet.textContent = currentSelection.pet
        ? `${currentSelection.pet.name} (${currentSelection.pet.breed || currentSelection.pet.species})`
        : "Chưa chọn bé cưng";
    }
    if (sumDateTime) {
      const timeTxt = currentSelection.time || "09:30";
      const dateTxt = currentSelection.date || "Hôm nay";
      sumDateTime.textContent = `${timeTxt} • ${dateTxt}`;
    }
    if (sumLocation) {
      sumLocation.textContent = "123 Nguyễn Văn Linh, P. Hải Châu, TP. Đà Nẵng";
    }
    if (sumFee) {
      sumFee.textContent = currentSelection.service ? currentSelection.service.priceDisplay : "120.000đ";
    }
  }

  // 6. Xử lý Gửi Form đặt lịch
  bookingForm.addEventListener("submit", (e) => {
    e.preventDefault();

    // Kiểm tra tính hợp lệ (Validation)
    if (!currentSelection.service) {
      alert("Vui lòng chọn dịch vụ bạn muốn đặt cho bé.");
      return;
    }

    if (!currentSelection.pet) {
      const user = getCurrentUser();
      if (!user) {
        alert("Vui lòng nhập tên bé cưng của bạn ở Bước 2.");
        const guestPetName = document.getElementById("guestPetName");
        if (guestPetName) guestPetName.focus();
      } else {
        alert("Vui lòng chọn bé thú cưng tiếp nhận dịch vụ.");
      }
      return;
    }

    if (!dateInput.value) {
      alert("Vui lòng chọn ngày hẹn.");
      dateInput.focus();
      return;
    }

    if (!currentSelection.time) {
      alert("Vui lòng chọn khung giờ hẹn phù hợp.");
      return;
    }

    const ownerName = (ownerNameInput.value || "").trim();
    if (!ownerName) {
      alert("Vui lòng nhập họ và tên người đặt lịch.");
      ownerNameInput.focus();
      return;
    }

    const ownerPhone = (ownerPhoneInput.value || "").trim();
    if (!ownerPhone) {
      alert("Vui lòng nhập số điện thoại liên hệ.");
      ownerPhoneInput.focus();
      return;
    }

    // Tạo mã lịch hẹn ngẫu nhiên sang trọng
    const bookingCode = `PC-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, "0")}-${Math.floor(1000 + Math.random() * 9000)}`;

    const user = getCurrentUser();

    const newAppointment = {
      id: bookingCode,
      userId: user ? user.phone : null,
      userEmail: user ? user.email : null,
      serviceId: currentSelection.service.id,
      serviceName: currentSelection.service.name,
      serviceIcon: currentSelection.service.icon,
      petName: currentSelection.pet.name,
      petSpecies: currentSelection.pet.species || "Thú cưng",
      petBreed: currentSelection.pet.breed || "",
      petAvatar: currentSelection.pet.avatar || "../assets/img/golden.jpg",
      date: formatDateVN(dateInput.value),
      time: currentSelection.time,
      ownerName: ownerName,
      ownerPhone: ownerPhone,
      notes: (notesInput?.value || "").trim(),
      location: "123 Nguyễn Văn Linh, P. Hải Châu, TP. Đà Nẵng",
      status: "Chờ xác nhận",
      feeDisplay: currentSelection.service.priceDisplay,
      createdAt: Date.now(),
    };

    // Lưu vào localStorage
    saveAppointment(newAppointment);

    // Mở Modal thành công
    if (successBookingId) successBookingId.textContent = `Mã lịch hẹn: ${bookingCode}`;
    if (successRecapService) successRecapService.textContent = `${newAppointment.serviceIcon} ${newAppointment.serviceName}`;
    if (successRecapPet) successRecapPet.textContent = `${newAppointment.petName} (${newAppointment.petBreed})`;
    if (successRecapTime) successRecapTime.textContent = `${newAppointment.time} ngày ${newAppointment.date}`;

    if (successModal) successModal.hidden = false;
    updateBadgeCount();
  });

  if (successModalClose) {
    successModalClose.addEventListener("click", () => {
      successModal.hidden = true;
    });
  }

  if (btnViewMyAppts) {
    btnViewMyAppts.addEventListener("click", () => {
      successModal.hidden = true;
      const user = getCurrentUser();
      if (user) {
        switchToMyAppointmentsTab();
      } else {
        alert("Để xem và quản lý lịch hẹn vừa đặt, bạn hãy đăng nhập hoặc tạo tài khoản mới!");
        window.location.href = "./login.html";
      }
    });
  }

  // 7. Xử lý Tab "Lịch hẹn đã đặt (My Appointments)"
  function updateBadgeCount() {
    const user = getCurrentUser();
    const bookingViewTabs = document.getElementById("bookingViewTabs");

    if (!user) {
      // Khách vãng lai: ẨN hoàn toàn thanh tab "Lịch hẹn của tôi" và badge
      if (bookingViewTabs) bookingViewTabs.style.display = "none";
      if (tabMyAppointments) tabMyAppointments.hidden = true;
      if (apptBadgeCount) {
        apptBadgeCount.textContent = "0";
        apptBadgeCount.hidden = true;
      }
      return;
    }

    // Đã đăng nhập: Hiện tab chuyển đổi và badge số lượng thật
    if (bookingViewTabs) bookingViewTabs.style.display = "inline-flex";
    if (tabMyAppointments) tabMyAppointments.hidden = false;

    const myAppts = getUserAppointments();
    if (apptBadgeCount) {
      apptBadgeCount.textContent = myAppts.length;
      apptBadgeCount.hidden = myAppts.length === 0;
    }
  }

  function renderMyAppointments() {
    const listContainer = document.getElementById("appointmentCardsList");
    const emptyBox = document.getElementById("emptyAppointmentsBox");
    const guestAuthBox = document.getElementById("guestAuthPromptBox");
    const filterBar = document.querySelector(".appointments-filter-bar");
    if (!listContainer) return;

    const user = getCurrentUser();
    if (!user) {
      // Khách chưa đăng nhập: Không hiển thị danh sách của ai cả, mà hiện nhắc đăng nhập
      if (guestAuthBox) guestAuthBox.hidden = false;
      if (emptyBox) emptyBox.hidden = true;
      if (listContainer) listContainer.innerHTML = "";
      if (filterBar) filterBar.style.display = "none";
      updateBadgeCount();
      return;
    }

    if (guestAuthBox) guestAuthBox.hidden = true;
    if (filterBar) filterBar.style.display = "flex";

    const list = getUserAppointments();
    updateBadgeCount();

    if (list.length === 0) {
      listContainer.innerHTML = "";
      if (emptyBox) emptyBox.hidden = false;
      return;
    }

    if (emptyBox) emptyBox.hidden = true;

    listContainer.innerHTML = list
      .map((a) => {
        let statusClass = "pending";
        if (a.status === "Đã xác nhận") statusClass = "confirmed";
        if (a.status === "Đã hủy") statusClass = "cancelled";

        const canCancel = a.status === "Chờ xác nhận" || a.status === "Đã xác nhận";

        return `
        <article class="appointment-card" data-id="${a.id}">
          <div class="appt-left">
            <div class="appt-icon-box">${a.serviceIcon || "🩺"}</div>
            <div class="appt-info">
              <h4>${escapeHTML(a.serviceName)}</h4>
              <div class="appt-meta">
                <span>🐾 <strong>${escapeHTML(a.petName)}</strong> (${escapeHTML(a.petBreed || a.petSpecies)})</span>
                <span>📅 <strong>${escapeHTML(a.time)}</strong> • ${escapeHTML(a.date)}</span>
                <span>📍 ${escapeHTML(a.location)}</span>
              </div>
            </div>
          </div>

          <div class="appt-right">
            <span class="appt-status ${statusClass}">${escapeHTML(a.status)}</span>
            <span style="font-size:12px; color:var(--ink-faint)">Mã: ${escapeHTML(a.id)}</span>
            ${canCancel ? `<button class="btn-cancel-appt" data-action="cancel" data-id="${a.id}" type="button">Hủy lịch</button>` : ""}
          </div>
        </article>
      `;
      })
      .join("");

    listContainer.querySelectorAll('[data-action="cancel"]').forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.id;
        if (confirm(`Bạn có chắc chắn muốn hủy lịch hẹn mã ${id} không?`)) {
          cancelAppointment(id);
          renderMyAppointments();
        }
      });
    });
  }

  function switchToBookingTab() {
    tabNewBooking.classList.add("active");
    tabMyAppointments.classList.remove("active");
    viewBookingForm.hidden = false;
    viewMyAppointments.hidden = true;
  }

  function switchToMyAppointmentsTab() {
    tabNewBooking.classList.remove("active");
    tabMyAppointments.classList.add("active");
    viewBookingForm.hidden = true;
    viewMyAppointments.hidden = false;
    renderMyAppointments();
  }

  if (tabNewBooking) tabNewBooking.addEventListener("click", switchToBookingTab);
  if (tabMyAppointments) tabMyAppointments.addEventListener("click", switchToMyAppointmentsTab);

  const btnBookFirst = document.getElementById("btnBookFirstAppt");
  if (btnBookFirst) btnBookFirst.addEventListener("click", switchToBookingTab);

  // Khởi chạy
  renderServices();
  renderPets();
  initDateTime();
  prefillUserInfo();
  updateSummary();
  updateBadgeCount();

  if (window.location.hash === "#my-appts" || window.location.hash === "#my-appointments") {
    switchToMyAppointmentsTab();
  }
}
