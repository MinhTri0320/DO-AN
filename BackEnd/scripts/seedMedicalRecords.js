require("dotenv").config();
const dns = require("dns");
try {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
} catch (e) {}

const mongoose = require("mongoose");
const connectDB = require("../config/database");
const MedicalRecord = require("../models/medicalRecord");
const PetHealthProfile = require("../models/petHealthProfile");

const sampleHealthProfiles = [
  {
    petId: "pet_1",
    bloodType: "DEA 1.1 Dương tính",
    microchip: "985141002348912",
    allergies: "Dị ứng thịt gà công nghiệp & kháng sinh Penicillin",
    chronicConditions: "Không có bệnh mãn tính",
    sterilized: "Đã triệt sản",
    vaccinationStatus: "Đã tiêm phòng đủ (Hạn đến 05/2027)",
    dewormingStatus: "Đã tẩy giun (Hạn đến 11/2026)",
    overallStatus: "Khỏe mạnh",
  },
  {
    petId: "pet_2",
    bloodType: "Nhóm A (Mèo)",
    microchip: "985141005891244",
    allergies: "Chưa ghi nhận dị ứng",
    chronicConditions: "Cơ địa bàng quang nhạy cảm, dễ kết tủa tinh thể Struvite",
    sterilized: "Chưa triệt sản",
    vaccinationStatus: "Đã tiêm phòng đủ (Hạn đến 10/2027)",
    dewormingStatus: "Đã nhỏ gáy Revolution Plus (Hạn đến 11/2026)",
    overallStatus: "Cần theo dõi",
  },
];

