/* ============================================================
   hotel-data.js
   Tầng dữ liệu dùng chung cho Sprint 4: Quản lý Lưu Chuồng & Khách Sạn
   1. Cage List & Status (Danh sách & Trạng thái chuồng)
   2. Pet Check-in (Nhận thú cưng lưu chuồng)
   3. Pet Check-out (Trả thú cưng, tính phí & Lịch sử)
   ============================================================ */

import { STORAGE_KEYS, getData, setData, escapeHTML } from "./storage.js";
import { getCurrentUser } from "./auth.js";
import { getPetsList } from "./pet-profile.js";

export const DEFAULT_HOTEL_CUSTOMERS = [
  {
    id: "cust_1",
    name: "Minh Anh",
    phone: "0900123456",
    email: "minhanh@pawncare.vn",
    address: "123 Nguyễn Văn Linh, Hải Châu, TP. Đà Nẵng",
    memberTier: "Khách hàng Thân thiết",
    pets: [
      { id: "pet_1", name: "Bé Bơ", species: "Chó", breed: "Golden Retriever", weight: "19.5" },
      { id: "pet_2", name: "Miu Miu", species: "Mèo", breed: "Mèo Anh lông ngắn", weight: "4.2" },
    ],
  },
  {
    id: "cust_2",
    name: "Trần Hoàng Nam",
    phone: "0912345678",
    email: "nam.tran@gmail.com",
    address: "45 Lê Lợi, Thạch Thang, TP. Đà Nẵng",
    memberTier: "Thành viên VIP",
    pets: [
      { id: "pet_3", name: "Bé Lu", species: "Chó", breed: "Corgi Chân Ngắn", weight: "12.0" },
      { id: "pet_4", name: "Bé Mây", species: "Mèo", breed: "Mèo Ba Tư Trắng", weight: "3.8" },
    ],
  },
  {
    id: "cust_3",
    name: "Lê Thị Mai",
    phone: "0988776655",
    email: "mai.le@pawncare.vn",
    address: "88 Trần Phú, Hải Châu 1, TP. Đà Nẵng",
    memberTier: "Khách hàng Tiêu chuẩn",
    pets: [
      { id: "pet_5", name: "Bé Sữa", species: "Chó", breed: "Poodle Tiny", weight: "3.2" },
    ],
  },
];

