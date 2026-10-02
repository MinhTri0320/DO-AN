/* ============================================================
   auth.js
   Toàn bộ logic ĐĂNG NHẬP / ĐĂNG KÝ / ĐĂNG XUẤT.
   Hỗ trợ đầy đủ:
   - Đăng ký: Tên, SĐT, Mật khẩu, Tên thú cưng, Địa chỉ 4 thành phần
   - Đăng nhập: SĐT (hoặc Email) + Mật khẩu
   - Kết nối trực tiếp tới Back-End Express (http://localhost:3000/api)
   - Tự động fallback phiên cục bộ thông minh nếu Back-End chưa chạy
   - Phát sự kiện "pawncare:auth-changed" để cập nhật Header ngay lập tức
   ============================================================ */

import { STORAGE_KEYS, getData, setData } from "./storage.js";

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

function saveLocalUser(user) {
  const users = getLocalUsers();
  const existingIdx = users.findIndex((u) => u.phone === user.phone);
  if (existingIdx >= 0) {
    users[existingIdx] = user;
  } else {
    users.push(user);
  }
  setData(LOCAL_USERS_KEY, users);
}

export async function registerUser({
  name,
  phone,
  password,
  petName = "",
  address = {},
  email = "",
}) {
  const payload = {
    name: name.trim(),
    phone: phone.trim(),
    password,
    petName: (petName || "").trim(),
    address: address || {},
    email: (email || "").trim() || `${phone.replace(/\D/g, "")}@pawncare.vn`,
  };

  try {
    const res = await fetch(`${API_BASE_URL}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || "Đăng ký không thành công.");
    }

    const user = data.user;
    setData(STORAGE_KEYS.CURRENT_USER, user);
    saveLocalUser({ ...payload, id: user.id || "u_" + Date.now() });
    notifyAuthChange(user);
    return user;
  } catch (err) {
    // Nếu BackEnd chưa bật (Lỗi kết nối mạng), tự động lưu cục bộ để demo mượt mà
    if (err instanceof TypeError) {
      console.warn("BackEnd offline, sử dụng phiên đăng ký cục bộ cho demo.");
      const users = getLocalUsers();
      if (users.some((u) => u.phone === payload.phone)) {
        throw new Error("Số điện thoại này đã được đăng ký tài khoản.");
      }

      const mockUser = {
        id: "local_" + Date.now(),
        name: payload.name,
        phone: payload.phone,
        email: payload.email,
        petName: payload.petName,
        address: payload.address,
      };

      saveLocalUser({ ...payload, id: mockUser.id });
      setData(STORAGE_KEYS.CURRENT_USER, mockUser);
      notifyAuthChange(mockUser);
      return mockUser;
    }
    throw err;
  }
}

export async function loginUser({ phoneOrEmail, password }) {
  const account = (phoneOrEmail || "").trim();

  try {
    const res = await fetch(`${API_BASE_URL}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: account.includes("@") ? account : `${account.replace(/\D/g, "")}@pawncare.vn`,
        phone: account,
        phoneOrEmail: account,
        password,
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || "Số điện thoại hoặc mật khẩu không đúng.");
    }

    setData(STORAGE_KEYS.CURRENT_USER, data.user);
    notifyAuthChange(data.user);
    return data.user;
  } catch (err) {
    // Nếu BackEnd chưa bật, kiểm tra trong kho tài khoản cục bộ
    if (err instanceof TypeError) {
      console.warn("BackEnd offline, kiểm tra đăng nhập cục bộ.");
      const users = getLocalUsers();
      const matched = users.find(
        (u) => (u.phone === account || u.email === account) && u.password === password
      );

      if (matched) {
        const user = {
          id: matched.id,
          name: matched.name,
          phone: matched.phone,
          email: matched.email,
          petName: matched.petName,
          address: matched.address,
        };
        setData(STORAGE_KEYS.CURRENT_USER, user);
        notifyAuthChange(user);
        return user;
      }

      // Nếu chưa có tài khoản nào đăng ký trước đó, cho phép đăng nhập demo mẫu
      if (users.length === 0 && password.length >= 6) {
        const demoUser = {
          id: "demo_1",
          name: "Nguyễn Văn A",
          phone: account,
          petName: "Bin Corgi",
          address: {
            houseNumber: "123/4",
            street: "Nguyễn Văn Linh",
            ward: "Hải Châu",
            city: "TP. Đà Nẵng",
          },
        };
        setData(STORAGE_KEYS.CURRENT_USER, demoUser);
        notifyAuthChange(demoUser);
        return demoUser;
      }

      throw new Error("Số điện thoại hoặc mật khẩu không chính xác.");
    }
    throw err;
  }
}

export function logoutUser() {
  localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
  notifyAuthChange(null);
}
