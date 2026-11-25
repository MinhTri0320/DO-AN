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
import { getPetsList, fetchPetsFromDatabase, savePetItem } from "./pet-profile.js";
import { createNotification, renderNotifBadge } from "./notifications.js";
import { normalizePhone } from "./validators.js";
import {
  apiCreateAppointment,
  apiCancelAppointment,
  apiGetBookedSlots,
  apiGetAppointments,
} from "./api.js";

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

function formatDateVNStatic(dateString) {
  if (!dateString) return "";
  const parts = String(dateString).split("-");
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return String(dateString);
}

function belongsToUser(a, user) {
  if (!a || !user) return false;
  const uid = user.id || user._id;
  if (uid && a.userId && String(a.userId) === String(uid)) {
    return true;
  }
  const userPhone = user.phone ? normalizePhone(user.phone) : "";
  const apptPhone = a.ownerPhone ? normalizePhone(a.ownerPhone) : "";
  if (userPhone && apptPhone && apptPhone === userPhone) {
    return true;
  }
  if (
    user.email &&
    a.userEmail &&
    String(a.userEmail).trim().toLowerCase() === String(user.email).trim().toLowerCase()
  ) {
    return true;
  }
  return false;
}

function normalizeAppointmentItem(a) {
  if (!a || typeof a !== "object") return null;
  const code = a.bookingCode || a.id || (a._id ? String(a._id) : "");
  return {
    ...a,
    id: code,
    bookingCode: a.bookingCode || code,
    ...(a._id ? { _id: String(a._id) } : {}),
    ...(a.userId ? { userId: String(a.userId) } : {}),
    serviceId: a.serviceId || "vet",
    serviceName: a.serviceName || "Dịch vụ thú y",
    serviceIcon: a.serviceIcon || "🩺",
    petName: a.petName || "Bé cưng",
    petSpecies: a.petSpecies || "Thú cưng",
    petBreed: a.petBreed || "",
    petAvatar: a.petAvatar || "../assets/img/golden.jpg",
    date: a.date || (a.dateISO ? formatDateVNStatic(a.dateISO) : ""),
    dateISO: a.dateISO || "",
    time: a.time || "",
    ownerName: a.ownerName || "",
    ownerPhone: a.ownerPhone || "",
    location: a.location || "123 Nguyễn Văn Linh, P. Hải Châu, TP. Đà Nẵng",
    status: a.status || "Chờ xác nhận",
    feeDisplay: a.feeDisplay || "",
    createdAt: a.createdAt || Date.now(),
  };
}

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
  // Lọc lịch hẹn ưu tiên theo userId / ownerPhone / userEmail (KHÔNG lọc theo ownerName tránh lẫn user trùng tên)
  return all.filter((a) => belongsToUser(a, user));
}

export async function syncUserAppointmentsFromDatabase() {
  const user = getCurrentUser();
  if (!user) return [];

  const userId = user.id || user._id;
  const userEmail = user.email;
  if (!userId && !userEmail) return getUserAppointments();

  try {
    const remote = await apiGetAppointments(userId, userEmail);
    if (Array.isArray(remote)) {
      const normalizedRemote = remote
        .map(normalizeAppointmentItem)
        .filter(Boolean);

      // Giữ lại lịch hẹn của tài khoản khác (nếu có trong localStorage), thay thế lịch của user hiện tại bằng bản mới nhất từ MongoDB
      const otherUsersAppts = getAppointments().filter((a) => !belongsToUser(a, user));
      const merged = [...normalizedRemote, ...otherUsersAppts];
      setData(STORAGE_KEYS.APPOINTMENTS, merged);
      return normalizedRemote;
    }
  } catch (err) {
    console.warn("[Booking] Không thể đồng bộ lịch hẹn từ MongoDB, dùng dữ liệu cục bộ:", err);
  }

  return getUserAppointments();
}

