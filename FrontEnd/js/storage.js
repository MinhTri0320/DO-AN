/* ============================================================
   storage.js
   Các hàm tiện ích dùng chung: đọc/ghi localStorage, format thời
   gian, escape HTML chống XSS. KHÔNG chứa logic nghiệp vụ.
   ============================================================ */

export const STORAGE_KEYS = {
  CURRENT_USER: "pawncare_current_user",
  NOTIFICATIONS: "pawncare_notifications",
  FORUM_POSTS: "pawncare_forum_posts",
  CAMPAIGN_REGS: "pawncare_campaign_regs",
  PETS: "pawncare_pets",
  CUSTOMER_PROFILES: "pawncare_customer_profiles",
};

export function getData(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
}

export function setData(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function formatTimeAgo(timestamp) {
  const diffMs = Date.now() - timestamp;
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "Vừa xong";
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  return `${days} ngày trước`;
}

// Escape HTML trước khi nhét dữ liệu người dùng nhập vào innerHTML,
// tránh lỗi XSS (vd: ai đó nhập <script> vào ô bình luận).
export function escapeHTML(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
