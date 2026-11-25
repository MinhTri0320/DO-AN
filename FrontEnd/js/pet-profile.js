/* ============================================================
 pet-profile.js
 Sprint 2 Task: "Pet Profile"
 - Cho phép người dùng quản lý thông tin hồ sơ của thú cưng:
 tên, loài, giống, tuổi, cân nặng và các thông tin liên quan.
 - Người dùng có thể xem, thêm mới, cập nhật và xóa thú cưng.
 - Kết nối trực tiếp cơ sở dữ liệu MongoDB thông qua Back-End Express API.
 - Tự động đồng bộ với localStorage (pawncare_pets) và trang Đặt lịch hẹn.
 ============================================================ */

import { STORAGE_KEYS, getData, setData, escapeHTML } from "./storage.js";
import { apiGetPets, apiSavePet, apiDeletePet } from "./api.js";
import { getCurrentUser } from "./auth.js";

const DEFAULT_PETS = [
 {
 id: "pet_1",
 name: "Bé Bơ",
 species: "Chó",
 breed: "Golden Retriever",
 age: "2 tuổi",
 gender: "Đực",
 weight: "19.5",
 vaccinated: "Đã tiêm phòng đủ",
 sterilized: "Đã triệt sản",
 avatar: "../assets/img/golden.jpg",
 notes: "Rất thân thiện, thích chạy nhảy ngoài sân cỏ, ngoan khi tắm và cắt móng.",
 },
 {
 id: "pet_2",
 name: "Miu Miu",
 species: "Mèo",
 breed: "Mèo Anh lông ngắn",
 age: "1.5 tuổi",
 gender: "Cái",
 weight: "4.2",
 vaccinated: "Đã tiêm phòng đủ",
 sterilized: "Chưa triệt sản",
 avatar: "../assets/img/frenchie.jpg",
 notes: "Hơi nhát người lạ lần đầu gặp, thích ăn pate cá hồi, tai và lông sạch sẽ.",
 },
];

export function normalizeGenderToUI(val) {
  if (val === "male" || val === "Đực" || String(val || "").trim().toLowerCase() === "male") {
    return "Đực";
  }
  if (val === "female" || val === "Cái" || String(val || "").trim().toLowerCase() === "female") {
    return "Cái";
  }
  return "Đực";
}

export function normalizeVaccinatedToUI(val) {
  if (val === true || val === "true" || val === "Đã tiêm phòng đủ") {
    return "Đã tiêm phòng đủ";
  }
  if (
    val === false ||
    val === "false" ||
    val === "Chưa tiêm" ||
    val === "Chưa tiêm phòng" ||
    val === "Cần tiêm nhắc lại"
  ) {
    return "Cần tiêm nhắc lại";
  }
  return "Chưa rõ";
}

export function normalizeSterilizedToUI(val) {
  if (val === true || val === "true" || val === "Đã triệt sản") {
    return "Đã triệt sản";
  }
  if (val === false || val === "false" || val === "Chưa triệt sản") {
    return "Chưa triệt sản";
  }
  return "Chưa rõ";
}

function normalizeAgeToUI(p) {
  if (p?.ageText !== undefined && p?.ageText !== null && String(p.ageText).trim() !== "") {
    return String(p.ageText).trim();
  }
  if (p?.age !== undefined && p?.age !== null && String(p.age).trim() !== "") {
    return typeof p.age === "number" ? `${p.age} tuổi` : String(p.age).trim();
  }
  return "Chưa rõ";
}

function showToast(message, type = "success") {
  let toast = document.getElementById("profileToast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "profileToast";
    toast.className = "toast-notice";
    document.body.appendChild(toast);
  }
  const icon = type === "error" ? "⚠️" : type === "info" ? "ℹ️" : "✓";
  toast.className = `toast-notice ${type} show`;
  toast.innerHTML = `<span>${icon}</span> <span>${escapeHTML(message)}</span>`;
  setTimeout(() => {
    toast.classList.remove("show");
  }, 3200);
}

