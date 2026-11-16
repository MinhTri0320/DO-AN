/**
 * ============================================================================
 * PAWNCARE PET HEALTHCARE SYSTEM - DATABASE MODULE
 * SPRINT 3 TASK: Medical Record (Hồ sơ bệnh án điện tử thú cưng)
 * Người thực hiện phụ trách DataBase: Trần Minh Trí
 * 
 * PHẦN 2: TẬP HỢP CÁC TRUY VẤN DỮ LIỆU & PHÂN TÍCH (QUERIES & AGGREGATIONS)
 * Đáp ứng checklist: [x] Truy vấn Medical Record (Trí)
 * ============================================================================
 */

const dbName = "pawncare";
db = db.getSiblingDB(dbName);

print(`[DATABASE QUERIES] Đang thực thi các truy vấn nghiệp vụ Medical Record trên database: ${dbName}...\n`);


/* ============================================================================
 * MỤC 1: CÁC THAO TÁC LƯU TRỮ & CẬP NHẬT (INSERT / UPDATE / UPSERT / SOFT-DELETE)
 * ============================================================================ */

/**
 * 1.1. Thêm mới một hồ sơ bệnh án (Insert New Medical Record)
 * Tình huống: Bác sĩ hoàn thành khám cho thú cưng và lưu hồ sơ vào hệ thống.
 */
print("--- [1.1] THÊM MỚI BỆNH ÁN KHÁM BỆNH ---");
const newRecordResult = db.medical_records.insertOne({
  recordCode: "MED-2026-005",
  petId: "pet_1",
  petName: "Bé Bơ",
  petSpecies: "Chó",
  petBreed: "Golden Retriever",
  date: "16/11/2026",
  dateISO: "2026-11-16",
  title: "Khám định kỳ răng miệng & Cạo vôi răng sóng siêu âm",
  category: "Mắt - Tai - Mũi",
  status: "Đang điều trị",
  veterinarian: "BS. CKI. Nguyễn Văn Hùng",
  clinicBranch: "PawnCare 123 Nguyễn Văn Linh, Hải Châu, Đà Nẵng",
  reason: "Hơi thở có mùi hôi, nướu răng ửng đỏ nhẹ",
  vitalSigns: {
    temperature: 38.5,
    weight: 19.8,
    heartRate: 108,
    respiratoryRate: 22,
    mucousMembranes: "Hồng hào",
    hydration: "Bình thường"
  },
  symptoms: [
    "Cao răng bám mảng dày ở răng nanh và hàm trên",
    "Viêm nướu độ 1 (Gingivitis)"
  ],
  preliminaryDiagnosis: "Viêm nha chu giai đoạn sớm do mảng bám vôi răng",
  confirmedDiagnosis: "Viêm nướu răng độ 1, tích tụ mảng bám cao răng nặng",
  testResults: [
    {
      name: "Thử máu nhanh trước tiền mê nhẹ",
      sample: "Máu toàn phần",
      result: "Chức năng gan thận (ALT, Creatinine) trong ngưỡng an toàn",
      status: "Bình thường"
    }
  ],
  prescription: [
    {
      name: "Gel bôi nha chu Orozyme",
      active: "Enzyme tự nhiên kháng khuẩn",
      dosage: "Bôi trực tiếp vào viền nướu ngày 1 lần sau ăn tối",
      duration: "14 ngày",
      notes: "Không cần súc miệng lại với nước"
    }
  ],
  doctorAdvice: "Vệ sinh răng miệng định kỳ bằng bàn chải mềm 3 lần/tuần. Hạn chế cho ăn tinh bột dính.",
  nextAppointment: "30/11/2026",
  totalCost: "450.000đ",
  isDeleted: false,
  createdAt: new Date(),
  updatedAt: new Date()
});
print(`Đã tạo bệnh án mới với mã ID: ${newRecordResult.insertedId}`);


/**
 * 1.2. Lưu / Cập nhật Hồ sơ sức khỏe nền (Upsert Pet Health Profile)
 * Tình huống: Cập nhật thông tin dị ứng mới phát hiện hoặc số vi mạch microchip.
 */
print("\n--- [1.2] CẬP NHẬT HỒ SƠ SỨC KHỎE NỀN (UPSERT) ---");
db.pet_health_profiles.updateOne(
  { petId: "pet_1" },
  {
    $set: {
      allergies: "Dị ứng thịt gà công nghiệp, kháng sinh Penicillin và tôm biển",
      overallStatus: "Khỏe mạnh",
      updatedAt: new Date()
    }
  },
  { upsert: true }
);
print("Đã cập nhật thông tin dị ứng cho thú cưng pet_1 thành công.");


