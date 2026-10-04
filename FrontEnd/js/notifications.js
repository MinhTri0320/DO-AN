import { formatTimeAgo, escapeHTML } from "./storage.js";
import { getCurrentUser } from "./auth.js";
import { apiRequest } from "./api.js";

function getUserQuery() {
  const user = getCurrentUser();
  const userId = user?.id ? String(user.id) : user?.email || null;
  if (!userId) return null;

  const params = new URLSearchParams({ userId });
  if (user?.email) params.set("email", user.email);
  return params.toString();
}

export async function createNotification(notification) {
  const result = await apiRequest("/notifications", {
    method: "POST",
    body: JSON.stringify(notification),
  });
  await renderNotifBadge();
  return result.notification;
}

export async function renderNotifBadge() {
  const badge = document.getElementById("notifBadge");
  if (!badge) return;

  const userQuery = getUserQuery();
  if (!userQuery) {
    badge.hidden = true;
    return;
  }

  try {
    const data = await apiRequest(`/notifications?${userQuery}`);
    const unread = data.unreadCount;
    if (unread > 0) {
      badge.hidden = false;
      badge.textContent = unread > 9 ? "9+" : String(unread);
    } else {
      badge.hidden = true;
    }
  } catch (error) {
    badge.hidden = true;
    console.error("Không thể tải số lượng thông báo:", error);
  }
}

export function initNotificationsPage() {
  const listEl = document.getElementById("notifList");
  if (!listEl) return;

  const emptyEl = document.getElementById("notifEmpty");
  const markAllBtn = document.getElementById("markAllRead");

  async function draw() {
    const userQuery = getUserQuery();
    if (!userQuery) {
      listEl.innerHTML = "";
      emptyEl.textContent = "Đăng nhập để xem thông báo của bạn.";
      emptyEl.hidden = false;
      return;
    }

    try {
      const { notifications } = await apiRequest(
        `/notifications?${userQuery}`
      );
      if (notifications.length === 0) {
        listEl.innerHTML = "";
        emptyEl.textContent = "Hiện tại bạn không có thông báo mới nào.";
        emptyEl.hidden = false;
        return;
      }

      emptyEl.hidden = true;
      listEl.innerHTML = notifications
        .map((notification) => {
          const timestamp = new Date(notification.createdAt).getTime();
          const time = Number.isNaN(timestamp) ? "" : formatTimeAgo(timestamp);
          return `
        <div class="notif-item ${notification.read ? "read" : "unread"}" data-id="${escapeHTML(notification._id)}">
          <span class="notif-dot"></span>
          <span class="notif-icon">${escapeHTML(notification.icon || "🔔")}</span>
          <div>
            <p class="notif-title">${escapeHTML(notification.title)}</p>
            <p class="notif-desc">${escapeHTML(notification.message)}</p>
            <p class="notif-time">${escapeHTML(time)}</p>
          </div>
        </div>`;
        })
        .join("");

      listEl.querySelectorAll(".notif-item").forEach((element) => {
        element.addEventListener("click", async () => {
          if (element.classList.contains("read")) return;
          try {
            await apiRequest(
              `/notifications/${encodeURIComponent(element.dataset.id)}/read?${userQuery}`,
              { method: "PATCH" }
            );
            await draw();
            await renderNotifBadge();
          } catch (error) {
            emptyEl.textContent = error.message || "Không thể cập nhật thông báo.";
            emptyEl.hidden = false;
          }
        });
      });
    } catch (error) {
      listEl.innerHTML = "";
      emptyEl.textContent = error.message || "Không thể tải thông báo. Vui lòng thử lại.";
      emptyEl.hidden = false;
    }
  }

  if (markAllBtn) {
    markAllBtn.addEventListener("click", async () => {
      const userQuery = getUserQuery();
      if (!userQuery) return;

      markAllBtn.disabled = true;
      try {
        await apiRequest(
          `/notifications/read-all?${userQuery}`,
          { method: "PATCH" }
        );
        await draw();
        await renderNotifBadge();
      } catch (error) {
        emptyEl.textContent = error.message || "Không thể cập nhật thông báo.";
        emptyEl.hidden = false;
      } finally {
        markAllBtn.disabled = false;
      }
    });
  }

  draw();
}