export const DEFAULT_CAGES = [
  {
    id: "CAGE-S01",
    code: "CAGE-S01",
    name: "Chuồng S-01 (Kính cường lực & Nệm êm)",
    size: "small",
    sizeLabel: "Nhỏ (Dưới 5kg)",
    price: 150000,
    status: "available", // available | occupied | maintenance
    description: "Trang bị nệm bông tiệt trùng, bình nước tự động, hệ thống đối lưu không khí.",
    lastCleaned: "2026-11-22 08:00",
  },
  {
    id: "CAGE-S02",
    code: "CAGE-S02",
    name: "Chuồng S-02 (Kính cường lực & Nệm êm)",
    size: "small",
    sizeLabel: "Nhỏ (Dưới 5kg)",
    price: 150000,
    status: "available",
    description: "Không gian ấm cúng, thiết kế cách âm nhẹ nhàng, an toàn cho mèo và cún mini.",
    lastCleaned: "2026-11-22 08:30",
  },
  {
    id: "CAGE-S03",
    code: "CAGE-S03",
    name: "Chuồng S-03 (Máy lọc khí riêng)",
    size: "small",
    sizeLabel: "Nhỏ (Dưới 5kg)",
    price: 150000,
    status: "maintenance",
    description: "Đang định kỳ khử khuẩn UV và bảo dưỡng hệ thống điều hòa cấp nhiệt.",
    lastCleaned: "2026-11-21 17:00",
  },
  {
    id: "CAGE-M01",
    code: "CAGE-M01",
    name: "Chuồng M-01 (Phòng Deluxe Có Camera HD)",
    size: "medium",
    sizeLabel: "Vừa (5kg - 15kg)",
    price: 220000,
    status: "occupied", // Bé Lu đang ở
    description: "Phòng kính mở rộng kèm camera trực tiếp gửi app cho ba mẹ, lót thảm chống trượt.",
    lastCleaned: "2026-11-21 09:00",
  },
  {
    id: "CAGE-M02",
    code: "CAGE-M02",
    name: "Chuồng M-02 (Phòng Deluxe Có Camera HD)",
    size: "medium",
    sizeLabel: "Vừa (5kg - 15kg)",
    price: 220000,
    status: "available",
    description: "Kích thước rộng rãi cho cún vận động nhẹ, điều hòa 25°C chuẩn thú cưng.",
    lastCleaned: "2026-11-22 07:45",
  },
  {
    id: "CAGE-M03",
    code: "CAGE-M03",
    name: "Chuồng M-03 (Phòng Deluxe Có Sân Chơi Mini)",
    size: "medium",
    sizeLabel: "Vừa (5kg - 15kg)",
    price: 220000,
    status: "available",
    description: "Cửa kính đón nắng sớm tự nhiên, nệm êm ái chống lạnh lưng.",
    lastCleaned: "2026-11-22 08:15",
  },
  {
    id: "CAGE-L01",
    code: "CAGE-L01",
    name: "Chuồng L-01 (Phòng VIP Suite Panorama)",
    size: "large",
    sizeLabel: "Lớn (Trên 15kg)",
    price: 320000,
    status: "occupied", // Bé Bơ đang ở
    description: "Không gian 6m² tiêu chuẩn 5 sao, sofa thú cưng, góc chơi riêng, camera góc rộng 4K.",
    lastCleaned: "2026-11-20 10:00",
  },
  {
    id: "CAGE-L02",
    code: "CAGE-L02",
    name: "Chuồng L-02 (Phòng VIP Suite Panorama)",
    size: "large",
    sizeLabel: "Lớn (Trên 15kg)",
    price: 320000,
    status: "available",
    description: "Dành cho các dòng chó lớn Golden, Husky, Samoyed. Lọc không khí công nghệ HEPA.",
    lastCleaned: "2026-11-22 07:30",
  },
];