export async function saveAppointment(appointment) {
  const normalized = normalizeAppointmentItem(appointment) || appointment;
  const list = getAppointments().filter(
    (a) => String(a.id) !== String(normalized.id)
  );
  list.unshift(normalized);
  setData(STORAGE_KEYS.APPOINTMENTS, list);

  // Tạo thông báo mới trong hệ thống thông báo
  const notifs = getData(STORAGE_KEYS.NOTIFICATIONS, []);
  notifs.unshift({
    id: Date.now(),
    icon: "📅",
    title: "Đặt lịch hẹn thành công!",
    desc: `Lịch hẹn ${normalized.serviceName} cho ${normalized.petName} vào ${normalized.time} ngày ${normalized.date} đã được ghi nhận. Mã: ${normalized.id}.`,
    time: Date.now(),
    read: false,
  });
  setData(STORAGE_KEYS.NOTIFICATIONS, notifs);
  renderNotifBadge();

  return normalized;
}

export async function cancelAppointment(appointmentId) {
  const list = getAppointments();
  const target = list.find(
    (a) =>
      String(a.id) === String(appointmentId) ||
      String(a.bookingCode || "") === String(appointmentId) ||
      String(a._id || "") === String(appointmentId)
  );
  if (target) {
    const cancelKey = target.bookingCode || target.id;
    if (cancelKey) {
      await apiCancelAppointment(cancelKey);
    }
    target.status = "Đã hủy";
    setData(STORAGE_KEYS.APPOINTMENTS, list);

    // Ghi nhận thông báo vào hệ thống thông báo chuông
    const notifs = getData(STORAGE_KEYS.NOTIFICATIONS, []);
    notifs.unshift({
      id: Date.now(),
      icon: "ℹ️",
      title: "Hủy lịch hẹn thành công",
      desc: `Lịch hẹn ${target.serviceName} cho bé ${target.petName} (Mã: ${target.id}) đã được hủy theo yêu cầu của bạn.`,
      time: Date.now(),
      read: false,
    });
    setData(STORAGE_KEYS.NOTIFICATIONS, notifs);
    renderNotifBadge();
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
 let bookedTimes = new Set();
 let availabilityLoaded = false;
 let activePromo = null;

 // 1. Khởi tạo danh sách Dịch vụ
 function renderServices() {
 // Đọc query string URL xem có pre-select service không (vd ?service=spa)
 const urlParams = new URLSearchParams(window.location.search);
 const rawService = urlParams.get("service") || "vet";
 const serviceAliasMap = { bath: "spa", grooming: "spa" };
 const preselectedId = serviceAliasMap[rawService] || rawService;

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
  async function renderPets(options = {}) {
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
      updateSummary();
      return;
    }

    // NGƯỜI DÙNG ĐÃ ĐĂNG NHẬP: Chờ tải danh sách thú cưng mới nhất từ MongoDB trước khi render
    if (petStepSubtitle) {
      petStepSubtitle.textContent = `Hồ sơ thú cưng đã đăng ký của bạn (${user.name || "Khách hàng"})`;
    }

    let pets = Array.isArray(options.pets) ? options.pets : null;
    if (!pets) {
      try {
        pets = await fetchPetsFromDatabase();
      } catch {
        pets = getPetsList();
      }
    }
    if (!Array.isArray(pets)) pets = [];

    const preferredId =
      options.selectedPetId || currentSelection.pet?.id || currentSelection.pet?._id;
    let selectedPet = null;
    if (preferredId) {
      selectedPet = pets.find(
        (p) =>
          String(p.id) === String(preferredId) ||
          (p._id && String(p._id) === String(preferredId))
      );
    }
    if (!selectedPet && pets.length > 0) {
      selectedPet = pets[0];
    }
    currentSelection.pet = selectedPet || null;

    let html = pets
      .map((p) => {
        const isChecked = Boolean(selectedPet && String(p.id) === String(selectedPet.id));
        const avatarSrc =
          p.avatar ||
          (p.species === "Mèo" ? "../assets/img/frenchie.jpg" : "../assets/img/golden.jpg");
        const speciesIcon = p.species === "Mèo" ? "🐱" : "🐶";
        const safeId = escapeHTML(String(p.id || ""));

        return `
          <label class="booking-pet-item ${isChecked ? "selected" : ""}" data-id="${safeId}">
            <input type="radio" name="petOption" value="${safeId}" ${isChecked ? "checked" : ""} />
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
        petsContainer
          .querySelectorAll(".booking-pet-item")
          .forEach((c) => c.classList.remove("selected"));
        card.classList.add("selected");
        const radio = card.querySelector('input[type="radio"]');
        if (radio) radio.checked = true;

        const pId = card.dataset.id;
        currentSelection.pet = pets.find((p) => String(p.id) === String(pId)) || null;
        updateSummary();
      });
    });

    const btnQuickAdd = document.getElementById("btnQuickAddPet");
    if (btnQuickAdd) {
      btnQuickAdd.addEventListener("click", async () => {
        const petName = prompt("Nhập tên bé cưng của bạn:");
        if (!petName || !petName.trim()) return;

        const trimmedName = petName.trim();
        const ownerId = user.id || user._id;
        const newPetPayload = {
          name: trimmedName,
          species: "Chó",
          breed: "Thú cưng gia đình",
          age: "Chưa rõ",
          ageText: "Chưa rõ",
          gender: "Đực",
          vaccinated: "Cần tiêm nhắc lại",
          sterilized: "Chưa triệt sản",
          avatar: "../assets/img/golden.jpg",
          userId: ownerId,
          ownerId: ownerId,
        };

        try {
          const updatedPets = await savePetItem(newPetPayload);
          const savedPet =
            [...updatedPets].reverse().find((p) => p.name === trimmedName) ||
            updatedPets[updatedPets.length - 1] ||
            null;
          currentSelection.pet = savedPet;
          await renderPets({
            pets: updatedPets,
            selectedPetId: savedPet?.id || savedPet?._id,
          });
          updateSummary();
        } catch (err) {
          console.error("Không thể thêm thú cưng mới:", err);
          alert(err.message || "Không thể thêm thú cưng lúc này. Vui lòng thử lại.");
        }
      });
    }

    updateSummary();
  }

  // 3. Khởi tạo Ngày & Khung giờ
  function getTodayISO() {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  function parseTimeToMinutes(timeStr) {
    if (!timeStr || typeof timeStr !== "string") return -1;
    const parts = timeStr.split(":");
    if (parts.length < 2) return -1;
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if (isNaN(h) || isNaN(m)) return -1;
    return h * 60 + m;
  }

  function isPastDateTime(dateISO, timeStr) {
    if (!dateISO) return false;
    const todayISO = getTodayISO();
    if (dateISO < todayISO) return true;
    if (dateISO > todayISO) return false;
    const slotMinutes = parseTimeToMinutes(timeStr);
    if (slotMinutes < 0) return false;
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    return slotMinutes <= nowMinutes;
  }

  function isWithinClinicHours(timeStr) {
    const totalMinutes = parseTimeToMinutes(timeStr);
    if (totalMinutes < 0) return false;

    // Sáng: 08:30 (510 phút) đến 11:30 (690 phút)
    const isMorning = totalMinutes >= 8 * 60 + 30 && totalMinutes <= 11 * 60 + 30;
    // Chiều & Tối: 13:30 (810 phút) đến 19:30 (1170 phút)
    const isAfternoon = totalMinutes >= 13 * 60 + 30 && totalMinutes <= 19 * 60 + 30;

    return isMorning || isAfternoon;
  }

  function applySlotAvailability() {
    if (!timeSlotsContainer || !dateInput?.value) return;
    const selectedDate = dateInput.value;
    const slots = [...timeSlotsContainer.querySelectorAll(".time-slot-pill")];

    slots.forEach((pill) => {
      const time = pill.dataset.time;
      const isBooked = bookedTimes.has(time);
      const isPast = isPastDateTime(selectedDate, time);
      const isDisabled = isBooked || isPast;

      pill.classList.toggle("booked", isBooked);
      pill.classList.toggle("past", isPast);
      pill.classList.toggle("disabled", isDisabled);
      if (isPast && !isBooked) {
        pill.style.opacity = "0.45";
        pill.style.cursor = "not-allowed";
        pill.style.textDecoration = "line-through";
      } else if (!isBooked) {
        pill.style.opacity = "";
        pill.style.cursor = "";
        pill.style.textDecoration = "";
      }

      pill.setAttribute("aria-disabled", String(isDisabled));
      pill.title = isBooked
        ? "Khung giờ đã được đặt trước"
        : isPast
        ? "Khung giờ này đã qua"
        : "";

      const radio = pill.querySelector('input[type="radio"]');
      if (radio) radio.disabled = isDisabled;

      if (isDisabled && currentSelection.time === time) {
        pill.classList.remove("selected");
        if (radio) radio.checked = false;
        currentSelection.time = "";
      }
    });

    const customTimeInput = document.getElementById("customTimeInput");
    const customTimeError = document.getElementById("customTimeError");
    if (customTimeInput && customTimeInput.value) {
      const val = customTimeInput.value;
      if (bookedTimes.has(val) || isPastDateTime(selectedDate, val)) {
        customTimeInput.classList.remove("custom-time-active");
        if (currentSelection.time === val) {
          currentSelection.time = "";
        }
        if (customTimeError) {
          customTimeError.textContent = bookedTimes.has(val)
            ? "Khung giờ đã được đặt trước."
            : "⚠️ Khung giờ này đã qua. Vui lòng chọn khung giờ trong tương lai.";
          customTimeError.hidden = false;
        }
      }
    }

    if (!currentSelection.time && (!customTimeInput || !customTimeInput.value)) {
      const firstAvailable = slots.find(
        (pill) => !pill.classList.contains("booked") && !pill.classList.contains("past")
      );
      slots.forEach((p) => {
        p.classList.remove("selected");
        const r = p.querySelector('input[type="radio"]');
        if (r) r.checked = false;
      });
      if (firstAvailable) {
        firstAvailable.classList.add("selected");
        const radio = firstAvailable.querySelector('input[type="radio"]');
        if (radio) radio.checked = true;
        currentSelection.time = firstAvailable.dataset.time || radio?.value || "";
      } else {
        currentSelection.time = "";
      }
    }

    updateSummary();
  }

  function initDateTime() {
    // Thiết lập ngày tối thiểu là ngày hôm nay
    const todayStr = getTodayISO();
    const customTimeInput = document.getElementById("customTimeInput");
    const customTimeError = document.getElementById("customTimeError");

    if (dateInput) {
      dateInput.min = todayStr;
      dateInput.value = todayStr;
      currentSelection.date = formatDateVN(todayStr);

      dateInput.addEventListener("change", () => {
        currentSelection.date = formatDateVN(dateInput.value);
        currentSelection.time = "";
        if (customTimeInput) {
          customTimeInput.value = "";
          customTimeInput.classList.remove("custom-time-active");
        }
        if (customTimeError) customTimeError.hidden = true;
        if (timeSlotsContainer) {
          timeSlotsContainer.querySelectorAll(".time-slot-pill").forEach((pill) => {
            pill.classList.remove("selected");
            const radio = pill.querySelector('input[type="radio"]');
            if (radio) radio.checked = false;
          });
        }
        applySlotAvailability();
        refreshBookedSlots();
      });
    }

    // Gắn sự kiện cho các pill time-slot cố định
    if (timeSlotsContainer) {
      const slots = timeSlotsContainer.querySelectorAll(".time-slot-pill");
      slots.forEach((pill) => {
        // Xóa trạng thái checked mặc định cứng từ HTML để applySlotAvailability chọn đúng slot khả dụng đầu tiên
        pill.classList.remove("selected");
        const radioInit = pill.querySelector('input[type="radio"]');
        if (radioInit) radioInit.checked = false;

        pill.addEventListener("click", (ev) => {
          if (pill.classList.contains("booked")) {
            ev.preventDefault();
            alert("Khung giờ đã được đặt trước.");
            return;
          }
          if (
            pill.classList.contains("past") ||
            isPastDateTime(dateInput?.value, pill.dataset.time)
          ) {
            ev.preventDefault();
            alert("Khung giờ này đã qua. Vui lòng chọn khung giờ khác hoặc chọn ngày mai.");
            return;
          }

          slots.forEach((p) => {
            p.classList.remove("selected");
            const r = p.querySelector('input[type="radio"]');
            if (r) r.checked = false;
          });
          pill.classList.add("selected");
          const radio = pill.querySelector('input[type="radio"]');
          if (radio) radio.checked = true;

          // Bỏ custom time khi khách click chọn pill cố định
          if (customTimeInput) {
            customTimeInput.value = "";
            customTimeInput.classList.remove("custom-time-active");
          }
          if (customTimeError) customTimeError.hidden = true;

          currentSelection.time = pill.dataset.time || radio?.value || "";
          updateSummary();
        });
      });
    }

    applySlotAvailability();
    refreshBookedSlots();

    // Gắn sự kiện cho ô TỰ CHỌN GIỜ RIÊNG (Custom Time Picker)
    if (customTimeInput) {
      const handleCustomTimeChange = () => {
        const val = customTimeInput.value;
        if (!val) {
          customTimeInput.classList.remove("custom-time-active");
          if (customTimeError) customTimeError.hidden = true;
          const selectedPill = timeSlotsContainer?.querySelector(".time-slot-pill.selected");
          currentSelection.time = selectedPill ? selectedPill.dataset.time || "" : "";
          updateSummary();
          return;
        }

        const clearSelectedPills = () => {
          if (timeSlotsContainer) {
            timeSlotsContainer.querySelectorAll(".time-slot-pill").forEach((p) => {
              p.classList.remove("selected");
              const r = p.querySelector('input[type="radio"]');
              if (r) r.checked = false;
            });
          }
        };

        if (!isWithinClinicHours(val)) {
          customTimeInput.classList.remove("custom-time-active");
          clearSelectedPills();
          currentSelection.time = "";
          if (customTimeError) {
            customTimeError.textContent =
              "⚠️ Khung giờ này ngoài ca tiếp nhận. Vui lòng chọn trong khoảng 08:30 – 11:30 (sáng) hoặc 13:30 – 19:30 (chiều tối).";
            customTimeError.hidden = false;
          }
          updateSummary();
          return;
        }

        if (isPastDateTime(dateInput?.value, val)) {
          customTimeInput.classList.remove("custom-time-active");
          clearSelectedPills();
          currentSelection.time = "";
          if (customTimeError) {
            customTimeError.textContent =
              "⚠️ Khung giờ này đã qua. Vui lòng chọn khung giờ trong tương lai hoặc chọn ngày mai.";
            customTimeError.hidden = false;
          }
          updateSummary();
          return;
        }

        if (bookedTimes.has(val)) {
          customTimeInput.classList.remove("custom-time-active");
          clearSelectedPills();
          currentSelection.time = "";
          if (customTimeError) {
            customTimeError.textContent = "Khung giờ đã được đặt trước.";
            customTimeError.hidden = false;
          }
          updateSummary();
          return;
        }

        // Hợp lệ: Bỏ chọn các pill cố định để khách toàn quyền chọn giờ riêng
        clearSelectedPills();
        customTimeInput.classList.add("custom-time-active");
        if (customTimeError) customTimeError.hidden = true;

        currentSelection.time = val;
        updateSummary();
      };

      customTimeInput.addEventListener("input", handleCustomTimeChange);
      customTimeInput.addEventListener("change", handleCustomTimeChange);
    }
  }

  async function refreshBookedSlots() {
    if (!dateInput?.value) return;
    const selectedDate = dateInput.value;
    availabilityLoaded = false;
    try {
      const result = await apiGetBookedSlots(selectedDate);
      if (dateInput.value !== selectedDate) return;
      bookedTimes = new Set(result.bookedTimes || []);
      availabilityLoaded = true;
      applySlotAvailability();
    } catch (error) {
      if (dateInput.value === selectedDate) {
        availabilityLoaded = false;
        applySlotAvailability();
        console.error("Không thể kiểm tra khung giờ đã đặt:", error);
      }
    }
  }

  function formatDateVN(dateString) {
    return formatDateVNStatic(dateString);
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
      const timeTxt = currentSelection.time || "Chưa chọn giờ";
      const dateTxt = currentSelection.date || "Hôm nay";
      sumDateTime.textContent = `${timeTxt} • ${dateTxt}`;
    }
 if (sumLocation) {
 sumLocation.textContent = "123 Nguyễn Văn Linh, P. Hải Châu, TP. Đà Nẵng";
 }
 if (sumFee) {
 if (currentSelection.service) {
 const basePrice = currentSelection.service.price || 120000;
 if (activePromo) {
 const discounted = Math.round(basePrice * (1 - activePromo.discount));
 sumFee.innerHTML = `<span style="text-decoration:line-through; font-size:13px; color:var(--ink-faint); margin-right:6px;">${basePrice.toLocaleString("vi-VN")}đ</span> ${discounted.toLocaleString("vi-VN")}đ`;
 } else {
 sumFee.textContent = currentSelection.service.priceDisplay;
 }
 } else {
 sumFee.textContent = "120.000đ";
 }
 }
 }

 // Khởi tạo xử lý Voucher ưu đãi (Pawmily vouchers: WELOVEPML20, DOUB5, TRIP7)
 const promoInput = document.getElementById("bookingPromoInput");
 const btnApplyPromo = document.getElementById("btnApplyPromo");
 const promoStatus = document.getElementById("promoStatusMessage");

 const PROMO_CODES = {
 WELOVEPML20: { discount: 0.2, label: "Giảm 20% (Ưu đãi khách hàng mới)" },
 DOUB5: { discount: 0.05, label: "Giảm 5% (Ưu đãi từ 2 bé cưng)" },
 TRIP7: { discount: 0.07, label: "Giảm 7% (Ưu đãi từ 3 bé cưng)" },
 };

 function applyPromoCode(codeStr) {
 if (!codeStr) return;
 const cleanCode = codeStr.trim().toUpperCase();
 if (PROMO_CODES[cleanCode]) {
 activePromo = { code: cleanCode, ...PROMO_CODES[cleanCode] };
 if (promoInput) promoInput.value = cleanCode;
 if (promoStatus) {
 promoStatus.hidden = false;
 promoStatus.style.color = "var(--sage-green)";
 promoStatus.textContent = `✓ Đã áp dụng: ${activePromo.label}`;
 }
 } else {
 activePromo = null;
 if (promoStatus) {
 promoStatus.hidden = false;
 promoStatus.style.color = "var(--danger)";
 promoStatus.textContent = "❌ Mã ưu đãi không hợp lệ hoặc đã hết hạn.";
 }
 }
 updateSummary();
 }

 if (btnApplyPromo && promoInput) {
 btnApplyPromo.addEventListener("click", () => {
 applyPromoCode(promoInput.value);
 });
 }

 // Tự động kiểm tra param ?promo=... từ URL
 const paramPromo = new URLSearchParams(window.location.search).get("promo");
 if (paramPromo) {
 applyPromoCode(paramPromo);
 }

 // 6. Xử lý Gửi Form đặt lịch
 bookingForm.addEventListener("submit", async (e) => {
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

    if (dateInput.value < getTodayISO()) {
      alert("Không thể đặt lịch cho ngày trong quá khứ. Vui lòng chọn từ hôm nay trở đi.");
      dateInput.focus();
      return;
    }

    if (!currentSelection.time) {
      alert("Vui lòng chọn khung giờ hẹn phù hợp.");
      return;
    }

    if (!isWithinClinicHours(currentSelection.time)) {
      alert(
        "Khung giờ ngoài ca tiếp nhận. Vui lòng chọn trong khoảng 08:30 – 11:30 hoặc 13:30 – 19:30."
      );
      return;
    }

    if (isPastDateTime(dateInput.value, currentSelection.time)) {
      alert("Khung giờ đã qua. Vui lòng chọn khung giờ trong tương lai hoặc chọn ngày khác.");
      applySlotAvailability();
      return;
    }

    const ownerName = (ownerNameInput.value || "").trim();
    if (!ownerName) {
      alert("Vui lòng nhập họ và tên người đặt lịch.");
      ownerNameInput.focus();
      return;
    }

    const ownerPhone = normalizePhone(ownerPhoneInput.value || "");
    if (!ownerPhone) {
      alert("Vui lòng nhập số điện thoại liên hệ.");
      ownerPhoneInput.focus();
      return;
    }

    const user = getCurrentUser();
    const userId = user?.id || user?._id;
    if (!availabilityLoaded) {
      await refreshBookedSlots();
      if (!availabilityLoaded) {
        alert("Không thể kiểm tra khung giờ. Vui lòng thử lại sau.");
        return;
      }
    }
    if (bookedTimes.has(currentSelection.time)) {
      alert("Khung giờ đã được đặt trước.");
      await refreshBookedSlots();
      return;
    }

    let newAppointment;
    try {
      const result = await apiCreateAppointment({
        userId: userId ? String(userId) : undefined,
        userEmail: user?.email,
        serviceId: currentSelection.service.id,
        serviceName: currentSelection.service.name,
        serviceIcon: currentSelection.service.icon,
        petName: currentSelection.pet.name,
        petSpecies: currentSelection.pet.species || "Thú cưng",
        petBreed: currentSelection.pet.breed || "",
        petAvatar: currentSelection.pet.avatar || "../assets/img/golden.jpg",
        dateISO: dateInput.value,
        time: currentSelection.time,
        ownerName,
        ownerPhone,
        notes: (notesInput?.value || "").trim(),
        location: "123 Nguyễn Văn Linh, P. Hải Châu, TP. Đà Nẵng",
        feeDisplay: currentSelection.service.priceDisplay,
      });
      newAppointment = {
        ...result,
        id: result.bookingCode || result._id,
        bookingCode: result.bookingCode,
        date: formatDateVN(dateInput.value),
        createdAt: Date.now(),
      };
      await saveAppointment(newAppointment);
    } catch (error) {
      if (error.statusCode === 409) {
        alert("Khung giờ đã được đặt trước.");
        await refreshBookedSlots();
        return;
      }
      console.error("Không thể đặt lịch:", error);
      alert(error.message || "Không thể đặt lịch lúc này. Vui lòng thử lại.");
      return;
    }

    // Làm mới khung giờ đã đặt ngay sau khi đặt lịch thành công
    await refreshBookedSlots();
    if (user) {
      await syncUserAppointmentsFromDatabase();
    }

    const bookingCode = newAppointment.bookingCode || newAppointment.id;
    if (userId) {
      createNotification({
        userId: String(userId),
        type: "appointment",
        title: "Đặt lịch hẹn thành công!",
        message: `Lịch hẹn ${newAppointment.serviceName} cho ${newAppointment.petName} vào ${newAppointment.time} ngày ${newAppointment.date} đã được ghi nhận. Mã: ${newAppointment.id}.`,
        icon: "📅",
      }).catch((error) => {
        console.error("Không thể lưu thông báo đặt lịch:", error);
      });
    }

    // Mở Modal thành công
    if (successBookingId) successBookingId.textContent = `Mã lịch hẹn: ${bookingCode}`;
    if (successRecapService)
      successRecapService.textContent = `${newAppointment.serviceIcon} ${newAppointment.serviceName}`;
    if (successRecapPet)
      successRecapPet.textContent = `${newAppointment.petName} (${newAppointment.petBreed})`;
    if (successRecapTime)
      successRecapTime.textContent = `${newAppointment.time} ngày ${newAppointment.date}`;

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

    let list = getUserAppointments();
    updateBadgeCount();

    if (list.length === 0) {
      listContainer.innerHTML = "";
      if (emptyBox) emptyBox.hidden = false;
      return;
    }

    if (emptyBox) emptyBox.hidden = true;

    // Lọc theo bộ lọc trạng thái nếu có
    let displayList = list;
    if (currentStatusFilter === "pending") {
      displayList = list.filter((a) => a.status === "Chờ xác nhận" || a.status === "pending");
    } else if (currentStatusFilter === "confirmed") {
      displayList = list.filter((a) => a.status === "Đã xác nhận");
    } else if (currentStatusFilter === "cancelled") {
      displayList = list.filter((a) => a.status === "Đã hủy");
    }

    if (displayList.length === 0) {
      listContainer.innerHTML = `
        <div style="text-align:center; padding: 40px 20px; background:var(--surface); border:1px dashed var(--line); border-radius:var(--radius-card); color:var(--ink-soft);">
          Không có lịch hẹn nào ở trạng thái này.
        </div>
      `;
      return;
    }

    listContainer.innerHTML = displayList
      .map((a) => {
        let statusClass = "pending";
        let statusLabel = a.status || "Chờ xác nhận";
        if (a.status === "Đã xác nhận") {
          statusClass = "confirmed";
        } else if (a.status === "Hoàn thành" || a.status === "completed") {
          statusClass = "confirmed";
          if (a.status === "completed") statusLabel = "Hoàn thành";
        } else if (a.status === "Đã hủy") {
          statusClass = "cancelled";
        } else if (a.status === "pending") {
          statusClass = "pending";
          statusLabel = "Chờ xác nhận";
        }

        const canCancel =
          a.status !== "Đã hủy" &&
          a.status !== "Hoàn thành" &&
          a.status !== "completed";
        const safeId = escapeHTML(String(a.id || ""));

        return `
          <article class="appointment-card" data-id="${safeId}">
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
              <span class="appt-status ${statusClass}">${escapeHTML(statusLabel)}</span>
              <span style="font-size:12px; color:var(--ink-faint)">Mã: ${safeId}</span>
              ${canCancel ? `<button class="btn-cancel-appt" data-action="cancel" data-id="${safeId}" type="button">Hủy lịch</button>` : ""}
            </div>
          </article>
        `;
      })
      .join("");

    listContainer.querySelectorAll('[data-action="cancel"]').forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.id;
        if (confirm(`Bạn có chắc chắn muốn hủy lịch hẹn mã ${id} không?`)) {
          try {
            await cancelAppointment(id);
            await syncUserAppointmentsFromDatabase();
            renderMyAppointments();
            await refreshBookedSlots();
          } catch (error) {
            console.error("Không thể hủy lịch hẹn:", error);
            alert(error.message || "Không thể hủy lịch hẹn lúc này.");
          }
        }
      });
    });
  }

  let currentStatusFilter = "all";
  function setupFilterButtons() {
    const filterContainer = document.getElementById("apptStatusFilters");
    if (!filterContainer) return;
    const buttons = filterContainer.querySelectorAll(".appt-filter-btn");
    buttons.forEach((btn) => {
      btn.addEventListener("click", () => {
        buttons.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        currentStatusFilter = btn.dataset.filter || "all";
        renderMyAppointments();
      });
    });
  }

  function switchToBookingTab() {
    tabNewBooking.classList.add("active");
    tabMyAppointments.classList.remove("active");
    viewBookingForm.hidden = false;
    viewMyAppointments.hidden = true;
  }

  async function switchToMyAppointmentsTab() {
    tabNewBooking.classList.remove("active");
    tabMyAppointments.classList.add("active");
    viewBookingForm.hidden = true;
    viewMyAppointments.hidden = false;
    renderMyAppointments();
    if (getCurrentUser()) {
      await syncUserAppointmentsFromDatabase();
      renderMyAppointments();
    }
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
  setupFilterButtons();

  // Đồng bộ lịch hẹn mới nhất từ MongoDB ngay khi mở trang
  if (getCurrentUser()) {
    syncUserAppointmentsFromDatabase().then(() => {
      updateBadgeCount();
      if (viewMyAppointments && !viewMyAppointments.hidden) {
        renderMyAppointments();
      }
    });
  }

  if (
    window.location.hash === "#my-appts" ||
    window.location.hash === "#my-appointments" ||
    window.location.pathname.includes("appointment-list")
  ) {
    switchToMyAppointmentsTab();
  }
}
