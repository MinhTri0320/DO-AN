/* ============================================================
   auth.js
   Toàn bộ logic ĐĂNG NHẬP / ĐĂNG KÝ / ĐĂNG XUẤT.
   Gọi thẳng tới Back-End Express thật (register.js, login.js).
   localStorage ở đây CHỈ lưu phiên đăng nhập hiện tại trên trình
   duyệt (CURRENT_USER) — danh sách user thật nằm ở Back-End.
   ============================================================ */

import { STORAGE_KEYS, getData, setData } from "./storage.js";

// Địa chỉ Back-End. Khi deploy thật, đổi sang domain server
// (vd: "https://api.pawncare.vn/api")
export const API_BASE_URL = "http://localhost:3000/api";

export function getCurrentUser() {
  return getData(STORAGE_KEYS.CURRENT_USER, null);
}

function friendlyNetworkError(err) {
  if (err instanceof TypeError) {
    return new Error(
      "Không kết nối được đến máy chủ. Kiểm tra lại Back-End đã chạy (node sever.js) chưa và đúng cổng 3000 chưa."
    );
  }
  return err;
}

export async function registerUser({ name, email, phone, password }) {
  let res;
  try {
    res = await fetch(`${API_BASE_URL}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, phone, password }),
    });
  } catch (err) {
    throw friendlyNetworkError(err);
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || "Đăng ký thất bại.");
  }
  return data.user;
}

export async function loginUser({ email, password }) {
  let res;
  try {
    res = await fetch(`${API_BASE_URL}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
  } catch (err) {
    throw friendlyNetworkError(err);
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || "Đăng nhập thất bại.");
  }

  setData(STORAGE_KEYS.CURRENT_USER, data.user);
  return data.user;
}

export function logoutUser() {
  localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
}
