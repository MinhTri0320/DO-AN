/* ============================================================
   notifications.js
   Task "Notification": chuông thông báo trên header (badge số) +
   trang notifications.html (danh sách, đánh dấu đã đọc).
   ============================================================ */

import { STORAGE_KEYS, getData, setData, formatTimeAgo, escapeHTML } from "./storage.js";

function seedNotificationsIfEmpty() {
  const existing = getData(STORAGE_KEYS.NOTIFICATIONS, null);
  if (existing) return existing;

  const now = Date.now();
  const seeded = [
    {
      id: 1,
      icon: "📅",
      title: "Lịch hẹn sắp tới",
      desc: "Boss Mít có lịch khám sức khỏe định kỳ vào 9:00 sáng mai.",
      time: now - 2 * 60 * 60 * 1000,
      read: false,
    },
    {
      id: 2,
      icon: "🎉",
      title: "Ưu đãi tháng 9",
      desc: "Giảm 20% dịch vụ Spa & Tỉa lông cho khách hàng thân thiết.",
      time: now - 26 * 60 * 60 * 1000,
      read: false,
    },
    {
      id: 3,
      icon: "💬",
      title: "Phản hồi diễn đàn",
      desc: "Có người vừa bình luận vào bài viết của bạn trên Diễn đàn.",
      time: now - 50 * 60 * 60 * 1000,
      read: true,
    },
  ];
  setData(STORAGE_KEYS.NOTIFICATIONS, seeded);
  return seeded;
}

// Được gọi ở MỌI trang (qua header.js) để cập nhật số đỏ trên chuông
export function renderNotifBadge() {
  const badge = document.getElementById("notifBadge");
  if (!badge) return;
  const list = seedNotificationsIfEmpty();
  const unread = list.filter((n) => !n.read).length;
  if (unread > 0) {
    badge.hidden = false;
    badge.textContent = unread > 9 ? "9+" : String(unread);
  } else {
    badge.hidden = true;
  }
}

// Chỉ chạy khi đang ở notifications.html (có #notifList trong DOM)
export function initNotificationsPage() {
  const listEl = document.getElementById("notifList");
  if (!listEl) return;

  function draw() {
    const list = seedNotificationsIfEmpty().sort((a, b) => b.time - a.time);

    if (list.length === 0) {
      listEl.innerHTML = "";
      document.getElementById("notifEmpty").hidden = false;
      return;
    }
    document.getElementById("notifEmpty").hidden = true;

    listEl.innerHTML = list
      .map(
        (n) => `
        <div class="notif-item ${n.read ? "read" : "unread"}" data-id="${n.id}">
          <span class="notif-dot"></span>
          <span class="notif-icon">${n.icon}</span>
          <div>
            <p class="notif-title">${escapeHTML(n.title)}</p>
            <p class="notif-desc">${escapeHTML(n.desc)}</p>
            <p class="notif-time">${formatTimeAgo(n.time)}</p>
          </div>
        </div>`
      )
      .join("");

    listEl.querySelectorAll(".notif-item").forEach((el) => {
      el.addEventListener("click", () => {
        const id = Number(el.dataset.id);
        const all = getData(STORAGE_KEYS.NOTIFICATIONS, []);
        const target = all.find((n) => n.id === id);
        if (target) target.read = true;
        setData(STORAGE_KEYS.NOTIFICATIONS, all);
        draw();
        renderNotifBadge();
      });
    });
  }

  const markAllBtn = document.getElementById("markAllRead");
  if (markAllBtn) {
    markAllBtn.addEventListener("click", () => {
      const all = getData(STORAGE_KEYS.NOTIFICATIONS, []).map((n) => ({
        ...n,
        read: true,
      }));
      setData(STORAGE_KEYS.NOTIFICATIONS, all);
      draw();
      renderNotifBadge();
    });
  }

  draw();
}