/**
 * 1.3. Bổ sung kết quả xét nghiệm cận lâm sàng vào bệnh án hiện hữu
 * Tình huống: Bác sĩ gửi mẫu xét nghiệm sang phòng Lab, sau 2 giờ nhận kết quả và cập nhật vào bệnh án.
 */
print("\n--- [1.3] BỔ SUNG KẾT QUẢ XÉT NGHIỆM VÀO ĐỢT KHÁM ---");
db.medical_records.updateOne(
  { recordCode: "MED-2026-005" },
  {
    $push: {
      testResults: {
        name: "Chụp X-Quang cung hàm kỹ thuật số",
        sample: "Xương hàm trên & dưới",
        result: "Chân răng còn nguyên vẹn, chưa tiêu xương ổ răng",
        status: "Bình thường"
      }
    },
    $set: { updatedAt: new Date() }
  }
);
print("Đã push kết quả X-Quang vào bệnh án MED-2026-005.");


/**
 * 1.4. Đổi trạng thái tiến trình điều trị (Status Transition)
 * Tình huống: Thú cưng khỏi bệnh sau đợt tái khám, bác sĩ chuyển từ 'Đang điều trị' -> 'Đã hoàn thành'.
 */
print("\n--- [1.4] ĐỔI TRẠNG THÁI TIẾN TRÌNH ĐIỀU TRỊ ---");
db.medical_records.updateOne(
  { recordCode: "MED-2026-004" },
  {
    $set: {
      status: "Đã hoàn thành",
      doctorAdvice: "Đã khỏi viêm bàng quang cấp, duy trì chế độ dinh dưỡng hạt hỗ trợ tiết niệu Urinary.",
      updatedAt: new Date()
    }
  }
);
print("Đã chuyển trạng thái bệnh án MED-2026-004 sang 'Đã hoàn thành'.");


/**
 * 1.5. Xóa mềm (Soft Delete) bệnh án
 * Tình huống: Lễ tân tạo nhầm hồ sơ và muốn ẩn khỏi danh sách mà không làm mất lịch sử Database.
 */
print("\n--- [1.5] XÓA MỀM (SOFT DELETE) BỆNH ÁN ---");
db.medical_records.updateOne(
  { recordCode: "MED-2026-005" },
  {
    $set: {
      isDeleted: true,
      updatedAt: new Date()
    }
  }
);
// Khôi phục lại để phục vụ các truy vấn bên dưới
db.medical_records.updateOne({ recordCode: "MED-2026-005" }, { $set: { isDeleted: false } });
print("Đã thử nghiệm cơ chế Soft Delete (isDeleted flag) an toàn.");


/* ============================================================================
 * MỤC 2: CÁC TRUY VẤN TRA CỨU, LỌC & TÌM KIẾM (READ & SEARCH QUERIES)
 * ============================================================================ */

/**
 * 2.1. Lấy toàn bộ lịch sử bệnh án của một thú cưng (theo petId), sắp xếp mới nhất lên trước
 * Đáp ứng giao diện: Trang danh sách hồ sơ y tế / Timeline lịch sử bệnh của thú cưng.
 */
print("\n--- [2.1] LẤY DANH SÁCH BỆNH ÁN CỦA BÉ BƠ (pet_1) MỚI NHẤT TRƯỚC ---");
const pet1Records = db.medical_records
  .find({ petId: "pet_1", isDeleted: { $ne: true } })
  .sort({ dateISO: -1 })
  .project({
    recordCode: 1,
    date: 1,
    title: 1,
    category: 1,
    status: 1,
    veterinarian: 1,
    "vitalSigns.weight": 1,
    confirmedDiagnosis: 1
  })
  .toArray();
printjson(pet1Records);


/**
 * 2.2. Lấy chi tiết đầy đủ của một bệnh án theo mã (Record Detail View)
 * Đáp ứng giao diện: Modal xem chi tiết hoặc trang In kết quả chẩn đoán (diagnosis.html).
 */
