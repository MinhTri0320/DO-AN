/* ============================================================
   campaigns.js
   Task "Register Campaigns": danh sách chiến dịch + modal
   đăng ký tham gia.
   ============================================================ */

import { STORAGE_KEYS, getData, setData, escapeHTML } from "./storage.js";
import { getCurrentUser } from "./auth.js";

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

function getCampaignRegs() {
  return getData(STORAGE_KEYS.CAMPAIGN_REGS, []);
}

function isRegistered(campaignId) {
  const user = getCurrentUser();
  if (!user) return false;
  return getCampaignRegs().some(
    (r) => r.campaignId === campaignId && r.email === user.email
  );
}

export function initCampaignsPage() {
  const grid = document.getElementById("campaignGrid");
  if (!grid) return; // không ở trang campaigns thì bỏ qua

  function draw() {
    grid.innerHTML = CAMPAIGNS.map(
      (c) => `
      <article class="campaign-card">
        <div class="campaign-banner" style="background:var(--card)">${c.icon}</div>
        <div class="campaign-body">
          <span class="campaign-date">${c.date}</span>
          <h3>${escapeHTML(c.title)}</h3>
          <p>${escapeHTML(c.desc)}</p>
          <button class="btn-register ${isRegistered(c.id) ? "registered" : ""}" data-id="${c.id}">
            ${isRegistered(c.id) ? "✓ Đã đăng ký" : "Đăng ký tham gia"}
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
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const name = form.elements.regName.value.trim();
      const phone = form.elements.regPhone.value.trim();
      const email = form.elements.regEmail.value.trim();

      if (!name || !phone || !email) {
        msgEl.textContent = "Vui lòng điền đầy đủ thông tin.";
        msgEl.classList.remove("success");
        msgEl.classList.add("show", "error");
        return;
      }

      const regs = getCampaignRegs();
      regs.push({ campaignId: activeCampaignId, name, phone, email, at: Date.now() });
      setData(STORAGE_KEYS.CAMPAIGN_REGS, regs);

      msgEl.textContent = "Đăng ký thành công! Cảm ơn bạn đã đồng hành cùng PawnCare 💛";
      msgEl.classList.remove("error");
      msgEl.classList.add("show", "success");

      setTimeout(() => {
        closeCampaignModal();
        draw();
      }, 1200);
    });
  }

  draw();
}
