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
    err.statusCode = response.status;
    err.status = response.status;
    err.data = data;
    throw err;
  }

  return data;
}

export async function apiRequest(endpoint, options = {}) {
  try {
    return await request(endpoint, options);
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error(
        "Không kết nối được máy chủ. Hãy bật MongoDB và chạy backend bằng lệnh npm start trong thư mục BackEnd."
      );
    }
    throw error;
  }
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
  const data = await apiRequest("/appointments", {
    method: "POST",
    body: JSON.stringify(appointment),
  });
  return data.appointment || data;
}

export async function apiGetBookedSlots(date) {
  return apiRequest(`/appointments/slots?date=${encodeURIComponent(date)}`);
}

/**
 * Lấy danh sách lịch hẹn (Appointment List)
 * Gửi tới: GET http://localhost:3000/api/appointments
 */
export async function apiGetAppointments(userId, userEmail) {
  try {
    console.log(
      `[API] Đang lấy danh sách lịch hẹn từ ${API_BASE_URL}/appointments...`
    );

    const params = new URLSearchParams();

    if (userId) {
      params.append("userId", userId);
    }

    if (userEmail) {
      params.append("userEmail", userEmail);
    }

    const query = params.toString();

    const endpoint = query
      ? `/appointments?${query}`
      : "/appointments";

    const data = await request(endpoint, {
      method: "GET",
    });

    return data.appointments || data;
  } catch (err) {
    console.warn(
      "[API] BackEnd offline hoặc chưa có route /api/appointments, lấy dữ liệu cục bộ:",
      err.message
    );

    return null;
  }
}

/**
 * Hủy lịch hẹn (Cancel Appointment)
 * Gửi tới: PUT http://localhost:3000/api/appointments/:id/cancel
 */
export async function apiCancelAppointment(appointmentId) {
  return apiRequest(`/appointments/${encodeURIComponent(appointmentId)}/cancel`, {
    method: "PATCH",
  });
}

/* ============================================================
   3. PET PROFILE APIS (QUẢN LÝ THÚ CƯNG)
   ============================================================ */

/**
 * Lấy danh sách thú cưng từ MongoDB thông qua Back-End Express
 * Gửi tới: GET http://localhost:3000/api/pets (hoặc /api/pets?userId=...)
 */
export async function apiGetPets(userId = null) {
  try {
    console.log(`[API] Đang tải danh sách thú cưng từ MongoDB/BackEnd...`, { userId });
    let endpoint = "/pets";
    if (userId) {
      endpoint = `/pets?userId=${encodeURIComponent(userId)}`;
    }

    let resData = null;
    try {
      resData = await request(endpoint, { method: "GET" });
    } catch (e1) {
      if (userId) {
        try {
          resData = await request(`/pets/user/${encodeURIComponent(userId)}`, { method: "GET" });
        } catch (e2) {
          resData = await request("/pets", { method: "GET" });
        }
      } else {
        throw e1;
      }
    }

    const pets = resData?.pets || resData?.data || (Array.isArray(resData) ? resData : null);
    return pets;
  } catch (err) {
    console.warn("[API] BackEnd offline hoặc chưa có route GET /api/pets, dùng dữ liệu thú cưng cục bộ:", err.message);
    return null;
  }
}

/**
 * Lấy chi tiết một thú cưng theo ID từ MongoDB
 * Gửi tới: GET http://localhost:3000/api/pets/:id
 */
export async function apiGetPetById(petId) {
  try {
    console.log(`[API] Đang tải chi tiết thú cưng từ MongoDB/BackEnd: ${API_BASE_URL}/pets/${petId}...`);
    const resData = await request(`/pets/${encodeURIComponent(petId)}`, { method: "GET" });
    return resData?.pet || resData?.data || resData;
  } catch (err) {
    console.warn("[API] Không thể tải chi tiết thú cưng từ MongoDB:", err.message);
    return null;
  }
}

/**
 * Lưu hoặc cập nhật hồ sơ thú cưng tới MongoDB thông qua Back-End Express
 * Nếu đã có ID (không phải ID tạm client): PUT /api/pets/:id
 * Nếu thú cưng mới: POST /api/pets
 */
export async function apiSavePet(pet) {
  try {
    const isUpdate = Boolean(pet.id && !pet.id.startsWith("pet_") && !pet.id.startsWith("local_"));
    console.log(`[API] Đang lưu hồ sơ thú cưng tới MongoDB/BackEnd...`, { isUpdate, pet });

    let resData = null;
    if (isUpdate) {
      try {
        resData = await request(`/pets/${encodeURIComponent(pet.id)}`, {
          method: "PUT",
          body: JSON.stringify(pet),
        });
      } catch (e) {
        resData = await request("/pets", {
          method: "POST",
          body: JSON.stringify(pet),
        });
      }
    } else {
      resData = await request("/pets", {
        method: "POST",
        body: JSON.stringify(pet),
      });
    }

    return resData?.pet || resData?.data || resData;
  } catch (err) {
    console.warn("[API] BackEnd offline hoặc chưa có route lưu thú cưng, lưu thú cưng cục bộ:", err.message);
    return null;
  }
}