print("\n--- [2.2] XEM CHI TIẾT ĐẦY ĐỦ BỆNH ÁN MED-2026-001 ---");
const recordDetail = db.medical_records.findOne({ recordCode: "MED-2026-001", isDeleted: { $ne: true } });
print(`Mã bệnh án: ${recordDetail.recordCode}`);
print(`Thú cưng: ${recordDetail.petName} (${recordDetail.petBreed})`);
print(`Bác sĩ: ${recordDetail.veterinarian}`);
print(`Chẩn đoán: ${recordDetail.confirmedDiagnosis}`);
print(`Số loại thuốc kê đơn: ${recordDetail.prescription.length} loại`);


/**
 * 2.3. Lọc các ca bệnh theo chuyên khoa điều trị (Filter by Category)
 * Tình huống: Tìm tất cả các ca khám thuộc khoa "Da liễu" hoặc "Tiêu hóa".
 */
print("\n--- [2.3] LỌC BỆNH ÁN THEO CHUYÊN KHOA 'Da liễu' VÀ 'Tiêu hóa' ---");
const categoryFilter = db.medical_records.find(
  {
    category: { $in: ["Da liễu", "Tiêu hóa"] },
    isDeleted: { $ne: true }
  },
  { recordCode: 1, petName: 1, category: 1, title: 1, date: 1 }
).toArray();
printjson(categoryFilter);


/**
 * 2.4. Tìm kiếm các ca bệnh có kết quả xét nghiệm "Bất thường" cần theo dõi đặc biệt
 */
print("\n--- [2.4] TÌM CÁC BỆNH ÁN CÓ KẾT QUẢ XÉT NGHIỆM BẤT THƯỜNG ---");
const abnormalCases = db.medical_records.find(
  {
    "testResults.status": "Bất thường",
    isDeleted: { $ne: true }
  },
  { recordCode: 1, petName: 1, title: 1, "testResults.$": 1 }
).toArray();
printjson(abnormalCases);


/**
 * 2.5. Tìm kiếm toàn văn (Full-Text Search) theo triệu chứng hoặc chẩn đoán
 * Tình huống: Chủ nuôi hoặc bác sĩ gõ từ khóa "nấm" hoặc "dị ứng" vào ô tìm kiếm.
 */
print("\n--- [2.5] TÌM KIẾM TOÀN VĂN VỚI TỪ KHÓA 'nấm' ---");
const textSearchResult = db.medical_records.find(
  {
    $text: { $search: "nấm" },
    isDeleted: { $ne: true }
  },
  { score: { $meta: "textScore" }, recordCode: 1, petName: 1, title: 1, confirmedDiagnosis: 1 }
).sort({ score: { $meta: "textScore" } }).toArray();
printjson(textSearchResult);


/**
 * 2.6. Phân trang danh sách bệnh án (Pagination: Page 1, Limit 2)
 */
print("\n--- [2.6] TRUY VẤN PHÂN TRANG (PAGE 1, LIMIT 2) ---");
const page = 1;
const limit = 2;
const pagedRecords = db.medical_records
  .find({ isDeleted: { $ne: true } })
  .sort({ dateISO: -1 })
  .skip((page - 1) * limit)
  .limit(limit)
  .project({ recordCode: 1, petName: 1, date: 1, title: 1 })
  .toArray();
printjson(pagedRecords);


/* ============================================================================
 * MỤC 3: CÁC TRUY VẤN THỐNG KÊ & PHÂN TÍCH NÂNG CAO (AGGREGATION PIPELINES)
 * ============================================================================ */

/**
 * 3.1. Dòng thời gian biến thiên cân nặng của thú cưng (Weight Trend Timeline)
 * Đáp ứng giao diện: Biểu đồ theo dõi cân nặng trong trang pet-medical-history.html
 */
print("\n--- [3.1] THEO DÕI BIẾN THIÊN CÂN NẶNG CỦA BÉ BƠ (pet_1) ---");
const weightTrend = db.medical_records.aggregate([
  {
    $match: {
      petId: "pet_1",
      isDeleted: { $ne: true },
      "vitalSigns.weight": { $exists: true }
    }
  },
  {
    $sort: { dateISO: 1 } // Sắp xếp theo thứ tự thời gian từ cũ đến mới
  },
  {
    $project: {
      _id: 0,
      date: "$date",
      dateISO: "$dateISO",
      weightKg: "$vitalSigns.weight",
      temperature: "$vitalSigns.temperature",
      title: "$title"
    }
  }
]).toArray();
printjson(weightTrend);


/**
 * 3.2. Thống kê số ca khám và tỷ lệ điều trị thành công theo từng Chuyên khoa
 * Giúp ban quản lý phòng khám nắm được phân bổ ca bệnh.
 */