/**
 * Lấy danh sách thú cưng từ kho lưu trữ cục bộ (dùng ngay để UI hiển thị tức thời)
 */
export function getPetsList() {
  const existing = getData(STORAGE_KEYS.PETS, null);
  if (Array.isArray(existing)) {
    return existing;
  }
  if (getCurrentUser()) {
    return [];
  }
  setData(STORAGE_KEYS.PETS, DEFAULT_PETS);
  return DEFAULT_PETS;
}

/**
 * Tải danh sách thú cưng mới nhất từ MongoDB thông qua API GET /api/pets
 */
export async function fetchPetsFromDatabase() {
  const currentUser = getCurrentUser();
  const userId = currentUser?.id || currentUser?._id;

  if (!userId) {
    return getPetsList();
  }

  try {
    console.log(`[PetProfile] Đang gửi GET lấy danh sách thú cưng từ MongoDB cho user: ${userId}...`);
    const mongoPets = await apiGetPets(userId);
    if (mongoPets && Array.isArray(mongoPets)) {
      console.log(`[PetProfile] Đã nhận ${mongoPets.length} thú cưng từ MongoDB:`, mongoPets);
      // Chuẩn hóa dữ liệu từ MongoDB
      const normalizedPets = mongoPets.map((p, idx) => {
        const ageDisplay = normalizeAgeToUI(p);
        return {
          id: String(p._id || p.id || `pet_${idx + 1}`),
          ...(p._id ? { _id: String(p._id) } : {}),
          name: p.name || "Bé cưng",
          species: p.species || "Chó",
          breed: p.breed || "Chưa rõ",
          age: ageDisplay,
          ageText: ageDisplay,
          gender: normalizeGenderToUI(p.gender),
          weight:
            p.weight !== undefined && p.weight !== null && String(p.weight) !== ""
              ? String(p.weight)
              : "",
          vaccinated: normalizeVaccinatedToUI(p.vaccinated),
          sterilized: normalizeSterilizedToUI(p.sterilized),
          avatar:
            p.avatar ||
            (p.species === "Mèo" ? "../assets/img/frenchie.jpg" : "../assets/img/golden.jpg"),
          notes: p.notes || "",
          ...(p.userId || p.ownerId ? { userId: String(p.userId || p.ownerId) } : {}),
        };
      });

      // Đồng bộ vào localStorage để duy trì cache và phục vụ các trang khác (như booking)
      setData(STORAGE_KEYS.PETS, normalizedPets);
      return normalizedPets;
    }
  } catch (err) {
    console.warn("[PetProfile] Không thể lấy danh sách thú cưng từ MongoDB, dùng fallback cục bộ:", err);
  }

  return getPetsList();
}

/**
 * Lưu hồ sơ thú cưng lên MongoDB và đồng bộ với kho cục bộ
 */
