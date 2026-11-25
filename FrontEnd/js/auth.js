/* ============================================================
 auth.js
 Toàn bộ logic ĐĂNG NHẬP / ĐĂNG KÝ / ĐĂNG XUẤT.
 Hỗ trợ đầy đủ:
 - Đăng ký: Tên, SĐT, Mật khẩu, Tên thú cưng, Địa chỉ 4 thành phần
 - Đăng nhập: SĐT + Mật khẩu
 - Kết nối trực tiếp tới Back-End Express (http://localhost:3000/api)
 - Tự động fallback phiên cục bộ thông minh nếu Back-End chưa chạy
 - Phát sự kiện "pawncare:auth-changed" để cập nhật Header ngay lập tức
 ============================================================ */

import { STORAGE_KEYS, getData, setData } from "./storage.js";
import { normalizePhone } from "./validators.js";

export const API_BASE_URL = "http://localhost:3000/api";
const LOCAL_USERS_KEY = "pawncare_registered_users";

export function getCurrentUser() {
 return getData(STORAGE_KEYS.CURRENT_USER, null);
}

function notifyAuthChange(user) {
 try {
 window.dispatchEvent(
 new CustomEvent("pawncare:auth-changed", { detail: user })
 );
 } catch (e) {
 // fallback nếu trình duyệt cũ
 }
}

// Lấy danh sách tài khoản demo lưu cục bộ (dùng khi BackEnd offline)
function getLocalUsers() {
 return getData(LOCAL_USERS_KEY, []);
}

// Tạo mã băm mật khẩu dùng cho chế độ demo offline (không bao giờ lưu plaintext)
async function hashPasswordOffline(password) {
  const text = String(password || "");
  try {
    if (
      typeof crypto !== "undefined" &&
      crypto.subtle &&
      typeof TextEncoder !== "undefined"
    ) {
      const digest = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(`pawncare:${text}`)
      );
      return Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    }
  } catch (e) {
    // Fallback cho môi trường không hỗ trợ crypto.subtle (vd: HTTP/file://)
  }

  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  const salted = `pawncare:${text}`;
  for (let i = 0; i < salted.length; i++) {
    const c = salted.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193);
    h2 = Math.imul(h2 ^ (c + i), 0x85ebca6b);
  }
  return `fnv_${(h1 >>> 0).toString(16).padStart(8, "0")}${(h2 >>> 0)
    .toString(16)
    .padStart(8, "0")}`;
}

function saveLocalUser(user) {
  const users = getLocalUsers();
  // Loại bỏ hoàn toàn mật khẩu dạng plaintext trước khi lưu vào localStorage
  const { password: _removedPassword, ...safeUser } = user || {};
  const normalizedPhone = safeUser.phone ? normalizePhone(safeUser.phone) : "";
  if (normalizedPhone) safeUser.phone = normalizedPhone;

  const existingIdx = users.findIndex(
    (u) =>
      (safeUser.id && u.id && String(u.id) === String(safeUser.id)) ||
      (normalizedPhone && normalizePhone(u.phone) === normalizedPhone)
  );

  if (existingIdx >= 0) {
    const { password: _oldPassword, ...existingSafe } = users[existingIdx] || {};
    users[existingIdx] = { ...existingSafe, ...safeUser };
  } else {
    users.push(safeUser);
  }

  setData(LOCAL_USERS_KEY, users);
}


// ============================================================
// ĐĂNG KÝ
// ============================================================