print("\n--- [3.2] THỐNG KÊ CA BỆNH VÀ TỶ LỆ ĐIỀU TRỊ KHỎI THEO CHUYÊN KHOA ---");
const statsByCategory = db.medical_records.aggregate([
  {
    $match: { isDeleted: { $ne: true } }
  },
  {
    $group: {
      _id: "$category",
      totalVisits: { $sum: 1 },
      completedCases: {
        $sum: { $cond: [{ $eq: ["$status", "Đã hoàn thành"] }, 1, 0] }
      },
      ongoingCases: {
        $sum: { $cond: [{ $eq: ["$status", "Đang điều trị"] }, 1, 0] }
      }
    }
  },
  {
    $project: {
      _id: 0,
      chuyenKhoa: "$_id",
      tongSoCa: "$totalVisits",
      soCaKhoiBenh: "$completedCases",
      soCaDangDieuTri: "$ongoingCases",
      tyLeThanhCong: {
        $concat: [
          { $toString: { $round: [{ $multiply: [{ $divide: ["$completedCases", "$totalVisits"] }, 100] }, 1] } },
          "%"
        ]
      }
    }
  },
  {
    $sort: { tongSoCa: -1 }
  }
]).toArray();
printjson(statsByCategory);


/**
 * 3.3. Thống kê khối lượng công việc và số ca phụ trách của từng Bác sĩ thú y
 */
print("\n--- [3.3] BÁO CÁO HIỆU SUẤT THEO TỪNG BÁC SĨ THÚ Y ---");
const vetWorkload = db.medical_records.aggregate([
  {
    $match: { isDeleted: { $ne: true } }
  },
  {
    $group: {
      _id: "$veterinarian",
      totalHandled: { $sum: 1 },
      treatedPets: { $addToSet: "$petName" }
    }
  },
  {
    $project: {
      _id: 0,
      bacSi: "$_id",
      tongCaKham: "$totalHandled",
      soThuCungDieuTri: { $size: "$treatedPets" },
      danhSachThuCung: "$treatedPets"
    }
  },
  { $sort: { tongCaKham: -1 } }
]).toArray();
printjson(vetWorkload);


/**
 * 3.4. Danh sách các ca hẹn tái khám sắp đến (Follow-up Reminders)
 * Phục vụ hệ thống gửi tin nhắn/thông báo nhắc chủ nuôi đưa bé đến tái khám.
 */
print("\n--- [3.4] DANH SÁCH LỊCH HẸN TÁI KHÁM SẮP ĐẾN ---");
const upcomingFollowUps = db.medical_records.aggregate([
  {
    $match: {
      isDeleted: { $ne: true },
      nextAppointment: { $exists: true, $ne: null }
    }
  },
  {
    $project: {
      _id: 0,
      recordCode: 1,
      petName: 1,
      chuyenKhoa: "$category",
      bacSi: "$veterinarian",
      ngayHenTaiKham: "$nextAppointment",
      loiDan: "$doctorAdvice"
    }
  }
]).toArray();
printjson(upcomingFollowUps);


/**
 * 3.5. Kết hợp (Lookup) giữa Hồ sơ thú cưng và Toàn bộ lịch sử bệnh án (JOIN Aggregation)
 * Tương tự phép LEFT JOIN trong SQL để lấy trọn vẹn thông tin một lần truy vấn.
 */
print("\n--- [3.5] KẾT HỢP HỒ SƠ SỨC KHỎE NỀN VỚI LỊCH SỬ BỆNH ÁN (LOOKUP) ---");
const fullPetMedicalOverview = db.pet_health_profiles.aggregate([
  {
    $match: { petId: "pet_1" }
  },
  {
    $lookup: {
      from: "medical_records",
      localField: "petId",
      foreignField: "petId",
      as: "medicalHistory"
    }
  },
  {
    $project: {
      _id: 0,
      petId: 1,
      bloodType: 1,
      microchip: 1,
      allergies: 1,
      overallStatus: 1,
      tongSoLanKham: { $size: "$medicalHistory" },
      lanKhamGanNhat: { $arrayElemAt: ["$medicalHistory.date", 0] },
      danhSachBenhLy: "$medicalHistory.confirmedDiagnosis"
    }
  }
]).toArray();
printjson(fullPetMedicalOverview);

print("\n[DATABASE QUERIES] Hoàn thành xuất sắc toàn bộ các truy vấn nghiệp vụ Medical Record!");
