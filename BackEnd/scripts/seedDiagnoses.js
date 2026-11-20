require("dotenv").config();
const dns = require("dns");
try {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
} catch (e) {}

const mongoose = require("mongoose");
const connectDB = require("../config/database");
const Diagnosis = require("../models/diagnosis");

const sampleDiagnoses = [
  // 1. Chẩn đoán da liễu cho Bé Bơ (pet_1)
  {
    diagnosisCode: "DIAG-2026-001",
    recordId: "MED-2026-001",
    petId: "pet_1",
    petName: "Bé Bơ",
    petSpecies: "Chó",
    petBreed: "Golden Retriever",
    date: "15/10/2026",
    dateISO: "2026-10-15",
    category: "Da liễu",
    status: "Đã hoàn thành",
    veterinarian: "BS. CKI. Nguyễn Văn Hùng",
    clinicBranch: "PawnCare 123 Nguyễn Văn Linh, Hải Châu, Đà Nẵng",
    reason: "Gãi nhiều vùng cổ và tai, rụng lông thành mảng đỏ, có vảy gàu li ti",
    symptoms: [
      "Ngứa ngáy dữ dội",
      "Rụng lông vùng cổ và vành tai",
      "Vảy gàu li ti",
      "Da ửng đỏ, có mùi men chua",
    ],
    vitalSigns: {
      temperature: 38.6,
      weight: 19.5,
      heartRate: 110,
      respiratoryRate: 24,
      mucousMembranes: "Hồng tươi",
      hydration: "Bình thường",
    },
    preliminaryDiagnosis:
      "Nghi ngờ viêm da do dị ứng thức ăn hoặc nhiễm nấm / ve mò Demodex",
    confirmedDiagnosis:
      "Viêm da dị ứng tiếp xúc (Allergic Contact Dermatitis) kết hợp nhiễm nấm men Malassezia thứ phát",
    diagnosticSummary:
      "Phản ứng dị ứng kết hợp bội nhiễm nấm men Malassezia vùng biểu bì ẩm, thể trạng chung ổn định, tiên lượng phục hồi tốt sau 3 tuần điều trị.",
    severity: "Trung bình",
    testResults: [
      {
        name: "Soi tươi biểu bì da cạo sâu",
        sample: "Mẫu biểu bì cổ & vành tai",
        result:
          "Phát hiện nhiều tế bào nấm Malassezia dạng hồ lô (++), âm tính với ve mò Demodex",
        status: "Bất thường",
        testedAt: "15/10/2026 09:30",
        notes: "Cần dùng sữa tắm kháng nấm chuyên dụng",
      },
      {
        name: "Tổng phân tích tế bào máu ngoại vi (CBC)",
        sample: "Máu tĩnh mạch cảnh",
        result:
          "Bạch cầu ái toan Eosinophil tăng nhẹ 8.2% (phản ứng dị ứng), các dòng khác bình thường",
        status: "Bình thường",
        testedAt: "15/10/2026 10:00",
        notes: "Đáp ứng dị ứng điển hình",
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
    treatmentPlan:
      "Vệ sinh tắm trị liệu 2 lần/tuần kết hợp kháng sinh đường uống 7 ngày. Tái khám sau 10 ngày để soi lại vi nấm.",
    doctorAdvice:
      "Chuyển khẩu phần ăn sang dòng Hypoallergenic (đạm thủy phân). Vệ sinh nệm nằm, phơi nắng định kỳ. Giữ nếp da vùng cổ khô ráo.",
    nextAppointment: "25/10/2026",
    totalCost: "520.000đ",
    isDeleted: false,
  },

  // 2. Chẩn đoán tiêu hóa cho Bé Bơ (pet_1)
  {
    diagnosisCode: "DIAG-2026-002",
    recordId: "MED-2026-002",
    petId: "pet_1",
    petName: "Bé Bơ",
    petSpecies: "Chó",
    petBreed: "Golden Retriever",
    date: "28/08/2026",
    dateISO: "2026-08-28",
    category: "Tiêu hóa",
    status: "Đã hoàn thành",
    veterinarian: "BS. Lê Thị Thảo",
    clinicBranch: "PawnCare 123 Nguyễn Văn Linh, Hải Châu, Đà Nẵng",
    reason: "Nôn thức ăn sau bữa tối, đi phân lỏng 2 lần, giảm ăn và hơi ủ rũ",
    symptoms: [
      "Nôn thức ăn chưa tiêu",
      "Đi phân lỏng màu vàng sệt",
      "Bụng chướng nhẹ, sôi ruột",
      "Giảm thèm ăn trong 12 giờ qua",
    ],
    vitalSigns: {
      temperature: 38.8,
      weight: 19.0,
      heartRate: 118,
      respiratoryRate: 26,
      mucousMembranes: "Hồng nhạt",
      hydration: "Mất nước nhẹ (nếp gấp da thu hồi sau 1 giây)",
    },
    preliminaryDiagnosis:
      "Viêm dạ dày - ruột cấp (Acute Gastroenteritis), loại trừ bệnh truyền nhiễm do Parvovirus",
    confirmedDiagnosis:
      "Rối loạn tiêu hóa cấp do kích ứng thức ăn chứa hàm lượng đạm cao đột ngột (Dyspepsia)",
    diagnosticSummary:
      "Dạ dày phù nề nhẹ do thay đổi thức ăn quá nhanh, ruột tăng nhu động nhẹ, không có dị vật cản quang. Đã loại trừ Parvo virus.",
    severity: "Nhẹ",
    testResults: [
      {
        name: "Test nhanh kháng nguyên Parvo & Corona virus",
        sample: "Dịch phết trực tràng",
        result: "Âm tính (-) với cả Parvo virus và Corona virus",
        status: "Bình thường",
        testedAt: "28/08/2026 14:15",
        notes: "An toàn về mặt truyền nhiễm",
      },
      {
        name: "Siêu âm ổ bụng tổng quát",
        sample: "Vùng bụng trên & ruột non",
        result:
          "Thành dạ dày phù nề nhẹ, quai ruột có nhiều hơi và dịch lỏng, không thấy sỏi hay dị vật",
        status: "Bình thường",
        testedAt: "28/08/2026 14:40",
        notes: "Theo dõi nhu động ruột",
      },
    ],
    prescription: [
      {
        name: "Men vi sinh Enterogermina",
        active: "Bào tử Bacillus clausii",
        dosage: "1 ống/ngày chia làm 2 lần uống",
        duration: "5 ngày",
        notes: "Uống cách xa bữa ăn 1 giờ để tái lập hệ vi sinh",
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
        notes: "Cho uống từng lượng nhỏ, không ép dồn dập",
      },
    ],
    treatmentPlan:
      "Bù nước điện giải, làm dịu niêm mạc tiêu hóa, ăn cháo loãng thịt nạc trong 48 giờ.",
    doctorAdvice:
      "Nấu cháo thịt nạc băm loãng cho ăn làm nhiều bữa nhỏ trong 2 ngày đầu. Tránh hoàn toàn sữa tươi và thức ăn nhiều dầu mỡ.",
    nextAppointment: "02/09/2026",
    totalCost: "350.000đ",
    isDeleted: false,
  },

  // 3. Chẩn đoán tiết niệu cho Miu Miu (pet_2)
  {
    diagnosisCode: "DIAG-2026-003",
    recordId: "MED-2026-004",
    petId: "pet_2",
    petName: "Miu Miu",
    petSpecies: "Mèo",
    petBreed: "Mèo Anh lông ngắn",
    date: "20/09/2026",
    dateISO: "2026-09-20",
    category: "Tiết niệu",
    status: "Đã hoàn thành",
    veterinarian: "BS. Lê Thị Thảo",
    clinicBranch: "PawnCare 123 Nguyễn Văn Linh, Hải Châu, Đà Nẵng",
    reason:
      "Đi vệ sinh khay cát nhiều lần nhưng tiểu rất ít, rên rỉ khi tiểu, liên tục liếm vùng sinh dục",
    symptoms: [
      "Tiểu rắt, tiểu khó",
      "Tiểu nhiều lần lượng nhỏ giọt",
      "Liếm lông vùng sinh dục liên tục",
      "Căng thẳng bồn chồn khi vào khay cát",
    ],
    vitalSigns: {
      temperature: 38.7,
      weight: 4.2,
      heartRate: 145,
      respiratoryRate: 28,
      mucousMembranes: "Hồng",
      hydration: "Mất nước nhẹ",
    },
    preliminaryDiagnosis:
      "Nghi ngờ sỏi bàng quang hoặc viêm bàng quang kẽ vô căn ở mèo (FIC)",
    confirmedDiagnosis:
      "Viêm bàng quang vô căn thể không tắc nghẽn (Feline Idiopathic Cystitis - FIC) do stress môi trường",
    diagnosticSummary:
      "Thành bàng quang dày 2.8mm do viêm vô căn, chưa có sỏi cản quang hay tắc nghẽn niệu đạo. Phản ứng tốt với phác đồ giảm đau và bổ sung GAGs.",
    severity: "Trung bình",
    testResults: [
      {
        name: "Tổng phân tích nước tiểu & Soi cặn lắng",
        sample: "Nước tiểu chọc hút bàng quang",
        result:
          "pH 6.8, bạch cầu vi thể (+), protein vết, không thấy tinh thể sỏi Struvite",
        status: "Bình thường",
        testedAt: "20/09/2026 10:15",
        notes: "Không có dấu hiệu nhiễm khuẩn nặng",
      },
      {
        name: "Siêu âm hệ tiết niệu và bàng quang",
        sample: "Vùng hạ vị",
        result:
          "Thành bàng quang dày 2.8mm, lòng bàng quang có cặn giả mạc mỏng, không có sỏi cản quang",
        status: "Bất thường",
        testedAt: "20/09/2026 10:45",
        notes: "Viêm thành bàng quang thể FIC",
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
    treatmentPlan:
      "Kháng viêm giảm đau, giảm stress môi trường, tăng cường bổ sung nước qua pate ướt và đài phun nước.",
    doctorAdvice:
      "Lắp đặt đài phun nước tự động kích thích mèo uống nước nhiều hơn. Tăng tỷ lệ thức ăn ướt. Giữ khay cát luôn sạch sẽ, đặt nơi yên tĩnh.",
    nextAppointment: "05/10/2026",
    totalCost: "420.000đ",
    isDeleted: false,
  },
];

async function seed() {
  try {
    await connectDB();
    console.log("-> Đang nạp dữ liệu chẩn đoán mẫu vào MongoDB...");

    for (const item of sampleDiagnoses) {
      await Diagnosis.findOneAndUpdate(
        { diagnosisCode: item.diagnosisCode },
        { $set: item },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      console.log(`✓ Đã nạp hồ sơ chẩn đoán: [${item.diagnosisCode}] - ${item.petName} (${item.confirmedDiagnosis})`);
    }

    console.log("-> Hoàn tất nạp dữ liệu chẩn đoán (Diagnosis)!");
    process.exit(0);
  } catch (err) {
    console.error("X Lỗi nạp dữ liệu chẩn đoán:", err.message);
    process.exit(1);
  }
}

seed();