export async function registerUser({
  name,
  email = "",
  phone,
  password,
  petName = "",
  address = {},
}) {
  const normalizedPhone = normalizePhone(phone);
  const payload = {
    name: (name || "").trim(),
    email: (email || "").trim(),
    phone: normalizedPhone,
    password,
    petName: (petName || "").trim(),
    address: address || {},
  };

  try {
    console.log(
      `[AUTH] Đang gửi yêu cầu đăng ký tới BackEnd: ${API_BASE_URL}/register...`,
      {
        name: payload.name,
        email: payload.email,
        phone: payload.phone,
      }
    );

    const res = await fetch(`${API_BASE_URL}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },

      body: JSON.stringify({
        name: payload.name,
        phone: payload.phone,
        email: payload.email,
        password: payload.password,
        address: payload.address,
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data.message || "Đăng ký không thành công.");
    }

    const serverAddr = data.user?.address;
    const mergedAddress =
      serverAddr && typeof serverAddr === "object" && Object.keys(serverAddr).length > 0
        ? { ...payload.address, ...serverAddr }
        : payload.address;

    const user = {
      ...(data.user || {}),
      id: data.user?.id || data.user?._id,
      name: data.user?.name || payload.name,
      phone: data.user?.phone || payload.phone,
      email: data.user?.email || payload.email,
      petName: data.user?.petName || payload.petName,
      address: mergedAddress,
      role: data.user?.role || "pet_owner",
      role_id:
        Number(data.user?.role_id) ||
        (data.user?.role === "admin"
          ? 1
          : data.user?.role === "doctor"
          ? 2
          : data.user?.role === "receptionist"
          ? 3
          : 4),
    };

    setData(STORAGE_KEYS.CURRENT_USER, user);

    // Không lưu password (kể cả plaintext) vào localStorage trong nhánh online
    saveLocalUser({
      id: user.id || user._id || "u_" + Date.now(),
      name: user.name || payload.name,
      email: user.email || "",
      phone: user.phone || payload.phone,
      petName: user.petName || "",
      address: user.address || {},
      role: user.role || "pet_owner",
      role_id: Number(user.role_id) || 4,
    });

    notifyAuthChange(user);

    return user;
  } catch (err) {
    // Nếu BackEnd chưa bật
    if (err instanceof TypeError) {
      console.warn(
        "BackEnd offline, sử dụng phiên đăng ký cục bộ cho demo."
      );

      const users = getLocalUsers();

      if (users.some((u) => normalizePhone(u.phone) === payload.phone)) {
        throw new Error("Số điện thoại này đã được đăng ký tài khoản.");
      }

      const mockUser = {
        id: "local_" + Date.now(),
        name: payload.name,
        email: payload.email,
        phone: payload.phone,
        petName: payload.petName,
        address: payload.address,
        role: "pet_owner",
        role_id: 4,
      };

      const passwordHash = await hashPasswordOffline(payload.password);

      saveLocalUser({
        ...mockUser,
        passwordHash,
      });

      setData(STORAGE_KEYS.CURRENT_USER, mockUser);

      notifyAuthChange(mockUser);

      return mockUser;
    }

    throw err;
  }
}


// ============================================================
// ĐĂNG NHẬP
// ============================================================

export async function loginUser({
  phone,
  email,
  phoneOrEmail,
  password,
}) {
  const account = (phone || phoneOrEmail || email || "").trim();
  const isEmailLogin = account.includes("@");
  const normalizedAccount = isEmailLogin
    ? account.toLowerCase()
    : normalizePhone(account);

  // Tìm tài khoản cục bộ để bổ sung metadata nếu server chưa trả về
  const users = getLocalUsers();

  const matchedUser = users.find((u) =>
    isEmailLogin
      ? String(u.email || "").trim().toLowerCase() === normalizedAccount
      : normalizePhone(u.phone) === normalizedAccount
  );

  const loginBody = isEmailLogin
    ? { email: normalizedAccount, phone: normalizedAccount, password }
    : { phone: normalizedAccount, password };

  try {
    console.log(
      `[AUTH] Đang gửi yêu cầu đăng nhập tới BackEnd: ${API_BASE_URL}/login...`,
      isEmailLogin ? { email: normalizedAccount } : { phone: normalizedAccount }
    );

    const res = await fetch(`${API_BASE_URL}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },

      body: JSON.stringify(loginBody),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(
        data.message || "Số điện thoại hoặc mật khẩu không đúng."
      );
    }

    const serverAddr = data.user?.address;
    const mergedAddress =
      serverAddr && typeof serverAddr === "object" && Object.keys(serverAddr).length > 0
        ? { ...(matchedUser?.address || {}), ...serverAddr }
        : matchedUser?.address || {};

    const user = {
      ...(data.user || {}),
      email:
        data.user?.email ||
        matchedUser?.email ||
        (isEmailLogin ? normalizedAccount : ""),
      petName: data.user?.petName || matchedUser?.petName || "",
      address: mergedAddress,
    };

    setData(STORAGE_KEYS.CURRENT_USER, user);

    notifyAuthChange(user);

    return user;
  } catch (err) {
    // Nếu BackEnd chưa bật
    if (err instanceof TypeError) {
      console.warn("BackEnd offline, kiểm tra đăng nhập cục bộ.");

      const users = getLocalUsers();
      const inputHash = await hashPasswordOffline(password);

      const matched = users.find((u) => {
        const accountMatch = isEmailLogin
          ? String(u.email || "").trim().toLowerCase() === normalizedAccount
          : normalizePhone(u.phone) === normalizedAccount;
        return (
          accountMatch &&
          Boolean(u.passwordHash) &&
          u.passwordHash === inputHash
        );
      });

      if (matched) {
        const user = {
          id: matched.id,
          name: matched.name,
          email: matched.email || "",
          phone: matched.phone,
          petName: matched.petName,
          address: matched.address,
          role: matched.role || "pet_owner",
          role_id: Number(matched.role_id) || 4,
        };

        setData(STORAGE_KEYS.CURRENT_USER, user);

        notifyAuthChange(user);

        return user;
      }

      throw new Error("Số điện thoại hoặc mật khẩu không chính xác.");
    }

    throw err;
  }
}


// ============================================================
// ĐĂNG XUẤT
// ============================================================

export function logoutUser() {
 localStorage.removeItem(
 STORAGE_KEYS.CURRENT_USER
 );

 notifyAuthChange(null);
}


// ============================================================
// CẬP NHẬT USER HIỆN TẠI
// ============================================================

export function updateCurrentUser(patch) {

 const current = getCurrentUser() || {
 id: "user_" + Date.now(),
 name: "Minh Anh",
 phone: "0900123456",
 dob: "2000-05-15",
 gender: "female",
 memberTier: "Khách hàng Thân thiết",
 joinedDate: "10/2025",

 address: {
 houseNumber: "123",
 street: "Nguyễn Văn Linh",
 ward: "Phường Nam Dương",
 district: "Quận Hải Châu",
 city: "TP. Đà Nẵng",
 },
 };

 const updated = {
 ...current,
 ...patch,

 address: {
 ...(current.address || {}),
 ...(patch.address || {}),
 city: "TP. Đà Nẵng",
 },
 };

 setData(
 STORAGE_KEYS.CURRENT_USER,
 updated
 );

 saveLocalUser(updated);

 notifyAuthChange(updated);

 return updated;
}