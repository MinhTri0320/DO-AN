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
 * Đọc thông tin người dùng hiện tại từ localStorage một cách an toàn
 */
function getStoredCurrentUser() {
  try {
    if (typeof localStorage === "undefined") return null;
    const raw = localStorage.getItem("pawncare_current_user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Xác định số điện thoại từ identifier (object user, chuỗi SĐT) hoặc localStorage
 */
function resolvePhoneFromIdentifier(identifier) {
  if (identifier && typeof identifier === "object") {
    if (identifier.phone) return String(identifier.phone).trim();
  } else if (typeof identifier === "string") {
    const trimmed = identifier.trim();
    const digits = trimmed.replace(/\D/g, "");
    if (
      trimmed &&
      !trimmed.includes("@") &&
      !/^[a-f0-9]{24}$/i.test(trimmed) &&
      /^[0-9+\-\s().]+$/.test(trimmed) &&
      digits.length >= 8 &&
      digits.length <= 15
    ) {
      return trimmed;
    }
  }

  const currentUser = getStoredCurrentUser();
  if (currentUser?.phone) {
    return String(currentUser.phone).trim();
  }
  return "";
}

/**
 * Helper gọi HTTP fetch với timeout & tự động parse JSON
 */
async function request(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  // Tự động đính kèm x-user-id từ localStorage nếu caller chưa truyền sẵn
  const hasUserIdHeader = Object.keys(headers).some(
    (k) => k.toLowerCase() === "x-user-id" && headers[k]
  );
  if (!hasUserIdHeader) {
    const currentUser = getStoredCurrentUser();
    const currentUserId = currentUser?.id || currentUser?._id;
    if (currentUserId) {
      headers["x-user-id"] = String(currentUserId);
    }
  }

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
 * Body: { phone, password }
 */
export async function apiLogin({ phone, email, phoneOrEmail, password } = {}) {
  const resolvedPhone = (phone || phoneOrEmail || email || "").trim();
  console.log(`[API] Đang gửi yêu cầu đăng nhập tới ${API_BASE_URL}/login...`, { phone: resolvedPhone });
  return await request("/login", {
    method: "POST",
    body: JSON.stringify({
      phone: resolvedPhone,
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
    const petId = pet?.id || pet?._id;
    const isUpdate = Boolean(
      petId &&
        !String(petId).startsWith("pet_") &&
        !String(petId).startsWith("local_")
    );
    console.log(`[API] Đang lưu hồ sơ thú cưng tới MongoDB/BackEnd...`, { isUpdate, pet });

    let resData = null;
    if (isUpdate) {
      resData = await request(`/pets/${encodeURIComponent(petId)}`, {
        method: "PUT",
        body: JSON.stringify(pet),
      });
    } else {
      resData = await request("/pets", {
        method: "POST",
        body: JSON.stringify(pet),
      });
    }

    return resData?.pet || resData?.data || resData;
  } catch (err) {
    if (err instanceof TypeError) {
      console.warn("[API] BackEnd offline, lưu thú cưng cục bộ:", err.message);
      return null;
    }
    throw err;
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
    if (err instanceof TypeError) {
      console.warn("[API] BackEnd offline, xóa thú cưng cục bộ:", err.message);
      return null;
    }
    throw err;
  }
}

/* ============================================================
 4. CUSTOMER PROFILE APIS (HỒ SƠ KHÁCH HÀNG)
 ============================================================ */

/**
 * Lấy thông tin hồ sơ người dùng từ MongoDB thông qua Back-End Express
 * Gửi tới: GET http://localhost:3000/api/profile (kèm ?phone=... nếu có; x-user-id được request() tự động đính kèm)
 */
export async function apiGetUserProfile(identifier = null) {
  try {
    const phone = resolvePhoneFromIdentifier(identifier);
    const currentUser = getStoredCurrentUser();
    const resolvedUserId =
      typeof identifier === "string" && /^[a-f0-9]{24}$/i.test(identifier.trim())
        ? identifier.trim()
        : identifier && typeof identifier === "object"
        ? identifier.id || identifier._id
        : currentUser?.id || currentUser?._id;

    const endpoint = phone
      ? `/profile?phone=${encodeURIComponent(phone)}`
      : "/profile";

    const headers = {};
    if (resolvedUserId) {
      headers["x-user-id"] = String(resolvedUserId);
    }

    console.log(`[API] Đang lấy thông tin hồ sơ người dùng từ MongoDB/BackEnd...`, {
      identifier,
      phone,
      endpoint,
    });

    const resData = await request(endpoint, {
      method: "GET",
      headers,
    });

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
 * Gửi tới: PUT http://localhost:3000/api/users/profile
 * Hỗ trợ cả 2 chữ ký gọi: apiUpdateProfile(profileData, userId) và apiUpdateProfile(identifier, profileData)
 */
export async function apiUpdateProfile(identifierOrData, profileDataOrUserId = null) {
  try {
    let profileData;
    if (
      identifierOrData &&
      typeof identifierOrData === "object" &&
      (!profileDataOrUserId || typeof profileDataOrUserId !== "object")
    ) {
      // Kiểu gọi: apiUpdateProfile(profileData, userId)
      profileData = { ...identifierOrData };
      if (!profileData.id && !profileData._id && typeof profileDataOrUserId === "string" && profileDataOrUserId) {
        profileData.id = profileDataOrUserId;
      }
    } else if (profileDataOrUserId && typeof profileDataOrUserId === "object") {
      // Kiểu gọi: apiUpdateProfile(identifier, profileData)
      profileData = { ...profileDataOrUserId };
      if (!profileData.phone) {
        const phone = resolvePhoneFromIdentifier(identifierOrData);
        if (phone) profileData.phone = phone;
      }
      if (!profileData.id && !profileData._id && typeof identifierOrData === "string" && identifierOrData) {
        profileData.id = identifierOrData;
      }
    } else {
      profileData = {};
    }

    if (!profileData.phone) {
      const currentUser = getStoredCurrentUser();
      if (currentUser?.phone) {
        profileData.phone = String(currentUser.phone).trim();
      }
    }

    console.log(`[API] Đang cập nhật hồ sơ khách hàng tới MongoDB/BackEnd...`, profileData);

    const resData = await request("/users/profile", {
      method: "PUT",
      body: JSON.stringify(profileData),
    });

    return resData?.user || resData?.profile || resData?.data || resData;
  } catch (err) {
    if (err instanceof TypeError) {
      console.warn("[API] BackEnd offline, lưu hồ sơ cục bộ:", err.message);
      return null;
    }
    throw err;
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
 const isUpdate = Boolean(record.isEditing);
 console.log(`[API] Đang lưu hồ sơ y tế tới MongoDB/BackEnd...`, { isUpdate, record });

 let resData = null;
 if (isUpdate && record.id) {
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

/* ============================================================
 6. SPRINT 3: PRESCRIPTIONS & RE-EXAMINATION HISTORY APIS
 ============================================================ */

/**
 * Lấy danh sách đơn thuốc từ MongoDB/BackEnd
 * Gửi tới: GET http://localhost:3000/api/prescriptions?petId=...&status=...
 */
export async function apiGetPrescriptions(petId = null, options = {}) {
 try {
 const params = new URLSearchParams();
 if (petId) params.append("petId", petId);
 if (options.status) params.append("status", options.status);
 if (options.recordCode) params.append("recordCode", options.recordCode);
 if (options.search) params.append("search", options.search);

 const query = params.toString() ? `?${params.toString()}` : "";
 console.log(`[API] Đang tải danh sách đơn thuốc: ${API_BASE_URL}/prescriptions${query}...`);
 const data = await request(`/prescriptions${query}`, { method: "GET" });
 return data.prescriptions || data.data || (Array.isArray(data) ? data : []);
 } catch (err) {
 console.warn("[API] Lỗi khi tải danh sách đơn thuốc:", err.message);
 return [];
 }
}

/**
 * Lấy chi tiết đơn thuốc theo ID hoặc mã đơn
 * Gửi tới: GET http://localhost:3000/api/prescriptions/:id
 */
export async function apiGetPrescriptionById(prescriptionId) {
 try {
 console.log(`[API] Đang tải chi tiết đơn thuốc: ${API_BASE_URL}/prescriptions/${prescriptionId}...`);
 const data = await request(`/prescriptions/${encodeURIComponent(prescriptionId)}`, { method: "GET" });
 return data.prescription || data.data || data;
 } catch (err) {
 console.warn("[API] Không thể tải chi tiết đơn thuốc:", err.message);
 return null;
 }
}

/**
 * Lưu hoặc cập nhật đơn thuốc
 * Nếu có ID/mã: PUT /api/prescriptions/:id, nếu mới: POST /api/prescriptions
 */
export async function apiSavePrescription(prescription) {
 try {
 const id = prescription.id || prescription._id || prescription.prescriptionCode;
 const isUpdate = Boolean(id && !String(id).startsWith("local_"));
 console.log(`[API] Đang lưu đơn thuốc...`, { isUpdate, prescription });

 let resData = null;
 if (isUpdate) {
 try {
 resData = await request(`/prescriptions/${encodeURIComponent(id)}`, {
 method: "PUT",
 body: JSON.stringify(prescription),
 });
 } catch (e) {
 resData = await request("/prescriptions", {
 method: "POST",
 body: JSON.stringify(prescription),
 });
 }
 } else {
 resData = await request("/prescriptions", {
 method: "POST",
 body: JSON.stringify(prescription),
 });
 }

 return resData?.prescription || resData?.data || resData;
 } catch (err) {
 console.warn("[API] Lỗi khi lưu đơn thuốc:", err.message);
 return null;
 }
}

/**
 * Xóa đơn thuốc (xóa mềm)
 * Gửi tới: DELETE http://localhost:3000/api/prescriptions/:id
 */
export async function apiDeletePrescription(prescriptionId) {
 try {
 console.log(`[API] Đang xóa đơn thuốc: ${API_BASE_URL}/prescriptions/${prescriptionId}...`);
 return await request(`/prescriptions/${encodeURIComponent(prescriptionId)}`, { method: "DELETE" });
 } catch (err) {
 console.warn("[API] Lỗi khi xóa đơn thuốc:", err.message);
 return null;
 }
}

/**
 * Lấy danh sách lịch sử các lần tái khám của thú cưng
 * Gửi tới: GET http://localhost:3000/api/re-examinations?petId=...
 */
export async function apiGetReExaminations(petId = null, options = {}) {
 try {
 const params = new URLSearchParams();
 if (petId) params.append("petId", petId);
 if (options.recordCode) params.append("recordCode", options.recordCode);
 if (options.recoveryStatus) params.append("recoveryStatus", options.recoveryStatus);
 if (options.search) params.append("search", options.search);

 const query = params.toString() ? `?${params.toString()}` : "";
 console.log(`[API] Đang tải lịch sử tái khám: ${API_BASE_URL}/re-examinations${query}...`);
 const data = await request(`/re-examinations${query}`, { method: "GET" });
 return data.reExaminations || data.data || (Array.isArray(data) ? data : []);
 } catch (err) {
 console.warn("[API] Lỗi khi tải lịch sử tái khám:", err.message);
 return [];
 }
}

/**
 * Lấy chi tiết một lần tái khám
 * Gửi tới: GET http://localhost:3000/api/re-examinations/:id
 */
export async function apiGetReExaminationById(reExamId) {
 try {
 console.log(`[API] Đang tải chi tiết tái khám: ${API_BASE_URL}/re-examinations/${reExamId}...`);
 const data = await request(`/re-examinations/${encodeURIComponent(reExamId)}`, { method: "GET" });
 return data.reExamination || data.data || data;
 } catch (err) {
 console.warn("[API] Không thể tải chi tiết tái khám:", err.message);
 return null;
 }
}

/**
 * Lưu hoặc cập nhật kết quả tái khám
 * Nếu có ID/mã: PUT /api/re-examinations/:id, nếu mới: POST /api/re-examinations
 */
export async function apiSaveReExamination(reExamData) {
 try {
 const id = reExamData.id || reExamData._id || reExamData.reExamCode;
 const isUpdate = Boolean(id && !String(id).startsWith("local_"));
 console.log(`[API] Đang lưu thông tin tái khám...`, { isUpdate, reExamData });

 let resData = null;
 if (isUpdate) {
 try {
 resData = await request(`/re-examinations/${encodeURIComponent(id)}`, {
 method: "PUT",
 body: JSON.stringify(reExamData),
 });
 } catch (e) {
 resData = await request("/re-examinations", {
 method: "POST",
 body: JSON.stringify(reExamData),
 });
 }
 } else {
 resData = await request("/re-examinations", {
 method: "POST",
 body: JSON.stringify(reExamData),
 });
 }

 return resData?.reExamination || resData?.data || resData;
 } catch (err) {
 console.warn("[API] Lỗi khi lưu thông tin tái khám:", err.message);
 return null;
 }
}

/**
 * Xóa một bản ghi tái khám (xóa mềm)
 * Gửi tới: DELETE http://localhost:3000/api/re-examinations/:id
 */
export async function apiDeleteReExamination(reExamId) {
 try {
 console.log(`[API] Đang xóa lịch sử tái khám: ${API_BASE_URL}/re-examinations/${reExamId}...`);
 return await request(`/re-examinations/${encodeURIComponent(reExamId)}`, { method: "DELETE" });
 } catch (err) {
 console.warn("[API] Lỗi khi xóa thông tin tái khám:", err.message);
 return null;
 }
}

/**
 * Lấy toàn bộ tiến trình lịch sử tái khám theo petId (dùng cho timeline / biểu đồ hồi phục)
 * Gửi tới: GET http://localhost:3000/api/pets/:petId/re-examinations
 */
export async function apiGetPetReExaminations(petId) {
 try {
 console.log(`[API] Đang tải toàn bộ tiến trình tái khám của bé ${petId}...`);
 const data = await request(`/pets/${encodeURIComponent(petId)}/re-examinations`, { method: "GET" });
 return data;
 } catch (err) {
 console.warn("[API] Lỗi khi tải tiến trình tái khám của thú cưng:", err.message);
 return { success: false, reExaminations: [] };
 }
}


/* ============================================================
   7. SPRINT 4: GROOMING, MEDICINE, INVOICE & PAYMENT, ROLE MANAGEMENT
   ============================================================ */

/* --- A. GROOMING APIS --- */

export async function apiCreateGrooming(groomingData) {
  try {
    return await request("/grooming", {
      method: "POST",
      body: JSON.stringify(groomingData),
    });
  } catch (err) {
    console.warn("[API] Lỗi khi tạo lịch grooming:", err.message);
    throw err;
  }
}

export async function apiGetGroomings(params = {}) {
  try {
    const query = new URLSearchParams(params).toString();
    const endpoint = query ? `/grooming?${query}` : "/grooming";
    return await request(endpoint, { method: "GET" });
  } catch (err) {
    console.warn("[API] Lỗi lấy danh sách grooming:", err.message);
    return { success: false, groomings: [], message: err.message };
  }
}

export async function apiGetGroomingById(id) {
  try {
    return await request(`/grooming/${encodeURIComponent(id)}`, { method: "GET" });
  } catch (err) {
    console.warn("[API] Lỗi lấy chi tiết grooming:", err.message);
    return null;
  }
}

export async function apiChangeGroomingStatus(id, newStatus) {
  try {
    return await request(`/grooming/${encodeURIComponent(id)}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status: newStatus }),
    });
  } catch (err) {
    console.warn("[API] Lỗi chuyển trạng thái grooming:", err.message);
    throw err;
  }
}

export async function apiCancelGrooming(id) {
  try {
    return await request(`/grooming/${encodeURIComponent(id)}/cancel`, {
      method: "PATCH",
    });
  } catch (err) {
    console.warn("[API] Lỗi hủy lịch grooming:", err.message);
    throw err;
  }
}

export async function apiGetGroomingCustomers() {
  try {
    return await request("/grooming-meta/customers", { method: "GET" });
  } catch (err) {
    console.warn("[API] Lỗi lấy danh sách khách hàng grooming:", err.message);
    return { success: false, customers: [] };
  }
}

/* --- B. MEDICINE & DISPENSING APIS --- */

export async function apiGetMedicines(options = {}) {
  try {
    const query = new URLSearchParams(options).toString();
    const endpoint = query ? `/medicines?${query}` : "/medicines";
    return await request(endpoint, { method: "GET" });
  } catch (err) {
    console.warn("[API] Lỗi lấy danh mục thuốc:", err.message);
    return { success: false, medicines: [] };
  }
}

export async function apiGetMedicineById(id) {
  try {
    return await request(`/medicines/${encodeURIComponent(id)}`, { method: "GET" });
  } catch (err) {
    console.warn("[API] Lỗi lấy chi tiết thuốc:", err.message);
    return null;
  }
}

export async function apiCreateMedicine(medicineData) {
  try {
    return await request("/medicines", {
      method: "POST",
      body: JSON.stringify(medicineData),
    });
  } catch (err) {
    console.warn("[API] Lỗi thêm thuốc mới:", err.message);
    throw err;
  }
}

export async function apiUpdateMedicine(id, medicineData) {
  try {
    return await request(`/medicines/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify(medicineData),
    });
  } catch (err) {
    console.warn("[API] Lỗi cập nhật thuốc:", err.message);
    throw err;
  }
}

export async function apiDeleteMedicine(id) {
  try {
    return await request(`/medicines/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  } catch (err) {
    console.warn("[API] Lỗi xóa thuốc:", err.message);
    throw err;
  }
}

export async function apiDispensePrescription(dispenseData) {
  try {
    return await request("/dispensing", {
      method: "POST",
      body: JSON.stringify(dispenseData),
    });
  } catch (err) {
    console.warn("[API] Lỗi cấp thuốc theo đơn:", err.message);
    throw err;
  }
}

export async function apiGetDispensings(options = {}) {
  try {
    const query = new URLSearchParams(options).toString();
    const endpoint = query ? `/dispensing?${query}` : "/dispensing";
    return await request(endpoint, { method: "GET" });
  } catch (err) {
    console.warn("[API] Lỗi lấy danh sách cấp thuốc:", err.message);
    return { success: false, dispensings: [] };
  }
}

/* --- C. INVOICE & PAYMENT APIS --- */

export async function apiCreateInvoice(invoiceData) {
  try {
    return await request("/invoices", {
      method: "POST",
      body: JSON.stringify(invoiceData),
    });
  } catch (err) {
    console.warn("[API] Lỗi tạo hóa đơn:", err.message);
    throw err;
  }
}

export async function apiCreateInvoiceFromDispensing(dispensingId) {
  try {
    return await request(`/invoices/from-dispensing/${encodeURIComponent(dispensingId)}`, {
      method: "POST",
    });
  } catch (err) {
    console.warn("[API] Lỗi tạo hóa đơn từ lượt cấp thuốc:", err.message);
    throw err;
  }
}

export async function apiGetInvoices(options = {}) {
  try {
    const headers = {};
    if (options.userId) {
      headers["x-user-id"] = options.userId;
    }
    const query = new URLSearchParams(options).toString();
    const endpoint = query ? `/invoices?${query}` : "/invoices";
    return await request(endpoint, { method: "GET", headers });
  } catch (err) {
    console.warn("[API] Lỗi lấy danh sách hóa đơn:", err.message);
    return { success: false, invoices: [] };
  }
}

export async function apiGetInvoiceById(id, userId = null) {
  try {
    const headers = {};
    if (userId) headers["x-user-id"] = userId;
    return await request(`/invoices/${encodeURIComponent(id)}`, { method: "GET", headers });
  } catch (err) {
    console.warn("[API] Lỗi lấy chi tiết hóa đơn:", err.message);
    throw err;
  }
}

export async function apiProcessPayment(paymentData) {
  try {
    return await request("/payments", {
      method: "POST",
      body: JSON.stringify(paymentData),
    });
  } catch (err) {
    console.warn("[API] Lỗi thực hiện thanh toán:", err.message);
    throw err;
  }
}

export async function apiGetPayments(options = {}) {
  try {
    const query = new URLSearchParams(options).toString();
    const endpoint = query ? `/payments?${query}` : "/payments";
    return await request(endpoint, { method: "GET" });
  } catch (err) {
    console.warn("[API] Lỗi lấy danh sách thanh toán:", err.message);
    return { success: false, payments: [] };
  }
}

/* --- D. ADMIN ROLE MANAGEMENT & DOCTOR APIS --- */

export async function apiAdminGetRoles() {
  try {
    return await request("/admin/roles", { method: "GET" });
  } catch (err) {
    console.warn("[API] Lỗi lấy danh mục roles:", err.message);
    return { success: false, roles: [] };
  }
}

export async function apiAdminGetUsers(search = "", role_id = null, adminId = null) {
  try {
    const headers = {};
    if (adminId) headers["x-user-id"] = adminId;
    const params = new URLSearchParams();
    if (search) params.append("search", search);
    if (role_id) params.append("role_id", role_id);
    const query = params.toString() ? `?${params.toString()}` : "";
    return await request(`/admin/users${query}`, { method: "GET", headers });
  } catch (err) {
    console.warn("[API] Lỗi lấy danh sách user admin:", err.message);
    throw err;
  }
}

export async function apiAdminUpdateUserRole(userId, role_id, adminId = null) {
  try {
    const headers = {};
    if (adminId) headers["x-user-id"] = adminId;
    return await request(`/admin/users/${encodeURIComponent(userId)}/role`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ role_id }),
    });
  } catch (err) {
    console.warn("[API] Lỗi cập nhật phân quyền người dùng:", err.message);
    throw err;
  }
}

export async function apiGetDoctors() {
  try {
    return await request("/doctors", { method: "GET" });
  } catch (err) {
    console.warn("[API] Lỗi lấy danh sách bác sĩ:", err.message);
    return { success: false, doctors: [] };
  }
}

export async function apiGetDoctorAppointments(id_bac_sy = null, doctorId = null) {
  try {
    const headers = {};
    if (doctorId) headers["x-user-id"] = doctorId;
    if (id_bac_sy) headers["x-doctor-id"] = id_bac_sy;
    const query = id_bac_sy ? `?id_bac_sy=${encodeURIComponent(id_bac_sy)}` : "";
    return await request(`/doctor/appointments${query}`, { method: "GET", headers });
  } catch (err) {
    console.warn("[API] Lỗi lấy lịch đặt trước của bác sĩ:", err.message);
    throw err;
  }
}

export async function apiGetDoctorDiagnoses(id_bac_sy = null, doctorId = null) {
  try {
    const headers = {};
    if (doctorId) headers["x-user-id"] = doctorId;
    if (id_bac_sy) headers["x-doctor-id"] = id_bac_sy;
    const query = id_bac_sy ? `?id_bac_sy=${encodeURIComponent(id_bac_sy)}` : "";
    return await request(`/doctor/diagnoses${query}`, { method: "GET", headers });
  } catch (err) {
    console.warn("[API] Lỗi lấy phiếu khám của bác sĩ:", err.message);
    throw err;
  }
}

export async function apiGetDoctorMedicalRecords(petId = null, doctorId = null) {
  try {
    const headers = {};
    if (doctorId) headers["x-user-id"] = doctorId;
    const query = petId ? `?petId=${encodeURIComponent(petId)}` : "";
    return await request(`/doctor/medical-records${query}`, { method: "GET", headers });
  } catch (err) {
    console.warn("[API] Lỗi lấy hồ sơ khám thú cưng:", err.message);
    throw err;
  }
}
