const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
const dns = require("dns");
try {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
} catch (e) {}

const mongoose = require("mongoose");
const connectDB = require("../config/database");
const Prescription = require("../models/prescription");
const ReExamination = require("../models/reExamination");

const samplePrescriptions = [
  {
    prescriptionCode: "RX-2026-001",
    petId: "pet_1",
    petName: "Bé Bơ",
    petSpecies: "Chó",
    recordCode: "MED-2026-001",
    date: "15/10/2026",
    dateISO: "2026-10-15",
    title: "Đơn thuốc đặc trị Viêm da & Nhiễm nấm Malassezia",
    diagnosis: "Viêm da dị ứng tiếp xúc kết hợp nhiễm nấm men Malassezia",
    veterinarian: "BS. CKI. Nguyễn Văn Hùng",
    clinicBranch: "PawnCare 123 Nguyễn Văn Linh, Hải Châu, Đà Nẵng",
    status: "Đã hoàn thành",
    medicines: [
      {
        name: "Cefalexin 250mg",
        active: "Cephalosporin thế hệ 1",
        dosage: "1 viên x 2 lần/ngày sau khi ăn",
        duration: "7 ngày",
        instructions: "Kháng sinh chống bội nhiễm vi khuẩn cơ hội",
        quantity: "14 viên",
        price: "140.000đ",
      },
      {
        name: "Sữa tắm trị nấm Malaseb 250ml",
        active: "Chlorhexidine + Miconazole",
        dosage: "Tắm 2 lần/tuần, lưu bọt 10 phút trước khi xả sạch",
        duration: "3 tuần",
        instructions: "Tránh để bọt tiếp xúc vào mắt và niêm mạc tai",
        quantity: "1 chai",
        price: "260.000đ",
      },
      {
        name: "Dung dịch vệ sinh tai Otoproct 15ml",
        active: "Dexamethasone + Polymyxin B",
        dosage: "Nhỏ 3 giọt mỗi bên tai ngày 1 lần",
        duration: "5 ngày",
        instructions: "Mát-xa nhẹ gốc tai, dùng bông mềm lau sạch cặn bẩn",
        quantity: "1 lọ",
        price: "120.000đ",
      },
    ],
    doctorAdvice:
      "Chuyển khẩu phần ăn sang dòng Hypoallergenic. Giữ nếp da vùng cổ khô ráo.",
    totalCost: "520.000đ",
    notes: "Bé đáp ứng tốt, không có dấu hiệu dị ứng thuốc.",
    isDeleted: false,
  },
  {
    prescriptionCode: "RX-2026-002",
    petId: "pet_1",
    petName: "Bé Bơ",
    petSpecies: "Chó",
    recordCode: "MED-2026-002",
    date: "28/08/2026",
    dateISO: "2026-08-28",
    title: "Đơn thuốc hỗ trợ phục hồi Rối loạn tiêu hóa cấp",
    diagnosis: "Rối loạn tiêu hóa cấp do kích ứng thức ăn mới",
    veterinarian: "BS. Lê Thị Thảo",
    clinicBranch: "PawnCare 123 Nguyễn Văn Linh, Hải Châu, Đà Nẵng",
    status: "Đã hoàn thành",
    medicines: [
      {
        name: "Men vi sinh Enterogermina",
        active: "Bào tử Bacillus clausii",
        dosage: "1 ống/ngày chia làm 2 lần uống",
        duration: "5 ngày",
        instructions: "Uống cách xa thời gian ăn 1 giờ để tái lập hệ vi sinh",
        quantity: "5 ống",
        price: "150.000đ",
      },
      {
        name: "Thuốc tráng niêm mạc Phosphalugel",
        active: "Aluminium phosphate",
        dosage: "1 gói/ngày trước bữa ăn 30 phút",
        duration: "3 ngày",
        instructions: "Làm dịu niêm mạc dạ dày và chống trào ngược",
        quantity: "3 gói",
        price: "200.000đ",
      },
    ],
    doctorAdvice: "Nấu cháo thịt nạc băm loãng cho ăn làm nhiều bữa nhỏ trong 2 ngày đầu.",
    totalCost: "350.000đ",
    notes: "Theo dõi phản ứng nôn sau dùng thuốc.",
    isDeleted: false,
  },
  {
    prescriptionCode: "RX-2026-003",
    petId: "pet_2",
    petName: "Miu Miu",
    petSpecies: "Mèo",
    recordCode: "MED-2026-004",
    date: "20/09/2026",
    dateISO: "2026-09-20",
    title: "Đơn thuốc điều trị Viêm bàng quang & Cặn sỏi Struvite",
    diagnosis: "Hội chứng viêm đường tiết niệu dưới ở mèo (FLUTD)",
    veterinarian: "BS. CKI. Nguyễn Văn Hùng",
    clinicBranch: "PawnCare 123 Nguyễn Văn Linh, Hải Châu, Đà Nẵng",
    status: "Đang sử dụng",
    medicines: [
      {
        name: "Kháng sinh Marbofloxacin 20mg",
        active: "Marbofloxacin (Fluoroquinolone)",
        dosage: "1/2 viên x 1 lần/ngày",
        duration: "10 ngày",
        instructions: "Uống vào buổi sáng cùng một lượng thức ăn nhỏ",
        quantity: "5 viên",
        price: "280.000đ",
      },
      {
        name: "Gel dinh dưỡng hỗ trợ tan sỏi Uro-Pet 120g",
        active: "DL-Methionine (Axit hóa nước tiểu)",
        dosage: "1 muỗng cà phê (5g) trộn vào pate hàng ngày",
        duration: "30 ngày",
        instructions: "Kiểm soát đưa pH nước tiểu về mức lý tưởng 6.0 - 6.5",
        quantity: "1 tuýp",
        price: "400.000đ",
      },
    ],
    doctorAdvice:
      "Bắt buộc đổi sang hạt Royal Canin Urinary S/O. Đặt thêm đài phun nước tự động.",
    totalCost: "680.000đ",
    notes: "Uống đủ nước mỗi ngày để tăng đào thải cặn sỏi.",
    isDeleted: false,
  },
  {
    prescriptionCode: "RX-2026-004",
    petId: "pet_1",
    petName: "Bé Bơ",
    petSpecies: "Chó",
    date: "05/11/2026",
    dateISO: "2026-11-05",
    title: "Đơn bổ sung vi chất dinh dưỡng và chăm sóc lông da",
    diagnosis: "Chăm sóc phục hồi sau điều trị da liễu",
    veterinarian: "BS. CKI. Nguyễn Văn Hùng",
    clinicBranch: "PawnCare 123 Nguyễn Văn Linh, Hải Châu, Đà Nẵng",
    status: "Đang sử dụng",
    medicines: [
      {
        name: "Dầu cá hồi hữu cơ Salmon Oil 250ml",
        active: "Omega-3, EPA & DHA",
        dosage: "2 lần xịt vào thức ăn mỗi ngày",
        duration: "30 ngày",
        instructions: "Hỗ trợ dưỡng da mượt lông và chống viêm tự nhiên",
        quantity: "1 chai",
        price: "220.000đ",
      },
      {
        name: "Viên men bia Pet Naturals Daily Probiotic",
        active: "Bacillus coagulans & FOS",
        dosage: "1 viên/ngày",
        duration: "30 ngày",
        instructions: "Tăng cường miễn dịch và hấp thu dinh dưỡng",
        quantity: "1 lọ",
        price: "100.000đ",
      },
    ],
    doctorAdvice: "Bảo quản dầu cá nơi khô mát, tránh ánh nắng trực tiếp.",
    totalCost: "320.000đ",
    notes: "Đơn bổ sung dinh dưỡng định kỳ.",
    isDeleted: false,
  },
  {
    prescriptionCode: "RX-2026-693",
    petId: "6afb3d4929cc539c893f82d3",
    petName: "Huy",
    petSpecies: "Chó",
    recordCode: "MED-2026-693",
    date: "17/11/2026",
    dateISO: "2026-11-17",
    title: "Đơn thuốc hỗ trợ điều trị Bệnh Dại",
    diagnosis: "Bệnh Dại lâu ngày",
    veterinarian: "BS. Trần Minh Trí",
    clinicBranch: "PawnCare 123 Nguyễn Văn Linh, Hải Châu, Đà Nẵng",
    status: "Đang sử dụng",
    medicines: [
      {
        name: "Thuốc bổ & Kháng viêm dịu nhẹ",
        active: "Vitamin tổng hợp",
        dosage: "1 viên/ngày",
        duration: "5 ngày",
        instructions: "Uống sau ăn",
        quantity: "5 viên",
        price: "150.000đ",
      },
    ],
    doctorAdvice: "Theo dõi thường xuyên",
    totalCost: "350.000đ",
    notes: "Theo dõi phản xạ thần kinh và uống nhiều nước.",
    isDeleted: false,
  },
  {
    prescriptionCode: "RX-2026-702",
    petId: "6afb3068c2cd9645011c3ecc",
    petName: "Thịnh",
    petSpecies: "Chó",
    recordCode: "MED-2026-702",
    date: "16/11/2026",
    dateISO: "2026-11-16",
    title: "Đơn thuốc vệ sinh răng miệng & men tiêu hóa",
    diagnosis: "Viêm nướu nhẹ do mảng bám vôi răng",
    veterinarian: "BS. CKI. Nguyễn Văn Hùng",
    clinicBranch: "PawnCare 123 Nguyễn Văn Linh, Hải Châu, Đà Nẵng",
    status: "Đã hoàn thành",
    medicines: [
      {
        name: "Gel xịt thơm miệng diệt khuẩn Orozyme",
        active: "Enzyme tự nhiên",
        dosage: "Xịt 1 lần/ngày vào nướu",
        duration: "14 ngày",
        instructions: "Không cho uống nước trong 30 phút sau xịt",
        quantity: "1 chai",
        price: "180.000đ",
      },
    ],
    doctorAdvice: "Đánh răng cho bé 2-3 lần/tuần bằng kem đánh răng thú cưng chuyên dụng.",
    totalCost: "180.000đ",
    notes: "Tái khám sau 1 tháng.",
    isDeleted: false,
  },
];