/**
 * Xóa hồ sơ thú cưng khỏi MongoDB thông qua Back-End Express
 * Gửi tới: DELETE http://localhost:3000/api/pets/:id
 */
export async function apiDeletePet(petId) {
  try {
    console.log(`[API] Đang xóa thú cưng từ MongoDB/BackEnd: ${API_BASE_URL}/pets/${petId}...`);
    return await request(`/pets/${encodeURIComponent(petId)}`, { method: "DELETE" });
  } catch (err) {
    console.warn("[API] BackEnd offline hoặc chưa có route xóa thú cưng:", err.message);
    return null;
  }
}

/* ============================================================
   4. CUSTOMER PROFILE APIS (HỒ SƠ KHÁCH HÀNG)
   ============================================================ */

/**
 * Lấy thông tin hồ sơ người dùng từ MongoDB thông qua Back-End Express
 * Gửi tới: GET http://localhost:3000/api/users/profile/:id hoặc /api/users/:id hoặc /api/users/profile?email=...
 */
export async function apiGetUserProfile(userIdOrEmail) {
  try {
    const param = userIdOrEmail ? encodeURIComponent(userIdOrEmail) : "";
    console.log(`[API] Đang lấy thông tin hồ sơ người dùng từ MongoDB/BackEnd...`, { userIdOrEmail });

    // Thử endpoint 1: /users/profile/:id (hoặc /users/profile)
    let endpoint = param ? `/users/profile/${param}` : `/users/profile`;
    let resData = null;

    try {
      resData = await request(endpoint, { method: "GET" });
    } catch (e1) {
      // Thử endpoint 2: /users/:id
      if (param) {
        try {
          resData = await request(`/users/${param}`, { method: "GET" });
        } catch (e2) {
          // Thử endpoint 3: query string ?id= hoặc ?email=
          if (userIdOrEmail && userIdOrEmail.includes("@")) {
            resData = await request(`/users?email=${param}`, { method: "GET" });
          } else {
            resData = await request(`/users?id=${param}`, { method: "GET" });
          }
        }
      } else {
        throw e1;
      }
    }

    const user = resData?.user || resData?.profile || resData?.data || resData;
    return user;
  } catch (err) {
    console.warn("[API] BackEnd offline hoặc chưa có route GET user profile, dùng fallback cục bộ:", err.message);
    return null;
  }
}

export const apiGetProfile = apiGetUserProfile;

/**
 * Cập nhật thông tin hồ sơ người dùng tới MongoDB thông qua Back-End Express
 * Gửi tới: PUT http://localhost:3000/api/users/profile/:id hoặc PUT /api/users/profile
 */
export async function apiUpdateProfile(profileData, userId = null) {
  try {
    const id = userId || profileData.id || profileData._id;
    const param = id ? encodeURIComponent(id) : "";
    console.log(`[API] Đang cập nhật hồ sơ khách hàng tới MongoDB/BackEnd...`, profileData);

    let endpoint = param ? `/users/profile/${param}` : `/users/profile`;
    let resData = null;

    try {
      resData = await request(endpoint, {
        method: "PUT",
        body: JSON.stringify(profileData),
      });
    } catch (e1) {
      if (param) {
        try {
          resData = await request(`/users/${param}`, {
            method: "PUT",
            body: JSON.stringify(profileData),
          });
        } catch (e2) {
          resData = await request("/users/profile", {
            method: "PUT",
            body: JSON.stringify(profileData),
          });
        }
      } else {
        throw e1;
      }
    }

    return resData?.user || resData?.profile || resData?.data || resData;
  } catch (err) {
    console.warn("[API] BackEnd offline hoặc chưa có route PUT update profile, lưu hồ sơ cục bộ:", err.message);
    return null;
  }
}


/* ============================================================
   5. SPRINT 3: MEDICAL RECORD, PET MEDICAL HISTORY & DIAGNOSIS APIS
   ============================================================ */

/**
 * Lấy danh sách hồ sơ y tế / bệnh án của thú cưng từ MongoDB
 * Gửi tới: GET http://localhost:3000/api/medical-records?petId=...
 */
export async function apiGetMedicalRecords(petId = null) {
  try {
    const query = petId ? `?petId=${encodeURIComponent(petId)}` : "";
    console.log(`[API] Đang tải danh sách hồ sơ y tế từ MongoDB/BackEnd: ${API_BASE_URL}/medical-records${query}...`);
    const data = await request(`/medical-records${query}`, { method: "GET" });
    return data.records || data.medicalRecords || data.data || (Array.isArray(data) ? data : null);
  } catch (err) {
    console.warn("[API] BackEnd offline hoặc chưa có route GET /api/medical-records, dùng dữ liệu cục bộ:", err.message);
    return null;
  }
}

