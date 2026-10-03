/* ============================================================
   api.js
   Tầng giao tiếp API tập trung kết nối từ Front-End tới Back-End Express:
   - Base URL mặc định: http://localhost:3000/api
   - Hỗ trợ đầy đủ các module: Auth (Đăng ký/Đăng nhập), Lịch hẹn (Appointments),
     Thú cưng (Pets), Hồ sơ (Profile).
   - Tự động fallback dữ liệu an toàn sang localStorage nếu Back-End chưa bật
     hoặc endpoint đang trong quá trình phát triển (tránh gián đoạn demo giao diện).
   ============================================================ */

export const API_BASE_URL = "http://localhost:3000/api";

/**
 * Helper gọi HTTP fetch với timeout & tự động parse JSON
 */
async function request(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMsg = data.message || `Lỗi yêu cầu: ${response.status} ${response.statusText}`;
    const err = new Error(errorMsg);
    err.status = response.status;
    err.data = data;
    throw err;
  }

  return data;
}

/* ============================================================
   1. AUTH APIS (ĐĂNG KÝ & ĐĂNG NHẬP)
   ============================================================ */

/**
 * Đăng ký tài khoản thành viên mới
 * Gửi tới: POST http://localhost:3000/api/register
 * Body: { name, email, phone, password, ... }
 */
export async function apiRegister({ name, email, phone, password, petName, address }) {
  console.log(`[API] Đang gửi yêu cầu đăng ký tới ${API_BASE_URL}/register...`, { name, email, phone });
  return await request("/register", {
    method: "POST",
    body: JSON.stringify({
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      password: password,
      petName: petName ? petName.trim() : "",
      address: address || {},
    }),
  });
}

/**
 * Đăng nhập tài khoản
 * Gửi tới: POST http://localhost:3000/api/login
 * Body: { email, password }
 */
export async function apiLogin({ email, password }) {
  console.log(`[API] Đang gửi yêu cầu đăng nhập tới ${API_BASE_URL}/login...`, { email });
  return await request("/login", {
    method: "POST",
    body: JSON.stringify({
      email: email.trim(),
      password: password,
    }),
  });
}

/* ============================================================
   2. APPOINTMENT APIS (ĐẶT LỊCH, XEM LỊCH, HỦY LỊCH)
   ============================================================ */

/**
 * Tạo lịch hẹn mới (Appointment Booking)
 * Gửi tới: POST http://localhost:3000/api/appointments
 */
export async function apiCreateAppointment(appointment) {
  try {
    console.log(`[API] Đang tạo lịch hẹn mới tới ${API_BASE_URL}/appointments...`, appointment);
    const data = await request("/appointments", {
      method: "POST",
      body: JSON.stringify(appointment),
    });
    return data.appointment || data;
  } catch (err) {
    console.warn("[API] BackEnd offline hoặc chưa có route /api/appointments, đồng bộ lưu trữ cục bộ:", err.message);
    return null;
  }
}

/**
 * Lấy danh sách lịch hẹn (Appointment List)
 * Gửi tới: GET http://localhost:3000/api/appointments
 */
export async function apiGetAppointments() {
  try {
    console.log(`[API] Đang lấy danh sách lịch hẹn từ ${API_BASE_URL}/appointments...`);
    const data = await request("/appointments", { method: "GET" });
    return data.appointments || data;
  } catch (err) {
    console.warn("[API] BackEnd offline hoặc chưa có route /api/appointments, lấy dữ liệu cục bộ:", err.message);
    return null;
  }
}

/**
 * Hủy lịch hẹn (Cancel Appointment)
 * Gửi tới: PUT http://localhost:3000/api/appointments/:id/cancel
 */
export async function apiCancelAppointment(appointmentId) {
  try {
    console.log(`[API] Đang gửi yêu cầu hủy lịch hẹn tới ${API_BASE_URL}/appointments/${appointmentId}/cancel...`);
    const data = await request(`/appointments/${appointmentId}/cancel`, {
      method: "PUT",
      body: JSON.stringify({ status: "Đã hủy" }),
    });
    return data;
  } catch (err) {
    console.warn("[API] BackEnd offline hoặc chưa có route hủy lịch, cập nhật trạng thái cục bộ:", err.message);
    return null;
  }
}

/* ============================================================
   3. PET PROFILE APIS (QUẢN LÝ THÚ CƯNG)
   ============================================================ */

export async function apiGetPets() {
  try {
    console.log(`[API] Đang tải danh sách thú cưng từ ${API_BASE_URL}/pets...`);
    const data = await request("/pets", { method: "GET" });
    return data.pets || data;
  } catch (err) {
    console.warn("[API] BackEnd offline hoặc chưa có route /api/pets, dùng dữ liệu thú cưng cục bộ:", err.message);
    return null;
  }
}

export async function apiSavePet(pet) {
  try {
    console.log(`[API] Đang lưu hồ sơ thú cưng tới ${API_BASE_URL}/pets...`, pet);
    const data = await request("/pets", {
      method: "POST",
      body: JSON.stringify(pet),
    });
    return data.pet || data;
  } catch (err) {
    console.warn("[API] BackEnd offline hoặc chưa có route /api/pets, lưu thú cưng cục bộ:", err.message);
    return null;
  }
}

export async function apiDeletePet(petId) {
  try {
    console.log(`[API] Đang xóa thú cưng tới ${API_BASE_URL}/pets/${petId}...`);
    return await request(`/pets/${petId}`, { method: "DELETE" });
  } catch (err) {
    console.warn("[API] BackEnd offline hoặc chưa có route xóa thú cưng:", err.message);
    return null;
  }
}

/* ============================================================
   4. CUSTOMER PROFILE APIS (HỒ SƠ KHÁCH HÀNG)
   ============================================================ */

export async function apiUpdateProfile(profileData) {
  try {
    console.log(`[API] Đang cập nhật hồ sơ khách hàng tới ${API_BASE_URL}/users/profile...`, profileData);
    return await request("/users/profile", {
      method: "PUT",
      body: JSON.stringify(profileData),
    });
  } catch (err) {
    console.warn("[API] BackEnd offline hoặc chưa có route /api/users/profile, lưu hồ sơ cục bộ:", err.message);
    return null;
  }
}
