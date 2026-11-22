/* ============================================================
   pet-checkin.js
   Sprint 4: Task 2 - Pet Check-in
   - Cho phép nhân viên nhận thú cưng vào lưu chuồng.
   - Chọn khách hàng, thú cưng (phải thuộc về khách đã chọn),
     chuồng trống phù hợp (chỉ hiện chuồng có trạng thái available).
   - Ngày nhận, ngày dự kiến trả (ngày dự kiến trả phải sau ngày nhận).
   - Ghi lại đồ mang theo (belongings) và tình trạng sức khỏe lúc nhận (healthNote).
   - RÀNG BUỘC: Một thú cưng không thể check-in khi vẫn đang lưu ở chuồng khác.
   - Check-in thành công thì tạo lượt lưu chuồng với trạng thái checked_in
     và tự chuyển chuồng sang occupied.
   - Chuồng đã có người, thú cưng đang lưu hoặc dữ liệu sai đều bị từ chối kèm thông báo rõ ràng.
   ============================================================ */

import {
  getHotelCustomers,
  getHotelCages,
  setHotelCages,
  getHotelStays,
  setHotelStays,
  getAvailableCages,
  isPetCurrentlyBoarding,
  calculateStayDurationAndFee,
  showHotelToast,
  formatVND,
} from "./hotel-data.js";
import { escapeHTML } from "./storage.js";