/**
 * Lấy chi tiết một bệnh án theo ID
 * Gửi tới: GET http://localhost:3000/api/medical-records/:id
 */
export async function apiGetMedicalRecordById(recordId) {
  try {
    console.log(`[API] Đang tải chi tiết bệnh án từ MongoDB/BackEnd: ${API_BASE_URL}/medical-records/${recordId}...`);
    const data = await request(`/medical-records/${encodeURIComponent(recordId)}`, { method: "GET" });
    return data.record || data.data || data;
  } catch (err) {
    console.warn("[API] Không thể tải chi tiết bệnh án từ MongoDB:", err.message);
    return null;
  }
}

/**
 * Lưu hoặc cập nhật hồ sơ y tế / bệnh án vào MongoDB
 * Nếu đã có ID: PUT /api/medical-records/:id, nếu mới: POST /api/medical-records
 */
export async function apiSaveMedicalRecord(record) {
  try {
    const isUpdate = Boolean(record.id && !record.id.startsWith("local_"));
    console.log(`[API] Đang lưu hồ sơ y tế tới MongoDB/BackEnd...`, { isUpdate, record });

    let resData = null;
    if (isUpdate) {
      try {
        resData = await request(`/medical-records/${encodeURIComponent(record.id)}`, {
          method: "PUT",
          body: JSON.stringify(record),
        });
      } catch (e) {
        resData = await request("/medical-records", {
          method: "POST",
          body: JSON.stringify(record),
        });
      }
    } else {
      resData = await request("/medical-records", {
        method: "POST",
        body: JSON.stringify(record),
      });
    }

    return resData?.record || resData?.data || resData;
  } catch (err) {
    console.warn("[API] BackEnd offline hoặc chưa có route lưu bệnh án, lưu cục bộ:", err.message);
    return null;
  }
}

/**
 * Xóa một hồ sơ bệnh án
 * Gửi tới: DELETE http://localhost:3000/api/medical-records/:id
 */
export async function apiDeleteMedicalRecord(recordId) {
  try {
    console.log(`[API] Đang xóa hồ sơ y tế: ${API_BASE_URL}/medical-records/${recordId}...`);
    return await request(`/medical-records/${encodeURIComponent(recordId)}`, { method: "DELETE" });
  } catch (err) {
    console.warn("[API] Không thể xóa hồ sơ y tế trên server:", err.message);
    return null;
  }
}

/**
 * Lấy thông tin hồ sơ sức khỏe nền của bé (Nhóm máu, microchip, tiền sử dị ứng)
 * Gửi tới: GET http://localhost:3000/api/pets/:id/health-profile
 */
export async function apiGetPetHealthProfile(petId) {
  try {
    console.log(`[API] Đang tải hồ sơ sức khỏe nền của bé ${petId}...`);
    const data = await request(`/pets/${encodeURIComponent(petId)}/health-profile`, { method: "GET" });
    return data.healthProfile || data.data || data;
  } catch (err) {
    console.warn("[API] BackEnd offline hoặc chưa có route health profile, dùng dữ liệu cục bộ:", err.message);
    return null;
  }
}

/**
 * Cập nhật thông tin sức khỏe nền của bé
 * Gửi tới: PUT http://localhost:3000/api/pets/:id/health-profile
 */
export async function apiSavePetHealthProfile(petId, profileData) {
  try {
    console.log(`[API] Đang cập nhật hồ sơ sức khỏe nền cho bé ${petId}...`, profileData);
    const data = await request(`/pets/${encodeURIComponent(petId)}/health-profile`, {
      method: "PUT",
      body: JSON.stringify(profileData),
    });
    return data.healthProfile || data.data || data;
  } catch (err) {
    console.warn("[API] BackEnd offline, lưu hồ sơ sức khỏe nền cục bộ:", err.message);
    return null;
  }
}

/**
 * Lưu kết quả chẩn đoán chi tiết sau khám bệnh
 * Gửi tới: POST/PUT http://localhost:3000/api/diagnoses
 */
export async function apiSaveDiagnosis(diagnosisData) {
  try {
    console.log(`[API] Đang lưu thông tin chẩn đoán bệnh...`, diagnosisData);
    const data = await request("/diagnoses", {
      method: "POST",
      body: JSON.stringify(diagnosisData),
    });
    return data.diagnosis || data.data || data;
  } catch (err) {
    console.warn("[API] BackEnd offline hoặc chưa có route /api/diagnoses, lưu cục bộ:", err.message);
    return null;
  }
}