const sampleReExaminations = [
  {
    reExamCode: "RE-2026-001",
    petId: "pet_1",
    petName: "Bé Bơ",
    petSpecies: "Chó",
    recordCode: "MED-2026-001",
    reExamDate: "25/10/2026",
    dateISO: "2026-10-25",
    title: "Tái khám theo dõi viêm da và nấm Malassezia",
    veterinarian: "BS. CKI. Nguyễn Văn Hùng",
    clinicBranch: "PawnCare 123 Nguyễn Văn Linh, Hải Châu, Đà Nẵng",
    recoveryStatus: "Hồi phục hoàn toàn",
    vitalSigns: {
      temperature: 38.5,
      weight: 19.8,
      heartRate: 105,
      respiratoryRate: 22,
      mucousMembranes: "Hồng hào",
      hydration: "Bình thường",
    },
    examinationNotes:
      "Vùng cổ và vành tai đã mọc lông tơ trở lại, da không còn vảy gàu và hết mùi men chua. Bé không còn cào gãi.",
    treatmentResult:
      "Nấm Malassezia đã được tiêu diệt hoàn toàn qua soi tươi cạo sâu. Đáp ứng xuất sắc với liệu trình điều trị.",
    doctorAdvice:
      "Duy trì tắm dưỡng 1 lần/tuần, tiếp tục duy trì chế độ ăn Hypoallergenic.",
    prescriptionCode: "RX-2026-001",
    nextAppointment: "",
    status: "Đã khám",
    isDeleted: false,
  },
  {
    reExamCode: "RE-2026-002",
    petId: "pet_1",
    petName: "Bé Bơ",
    petSpecies: "Chó",
    recordCode: "MED-2026-002",
    reExamDate: "02/09/2026",
    dateISO: "2026-09-02",
    title: "Tái khám kiểm tra chức năng tiêu hóa",
    veterinarian: "BS. Lê Thị Thảo",
    clinicBranch: "PawnCare 123 Nguyễn Văn Linh, Hải Châu, Đà Nẵng",
    recoveryStatus: "Hồi phục hoàn toàn",
    vitalSigns: {
      temperature: 38.4,
      weight: 19.2,
      heartRate: 108,
      respiratoryRate: 24,
      mucousMembranes: "Hồng hào",
      hydration: "Bình thường",
    },
    examinationNotes:
      "Phân đã thành khuôn tốt, không còn nôn, bụng mềm không chướng, ăn uống bình thường trở lại.",
    treatmentResult:
      "Hệ vi sinh đường ruột đã ổn định hoàn toàn sau đợt viêm cấp.",
    doctorAdvice:
      "Có thể chuyển dần lại khẩu phần ăn tiêu chuẩn, theo dõi khi dùng thức ăn mới.",
    prescriptionCode: "RX-2026-002",
    nextAppointment: "",
    status: "Đã khám",
    isDeleted: false,
  },
  {
    reExamCode: "RE-2026-003",
    petId: "pet_2",
    petName: "Miu Miu",
    petSpecies: "Mèo",
    recordCode: "MED-2026-004",
    reExamDate: "30/09/2026",
    dateISO: "2026-09-30",
    title: "Tái khám theo dõi viêm bàng quang & cặn sỏi Struvite",
    veterinarian: "BS. CKI. Nguyễn Văn Hùng",
    clinicBranch: "PawnCare 123 Nguyễn Văn Linh, Hải Châu, Đà Nẵng",
    recoveryStatus: "Tiến triển tốt",
    vitalSigns: {
      temperature: 38.6,
      weight: 4.3,
      heartRate: 130,
      respiratoryRate: 28,
      mucousMembranes: "Hồng hào",
      hydration: "Bình thường",
    },
    examinationNotes:
      "Bé đi tiểu dễ hơn, lượng nước tiểu tăng, không còn rên rỉ khi rặn, nước tiểu trong và không còn ánh hồng máu.",
    treatmentResult:
      "Viêm bàng quang giảm đáng kể, tinh thể Struvite trong cặn lắng giảm 70%. pH nước tiểu đạt 6.5.",
    doctorAdvice:
      "Tiếp tục dùng gel Uro-Pet thêm 15 ngày, ăn hạt chuyên dụng và hẹn tái khám đánh giá lại.",
    prescriptionCode: "RX-2026-003",
    nextAppointment: "15/10/2026",
    status: "Đã khám",
    isDeleted: false,
  },
  {
    reExamCode: "RE-2026-693",
    petId: "6afb3d4929cc539c893f82d3",
    petName: "Huy",
    petSpecies: "Chó",
    recordCode: "MED-2026-693",
    reExamDate: "18/11/2026",
    dateISO: "2026-11-18",
    title: "Tái khám theo dõi Bệnh Dại",
    veterinarian: "BS. Trần Minh Trí",
    clinicBranch: "PawnCare 123 Nguyễn Văn Linh, Hải Châu, Đà Nẵng",
    recoveryStatus: "Cần tiếp tục theo dõi",
    vitalSigns: {
      temperature: 38.5,
      weight: 6.0,
      heartRate: 110,
      respiratoryRate: 24,
      mucousMembranes: "Hồng hào",
      hydration: "Bình thường",
    },
    examinationNotes: "Bé còn sợ ánh sáng và tiếng động mạnh, ăn uống ít.",
    treatmentResult: "Cần tiếp tục cách ly theo dõi trong phòng tĩnh.",
    doctorAdvice: "Theo dõi thường xuyên",
    prescriptionCode: "RX-2026-693",
    nextAppointment: "25/11/2026",
    status: "Đã khám",
    isDeleted: false,
  },
  {
    reExamCode: "RE-2026-702",
    petId: "6afb3068c2cd9645011c3ecc",
    petName: "Thịnh",
    petSpecies: "Chó",
    recordCode: "MED-2026-702",
    reExamDate: "16/12/2026",
    dateISO: "2026-12-16",
    title: "Tái khám răng miệng định kỳ",
    veterinarian: "BS. CKI. Nguyễn Văn Hùng",
    clinicBranch: "PawnCare 123 Nguyễn Văn Linh, Hải Châu, Đà Nẵng",
    recoveryStatus: "Tiến triển tốt",
    vitalSigns: {
      temperature: 38.4,
      weight: 6.6,
      heartRate: 110,
      respiratoryRate: 22,
      mucousMembranes: "Hồng tươi",
      hydration: "Bình thường",
    },
    examinationNotes: "Nướu hồng hào, hơi thở thơm tho, không còn cặn vôi răng.",
    treatmentResult: "Mảng bám răng đã sạch, nướu hết viêm đỏ.",
    doctorAdvice: "Duy trì đánh răng hàng tuần.",
    prescriptionCode: "RX-2026-702",
    nextAppointment: "",
    status: "Chờ khám",
    isDeleted: false,
  },
];