export async function savePetItem(petData) {
  const currentUser = getCurrentUser();
  const payload = { ...petData };
  if (currentUser) {
    const uid = currentUser.id || currentUser._id;
    payload.userId = payload.userId || uid;
    payload.ownerId = payload.ownerId || uid;
    payload.ownerPhone = currentUser.phone;
    payload.ownerEmail = currentUser.email;
  }

  // 1. Gửi fetch API tới MongoDB/BackEnd
  let savedFromDb = null;
  try {
    savedFromDb = await apiSavePet(payload);
    if (savedFromDb) {
      console.log("[PetProfile] Đã lưu thú cưng lên MongoDB thành công:", savedFromDb);
    }
  } catch (e) {
    if (e instanceof TypeError) {
      console.warn("[PetProfile] BackEnd offline, dùng fallback cục bộ:", e);
    } else {
      throw e;
    }
  }

  // 2. Chuẩn hóa dữ liệu & ID từ MongoDB (không để giá trị raw DB ghi đè sai sang UI)
  const mergedRaw =
    savedFromDb && typeof savedFromDb === "object"
      ? { ...payload, ...savedFromDb }
      : { ...payload };

  const normalizedAge = normalizeAgeToUI({
    ageText: mergedRaw.ageText || payload.ageText,
    age: mergedRaw.age !== null && mergedRaw.age !== undefined ? mergedRaw.age : payload.age,
  });

  const finalPet = {
    ...mergedRaw,
    id: String(mergedRaw._id || mergedRaw.id || "pet_" + Date.now()),
    ...(mergedRaw._id ? { _id: String(mergedRaw._id) } : {}),
    name: mergedRaw.name || payload.name || "Bé cưng",
    species: mergedRaw.species || payload.species || "Chó",
    breed: mergedRaw.breed || payload.breed || "Chưa rõ",
    age: normalizedAge,
    ageText: normalizedAge,
    gender: normalizeGenderToUI(
      savedFromDb && savedFromDb.gender !== undefined ? savedFromDb.gender : payload.gender
    ),
    weight:
      mergedRaw.weight !== undefined && mergedRaw.weight !== null && String(mergedRaw.weight) !== ""
        ? String(mergedRaw.weight)
        : "",
    vaccinated: normalizeVaccinatedToUI(
      savedFromDb && savedFromDb.vaccinated !== undefined
        ? savedFromDb.vaccinated
        : payload.vaccinated
    ),
    sterilized: normalizeSterilizedToUI(
      savedFromDb && savedFromDb.sterilized !== undefined
        ? savedFromDb.sterilized
        : payload.sterilized
    ),
    avatar:
      mergedRaw.avatar ||
      payload.avatar ||
      (mergedRaw.species === "Mèo" ? "../assets/img/frenchie.jpg" : "../assets/img/golden.jpg"),
    notes: mergedRaw.notes !== undefined ? mergedRaw.notes : payload.notes || "",
  };

  // 3. Đồng bộ với kho lưu trữ cục bộ
  const pets = getPetsList().slice();
  const idx = pets.findIndex(
    (p) =>
      String(p.id) === String(finalPet.id) ||
      (finalPet._id && String(p._id || "") === String(finalPet._id)) ||
      (payload.id && String(p.id) === String(payload.id))
  );
  if (idx >= 0) {
    pets[idx] = { ...pets[idx], ...finalPet };
  } else {
    pets.push(finalPet);
  }
  setData(STORAGE_KEYS.PETS, pets);

  return pets;
}

/**
 * Xóa thú cưng khỏi MongoDB và đồng bộ kho cục bộ
 */
export async function deletePetItem(petId) {
  const isLocalOnly =
    String(petId || "").startsWith("pet_") ||
    String(petId || "").startsWith("local_");

  // 1. Gửi fetch API xóa tới MongoDB/BackEnd nếu không phải ID cục bộ tạm
  if (!isLocalOnly) {
    try {
      console.log(`[PetProfile] Đang gửi yêu cầu xóa thú cưng ${petId} trên MongoDB...`);
      await apiDeletePet(petId);
    } catch (e) {
      if (e instanceof TypeError) {
        console.warn("[PetProfile] BackEnd offline, dùng fallback cục bộ:", e);
      } else {
        throw e;
      }
    }
  }

  // 2. Đồng bộ xóa trong kho lưu trữ cục bộ
  let pets = getPetsList();
  pets = pets.filter(
    (p) => String(p.id) !== String(petId) && String(p._id || "") !== String(petId)
  );
  setData(STORAGE_KEYS.PETS, pets);

  return pets;
}

