/* ============================================================
   medical-data.js
   Tầng dữ liệu dùng chung cho 3 chức năng:
   1. Medical Record (Hồ sơ y tế / Bệnh án)
   2. Pet Medical History (Lịch sử bệnh thú cưng)
   3. Diagnosis (Thông tin chẩn đoán bệnh)
   ============================================================ */

import { STORAGE_KEYS, getData, setData, escapeHTML } from "./storage.js";
import { getCurrentUser } from "./auth.js";
import { getPetsList, fetchPetsFromDatabase } from "./pet-profile.js";
import {
  apiGetMedicalRecords,
  apiSaveMedicalRecord,
  apiDeleteMedicalRecord,
  apiGetPetHealthProfile,
  apiSavePetHealthProfile,
} from "./api.js";

export const DEFAULT_HEALTH_PROFILES = {
  pet_1: {
    bloodType: "DEA 1.1 Dương tính",
    microchip: "985141002348912",
    allergies: "Dị ứng thịt gà công nghiệp & kháng sinh Penicillin",
    chronicConditions: "Không có bệnh mãn tính",
    sterilized: "Đã triệt sản",
    vaccinationStatus: "Đã tiêm phòng đủ (Hạn đến 05/2027)",
    dewormingStatus: "Đã tẩy giun (Hạn đến 11/2026)",
    overallStatus: "Khỏe mạnh",
  },
  pet_2: {
    bloodType: "Nhóm A (Mèo)",
    microchip: "985141005891244",
    allergies: "Chưa ghi nhận dị ứng",
    chronicConditions: "Cơ địa bàng quang nhạy cảm",
    sterilized: "Chưa triệt sản",
    vaccinationStatus: "Đã tiêm phòng đủ (Hạn đến 10/2027)",
    dewormingStatus: "Đã nhỏ gáy Revolution Plus (Hạn đến 11/2026)",
    overallStatus: "Khỏe mạnh",
  },
};

