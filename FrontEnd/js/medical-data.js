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
    const seen = new Set();
    const deduped = [];
    for (const r of records) {
      if (!r) continue;
      const id = r.id || r.recordCode || (r._id ? String(r._id) : "");
      if (id && !seen.has(id)) {
        seen.add(id);
        deduped.push({
          ...r,
          id,
          recordCode: r.recordCode || id,
        });
      }
    }
    // Tự động dọn sạch bản ghi trùng lặp trong localStorage nếu có
    if (deduped.length !== records.length) {
      setData(STORAGE_KEYS.MEDICAL_RECORDS, deduped);
    }
    return deduped;
  }
  setData(STORAGE_KEYS.MEDICAL_RECORDS, DEFAULT_MEDICAL_RECORDS);
  return DEFAULT_MEDICAL_RECORDS;
}

export function setStoredMedicalRecords(records) {
  if (!Array.isArray(records)) {
    setData(STORAGE_KEYS.MEDICAL_RECORDS, records);
    return;
  }
  const seen = new Set();
  const deduped = [];
  for (const r of records) {
    if (!r) continue;
    const id = r.id || r.recordCode || (r._id ? String(r._id) : "");
    if (id && !seen.has(id)) {
      seen.add(id);
      deduped.push({
        ...r,
        id,
        recordCode: r.recordCode || id,
      });
    }
  }
  setData(STORAGE_KEYS.MEDICAL_RECORDS, deduped);
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

/* ============================================================
   4. DỮ LIỆU MẶC ĐỊNH CHO TÁI KHÁM (RE-EXAMINATION HISTORY)
   ============================================================ */
export const DEFAULT_RE_EXAMINATIONS = [
  {
    id: "RE-2026-001",
    recordId: "MED-2026-001",
    petId: "pet_1",
    petName: "Bé Bơ",
    petSpecies: "Chó",
    petBreed: "Golden Retriever",
    date: "25/10/2026",
    time: "09:30",
    originalDiagnosis: "Viêm da dị ứng tiếp xúc & Nhiễm nấm Malassezia",
    category: "Da liễu",
    status: "Đã hoàn thành",
    veterinarian: "BS. CKI. Nguyễn Văn Hùng",
    clinicBranch: "PawnCare 123 Nguyễn Văn Linh, Hải Châu, Đà Nẵng",
    recoveryRate: 90,
    recoveryStatus: "Phục hồi rất tốt",
    comparison: {
      before: {
        temp: "38.6°C",
        weight: "19.5 kg",
        itchLevel: "Dữ dội (8/10)",
        skinCondition: "Rụng lông cổ & tai, da ửng đỏ, có vảy gàu men chua",
      },
      after: {
        temp: "38.3°C",
        weight: "19.8 kg",
        itchLevel: "Không còn ngứa (1/10)",
        skinCondition: "Lông tơ bắt đầu mọc lại đều, da se khô bình thường",
      },
    },
    findings:
      "Soi tươi biểu bì da tái kiểm tra: Mật độ tế bào nấm Malassezia giảm 95% (-/vết). Vùng da cổ và vành tai không còn sưng đỏ hay tiết bã nhờn.",
    treatmentAdjustment:
      "Ngưng hoàn toàn kháng sinh Cefalexin uống. Tiếp tục duy trì tắm sữa tắm Malaseb 1 lần/tuần trong 2 tuần tiếp theo.",
    homeCareAdvice:
      "Duy trì khẩu phần hạt Hypoallergenic. Không cho ăn vặt đồ ăn người. Giữ nếp gấp cổ khô ráo sau khi tắm hoặc đi dạo.",
    nextFollowup: "Không cần tái khám thêm nếu không có dấu hiệu ngứa lại",
    createdAt: Date.now() - 5 * 86400000,
  },
  {
    id: "RE-2026-002",
    recordId: "MED-2026-002",
    petId: "pet_1",
    petName: "Bé Bơ",
    petSpecies: "Chó",
    petBreed: "Golden Retriever",
    date: "02/09/2026",
    time: "15:00",
    originalDiagnosis: "Rối loạn tiêu hóa cấp do kích ứng thức ăn mới",
    category: "Tiêu hóa",
    status: "Đã hoàn thành",
    veterinarian: "BS. Lê Thị Thảo",
    clinicBranch: "PawnCare 123 Nguyễn Văn Linh, Hải Châu, Đà Nẵng",
    recoveryRate: 100,
    recoveryStatus: "Khỏi bệnh hoàn toàn",
    comparison: {
      before: {
        temp: "38.8°C",
        weight: "19.0 kg",
        stool: "Phân lỏng, nôn thức ăn",
        appetite: "Ủ rũ, bỏ bữa",
      },
      after: {
        temp: "38.4°C",
        weight: "19.4 kg",
        stool: "Phân khuôn đẹp",
        appetite: "Ăn khỏe, năng động",
      },
    },
    findings:
      "Nhu động ruột êm dịu, sờ nắn bụng mềm không đau. Hệ tiêu hóa đã hấp thu thức ăn tốt trở lại hoàn toàn.",
    treatmentAdjustment:
      "Dừng Phosphalugel. Uống nốt 2 ống men vi sinh Enterogermina còn lại để củng cố khuẩn đường ruột.",
    homeCareAdvice:
      "Tuân thủ nguyên tắc chuyển đổi thức ăn mới từ từ trong vòng 7 ngày để tránh kích ứng niêm mạc ruột.",
    nextFollowup: "Lịch tiêm phòng định kỳ vào tháng 05/2027",
    createdAt: Date.now() - 60 * 86400000,
  },
  {
    id: "RE-2026-003",
    recordId: "MED-2026-004",
    petId: "pet_2",
    petName: "Miu Miu",
    petSpecies: "Mèo",
    petBreed: "Mèo Anh lông ngắn",
    date: "05/10/2026",
    time: "10:00",
    originalDiagnosis: "Hội chứng viêm đường tiết niệu dưới ở mèo (FLUTD / FIC)",
    category: "Tiết niệu",
    status: "Đã hoàn thành",
    veterinarian: "BS. Lê Thị Thảo",
    clinicBranch: "PawnCare 123 Nguyễn Văn Linh, Hải Châu, Đà Nẵng",
    recoveryRate: 88,
    recoveryStatus: "Đang phục hồi tích cực",
    comparison: {
      before: {
        temp: "38.7°C",
        weight: "4.2 kg",
        urination: "Tiểu rắt, tiểu giọt, rên rỉ khi vào khay cát",
        ultrasound: "Thành bàng quang dày 2.8mm, có cặn giả mạc",
      },
      after: {
        temp: "38.5°C",
        weight: "4.3 kg",
        urination: "Tiểu thông suốt, lượng nước tiểu bình thường",
        ultrasound: "Thành bàng quang mỏng còn 1.6mm, dịch trong",
      },
    },
    findings:
      "Siêu âm tái kiểm tra: Thành bàng quang giảm phù nề đáng kể, không còn phản ứng viêm cấp tính. Bé không còn cảm giác đau buốt.",
    treatmentAdjustment:
      "Dừng thuốc giảm đau kháng viêm Meloxicam. Tiếp tục duy trì viên Cystease thêm 7 ngày nữa.",
    homeCareAdvice:
      "Bổ sung đài nước tự động và duy trì khẩu phần pate ướt. Khay cát luôn dọn sạch 2 lần/ngày để giảm stress.",
    nextFollowup: "Tái khám kiểm tra định kỳ vào 28/11/2026",
    createdAt: Date.now() - 25 * 86400000,
  },
  {
    id: "RE-2026-004",
    recordId: "MED-2026-004",
    petId: "pet_2",
    petName: "Miu Miu",
    petSpecies: "Mèo",
    petBreed: "Mèo Anh lông ngắn",
    date: "28/11/2026",
    time: "14:30",
    originalDiagnosis: "Kiểm tra định kỳ chức năng bàng quang & ngừa tái phát FLUTD",
    category: "Tiết niệu",
    status: "Sắp tới",
    veterinarian: "BS. Lê Thị Thảo",
    clinicBranch: "PawnCare 123 Nguyễn Văn Linh, Hải Châu, Đà Nẵng",
    recoveryRate: 90,
    recoveryStatus: "Lịch hẹn sắp diễn ra",
    comparison: {
      before: {
        temp: "38.5°C",
        weight: "4.3 kg",
        urination: "Tiểu ổn định",
      },
      after: {
        temp: "Đang chờ khám",
        weight: "Đang chờ cân",
        urination: "Đang theo dõi tại nhà",
      },
    },
    findings: "Lịch hẹn tái khám sắp tới. Bác sĩ sẽ siêu âm bàng quang và kiểm tra nước tiểu tầm soát định kỳ.",
    treatmentAdjustment: "Chờ bác sĩ khám và đưa ra lời khuyên phác đồ tiếp theo.",
    homeCareAdvice: "Nhịn ăn 4 tiếng trước khi siêu âm. Giữ tâm lý bé thoải mái trước khi đến phòng khám.",
    nextFollowup: "28/11/2026 lúc 14:30",
    createdAt: Date.now() - 2 * 86400000,
  },
];

export function getStoredReExaminations() {
  const data = getData(STORAGE_KEYS.RE_EXAMINATIONS, null);
  if (data && Array.isArray(data) && data.length > 0) {
    return data;
  }
  setData(STORAGE_KEYS.RE_EXAMINATIONS, DEFAULT_RE_EXAMINATIONS);
  return DEFAULT_RE_EXAMINATIONS;
}

export function setStoredReExaminations(records) {
  setData(STORAGE_KEYS.RE_EXAMINATIONS, records);
}

/* ============================================================
   5. DỮ LIỆU MẶC ĐỊNH CHO ĐƠN THUỐC (PRESCRIPTION)
   ============================================================ */
export const DEFAULT_PRESCRIPTIONS = [
  // --- BÉ BƠ (pet_1) ---
  {
    id: "RX-2026-001",
    petId: "pet_1",
    recordId: "MED-2026-001",
    diseaseTitle: "Viêm da dị ứng tiếp xúc & Nhiễm nấm Malassezia",
    medicineName: "Cefalexin 250mg",
    activeIngredient: "Cephalosporin thế hệ 1",
    category: "Kháng sinh đường uống",
    form: "Viên nang mềm",
    dosage: "1 viên x 2 lần/ngày (Sáng & Tối)",
    schedule: { morning: true, afternoon: false, evening: true },
    timing: "Uống sau khi ăn no 15 phút",
    duration: "7 ngày (15/10 - 22/10/2026)",
    status: "Đã hoàn thành",
    prescribedBy: "BS. CKI. Nguyễn Văn Hùng",
    notes: "Kháng sinh điều trị bội nhiễm vi khuẩn cơ hội ngoài da. Phải uống đủ liều đúng ngày.",
    warnings: "Không dùng nếu thú cưng có tiền sử dị ứng nhóm Penicillin/Cephalosporin.",
  },
  {
    id: "RX-2026-002",
    petId: "pet_1",
    recordId: "MED-2026-001",
    diseaseTitle: "Viêm da dị ứng tiếp xúc & Nhiễm nấm Malassezia",
    medicineName: "Sữa tắm trị nấm Malaseb 250ml",
    activeIngredient: "Chlorhexidine Gluconate 2% + Miconazole Nitrate 2%",
    category: "Sữa tắm dược liệu đặc trị",
    form: "Chai dung dịch 250ml",
    dosage: "Tắm 2 lần/tuần, lưu bọt 10 phút trên da trước khi xả",
    schedule: { morning: false, afternoon: true, evening: false },
    timing: "Tắm vào ban ngày, sấy khô lông thật kỹ",
    duration: "3 tuần",
    status: "Đang sử dụng",
    prescribedBy: "BS. CKI. Nguyễn Văn Hùng",
    notes: "Trị nấm men Malassezia và sát trùng vi khuẩn nang lông.",
    warnings: "Tránh để bọt xà phòng dây vào mắt và niêm mạc tai của bé.",
  },
  {
    id: "RX-2026-003",
    petId: "pet_1",
    recordId: "MED-2026-001",
    diseaseTitle: "Viêm da dị ứng tiếp xúc & Nhiễm nấm Malassezia",
    medicineName: "Dung dịch nhỏ tai Otoproct 15ml",
    activeIngredient: "Dexamethasone + Polymyxin B + Miconazole",
    category: "Thuốc nhỏ tai kháng viêm & diệt khuẩn",
    form: "Lọ nhỏ giọt 15ml",
    dosage: "Nhỏ 3 giọt mỗi bên tai x 1 lần/ngày",
    schedule: { morning: false, afternoon: false, evening: true },
    timing: "Nhỏ vào buổi tối sau khi đã vệ sinh sạch vành tai",
    duration: "5 ngày (15/10 - 20/10/2026)",
    status: "Đã hoàn thành",
    prescribedBy: "BS. CKI. Nguyễn Văn Hùng",
    notes: "Mát-xa nhẹ gốc tai sau khi nhỏ để thuốc thấm sâu vào ống tai.",
    warnings: "Không dùng nếu màng nhĩ bị rách.",
  },
  {
    id: "RX-2026-004",
    petId: "pet_1",
    recordId: "MED-2026-002",
    diseaseTitle: "Rối loạn tiêu hóa cấp do kích ứng thức ăn mới",
    medicineName: "Men vi sinh Enterogermina",
    activeIngredient: "Bào tử Bacillus clausii kháng đa kháng sinh 2 tỷ",
    category: "Men vi sinh tiêu hóa",
    form: "Hộp ống uống dạng hỗn dịch",
    dosage: "1 ống/ngày chia làm 2 cữ (Sáng 1/2 ống, Chiều 1/2 ống)",
    schedule: { morning: true, afternoon: true, evening: false },
    timing: "Uống cách bữa ăn 1 giờ",
    duration: "5 ngày (28/08 - 02/09/2026)",
    status: "Đã hoàn thành",
    prescribedBy: "BS. Lê Thị Thảo",
    notes: "Phục hồi hệ vi khuẩn có lợi đường ruột sau đợt nôn và tiêu chảy.",
    warnings: "Lắc đều ống thuốc trước khi bẻ uống.",
  },
  {
    id: "RX-2026-005",
    petId: "pet_1",
    recordId: "MED-2026-002",
    diseaseTitle: "Rối loạn tiêu hóa cấp do kích ứng thức ăn mới",
    medicineName: "Thuốc tráng dạ dày Phosphalugel",
    activeIngredient: "Aluminium phosphate dạng gel 20%",
    category: "Bảo vệ niêm mạc dạ dày",
    form: "Gói gel uống 20g",
    dosage: "1 gói/ngày chia 2 lần trước ăn 30 phút",
    schedule: { morning: true, afternoon: false, evening: true },
    timing: "Trước bữa ăn sáng và tối 30 phút",
    duration: "3 ngày (28/08 - 31/08/2026)",
    status: "Đã hoàn thành",
    prescribedBy: "BS. Lê Thị Thảo",
    notes: "Tạo lớp màng bảo vệ niêm mạc dạ dày khỏi axit dịch vị.",
    warnings: "Uống cách các thuốc khác tối thiểu 2 giờ.",
  },
  {
    id: "RX-2026-006",
    petId: "pet_1",
    recordId: "MED-2026-003",
    diseaseTitle: "Tiêm phòng định kỳ & Sổ giun chuyên sâu",
    medicineName: "Viên tẩy giun Drontal Plus",
    activeIngredient: "Febantel 150mg + Pyrantel embonate 144mg + Praziquantel 50mg",
    category: "Thuốc tẩy ký sinh trùng đường ruột",
    form: "Viên nén có mùi vị thịt bò",
    dosage: "2 viên uống trực tiếp 1 lần duy nhất",
    schedule: { morning: true, afternoon: false, evening: false },
    timing: "Uống vào buổi sáng cùng một mẩu thức ăn nhỏ",
    duration: "Định kỳ 3 tháng/lần",
    status: "Định kỳ",
    prescribedBy: "BS. CKI. Nguyễn Văn Hùng",
    notes: "Tẩy sạch giun đũa, giun móc, giun tóc và sán dây ở chó.",
    warnings: "Không sử dụng trong thời gian chó mẹ mang thai 2/3 thai kỳ đầu.",
  },

  // --- BÉ MIU MIU (pet_2) ---
  {
    id: "RX-2026-007",
    petId: "pet_2",
    recordId: "MED-2026-004",
    diseaseTitle: "Hội chứng viêm đường tiết niệu dưới ở mèo (FLUTD)",
    medicineName: "Siro giảm đau kháng viêm Meloxicam 0.5mg/ml",
    activeIngredient: "Meloxicam NSAID chuyên biệt cho mèo",
    category: "Kháng viêm & giảm đau đường tiết niệu",
    form: "Chai siro kèm ống bơm chia vạch",
    dosage: "0.2ml/ngày uống sau bữa ăn sáng",
    schedule: { morning: true, afternoon: false, evening: false },
    timing: "Trộn trực tiếp vào pate hoặc bơm khóe miệng sau ăn",
    duration: "4 ngày (20/09 - 24/09/2026)",
    status: "Đã hoàn thành",
    prescribedBy: "BS. Lê Thị Thảo",
    notes: "Làm dịu cơn đau buốt bàng quang, giúp mèo đi tiểu dễ dàng.",
    warnings: "Không dùng cho mèo bị suy thận cấp hoặc mất nước nặng.",
  },
  {
    id: "RX-2026-008",
    petId: "pet_2",
    recordId: "MED-2026-004",
    diseaseTitle: "Hội chứng viêm đường tiết niệu dưới ở mèo (FLUTD)",
    medicineName: "Viên uống bảo vệ bàng quang Cystease",
    activeIngredient: "N-acetyl D-glucosamine + L-tryptophan + Hyaluronic Acid",
    category: "Thực phẩm hỗ trợ niêm mạc bàng quang & an thần",
    form: "Viên nang mềm",
    dosage: "1 viên/ngày nghiền nhỏ trộn pate",
    schedule: { morning: false, afternoon: false, evening: true },
    timing: "Cho ăn cùng bữa pate buổi tối",
    duration: "21 ngày (20/09 - 11/10/2026)",
    status: "Đã hoàn thành",
    prescribedBy: "BS. Lê Thị Thảo",
    notes: "Bổ sung lớp màng Glycosaminoglycans (GAGs) bảo vệ vách bàng quang và giảm stress cho mèo.",
    warnings: "Bảo quản nơi khô ráo dưới 25°C.",
  },
  {
    id: "RX-2026-009",
    petId: "pet_2",
    recordId: "MED-2026-005",
    diseaseTitle: "Tiêm nhắc vaccine & Phòng ngừa ký sinh trùng",
    medicineName: "Thuốc nhỏ gáy Revolution Plus cho mèo",
    activeIngredient: "Selamectin 30mg + Sarolaner 5mg",
    category: "Phòng ngừa nội ngoại ký sinh trùng phổ rộng",
    form: "Tuýp bẻ nhỏ gáy 0.5ml",
    dosage: "1 tuýp nhỏ trực tiếp da sau gáy",
    schedule: { morning: false, afternoon: true, evening: false },
    timing: "Vạch lông sát da gáy và nhỏ hết thuốc",
    duration: "Định kỳ 1 tháng/lần",
    status: "Định kỳ",
    prescribedBy: "BS. CKI. Nguyễn Văn Hùng",
    notes: "Diệt bọ chét, ve rận, giun tim, ghẻ tai và giun móc, giun đũa.",
    warnings: "Không tắm trong 3 ngày sau khi nhỏ. Không để mèo khác liếm thuốc.",
  },
];

export function getStoredPrescriptions() {
  const data = getData(STORAGE_KEYS.PRESCRIPTIONS, null);
  if (data && Array.isArray(data) && data.length > 0) {
    return data;
  }
  setData(STORAGE_KEYS.PRESCRIPTIONS, DEFAULT_PRESCRIPTIONS);
  return DEFAULT_PRESCRIPTIONS;
}

export function setStoredPrescriptions(prescriptions) {
  setData(STORAGE_KEYS.PRESCRIPTIONS, prescriptions);
}
