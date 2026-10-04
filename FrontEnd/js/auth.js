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


// ============================================================
// ĐĂNG KÝ
// ============================================================

export async function registerUser({
  name,
  phone,
  password,
  petName = "",
  address = {},
}) {
  const payload = {
    name: name.trim(),
    phone: phone.trim(),
    password,
    petName: (petName || "").trim(),
    address: address || {},
  };

  try {
    console.log(
      `[AUTH] Đang gửi yêu cầu đăng ký tới BackEnd: ${API_BASE_URL}/register...`,
      {
        name: payload.name,
        phone: payload.phone,
      }
    );

    const res = await fetch(`${API_BASE_URL}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },

      body: JSON.stringify({
        name: payload.name,
        phone: payload.phone,
        password: payload.password,
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(
        data.message || "Đăng ký không thành công."
      );
    }

    const user = {
      ...(data.user || {}),
      petName: payload.petName,
      address: payload.address,
    };

    setData(STORAGE_KEYS.CURRENT_USER, user);

    saveLocalUser({
      ...payload,
      id: user.id || user._id || "u_" + Date.now(),
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

      if (
        users.some(
          (u) => u.phone === payload.phone
        )
      ) {
        throw new Error(
          "Số điện thoại này đã được đăng ký tài khoản."
        );
      }

      const mockUser = {
        id: "local_" + Date.now(),
        name: payload.name,
        phone: payload.phone,
        petName: payload.petName,
        address: payload.address,
      };

      saveLocalUser({
        ...payload,
        id: mockUser.id,
      });

      setData(
        STORAGE_KEYS.CURRENT_USER,
        mockUser
      );

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
  password
}) {
  const account = (phone || "").trim();

  // Tìm tài khoản theo số điện thoại
  const users = getLocalUsers();

  const matchedUser = users.find(
    (u) => u.phone === account
  );

  try {
    console.log(
      `[AUTH] Đang gửi yêu cầu đăng nhập tới BackEnd: ${API_BASE_URL}/login...`,
      {
        phone: account,
      }
    );

    const res = await fetch(`${API_BASE_URL}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },

      body: JSON.stringify({
        phone: account,
        password,
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(
        data.message ||
        "Số điện thoại hoặc mật khẩu không đúng."
      );
    }

    const user = {
      ...(data.user || {}),
      petName: matchedUser?.petName || "",
      address: matchedUser?.address || {},
    };

    setData(
      STORAGE_KEYS.CURRENT_USER,
      user
    );

    notifyAuthChange(user);

    return user;

  } catch (err) {

    // Nếu BackEnd chưa bật
    if (err instanceof TypeError) {

      console.warn(
        "BackEnd offline, kiểm tra đăng nhập cục bộ."
      );

      const users = getLocalUsers();

      const matched = users.find(
        (u) =>
          u.phone === account &&
          u.password === password
      );

      if (matched) {

        const user = {
          id: matched.id,
          name: matched.name,
          phone: matched.phone,
          petName: matched.petName,
          address: matched.address,
        };

        setData(
          STORAGE_KEYS.CURRENT_USER,
          user
        );

        notifyAuthChange(user);

        return user;
      }

      throw new Error(
        "Số điện thoại hoặc mật khẩu không chính xác."
      );
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