const sampleMedicalRecords = [
  {
    recordCode: "MED-2026-001",
    petId: "pet_1",
    petName: "Bé Bơ",
    petSpecies: "Chó",
    petBreed: "Golden Retriever",
    date: "15/10/2026",
    dateISO: "2026-10-15",
    title: "Viêm da dị ứng tiếp xúc & Nhiễm nấm Malassezia",
    category: "Da liễu",
    status: "Đã hoàn thành",
    veterinarian: "BS. CKI. Nguyễn Văn Hùng",
    clinicBranch: "PawnCare 123 Nguyễn Văn Linh, Hải Châu, Đà Nẵng",
    reason: "Gãi nhiều vùng cổ và tai, rụng lông thành mảng đỏ, có vảy gàu li ti",
    vitalSigns: {
      temperature: 38.6,
      weight: 19.5,
      heartRate: 110,
      respiratoryRate: 24,
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
    isDeleted: false,
  },
  {
    recordCode: "MED-2026-002",
    petId: "pet_1",
    petName: "Bé Bơ",
    petSpecies: "Chó",
    petBreed: "Golden Retriever",
    date: "28/08/2026",
    dateISO: "2026-08-28",
    title: "Rối loạn tiêu hóa cấp tính do kích ứng thức ăn mới",
    category: "Tiêu hóa",
    status: "Đã hoàn thành",
    veterinarian: "BS. Lê Thị Thảo",
    clinicBranch: "PawnCare 123 Nguyễn Văn Linh, Hải Châu, Đà Nẵng",
    reason: "Nôn thức ăn sau bữa tối, đi phân lỏng 2 lần, giảm ăn và hơi ủ rũ",
    vitalSigns: {
      temperature: 38.8,
      weight: 19.0,
      heartRate: 118,
      respiratoryRate: 26,
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
    ],
    doctorAdvice: "Nấu cháo thịt nạc băm loãng cho ăn làm nhiều bữa nhỏ trong 2 ngày đầu. Tránh hoàn toàn sữa tươi và thức ăn nhiều dầu mỡ.",
    nextAppointment: "02/09/2026",
    totalCost: "350.000đ",
    isDeleted: false,
  },
  {
    recordCode: "MED-2026-004",
    petId: "pet_2",
    petName: "Miu Miu",
    petSpecies: "Mèo",
    petBreed: "Mèo Anh lông ngắn",
    date: "20/09/2026",
    dateISO: "2026-09-20",
    title: "Hội chứng viêm đường tiết niệu dưới ở mèo (FLUTD)",
    category: "Tiết niệu",
    status: "Đang điều trị",
    veterinarian: "BS. CKI. Nguyễn Văn Hùng",
    clinicBranch: "PawnCare 123 Nguyễn Văn Linh, Hải Châu, Đà Nẵng",
    reason: "Đi khay cát nhiều lần nhưng chỉ nhỏ giọt, rặn tiểu rên rỉ, liếm vùng kín liên tục",
    vitalSigns: {
      temperature: 38.9,
      weight: 4.2,
      heartRate: 140,
      respiratoryRate: 32,
      mucousMembranes: "Hồng nhạt",
      hydration: "Bình thường",
    },
    symptoms: [
      "Tiểu rắt, tiểu khó (Stranguria)",
      "Nước tiểu màu hồng nhạt có lẫn tia máu (Hematuria)",
      "Liếm lông vùng sinh dục quá mức",
    ],
    preliminaryDiagnosis: "Viêm bàng quang vô căn hoặc sỏi tiết niệu gây tắc nghẽn bán phần (FLUTD)",
    confirmedDiagnosis: "Viêm bàng quang cấp có cặn tinh thể Struvite (Feline Idiopathic Cystitis with Struvite Crystalluria)",
    testResults: [
      {
        name: "Tổng phân tích nước tiểu 10 thông số & Soi cặn lắng",
        sample: "Nước tiểu lấy bằng chọc dò bàng quang (Cystocentesis)",
        result: "pH = 7.5 (Kiềm hóa), Protein (++), Hồng cầu (+++), phát hiện tinh thể Struvite hình nắp quan tài",
        status: "Bất thường",
      },
    ],
    prescription: [
      {
        name: "Kháng sinh Marbofloxacin 20mg",
        active: "Marbofloxacin (Fluoroquinolone)",
        dosage: "1/2 viên x 1 lần/ngày",
        duration: "10 ngày",
        notes: "Uống vào buổi sáng cùng một lượng thức ăn nhỏ",
      },
      {
        name: "Gel dinh dưỡng hỗ trợ tan sỏi Uro-Pet 120g",
        active: "DL-Methionine (Axit hóa nước tiểu)",
        dosage: "1 muỗng cà phê (5g) trộn vào pate hàng ngày",
        duration: "30 ngày",
        notes: "Kiểm soát đưa pH nước tiểu về mức lý tưởng 6.0 - 6.5",
      },
    ],
    doctorAdvice: "Bắt buộc đổi sang hạt Royal Canin Urinary S/O. Đặt thêm đài phun nước tự động để kích thích bé uống nhiều nước.",
    nextAppointment: "30/09/2026",
    totalCost: "680.000đ",
    isDeleted: false,
  },
];

async function seedData() {
  try {
    await connectDB();
    console.log("Đang đồng bộ dữ liệu vào Database:", mongoose.connection.name);

    // 1. Tạo indexes cho cả 2 models
    await PetHealthProfile.init();
    await MedicalRecord.init();
    console.log("✓ Đã khởi tạo Indexes cho PetHealthProfile và MedicalRecord");

    // 2. Upsert PetHealthProfile
    for (const profile of sampleHealthProfiles) {
      await PetHealthProfile.findOneAndUpdate(
        { petId: profile.petId },
        { $set: profile },
        { upsert: true, new: true }
      );
    }
    console.log(`✓ Đã nạp ${sampleHealthProfiles.length} hồ sơ sức khỏe vào collection "petHealthProfiles"`);

    // 3. Upsert MedicalRecord
    for (const record of sampleMedicalRecords) {
      await MedicalRecord.findOneAndUpdate(
        { recordCode: record.recordCode },
        { $set: record },
        { upsert: true, new: true }
      );
    }
    console.log(`✓ Đã nạp ${sampleMedicalRecords.length} bệnh án vào collection "medicalRecords"`);

    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log("\nDANH SÁCH COLLECTIONS HIỆN TẠI TRÊN MONGODB ATLAS:");
    collections.forEach((c) => console.log(` - ${c.name}`));

    await mongoose.connection.close();
    console.log("\n=> HOÀN TẤT! Bạn hãy tải lại (Refresh) trang MongoDB Atlas để thấy các collection mới.");
  } catch (err) {
    console.error("Lỗi khi nạp dữ liệu lên Atlas:", err);
    process.exit(1);
  }
}

seedData();