export function initPetCheckInPage() {
  const container = document.getElementById("petCheckInPage");
  if (!container) return; // Không ở trang Pet Check-in

  const checkinForm = document.getElementById("petCheckInForm");
  const selectCustomer = document.getElementById("checkinCustomer");
  const selectPet = document.getElementById("checkinPet");
  const selectCage = document.getElementById("checkinCage");
  const inputCheckInDate = document.getElementById("checkinDate");
  const inputExpectedCheckOutDate = document.getElementById("expectedCheckOutDate");
  const inputBelongings = document.getElementById("checkinBelongings");
  const inputHealthNote = document.getElementById("checkinHealthNote");
  const alertContainer = document.getElementById("checkinAlertContainer");

  // Summary elements
  const summaryCustomer = document.getElementById("summaryCustomer");
  const summaryPet = document.getElementById("summaryPet");
  const summaryCage = document.getElementById("summaryCage");
  const summaryDates = document.getElementById("summaryDates");
  const summaryDuration = document.getElementById("summaryDuration");
  const summaryRate = document.getElementById("summaryRate");
  const summaryTotal = document.getElementById("summaryTotal");
  const btnSubmit = document.getElementById("btnConfirmCheckin");

  // Đặt ngày mặc định (Hôm nay & Ngày mai)
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 2); // Dự kiến 2 ngày lưu trú

  const formatDateForInput = (d) => d.toISOString().split("T")[0];
  if (inputCheckInDate && !inputCheckInDate.value) {
    inputCheckInDate.value = formatDateForInput(today);
  }
  if (inputExpectedCheckOutDate && !inputExpectedCheckOutDate.value) {
    inputExpectedCheckOutDate.value = formatDateForInput(tomorrow);
  }

  function showAlert(message, type = "warning") {
    if (!alertContainer) return;
    if (!message) {
      alertContainer.innerHTML = "";
      alertContainer.style.display = "none";
      return;
    }
    const icon = type === "danger" ? "🚫" : "⚠️";
    alertContainer.className = `checkin-alert ${type}`;
    alertContainer.innerHTML = `<span>${icon}</span> <span>${escapeHTML(message)}</span>`;
    alertContainer.style.display = "flex";
  }

  function populateCustomers() {
    const customers = getHotelCustomers();
    selectCustomer.innerHTML = `<option value="">-- Chọn khách hàng gửi bé --</option>` +
      customers
        .map((c) => `<option value="${escapeHTML(c.id)}">${escapeHTML(c.name)} (${escapeHTML(c.phone)})</option>`)
        .join("");
  }

  function populatePetsForCustomer(customerId) {
    if (!customerId) {
      selectPet.innerHTML = `<option value="">-- Vui lòng chọn khách hàng trước --</option>`;
      selectPet.disabled = true;
      return;
    }

    const customers = getHotelCustomers();
    const customer = customers.find((c) => c.id === customerId);

    if (!customer || !customer.pets || customer.pets.length === 0) {
      selectPet.innerHTML = `<option value="">-- Khách hàng này chưa có hồ sơ thú cưng --</option>`;
      selectPet.disabled = true;
      showAlert("Khách hàng này chưa có thông tin thú cưng trong hệ thống. Vui lòng thêm bé vào hồ sơ trước.", "warning");
      return;
    }

    selectPet.disabled = false;
    selectPet.innerHTML = `<option value="">-- Chọn thú cưng tiếp nhận --</option>` +
      customer.pets
        .map((p) => {
          const isBoarding = isPetCurrentlyBoarding(p.id);
          const boardingNotice = isBoarding ? " [⚠️ Đang lưu ở chuồng khác]" : "";
          return `<option value="${escapeHTML(p.id)}" ${isBoarding ? 'data-boarding="true"' : ""}>${escapeHTML(p.name)} (${escapeHTML(p.species || "Chó/Mèo")} - ${escapeHTML(p.breed || "Thú cưng")})${boardingNotice}</option>`;
        })
        .join("");
  }

  function populateAvailableCages() {
    // RÀNG BUỘC: CHỈ HIỆN CHUỒNG CÓ TRẠNG THÁI available
    const availableCages = getAvailableCages();

    if (availableCages.length === 0) {
      selectCage.innerHTML = `<option value="">-- Hết chuồng trống (Tất cả chuồng đang đầy hoặc bảo trì) --</option>`;
      selectCage.disabled = true;
      showAlert("Hiện tại toàn bộ phòng lưu chuồng đã được lấp đầy hoặc đang bảo dưỡng. Vui lòng kiểm tra lại danh sách chuồng.", "danger");
      return;
    }

    selectCage.disabled = false;
    selectCage.innerHTML = `<option value="">-- Chọn chuồng trống phù hợp (${availableCages.length} chuồng sẵn sàng) --</option>` +
      availableCages
        .map((c) => {
          return `<option value="${escapeHTML(c.id)}" data-price="${c.price}" data-size="${escapeHTML(c.sizeLabel || c.size)}">
            ${escapeHTML(c.code)}: ${escapeHTML(c.name)} - ${escapeHTML(c.sizeLabel || c.size)} (${formatVND(c.price)}/ngày)
          </option>`;
        })
        .join("");
  }

  function updateLiveSummary() {
    showAlert(""); // Reset cảnh báo

    const customerId = selectCustomer.value;
    const petId = selectPet.value;
    const cageId = selectCage.value;
    const checkInVal = inputCheckInDate.value;
    const checkOutVal = inputExpectedCheckOutDate.value;

    const customers = getHotelCustomers();
    const currentCustomer = customers.find((c) => c.id === customerId);
    const currentPet = currentCustomer?.pets?.find((p) => p.id === petId);

    const cages = getHotelCages();
    const currentCage = cages.find((c) => c.id === cageId);

    // Cập nhật text tóm tắt
    if (summaryCustomer) {
      summaryCustomer.textContent = currentCustomer ? `${currentCustomer.name} (${currentCustomer.phone})` : "Chưa chọn";
    }

    if (summaryPet) {
      summaryPet.textContent = currentPet ? `${currentPet.name} (${currentPet.species || "Thú cưng"})` : "Chưa chọn";
    }

    // Kiểm tra ràng buộc thú cưng đang lưu chuồng
    if (currentPet && isPetCurrentlyBoarding(currentPet.id)) {
      showAlert(`Bé "${currentPet.name}" hiện đang trong một đợt lưu chuồng khác chưa trả. Không thể check-in hai chuồng cùng lúc!`, "danger");
      if (btnSubmit) btnSubmit.disabled = true;
      return;
    }

    // Kiểm tra chuồng trống
    if (currentCage) {
      if (currentCage.status !== "available") {
        showAlert(`Chuồng "${currentCage.code}" hiện không còn trống (${currentCage.status}). Vui lòng chọn chuồng khác!`, "danger");
        if (btnSubmit) btnSubmit.disabled = true;
        return;
      }
      if (summaryCage) {
        summaryCage.innerHTML = `<strong>${escapeHTML(currentCage.code)}:</strong> ${escapeHTML(currentCage.name)}`;
      }
      if (summaryRate) {
        summaryRate.textContent = `${formatVND(currentCage.price)} / ngày`;
      }
    } else {
      if (summaryCage) summaryCage.textContent = "Chưa chọn chuồng";
      if (summaryRate) summaryRate.textContent = "—";
    }

    // Kiểm tra ngày tháng & tính toán chi phí
    if (checkInVal && checkOutVal) {
      if (summaryDates) {
        summaryDates.textContent = `${checkInVal} → ${checkOutVal}`;
      }

      const price = currentCage ? currentCage.price : 0;
      const calc = calculateStayDurationAndFee(checkInVal, checkOutVal, price);

      if (!calc.isValid) {
        showAlert(calc.error || "Ngày dự kiến trả phòng phải sau ngày nhận phòng!", "danger");
        if (summaryDuration) summaryDuration.textContent = "Không hợp lệ";
        if (summaryTotal) summaryTotal.textContent = "0đ";
        if (btnSubmit) btnSubmit.disabled = true;
        return;
      }

      if (summaryDuration) {
        summaryDuration.textContent = `${calc.days} ngày (Dự kiến)`;
      }
      if (summaryTotal) {
        summaryTotal.textContent = formatVND(calc.totalFee);
      }
    } else {
      if (summaryDuration) summaryDuration.textContent = "—";
      if (summaryTotal) summaryTotal.textContent = "0đ";
    }

    // Nếu đầy đủ thông tin hợp lệ
    const isValidForm = Boolean(currentCustomer && currentPet && currentCage && currentCage.status === "available");
    if (btnSubmit) {
      btnSubmit.disabled = !isValidForm;
    }
  }

  // Khởi tạo chips gợi ý nhanh cho đồ dùng & ghi chú
  function initQuickChips() {
    document.querySelectorAll(".quick-chip[data-target]").forEach((chip) => {
      chip.addEventListener("click", () => {
        const targetId = chip.getAttribute("data-target");
        const text = chip.getAttribute("data-text");
        const input = document.getElementById(targetId);
        if (!input) return;

        if (input.value.trim().length > 0) {
          if (!input.value.includes(text)) {
            input.value = `${input.value.trim()}, ${text}`;
          }
        } else {
          input.value = text;
        }
      });
    });
  }

  // Xử lý sự kiện thay đổi dữ liệu form
  selectCustomer.addEventListener("change", () => {
    populatePetsForCustomer(selectCustomer.value);
    updateLiveSummary();
  });

  selectPet.addEventListener("change", updateLiveSummary);
  selectCage.addEventListener("change", updateLiveSummary);
  inputCheckInDate.addEventListener("change", updateLiveSummary);
  inputExpectedCheckOutDate.addEventListener("change", updateLiveSummary);

  // XỬ LÝ SUBMIT CHECK-IN
  checkinForm.addEventListener("submit", (e) => {
    e.preventDefault();

    const customerId = selectCustomer.value;
    const petId = selectPet.value;
    const cageId = selectCage.value;
    const checkInDate = inputCheckInDate.value;
    const expectedCheckOutDate = inputExpectedCheckOutDate.value;
    const belongings = inputBelongings.value.trim() || "Không gửi kèm đồ dùng cá nhân";
    const healthNote = inputHealthNote.value.trim() || "Bình thường, tinh thần tốt";

    if (!customerId || !petId || !cageId || !checkInDate || !expectedCheckOutDate) {
      showHotelToast("Vui lòng điền đầy đủ các thông tin bắt buộc!", "warning");
      return;
    }

    const customers = getHotelCustomers();
    const customer = customers.find((c) => c.id === customerId);
    const pet = customer?.pets?.find((p) => p.id === petId);

    const cages = getHotelCages();
    const cage = cages.find((c) => c.id === cageId);

    if (!customer || !pet || !cage) {
      showHotelToast("Dữ liệu khách hàng, thú cưng hoặc chuồng không hợp lệ!", "error");
      return;
    }

    // 1. RÀNG BUỘC: Thú cưng không thể check-in khi đang lưu ở chuồng khác
    if (isPetCurrentlyBoarding(pet.id)) {
      showHotelToast(`Bé ${pet.name} hiện đang lưu trú tại chuồng khác, không thể check-in!`, "error");
      showAlert(`Bé "${pet.name}" đang lưu trú tại cơ sở. Vui lòng check-out đợt cũ trước khi nhận lượt mới.`, "danger");
      return;
    }

    // 2. RÀNG BUỘC: Chuồng phải có trạng thái available
    if (cage.status !== "available") {
      showHotelToast(`Chuồng ${cage.code} đã có thú cưng lưu trú hoặc đang bảo trì!`, "error");
      showAlert(`Chuồng ${cage.code} không ở trạng thái sẵn sàng. Vui lòng chọn chuồng khác.`, "danger");
      populateAvailableCages();
      return;
    }

    // 3. RÀNG BUỘC: Ngày dự kiến trả phải sau ngày nhận
    const calc = calculateStayDurationAndFee(checkInDate, expectedCheckOutDate, cage.price);
    if (!calc.isValid) {
      showHotelToast(calc.error, "error");
      showAlert(calc.error, "danger");
      return;
    }

    // TẤT CẢ HỢP LỆ -> TIẾN HÀNH CHECK-IN
    // 1. Cập nhật chuồng sang 'occupied'
    cage.status = "occupied";
    setHotelCages(cages);

    // 2. Tạo lượt lưu chuồng mới với trạng thái 'checked_in'
    const stays = getHotelStays();
    const newStay = {
      id: "STAY-" + Date.now(),
      code: "STAY-" + Math.floor(100 + Math.random() * 900),
      customerId: customer.id,
      customerName: customer.name,
      customerPhone: customer.phone,
      petId: pet.id,
      petName: pet.name,
      petSpecies: pet.species || "Chó",
      petBreed: pet.breed || "Thú cưng",
      cageId: cage.id,
      cageName: cage.name,
      cageSize: cage.size,
      pricePerDay: cage.price,
      checkInDate,
      expectedCheckOutDate,
      belongings,
      healthNote,
      status: "checked_in", // checked_in
      createdAt: new Date().toISOString(),
    };

    stays.unshift(newStay);
    setHotelStays(stays);

    // Thông báo thành công
    showHotelToast(`Check-in thành công cho bé ${pet.name} vào ${cage.code}! Chuồng đã chuyển sang Đang dùng.`, "success");

    // Reset form & tải lại danh sách chuồng trống
    checkinForm.reset();
    inputCheckInDate.value = formatDateForInput(new Date());
    const newTomorrow = new Date();
    newTomorrow.setDate(newTomorrow.getDate() + 2);
    inputExpectedCheckOutDate.value = formatDateForInput(newTomorrow);

    populateAvailableCages();
    populatePetsForCustomer("");
    updateLiveSummary();
  });

  // Khởi chạy dữ liệu trang
  populateCustomers();
  populateAvailableCages();
  initQuickChips();
  updateLiveSummary();
}