export const DEFAULT_HOTEL_STAYS = [
  {
    id: "STAY-2026-001",
    code: "STAY-001",
    customerId: "cust_1",
    customerName: "Minh Anh",
    customerPhone: "0900123456",
    petId: "pet_1",
    petName: "Bé Bơ",
    petSpecies: "Chó",
    petBreed: "Golden Retriever",
    cageId: "CAGE-L01",
    cageName: "Chuồng L-01 (Phòng VIP Suite Panorama)",
    cageSize: "large",
    pricePerDay: 320000,
    checkInDate: "2026-11-20",
    expectedCheckOutDate: "2026-11-25",
    belongings: "Chăn bông hình xương, 01 bóng gặm cao su màu cam, 01 túi hạt Royal Canin Golden 3kg.",
    healthNote: "Bé năng động, lanh lợi, ăn uống bình thường, không có dấu hiệu dị ứng.",
    status: "checked_in", // checked_in | checked_out
    createdAt: "2026-11-20T09:30:00",
  },
  {
    id: "STAY-2026-002",
    code: "STAY-002",
    customerId: "cust_2",
    customerName: "Trần Hoàng Nam",
    customerPhone: "0912345678",
    petId: "pet_3",
    petName: "Bé Lu",
    petSpecies: "Chó",
    petBreed: "Corgi Chân Ngắn",
    cageId: "CAGE-M01",
    cageName: "Chuồng M-01 (Phòng Deluxe Có Camera HD)",
    cageSize: "medium",
    pricePerDay: 220000,
    checkInDate: "2026-11-21",
    expectedCheckOutDate: "2026-11-23",
    belongings: "Nệm riêng hình bánh mì, 02 lon pate cá hồi Monge, dây dắt yếm đỏ.",
    healthNote: "Sức khỏe tốt, đã tiêm đủ vắc xin 7 bệnh & dại, mắt và tai sạch.",
    status: "checked_in",
    createdAt: "2026-11-21T14:15:00",
  },
  {
    id: "STAY-2026-003",
    code: "STAY-003",
    customerId: "cust_1",
    customerName: "Minh Anh",
    customerPhone: "0900123456",
    petId: "pet_2",
    petName: "Miu Miu",
    petSpecies: "Mèo",
    petBreed: "Mèo Anh lông ngắn",
    cageId: "CAGE-S01",
    cageName: "Chuồng S-01 (Kính cường lực & Nệm êm)",
    cageSize: "small",
    pricePerDay: 150000,
    checkInDate: "2026-11-10",
    expectedCheckOutDate: "2026-11-14",
    actualCheckOutDate: "2026-11-14",
    belongings: "Cần câu lông vũ, túi cỏ mèo Catnip, lược chải lông.",
    healthNote: "Hơi nhát người lạ ngày đầu, mắt sáng, ăn uống tốt.",
    checkoutHealthNote: "Bé tăng 0.1kg, lông mượt, tinh thần vui vẻ hoạt bát, trả đủ đồ mang theo.",
    totalDays: 4,
    totalFee: 600000,
    status: "checked_out",
    createdAt: "2026-11-10T08:00:00",
    checkedOutAt: "2026-11-14T10:30:00",
  },
  {
    id: "STAY-2026-004",
    code: "STAY-004",
    customerId: "cust_3",
    customerName: "Lê Thị Mai",
    customerPhone: "0988776655",
    petId: "pet_5",
    petName: "Bé Sữa",
    petSpecies: "Chó",
    petBreed: "Poodle Tiny",
    cageId: "CAGE-S02",
    cageName: "Chuồng S-02 (Kính cường lực & Nệm êm)",
    cageSize: "small",
    pricePerDay: 150000,
    checkInDate: "2026-11-05",
    expectedCheckOutDate: "2026-11-07",
    actualCheckOutDate: "2026-11-07",
    belongings: "Áo len màu cam, gối ôm hình gấu nâu nhỏ.",
    healthNote: "Khỏe mạnh, thích được bế và xoa đầu.",
    checkoutHealthNote: "Trả đúng giờ, bé khỏe mạnh sạch sẽ, gửi lại đủ tư trang.",
    totalDays: 2,
    totalFee: 300000,
    status: "checked_out",
    createdAt: "2026-11-05T09:10:00",
    checkedOutAt: "2026-11-07T16:00:00",
  },
];

// Helper hiển thị thông báo Toast chuẩn PawnCare
export function showHotelToast(message, type = "success") {
  let toast = document.getElementById("hotelToast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "hotelToast";
    toast.className = "toast-notice";
    document.body.appendChild(toast);
  }
  const icon = type === "success" ? "✓" : (type === "warning" ? "⚠️" : "✕");
  toast.className = `toast-notice ${type} show`;
  toast.innerHTML = `<span class="toast-icon">${icon}</span> <span>${escapeHTML(message)}</span>`;
  setTimeout(() => {
    toast.classList.remove("show");
  }, 3500);
}

// Lấy danh sách khách hàng & thú cưng
export function getHotelCustomers() {
  const stored = getData(STORAGE_KEYS.HOTEL_CUSTOMERS, null);
  let customers = stored && Array.isArray(stored) && stored.length > 0 ? stored : [...DEFAULT_HOTEL_CUSTOMERS];

  // Tích hợp người dùng hiện tại và thú cưng của họ
  const currentUser = getCurrentUser();
  if (currentUser) {
    const userPets = getPetsList();
    const existingIndex = customers.findIndex((c) => c.phone === currentUser.phone || c.id === currentUser.id);
    const userCustomerObj = {
      id: currentUser.id || "cust_current",
      name: currentUser.name || "Khách hàng Hiện tại",
      phone: currentUser.phone || "0900123456",
      email: currentUser.email || "user@pawncare.vn",
      address: currentUser.address ? `${currentUser.address.houseNumber || ""} ${currentUser.address.street || ""}, ${currentUser.address.city || "TP. Đà Nẵng"}` : "123 Nguyễn Văn Linh, Đà Nẵng",
      memberTier: currentUser.memberTier || "Khách hàng Thân thiết",
      pets: userPets.map((p) => ({
        id: p.id,
        name: p.name,
        species: p.species || "Chó",
        breed: p.breed || "Thú cưng",
        weight: p.weight || "5.0",
      })),
    };

    if (existingIndex >= 0) {
      customers[existingIndex] = { ...customers[existingIndex], ...userCustomerObj };
    } else {
      customers.unshift(userCustomerObj);
    }
  }

  setData(STORAGE_KEYS.HOTEL_CUSTOMERS, customers);
  return customers;
}