export const DEFAULT_MEDICAL_RECORDS = [
  // --- BÉ BƠ (pet_1) ---
  {
    id: "MED-2026-001",
    petId: "pet_1",
    petName: "Bé Bơ",
    petSpecies: "Chó",
    petBreed: "Golden Retriever",
    date: "15/10/2026",
    title: "Viêm da dị ứng tiếp xúc & Nhiễm nấm Malassezia",
    category: "Da liễu",
    status: "Đã hoàn thành",
    veterinarian: "BS. CKI. Nguyễn Văn Hùng",
    clinicBranch: "PawnCare 123 Nguyễn Văn Linh, Hải Châu, Đà Nẵng",
    reason: "Gãi nhiều vùng cổ và tai, rụng lông thành mảng đỏ, có vảy gàu li ti",
    vitalSigns: {
      temperature: "38.6",
      weight: "19.5",
      heartRate: "110",
      respiratoryRate: "24",
      mucousMembranes: "Hồng hào, ẩm",
      hydration: "Bình thường, độ đàn hồi da tốt",
    },
    symptoms: [
      "Ngứa ngáy dữ dội",
      "Rụng lông vùng cổ và gốc tai",
      "Vảy gàu li ti",
      "Da ửng đỏ có mùi men chua",
    ],
    preliminaryDiagnosis: "Nghi ngờ viêm da do dị ứng thức ăn hoặc ký sinh trùng ngoài da (Demodex/Nấm)",
    confirmedDiagnosis: "Viêm da dị ứng tiếp xúc (Allergic Contact Dermatitis) kết hợp nhiễm nấm men Malassezia thứ phát",
    testResults: [
      {
        name: "Soi tươi biểu bì da cạo sâu",
        sample: "Mẫu biểu bì cổ & vành tai",
        result: "Phát hiện nhiều tế bào nấm Malassezia dạng hồ lô (++), âm tính với ve mò Demodex",
        status: "Bất thường",
      },
      {
        name: "Tổng phân tích tế bào máu ngoại vi (CBC)",
        sample: "Máu tĩnh mạch cảnh",
        result: "Bạch cầu ái toan Eosinophil tăng nhẹ 8.2% (phản ứng dị ứng), các dòng khác bình thường",
        status: "Bình thường",
      },
    ],
    prescription: [
      {
        name: "Cefalexin 250mg",
        active: "Cephalosporin thế hệ 1",
        dosage: "1 viên x 2 lần/ngày sau khi ăn",
        duration: "7 ngày",
        notes: "Kháng sinh chống bội nhiễm vi khuẩn cơ hội",
      },
      {
        name: "Sữa tắm trị nấm Malaseb 250ml",
        active: "Chlorhexidine + Miconazole",
        dosage: "Tắm 2 lần/tuần, lưu bọt 10 phút trước khi xả sạch",
        duration: "3 tuần",
        notes: "Tránh để bọt xà phòng tiếp xúc vào mắt và niêm mạc tai",
      },
      {
        name: "Dung dịch vệ sinh tai Otoproct 15ml",
        active: "Dexamethasone + Polymyxin B",
        dosage: "Nhỏ 3 giọt mỗi bên tai ngày 1 lần",
        duration: "5 ngày",
        notes: "Mát-xa nhẹ gốc tai, dùng bông mềm lau sạch cặn bẩn",
      },
    ],
    doctorAdvice: "Chuyển khẩu phần ăn sang dòng Hypoallergenic (đạm thủy phân). Vệ sinh nệm nằm, phơi nắng định kỳ. Giữ nếp da vùng cổ khô ráo sau khi vận động.",
    nextAppointment: "25/10/2026",
    totalCost: "520.000đ",
    createdAt: Date.now() - 15 * 86400000,
  },
  {
    id: "MED-2026-002",
    petId: "pet_1",
    petName: "Bé Bơ",
    petSpecies: "Chó",
    petBreed: "Golden Retriever",
    date: "28/08/2026",
    title: "Rối loạn tiêu hóa cấp tính do kích ứng thức ăn mới",
    category: "Tiêu hóa",
    status: "Đã hoàn thành",
    veterinarian: "BS. Lê Thị Thảo",
    clinicBranch: "PawnCare 123 Nguyễn Văn Linh, Hải Châu, Đà Nẵng",
    reason: "Nôn thức ăn sau bữa tối, đi phân lỏng 2 lần, giảm ăn và hơi ủ rũ",
    vitalSigns: {
      temperature: "38.8",
      weight: "19.0",
      heartRate: "118",
      respiratoryRate: "26",
      mucousMembranes: "Hồng nhạt",
      hydration: "Mất nước nhẹ (nếp gấp da thu hồi sau 1 giây)",
    },
    symptoms: [
      "Nôn thức ăn chưa tiêu",
      "Đi phân lỏng màu vàng sệt",
      "Bụng chướng nhẹ, sôi ruột",
      "Giảm thèm ăn trong 12 giờ qua",
    ],
    preliminaryDiagnosis: "Viêm dạ dày - ruột cấp (Acute Gastroenteritis), loại trừ bệnh truyền nhiễm do Parvovirus",
    confirmedDiagnosis: "Rối loạn tiêu hóa cấp do kích ứng thức ăn chứa hàm lượng đạm cao đột ngột (Dyspepsia)",
    testResults: [
      {
        name: "Test nhanh kháng nguyên Parvo & Corona virus",
        sample: "Dịch phết trực tràng",
        result: "Âm tính (-) với cả Parvo virus và Corona virus",
        status: "Bình thường",
      },
      {
        name: "Siêu âm ổ bụng tổng quát",
        sample: "Vùng bụng trên & ruột non",
        result: "Thành dạ dày phù nề nhẹ, quai ruột có nhiều hơi và dịch lỏng, không có dị vật",
        status: "Bình thường",
      },
    ],
    prescription: [
      {
        name: "Men vi sinh Enterogermina",
        active: "Bào tử Bacillus clausii",
        dosage: "1 ống/ngày chia làm 2 lần uống",
        duration: "5 ngày",
        notes: "Uống cách xa thời gian ăn 1 giờ để tái lập hệ vi sinh",
      },
      {
        name: "Thuốc tráng niêm mạc Phosphalugel",
        active: "Aluminium phosphate",
        dosage: "1 gói/ngày trước bữa ăn 30 phút",
        duration: "3 ngày",
        notes: "Làm dịu niêm mạc dạ dày và chống trào ngược",
      },
      {
        name: "Dung dịch bù nước & điện giải Pet Hydrate",
        active: "Glucose + Khoáng chất điện giải",
        dosage: "Pha 200ml nước ấm cho uống tự do",
        duration: "2 ngày",
        notes: "Cho uống từng lượng nhỏ, không ép uống dồn dập",
      },
    ],
    doctorAdvice: "Nấu cháo thịt nạc băm loãng cho ăn làm nhiều bữa nhỏ trong 2 ngày đầu. Tránh hoàn toàn sữa tươi và thức ăn nhiều dầu mỡ. Đưa bé đi khám lại ngay nếu xuất hiện nôn khan hoặc đi ngoài ra máu.",
    nextAppointment: "02/09/2026",
    totalCost: "350.000đ",
    createdAt: Date.now() - 65 * 86400000,
  },
  {
    id: "MED-2026-003",
    petId: "pet_1",
    petName: "Bé Bơ",
    petSpecies: "Chó",
    petBreed: "Golden Retriever",
    date: "10/05/2026",
    title: "Tiêm phòng định kỳ Vaccine 7 bệnh & Sổ giun chuyên sâu",
    category: "Tiêm chủng",
    status: "Đã hoàn thành",
    veterinarian: "BS. CKI. Nguyễn Văn Hùng",
    clinicBranch: "PawnCare 123 Nguyễn Văn Linh, Hải Châu, Đà Nẵng",
    reason: "Đến lịch tiêm nhắc lại hàng năm theo lịch hẹn sổ khám sức khỏe",
    vitalSigns: {
      temperature: "38.4",
      weight: "18.2",
      heartRate: "104",
      respiratoryRate: "22",
      mucousMembranes: "Hồng hào",
      hydration: "Bình thường",
    },
    symptoms: ["Bé khỏe mạnh, năng động, ăn uống và tiêu hóa bình thường"],
    preliminaryDiagnosis: "Đủ tiêu chuẩn thể trạng tốt để tiếp nhận tiêm vaccine phòng bệnh",
    confirmedDiagnosis: "Hoàn thành tiêm nhắc mũi Vaccine Vanguard Plus 5/L (7 bệnh) và tẩy giun định kỳ",
    testResults: [
      {
        name: "Khám lâm sàng sàng lọc trước tiêm chủng",
        sample: "Toàn thân",
        result: "Thân nhiệt ổn định, không ho sốt, hạch ngoại biên không sưng, tim phổi êm dịu",
        status: "Bình thường",
      },
    ],
    prescription: [
      {
        name: "Vaccine Vanguard Plus 5/L (Zoetis Mỹ)",
        active: "Ngừa Carred, Parvo, Viêm gan, Ho cũi chó, Lepto",
        dosage: "1 liều tiêm dưới da",
        duration: "1 năm",
        notes: "Lô sản xuất H8921B, bảo quản lạnh tiêu chuẩn",
      },
      {
        name: "Viên tẩy giun Drontal Plus",
        active: "Febantel + Pyrantel + Praziquantel",
        dosage: "2 viên uống trực tiếp vào buổi sáng",
        duration: "Định kỳ 3 tháng/lần",
        notes: "Tẩy sạch giun đũa, giun móc, giun tóc và sán dây",
      },
    ],
    doctorAdvice: "Theo dõi phản ứng của bé tại nhà trong 24 giờ đầu. Kiêng tắm trong vòng 7 ngày sau tiêm để đảm bảo đáp ứng miễn dịch tối đa. Tránh cho bé tiếp xúc với chó lạ chưa tiêm phòng.",
    nextAppointment: "10/05/2027",
    totalCost: "280.000đ",
    createdAt: Date.now() - 175 * 86400000,
  },

  // --- BÉ MIU MIU (pet_2) ---
  {
    id: "MED-2026-004",
    petId: "pet_2",
    petName: "Miu Miu",
    petSpecies: "Mèo",
    petBreed: "Mèo Anh lông ngắn",
    date: "20/09/2026",
    title: "Hội chứng viêm đường tiết niệu dưới ở mèo (FLUTD)",
    category: "Tiết niệu",
    status: "Đã hoàn thành",
    veterinarian: "BS. Lê Thị Thảo",
    clinicBranch: "PawnCare 123 Nguyễn Văn Linh, Hải Châu, Đà Nẵng",
    reason: "Đi vệ sinh khay cát nhiều lần nhưng tiểu rất ít, rên rỉ khi tiểu, liên tục liếm vùng sinh dục",
    vitalSigns: {
      temperature: "38.7",
      weight: "4.2",
      heartRate: "145",
      respiratoryRate: "28",
      mucousMembranes: "Hồng",
      hydration: "Mất nước nhẹ",
    },
    symptoms: [
      "Tiểu rắt, tiểu khó",
      "Tiểu nhiều lần lượng nhỏ giọt",
      "Liếm lông vùng sinh dục liên tục",
      "Căng thẳng bồn chồn khi vào khay cát",
    ],
    preliminaryDiagnosis: "Nghi ngờ sỏi bàng quang hoặc viêm bàng quang kẽ vô căn ở mèo (FIC)",
    confirmedDiagnosis: "Viêm bàng quang vô căn thể không tắc nghẽn (Feline Idiopathic Cystitis - FIC) do stress môi trường",
    testResults: [
      {
        name: "Tổng phân tích nước tiểu & Soi cặn lắng",
        sample: "Nước tiểu chọc hút bàng quang",
        result: "pH 6.8, bạch cầu vi thể (+), protein vết, không có tinh thể sỏi",
        status: "Bình thường",
      },
      {
        name: "Siêu âm hệ tiết niệu và bàng quang",
        sample: "Vùng hạ vị",
        result: "Thành bàng quang dày 2.8mm, lòng bàng quang có cặn giả mạc mỏng, không có sỏi cản quang",
        status: "Bất thường",
      },
    ],
    prescription: [
      {
        name: "Meloxicam siro cho mèo 0.5mg/ml",
        active: "Meloxicam NSAID",
        dosage: "0.2ml/ngày sau bữa ăn",
        duration: "4 ngày",
        notes: "Kháng viêm giảm đau nhanh, hỗ trợ đường tiểu",
      },
      {
        name: "Viên uống bảo vệ bàng quang Cystease",
        active: "N-acetyl D-glucosamine",
        dosage: "1 viên/ngày trộn pate ướt",
        duration: "14 ngày",
        notes: "Bổ sung lớp màng bảo vệ GAGs trên niêm mạc bàng quang",
      },
    ],
    doctorAdvice: "Lắp đặt đài phun nước tự động kích thích mèo uống nước nhiều hơn. Tăng tỷ lệ thức ăn ướt (pate). Giữ khay cát luôn sạch sẽ, đặt ở vị trí yên tĩnh, giảm thiểu tiếng ồn làm mèo giật mình.",
    nextAppointment: "05/10/2026",
    totalCost: "420.000đ",
    createdAt: Date.now() - 45 * 86400000,
  },
  {
    id: "MED-2026-005",
    petId: "pet_2",
    petName: "Miu Miu",
    petSpecies: "Mèo",
    petBreed: "Mèo Anh lông ngắn",
    date: "02/10/2026",
    title: "Tiêm nhắc vaccine 4 bệnh cho mèo & Nhỏ gáy diệt ký sinh trùng",
    category: "Tiêm chủng",
    status: "Đã hoàn thành",
    veterinarian: "BS. CKI. Nguyễn Văn Hùng",
    clinicBranch: "PawnCare 123 Nguyễn Văn Linh, Hải Châu, Đà Nẵng",
    reason: "Tiêm mũi nhắc lại hàng năm và phòng ngừa ve rận, giun tim",
    vitalSigns: {
      temperature: "38.5",
      weight: "4.2",
      heartRate: "140",
      respiratoryRate: "26",
      mucousMembranes: "Hồng tươi",
      hydration: "Bình thường",
    },
    symptoms: ["Thể trạng ổn định, lông bóng mượt, mắt và tai sạch sẽ"],
    preliminaryDiagnosis: "Đủ điều kiện sức khỏe tốt để tiêm vaccine và phòng ký sinh trùng",
    confirmedDiagnosis: "Hoàn thành mũi tiêm Vaccine Felocell 4 và thuốc nhỏ gáy Revolution Plus",
    testResults: [
      {
        name: "Khám tổng quát mắt, mũi, tai và khoang miệng",
        sample: "Lâm sàng",
        result: "Tai sạch, không viêm nướu, không sốt, tim phổi êm dịu",
        status: "Bình thường",
      },
    ],
    prescription: [
      {
        name: "Vaccine Felocell 4 (Zoetis)",
        active: "Phòng ngừa FPV, FHV-1, FCV, Chlamydia",
        dosage: "1 liều tiêm dưới da",
        duration: "1 năm",
        notes: "Mũi nhắc định kỳ hàng năm",
      },
      {
        name: "Thuốc nhỏ gáy Revolution Plus cho mèo",
        active: "Selamectin + Sarolaner",
        dosage: "1 tuýp nhỏ trực tiếp sau gáy",
        duration: "1 tháng",
        notes: "Phòng ve rận, bọ chét, giun tim, ghẻ tai và sán",
      },
    ],
    doctorAdvice: "Không để thú cưng khác liếm vào vùng gáy vừa nhỏ thuốc trong 4 giờ. Kiêng tắm trong 3 ngày tới.",
    nextAppointment: "02/10/2027",
    totalCost: "310.000đ",
    createdAt: Date.now() - 32 * 86400000,
  },
];

