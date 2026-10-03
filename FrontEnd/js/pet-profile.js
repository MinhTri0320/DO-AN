/* ============================================================
   pet-profile.js
   Sprint 2 Task: "Pet Profile"
   - Cho phép người dùng quản lý thông tin hồ sơ của thú cưng:
     tên, loài, giống, tuổi, cân nặng và các thông tin liên quan.
   - Người dùng có thể xem, thêm mới, cập nhật và xóa thú cưng.
   - Dữ liệu lưu bền vững trong localStorage (pawncare_pets).
   ============================================================ */

import { STORAGE_KEYS, getData, setData, escapeHTML } from "./storage.js";
import { apiSavePet, apiDeletePet } from "./api.js";

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

export function getPetsList() {
  const existing = getData(STORAGE_KEYS.PETS, null);
  if (existing && Array.isArray(existing)) {
    return existing;
  }
  setData(STORAGE_KEYS.PETS, DEFAULT_PETS);
  return DEFAULT_PETS;
}

export function savePetItem(petData) {
  const pets = getPetsList();
  if (petData.id) {
    const idx = pets.findIndex((p) => p.id === petData.id);
    if (idx >= 0) {
      pets[idx] = { ...pets[idx], ...petData };
    } else {
      pets.push(petData);
    }
  } else {
    petData.id = "pet_" + Date.now();
    pets.push(petData);
  }
  setData(STORAGE_KEYS.PETS, pets);

  // Gửi fetch API tới BackEnd
  try {
    apiSavePet(petData);
  } catch (e) {
    // API client đã xử lý fallback
  }

  return pets;
}

export function deletePetItem(petId) {
  let pets = getPetsList();
  pets = pets.filter((p) => p.id !== petId);
  setData(STORAGE_KEYS.PETS, pets);

  // Gửi fetch API xóa tới BackEnd
  try {
    apiDeletePet(petId);
  } catch (e) {
    // API client đã xử lý fallback
  }

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

  function renderPets() {
    const pets = getPetsList();

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
        const isVaccinated = p.vaccinated === "Đã tiêm phòng đủ";
        const isSterilized = p.sterilized === "Đã triệt sản";
        const speciesIcon = p.species === "Mèo" ? "🐱" : "🐶";
        const avatarSrc = p.avatar || (p.species === "Mèo" ? "../assets/img/frenchie.jpg" : "../assets/img/golden.jpg");

        return `
        <article class="pet-card" data-id="${p.id}">
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
              <span class="pet-detail-value">${escapeHTML(p.age || "Chưa rõ")}</span>
            </div>
            <div class="pet-detail-item">
              <span class="pet-detail-label">Giới tính</span>
              <span class="pet-detail-value">${escapeHTML(p.gender || "Đực")}</span>
            </div>
            <div class="pet-detail-item">
              <span class="pet-detail-label">Cân nặng</span>
              <span class="pet-detail-value">${escapeHTML(p.weight || "--")} kg</span>
            </div>
            <div class="pet-detail-item">
              <span class="pet-detail-label">Triệt sản</span>
              <span class="pet-detail-value">${isSterilized ? "Đã triệt sản" : "Chưa"}</span>
            </div>
          </div>

          <div class="pet-status-tags">
            <span class="status-badge ${isVaccinated ? "vaccinated" : "need-vaccine"}">
              ${isVaccinated ? "✓ Tiêm phòng đầy đủ" : "⚠️ Cần tiêm nhắc lại"}
            </span>
            <span class="status-badge sterilized">
              ${isSterilized ? "✂️ Đã triệt sản" : "Chưa triệt sản"}
            </span>
          </div>

          <div class="pet-notes-box">
            "${escapeHTML(p.notes || "Bé cưng ngoan ngoãn và khỏe mạnh.")}"
          </div>

          <div class="pet-card-footer">
            <button class="btn-pet-action btn-edit-pet" data-action="edit" data-id="${p.id}" type="button">
              ✏️ Chỉnh sửa
            </button>
            <button class="btn-pet-action btn-delete-pet" data-action="delete" data-id="${p.id}" type="button">
              🗑️ Xóa hồ sơ
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
    const target = pets.find((p) => p.id === petId);
    if (!target) return;

    editingPetId = petId;
    if (modalTitle) modalTitle.textContent = `Chỉnh Sửa Hồ Sơ: ${target.name}`;

    if (petForm) {
      petForm.elements.petId.value = target.id;
      petForm.elements.petName.value = target.name || "";
      petForm.elements.petSpecies.value = target.species || "Chó";
      petForm.elements.petBreed.value = target.breed || "";
      petForm.elements.petAge.value = target.age || "";
      petForm.elements.petGender.value = target.gender || "Đực";
      petForm.elements.petWeight.value = target.weight || "";
      petForm.elements.petVaccinated.value = target.vaccinated || "Đã tiêm phòng đủ";
      petForm.elements.petSterilized.value = target.sterilized || "Đã triệt sản";
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

  function confirmDeletePet(petId) {
    const pets = getPetsList();
    const target = pets.find((p) => p.id === petId);
    const name = target ? target.name : "thú cưng này";

    if (confirm(`Bạn có chắc chắn muốn xóa hồ sơ của ${name} không? Thao tác này không thể hoàn tác.`)) {
      deletePetItem(petId);
      renderPets();
      showToast(`Đã xóa hồ sơ của ${name}.`, "info");
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
    petForm.addEventListener("submit", (e) => {
      e.preventDefault();

      const name = (petForm.elements.petName.value || "").trim();
      if (!name) {
        alert("Vui lòng nhập tên cho bé cưng.");
        petForm.elements.petName.focus();
        return;
      }

      const petData = {
        id: petForm.elements.petId.value || undefined,
        name: name,
        species: petForm.elements.petSpecies.value || "Chó",
        breed: (petForm.elements.petBreed.value || "").trim() || "Chưa rõ",
        age: (petForm.elements.petAge.value || "").trim() || "1 tuổi",
        gender: petForm.elements.petGender.value || "Đực",
        weight: (petForm.elements.petWeight.value || "").trim() || "5.0",
        vaccinated: petForm.elements.petVaccinated.value || "Đã tiêm phòng đủ",
        sterilized: petForm.elements.petSterilized.value || "Đã triệt sản",
        notes: (petForm.elements.petNotes.value || "").trim(),
        avatar: petForm.elements.petAvatar.value || "../assets/img/golden.jpg",
      };

      savePetItem(petData);
      closeModal();
      renderPets();
      showToast(editingPetId ? "Cập nhật hồ sơ thú cưng thành công!" : "Đã thêm thú cưng mới vào danh sách!");
    });
  }

  // Render lần đầu
  renderPets();
}