// Lấy danh sách chuồng
export function getHotelCages() {
  const stored = getData(STORAGE_KEYS.HOTEL_CAGES, null);
  if (stored && Array.isArray(stored) && stored.length > 0) {
    return stored;
  }
  setData(STORAGE_KEYS.HOTEL_CAGES, DEFAULT_CAGES);
  return DEFAULT_CAGES;
}

// Lưu danh sách chuồng
export function setHotelCages(cages) {
  setData(STORAGE_KEYS.HOTEL_CAGES, cages);
}

// Lấy danh sách lượt lưu chuồng (Stays)
export function getHotelStays() {
  const stored = getData(STORAGE_KEYS.HOTEL_STAYS, null);
  if (stored && Array.isArray(stored) && stored.length > 0) {
    return stored;
  }
  setData(STORAGE_KEYS.HOTEL_STAYS, DEFAULT_HOTEL_STAYS);
  return DEFAULT_HOTEL_STAYS;
}

// Lưu danh sách lượt lưu chuồng
export function setHotelStays(stays) {
  setData(STORAGE_KEYS.HOTEL_STAYS, stays);
}

// Lấy danh sách chuồng trống (chỉ status === 'available')
export function getAvailableCages() {
  const cages = getHotelCages();
  return cages.filter((c) => c.status === "available");
}

// Kiểm tra xem thú cưng có đang lưu trong chuồng nào không (status === 'checked_in')
export function isPetCurrentlyBoarding(petId) {
  const stays = getHotelStays();
  return stays.some((s) => s.petId === petId && s.status === "checked_in");
}

// Lấy lượt lưu đang active của một chuồng
export function getActiveStayForCage(cageId) {
  const stays = getHotelStays();
  return stays.find((s) => s.cageId === cageId && s.status === "checked_in");
}

// Định dạng tiền VND chuẩn Việt Nam
export function formatVND(amount) {
  const num = Number(amount) || 0;
  return new Intl.NumberFormat("vi-VN").format(num) + "đ";
}

// Tính số ngày lưu trú và tổng tiền:
// diffDays = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24))
// Tối thiểu 1 ngày (Math.max(1, diffDays)) theo yêu cầu nghiệp vụ
export function calculateStayDurationAndFee(checkInStr, checkOutStr, pricePerDay) {
  if (!checkInStr || !checkOutStr) {
    return { days: 1, totalFee: pricePerDay || 0, isValid: false, error: "Vui lòng chọn ngày nhận và ngày trả." };
  }

  const parseDate = (dStr) => {
    if (dStr.includes("/")) {
      const parts = dStr.split("/");
      return new Date(parts[2], parts[1] - 1, parts[0]);
    }
    return new Date(dStr);
  };

  const inDate = parseDate(checkInStr);
  const outDate = parseDate(checkOutStr);

  inDate.setHours(0, 0, 0, 0);
  outDate.setHours(0, 0, 0, 0);

  const diffMs = outDate.getTime() - inDate.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) {
    return {
      days: 0,
      totalFee: 0,
      isValid: false,
      error: "Ngày trả phòng phải sau ngày nhận phòng ít nhất 1 ngày.",
    };
  }

  const days = Math.max(1, diffDays);
  const price = Number(pricePerDay) || 0;
  const totalFee = days * price;

  return {
    days,
    totalFee,
    isValid: true,
    error: null,
  };
}
