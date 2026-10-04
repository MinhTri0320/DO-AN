/* ============================================================
   campaigns.js
   Task "Register Campaigns": danh sách chiến dịch + modal
   đăng ký tham gia.
   ============================================================ */

import { escapeHTML, getData, setData, STORAGE_KEYS } from "./storage.js";
import { getCurrentUser } from "./auth.js";
import { apiRequest } from "./api.js";

const CAMPAIGNS = [
  {
    id: "vaccine-day",
    icon: "💉",
    date: "05/10/2026",
    title: "Ngày hội tiêm phòng miễn phí",
    desc: "Tiêm phòng dại & các bệnh truyền nhiễm miễn phí cho thú cưng trong khu vực.",
  },
  {
    id: "adoption-day",
    icon: "🐾",
    date: "18/10/2026",
    title: "Ngày hội nhận nuôi thú cưng",
    desc: "Kết nối các bé chó mèo mồ côi với những gia đình mới đầy yêu thương.",
  },
  {
    id: "donate-food",
    icon: "🍖",
    date: "30/10/2026",
    title: "Quyên góp thức ăn cho trạm cứu hộ",
    desc: "Chung tay đóng góp thức ăn, vật dụng cho các trạm cứu hộ động vật.",
  },
];

export function initCampaignsPage() {
  const grid = document.getElementById("campaignGrid");
  if (!grid) return; // không ở trang campaigns thì bỏ qua
  const user = getCurrentUser();
  const registrations = getData(STORAGE_KEYS.CAMPAIGN_REGS, []);
  const registeredCampaigns = new Set(
    Array.isArray(registrations)
      ? registrations
          .filter((registration) => {
        const sameUser = Boolean(
          user &&
            user.id &&
            String(registration.userId || "") === String(user.id)
        );
        const sameEmail = Boolean(
          user &&
            user.email &&
            String(registration.email || "").toLowerCase() ===
              String(user.email).toLowerCase()
        );
            return (
              registration.campaignId &&
              (!user || sameUser || sameEmail)
            );
          })
          .map((registration) => registration.campaignId)
      : []
  );

  function saveRegistration(campaignId, email) {
    const savedRegistrations = getData(STORAGE_KEYS.CAMPAIGN_REGS, []);
    const allRegistrations = Array.isArray(savedRegistrations)
      ? savedRegistrations
      : [];
    const normalizedEmail = email.trim().toLowerCase();
    const userId = user?.id ? String(user.id) : normalizedEmail;
    const alreadySaved = allRegistrations.some(
      (registration) =>
        registration.campaignId === campaignId &&
        ((userId && String(registration.userId || "") === userId) ||
          (normalizedEmail &&
            String(registration.email || "").toLowerCase() ===
              normalizedEmail))
    );

    if (!alreadySaved) {
      allRegistrations.push({
        campaignId,
        userId,
        email: normalizedEmail,
      });
      setData(STORAGE_KEYS.CAMPAIGN_REGS, allRegistrations);
    }
    registeredCampaigns.add(campaignId);
  }

  function draw() {
    grid.innerHTML = CAMPAIGNS.map(
      (c) => `
      <article class="campaign-card">
        <div class="campaign-banner" style="background:var(--card)">${c.icon}</div>
        <div class="campaign-body">
          <span class="campaign-date">${c.date}</span>
          <h3>${escapeHTML(c.title)}</h3>
          <p>${escapeHTML(c.desc)}</p>
          <button class="btn-register ${registeredCampaigns.has(c.id) ? "registered" : ""}" data-id="${c.id}">
            ${registeredCampaigns.has(c.id) ? "✓ Đã đăng ký" : "Đăng ký tham gia"}
          </button>
        </div>
      </article>`
    ).join("");

    grid.querySelectorAll(".btn-register").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (btn.classList.contains("registered")) return;
        openCampaignModal(btn.dataset.id);
      });
    });
  }

  /* ---- modal đăng ký ---- */
  const overlay = document.getElementById("campaignModal");
  const closeBtn = document.getElementById("campaignModalClose");
  const form = document.getElementById("campaignForm");
  const titleEl = document.getElementById("campaignModalTitle");
  const msgEl = document.getElementById("campaignFormMessage");
  let activeCampaignId = null;

  function openCampaignModal(campaignId) {
    const campaign = CAMPAIGNS.find((c) => c.id === campaignId);
    activeCampaignId = campaignId;
    titleEl.textContent = `Đăng ký: ${campaign.title}`;
    msgEl.classList.remove("show", "success", "error");
    form.reset();

    const user = getCurrentUser();
    if (user) {
      form.elements.regName.value = user.name;
      form.elements.regEmail.value = user.email;
    }
    overlay.hidden = false;
  }

  function closeCampaignModal() {
    overlay.hidden = true;
  }

  if (closeBtn) closeBtn.addEventListener("click", closeCampaignModal);
  if (overlay) {
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closeCampaignModal();
    });
  }

  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!form.reportValidity()) return;
      const name = form.elements.regName.value.trim();
      const phone = form.elements.regPhone.value.trim();
      const email = form.elements.regEmail.value.trim();
      const submitButton = form.querySelector('button[type="submit"]');

      if (!name || !phone || !email) {
        msgEl.textContent = "Vui lòng điền đầy đủ thông tin.";
        msgEl.classList.remove("success");
        msgEl.classList.add("show", "error");
        return;
      }

      if (submitButton) submitButton.disabled = true;
      try {
        await apiRequest("/campaigns/register", {
          method: "POST",
          body: JSON.stringify({
            campaignId: activeCampaignId,
            name,
            phone,
            email,
            userId: user?.id || email,
          }),
        });

        saveRegistration(activeCampaignId, email);
        msgEl.textContent = "Đăng ký thành công! Cảm ơn bạn đã đồng hành cùng PawnCare 💛";
        msgEl.classList.remove("error");
        msgEl.classList.add("show", "success");

        setTimeout(() => {
          closeCampaignModal();
          draw();
        }, 1200);
      } catch (error) {
        if (error.statusCode === 409) {
          saveRegistration(activeCampaignId, email);
          msgEl.textContent = "Bạn đã đăng ký chiến dịch này.";
          msgEl.classList.remove("error");
          msgEl.classList.add("show", "success");
          setTimeout(() => {
            closeCampaignModal();
            draw();
          }, 1200);
          return;
        }
        msgEl.textContent = error.message || "Không thể đăng ký chiến dịch. Vui lòng thử lại.";
        msgEl.classList.remove("success");
        msgEl.classList.add("show", "error");
      } finally {
        if (submitButton) submitButton.disabled = false;
      }
    });
  }

  draw();
}