export function initPetProfilePage() {
 const container = document.getElementById("petGridContainer");
 if (!container) return; // Không ở trang Pet Profile thì bỏ qua

 const modal = document.getElementById("petModal");
 const modalCloseBtn = document.getElementById("petModalClose");
 const modalCancelBtn = document.getElementById("btnCancelPetModal");
 const petForm = document.getElementById("petForm");
 const modalTitle = document.getElementById("petModalTitle");
 const openAddBtn = document.getElementById("btnOpenAddPet");
 const emptyState = document.getElementById("petEmptyState");
 const petCountStat = document.getElementById("petCountStat");

 let editingPetId = null;

 // Cập nhật card sidebar người dùng nếu đã đăng nhập
 const currentUser = getCurrentUser();
 if (currentUser) {
 const sideName = document.getElementById("sidebarUserName");
 const sidePhone = document.getElementById("sidebarUserPhone");
 const sideInitial = document.getElementById("sidebarUserInitial");
 if (sideName) sideName.textContent = currentUser.name || "Khách hàng";
 if (sidePhone) sidePhone.textContent = currentUser.phone || currentUser.email || "0900 123 456";
 if (sideInitial) sideInitial.textContent = (currentUser.name || "U").trim().charAt(0).toUpperCase();
 }

  function renderPets(customPets = null) {
    const pets = customPets || getPetsList();

    if (petCountStat) {
      petCountStat.textContent = `${pets.length} bé cưng`;
    }

    if (pets.length === 0) {
      container.innerHTML = "";
      if (emptyState) emptyState.hidden = false;
      return;
    }

    if (emptyState) emptyState.hidden = true;

    container.innerHTML = pets
      .map((p) => {
        const genderText = normalizeGenderToUI(p.gender);
        const vaccinatedText = normalizeVaccinatedToUI(p.vaccinated);
        const sterilizedText = normalizeSterilizedToUI(p.sterilized);
        const ageDisplay = normalizeAgeToUI(p);
        const isVaccinated = vaccinatedText === "Đã tiêm phòng đủ";
        const isSterilized = sterilizedText === "Đã triệt sản";
        const speciesIcon = p.species === "Mèo" ? "🐱" : "🐶";
        const avatarSrc =
          p.avatar ||
          (p.species === "Mèo" ? "../assets/img/frenchie.jpg" : "../assets/img/golden.jpg");
        const safeId = escapeHTML(String(p.id || ""));
        const weightDisplay =
          p.weight !== undefined && p.weight !== null && String(p.weight).trim() !== ""
            ? String(p.weight)
            : "--";

        return `
          <article class="pet-card" data-id="${safeId}">
            <div class="pet-card-head">
              <div class="pet-avatar-frame">
                <img class="pet-avatar-img" src="${escapeHTML(avatarSrc)}" alt="${escapeHTML(p.name)}" />
              </div>
              <div class="pet-card-title">
                <h3>
                  <span>${escapeHTML(p.name)}</span>
                  <span class="pet-species-badge">${speciesIcon} ${escapeHTML(p.species || "Thú cưng")}</span>
                </h3>
                <p class="pet-breed-text">${escapeHTML(p.breed || "Giống thuần chủng")}</p>
              </div>
            </div>

            <div class="pet-details-grid">
              <div class="pet-detail-item">
                <span class="pet-detail-label">Độ tuổi</span>
                <span class="pet-detail-value">${escapeHTML(ageDisplay)}</span>
              </div>
              <div class="pet-detail-item">
                <span class="pet-detail-label">Giới tính</span>
                <span class="pet-detail-value">${escapeHTML(genderText)}</span>
              </div>
              <div class="pet-detail-item">
                <span class="pet-detail-label">Cân nặng</span>
                <span class="pet-detail-value">${escapeHTML(weightDisplay)} kg</span>
              </div>
              <div class="pet-detail-item">
                <span class="pet-detail-label">Triệt sản</span>
                <span class="pet-detail-value">${escapeHTML(sterilizedText)}</span>
              </div>
            </div>

            <div class="pet-status-tags">
              <span class="status-badge ${isVaccinated ? "vaccinated" : "need-vaccine"}">
                ${
                  isVaccinated
                    ? "✓ Đã tiêm phòng đủ"
                    : vaccinatedText === "Chưa rõ"
                    ? "❓ Tiêm phòng: Chưa rõ"
                    : "⚠️ Cần tiêm nhắc lại"
                }
              </span>
              <span class="status-badge sterilized">
                ${isSterilized ? "✂️ Đã triệt sản" : escapeHTML(sterilizedText)}
              </span>
            </div>

            <div class="pet-notes-box">
              "${escapeHTML(p.notes || "Bé cưng ngoan ngoãn và khỏe mạnh.")}"
            </div>

            <div class="pet-card-footer">
              <a href="./medical-record.html?petId=${encodeURIComponent(String(p.id || ""))}" class="btn-pet-action btn-medical-pet">
                <span>🩺</span><span>Hồ sơ y tế</span>
              </a>
              <button class="btn-pet-action btn-edit-pet" data-action="edit" data-id="${safeId}" type="button">
                <span>✏️</span><span>Sửa</span>
              </button>
              <button class="btn-pet-action btn-delete-pet" data-action="delete" data-id="${safeId}" type="button">
                <span>🗑️</span><span>Xóa</span>
              </button>
            </div>
          </article>
        `;
      })
      .join("");

    // Gắn sự kiện cho các nút Edit & Delete
    container.querySelectorAll('[data-action="edit"]').forEach((btn) => {
      btn.addEventListener("click", () => {
        openEditPetModal(btn.dataset.id);
      });
    });

    container.querySelectorAll('[data-action="delete"]').forEach((btn) => {
      btn.addEventListener("click", () => {
        confirmDeletePet(btn.dataset.id);
      });
    });
  }

  // 1. Render ngay từ kho lưu trữ cục bộ để giao diện tức thời không bị giật
  renderPets();

  // 2. Fetch danh sách mới nhất trực tiếp từ MongoDB thông qua API GET
  async function syncPetsFromDatabase() {
    const mongoPets = await fetchPetsFromDatabase();
    if (mongoPets && Array.isArray(mongoPets)) {
      renderPets(mongoPets);
    }
  }
  syncPetsFromDatabase();

  function openAddPetModal() {
    editingPetId = null;
    if (modalTitle) modalTitle.textContent = "Thêm Thú Cưng Mới";
    if (petForm) {
      petForm.reset();
      petForm.elements.petId.value = "";
      petForm.elements.petAvatar.value = "../assets/img/golden.jpg";
    }
    updatePresetPhotoActive("../assets/img/golden.jpg");
    if (modal) modal.hidden = false;
  }

  function openEditPetModal(petId) {
    const pets = getPetsList();
    const target = pets.find((p) => String(p.id) === String(petId));
    if (!target) return;

    editingPetId = petId;
    if (modalTitle) modalTitle.textContent = `Chỉnh Sửa Hồ Sơ: ${target.name}`;

    if (petForm) {
      const genderVal = normalizeGenderToUI(target.gender);
      const vaccinatedVal = normalizeVaccinatedToUI(target.vaccinated);
      const sterilizedVal = normalizeSterilizedToUI(target.sterilized);
      const ageVal = normalizeAgeToUI(target);

      petForm.elements.petId.value = target.id;
      petForm.elements.petName.value = target.name || "";
      petForm.elements.petSpecies.value = target.species || "Chó";
      petForm.elements.petBreed.value = target.breed || "";
      petForm.elements.petAge.value = ageVal === "Chưa rõ" ? "" : ageVal;
      petForm.elements.petGender.value = genderVal;
      petForm.elements.petWeight.value =
        target.weight !== undefined && target.weight !== null ? target.weight : "";
      petForm.elements.petVaccinated.value =
        vaccinatedVal === "Chưa rõ" ? "Cần tiêm nhắc lại" : vaccinatedVal;
      petForm.elements.petSterilized.value =
        sterilizedVal === "Chưa rõ" ? "Chưa triệt sản" : sterilizedVal;
      petForm.elements.petNotes.value = target.notes || "";
      petForm.elements.petAvatar.value = target.avatar || "../assets/img/golden.jpg";
    }

    updatePresetPhotoActive(target.avatar || "../assets/img/golden.jpg");
    if (modal) modal.hidden = false;
  }

  function closeModal() {
    if (modal) modal.hidden = true;
    editingPetId = null;
  }

  async function confirmDeletePet(petId) {
    const pets = getPetsList();
    const target = pets.find((p) => String(p.id) === String(petId));
    const name = target ? target.name : "thú cưng này";

    if (confirm(`Bạn có chắc chắn muốn xóa hồ sơ của ${name} không? Thao tác này không thể hoàn tác.`)) {
      try {
        await deletePetItem(petId);
        renderPets();
        showToast(`Đã xóa hồ sơ của ${name}.`, "info");
      } catch (err) {
        console.error("Lỗi khi xóa thú cưng:", err);
        showToast(err.message || "Không thể xóa hồ sơ thú cưng. Vui lòng thử lại.", "error");
      }
    }
  }

  function updatePresetPhotoActive(src) {
    document.querySelectorAll(".preset-photo-btn").forEach((btn) => {
      if (btn.dataset.src === src) {
        btn.classList.add("active");
      } else {
        btn.classList.remove("active");
      }
    });
  }

  // Khởi tạo chọn ảnh mẫu
  document.querySelectorAll(".preset-photo-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const src = btn.dataset.src;
      if (petForm && petForm.elements.petAvatar) {
        petForm.elements.petAvatar.value = src;
      }
      updatePresetPhotoActive(src);
    });
  });

  if (openAddBtn) {
    openAddBtn.addEventListener("click", openAddPetModal);
  }

  const emptyAddBtn = document.getElementById("btnEmptyAddPet");
  if (emptyAddBtn) {
    emptyAddBtn.addEventListener("click", openAddPetModal);
  }

  if (modalCloseBtn) modalCloseBtn.addEventListener("click", closeModal);
  if (modalCancelBtn) modalCancelBtn.addEventListener("click", closeModal);

  if (petForm) {
    petForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const name = (petForm.elements.petName.value || "").trim();
      if (!name) {
        alert("Vui lòng nhập tên cho bé cưng.");
        petForm.elements.petName.focus();
        return;
      }

      const ageInput = (petForm.elements.petAge.value || "").trim();
      const petData = {
        id: petForm.elements.petId.value || undefined,
        name: name,
        species: petForm.elements.petSpecies.value || "Chó",
        breed: (petForm.elements.petBreed.value || "").trim() || "Chưa rõ",
        age: ageInput || "Chưa rõ",
        ageText: ageInput || "Chưa rõ",
        gender: normalizeGenderToUI(petForm.elements.petGender.value),
        weight: (petForm.elements.petWeight.value || "").trim(),
        vaccinated: normalizeVaccinatedToUI(petForm.elements.petVaccinated.value),
        sterilized: normalizeSterilizedToUI(petForm.elements.petSterilized.value),
        notes: (petForm.elements.petNotes.value || "").trim(),
        avatar: petForm.elements.petAvatar.value || "../assets/img/golden.jpg",
      };

      const submitBtn = petForm.querySelector('button[type="submit"]');
      const origBtnText = submitBtn ? submitBtn.innerHTML : "";
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<span>⏳</span> <span>Đang lưu...</span>`;
      }

      const wasEditing = Boolean(editingPetId);
      try {
        await savePetItem(petData);
        closeModal();
        renderPets();
        showToast(
          wasEditing
            ? "Cập nhật thông tin thú cưng thành công!"
            : "Đã thêm thú cưng mới vào cơ sở dữ liệu!",
          "success"
        );
      } catch (err) {
        console.error("Lỗi khi lưu thú cưng:", err);
        showToast(err.message || "Không thể lưu thông tin thú cưng. Vui lòng thử lại.", "error");
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = origBtnText;
        }
      }
    });
  }
}