export function getStoredMedicalRecords() {
  const records = getData(STORAGE_KEYS.MEDICAL_RECORDS, null);
  if (records && Array.isArray(records) && records.length > 0) {
    return records;
  }
  setData(STORAGE_KEYS.MEDICAL_RECORDS, DEFAULT_MEDICAL_RECORDS);
  return DEFAULT_MEDICAL_RECORDS;
}

export function setStoredMedicalRecords(records) {
  setData(STORAGE_KEYS.MEDICAL_RECORDS, records);
}

export function getStoredHealthProfiles() {
  const profiles = getData(STORAGE_KEYS.PET_HEALTH_PROFILES, null);
  if (profiles && typeof profiles === "object") {
    return profiles;
  }
  setData(STORAGE_KEYS.PET_HEALTH_PROFILES, DEFAULT_HEALTH_PROFILES);
  return DEFAULT_HEALTH_PROFILES;
}

export function setStoredHealthProfiles(profiles) {
  setData(STORAGE_KEYS.PET_HEALTH_PROFILES, profiles);
}

export function showToast(message, type = "success") {
  let toast = document.getElementById("profileToast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "profileToast";
    toast.className = "toast-notice";
    document.body.appendChild(toast);
  }
  toast.className = `toast-notice ${type} show`;
  toast.innerHTML = `<span>✓</span> <span>${escapeHTML(message)}</span>`;
  setTimeout(() => {
    toast.classList.remove("show");
  }, 3200);
}

export function updateSidebarInfo() {
  const user = getCurrentUser();
  if (user) {
    const sideName = document.getElementById("sidebarUserName");
    const sidePhone = document.getElementById("sidebarUserPhone");
    const sideInitial = document.getElementById("sidebarUserInitial");
    if (sideName) sideName.textContent = user.name || "Khách hàng";
    if (sidePhone) sidePhone.textContent = user.phone || user.email || "0900 123 456";
    if (sideInitial) sideInitial.textContent = (user.name || "U").trim().charAt(0).toUpperCase();
  }
}