async function seedData() {
  try {
    await connectDB();
    console.log("Đang đồng bộ dữ liệu vào Database:", mongoose.connection.name);

    await Prescription.init();
    await ReExamination.init();
    console.log("✓ Đã khởi tạo Indexes cho Prescription và ReExamination");

    // Nạp Prescriptions
    for (const rx of samplePrescriptions) {
      await Prescription.findOneAndUpdate(
        { prescriptionCode: rx.prescriptionCode },
        { $set: rx },
        { upsert: true, new: true }
      );
    }
    console.log(`✓ Đã nạp ${samplePrescriptions.length} đơn thuốc vào collection "prescriptions"`);

    // Nạp ReExaminations
    for (const re of sampleReExaminations) {
      await ReExamination.findOneAndUpdate(
        { reExamCode: re.reExamCode },
        { $set: re },
        { upsert: true, new: true }
      );
    }
    console.log(`✓ Đã nạp ${sampleReExaminations.length} lịch sử tái khám vào collection "reExaminations"`);

    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log("\nDANH SÁCH COLLECTIONS HIỆN TẠI TRÊN MONGODB:");
    collections.forEach((c) => console.log(` - ${c.name}`));

    await mongoose.connection.close();
    console.log("\n=> HOÀN TẤT SEED DỮ LIỆU ĐƠN THUỐC VÀ LỊCH SỬ TÁI KHÁM!");
  } catch (err) {
    console.error("Lỗi khi nạp dữ liệu:", err);
    process.exit(1);
  }
}

seedData();
