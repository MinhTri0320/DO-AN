/**
 * ============================================================================
 * PAWNCARE PET HEALTHCARE SYSTEM - DATABASE MODULE
 * SPRINT 3 TASK: Medical Record (Hồ sơ bệnh án điện tử thú cưng)
 * Người thực hiện phụ trách DataBase: Trần Minh Trí
 * 
 * PHẦN 1: THIẾT KẾ SCHEMA, RÀNG BUỘC VALIDATION, CHỈ MỤC (INDEXES) & DỮ LIỆU MẪU
 * Đáp ứng checklist: [x] Lưu thông tin Medical Record (Trí)
 * ============================================================================
 */

// Kết nối cơ sở dữ liệu 'pawncare'
const dbName = "pawncare";
db = db.getSiblingDB(dbName);

print(`[DATABASE SETUP] Bắt đầu thiết lập Collection & Schema cho module Medical Record trên Database: ${dbName}...`);

/* ============================================================================
 * 1. KHỞI TẠO COLLECTION: pet_health_profiles (Hồ sơ sức khỏe nền của thú cưng)
 * ============================================================================ */
try {
  db.pet_health_profiles.drop();
} catch (e) {}

db.createCollection("pet_health_profiles", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["petId", "bloodType", "overallStatus"],
      properties: {
        petId: {
          bsonType: ["string", "objectId"],
          description: "Mã định danh thú cưng (tham chiếu bảng pets) - Bắt buộc"
        },
        bloodType: {
          bsonType: "string",
          description: "Nhóm máu của thú cưng (vd: DEA 1.1 Dương tính, Nhóm A) - Bắt buộc"
        },
        microchip: {
          bsonType: "string",
          description: "Mã số chip nhận diện cấy dưới da (15 chữ số)"
        },
        allergies: {
          bsonType: "string",
          description: "Tiền sử dị ứng thức ăn, kháng sinh, phấn hoa"
        },
        chronicConditions: {
          bsonType: "string",
          description: "Bệnh lý nền mãn tính (tim mạch, thận, bàng quang...)"
        },
        sterilized: {
          bsonType: "string",
          enum: ["Đã triệt sản", "Chưa triệt sản", "Không rõ"],
          description: "Tình trạng triệt sản của thú cưng"
        },
        vaccinationStatus: {
          bsonType: "string",
          description: "Trạng thái tiêm phòng vaccine và thời hạn bảo hộ"
        },
        dewormingStatus: {
          bsonType: "string",
          description: "Trạng thái tẩy giun, nhỏ gáy phòng ve rận"
        },
        overallStatus: {
          bsonType: "string",
          enum: ["Khỏe mạnh", "Cần theo dõi", "Đang điều trị đặc biệt", "Hồi phục sau phẫu thuật"],
          description: "Đánh giá thể trạng tổng thể - Bắt buộc"
        },
        updatedAt: {
          bsonType: "date",
          description: "Thời điểm cập nhật hồ sơ sức khỏe gần nhất"
        }
      }
    }
  }
});

// Tạo chỉ mục cho pet_health_profiles
db.pet_health_profiles.createIndex({ petId: 1 }, { unique: true, name: "idx_unique_pet_health" });
db.pet_health_profiles.createIndex({ microchip: 1 }, { unique: true, sparse: true, name: "idx_unique_microchip" });

print("✓ Đã tạo collection 'pet_health_profiles' với ràng buộc Schema Validation và Indexes thành công.");


/* ============================================================================
 * 2. KHỞI TẠO COLLECTION: medical_records (Hồ sơ bệnh án điện tử chi tiết)
 * ============================================================================ */
try {
  db.medical_records.drop();
} catch (e) {}

db.createCollection("medical_records", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: [
        "recordCode",
        "petId",
        "petName",
        "dateISO",
        "title",
        "category",
        "status",
        "veterinarian",
        "vitalSigns",
        "symptoms",
        "confirmedDiagnosis"
      ],
      properties: {
        recordCode: {
          bsonType: "string",
          pattern: "^MED-\\d{4}-\\d{3,}$",
          description: "Mã bệnh án chuẩn định dạng MED-YYYY-XXX (vd: MED-2026-001) - Bắt buộc, duy nhất"
        },
        petId: {
          bsonType: ["string", "objectId"],
          description: "Mã thú cưng khám bệnh - Bắt buộc"
        },
        petName: {
          bsonType: "string",
          description: "Tên thú cưng tại thời điểm khám - Bắt buộc"
        },
        petSpecies: {
          bsonType: "string",
          description: "Loài thú cưng (Chó, Mèo...)"
        },
        petBreed: {
          bsonType: "string",
          description: "Giống loài (Golden Retriever, Mèo Anh lông ngắn...)"
        },
        date: {
          bsonType: "string",
          description: "Ngày khám định dạng hiển thị DD/MM/YYYY"
        },
        dateISO: {
          bsonType: "string",
          pattern: "^\\d{4}-\\d{2}-\\d{2}$",
          description: "Ngày khám chuẩn ISO YYYY-MM-DD để index và sắp xếp - Bắt buộc"
        },
        title: {
          bsonType: "string",
          description: "Tiêu đề tóm tắt ca bệnh / chẩn đoán - Bắt buộc"
        },
        category: {
          bsonType: "string",
          enum: [
            "Da liễu",
            "Tiêu hóa",
            "Tiêm chủng",
            "Tiết niệu",
            "Hô hấp",
            "Ngoại khoa",
            "Cơ xương khớp",
            "Mắt - Tai - Mũi",
            "Nội khoa tổng quát",
            "Khác"
          ],
          description: "Phân loại chuyên khoa khám chữa bệnh - Bắt buộc"
        },
        status: {
          bsonType: "string",
          enum: ["Đang điều trị", "Đã hoàn thành", "Chờ tái khám", "Đã hủy"],
          description: "Trạng thái tiến trình điều trị - Bắt buộc"
        },
        veterinarian: {
          bsonType: "string",
          description: "Họ tên & học vị bác sĩ thú y trực tiếp thăm khám - Bắt buộc"
        },
        clinicBranch: {
          bsonType: "string",
          description: "Cơ sở phòng khám tiếp nhận điều trị"
        },
        reason: {
          bsonType: "string",
          description: "Lý do đến khám và các biểu hiện chủ nuôi cung cấp"
        },
        vitalSigns: {
          bsonType: "object",
          required: ["temperature", "weight"],
          properties: {
            temperature: {
              bsonType: ["double", "int", "string"],
              description: "Thân nhiệt thú cưng (°C) - Bắt buộc"
            },
            weight: {
              bsonType: ["double", "int", "string"],
              description: "Cân nặng thú cưng (kg) - Bắt buộc"
            },
            heartRate: {
              bsonType: ["double", "int", "string"],
              description: "Nhịp tim (nhịp/phút)"
            },
            respiratoryRate: {
              bsonType: ["double", "int", "string"],
              description: "Nhịp thở (lần/phút)"
            },
            mucousMembranes: {
              bsonType: "string",
              description: "Tình trạng niêm mạc (Hồng hào, Tái nhợt, Xung huyết...)"
            },
            hydration: {
              bsonType: "string",
              description: "Mức độ ngậm nước / tình trạng mất nước"
            }
          },
          description: "Các chỉ số sinh tồn cơ bản tại phòng khám - Bắt buộc"
        },
        symptoms: {
          bsonType: "array",
          items: { bsonType: "string" },
          description: "Danh sách các triệu chứng ghi nhận được qua quan sát - Bắt buộc"
        },
        preliminaryDiagnosis: {
          bsonType: "string",
          description: "Chẩn đoán ban đầu / nghi ngờ trước khi có xét nghiệm"
        },
        confirmedDiagnosis: {
          bsonType: "string",
          description: "Chẩn đoán xác định sau khi có kết quả cận lâm sàng - Bắt buộc"
        },
        testResults: {
          bsonType: "array",
          items: {
            bsonType: "object",
            required: ["name", "result", "status"],
            properties: {
              name: { bsonType: "string", description: "Tên loại xét nghiệm cận lâm sàng" },
              sample: { bsonType: "string", description: "Bệnh phẩm thu thập" },
              result: { bsonType: "string", description: "Chi tiết kết quả / chỉ số xét nghiệm" },
              status: {
                bsonType: "string",
                enum: ["Bình thường", "Bất thường", "Cần theo dõi", "Nghi ngờ"],
                description: "Đánh giá kết quả xét nghiệm"
              }
            }
          },
          description: "Danh mục các kết quả xét nghiệm, siêu âm, X-Quang, soi tươi"
        },
        prescription: {
          bsonType: "array",
          items: {
            bsonType: "object",
            required: ["name", "dosage", "duration"],
            properties: {
              name: { bsonType: "string", description: "Tên biệt dược" },
              active: { bsonType: "string", description: "Hoạt chất thuốc" },
              dosage: { bsonType: "string", description: "Liều lượng và cách dùng chi tiết" },
              duration: { bsonType: "string", description: "Thời gian sử dụng thuốc (ngày/tuần)" },
              notes: { bsonType: "string", description: "Chỉ dẫn bảo quản & lưu ý chống chỉ định" }
            }
          },
          description: "Đơn thuốc & phác đồ điều trị của bác sĩ"
        },
        doctorAdvice: {
          bsonType: "string",
          description: "Lời dặn dò về chế độ dinh dưỡng, cách ly và chăm sóc tại nhà"
        },
        nextAppointment: {
          bsonType: "string",
          description: "Lịch hẹn tái khám hoặc tiêm mũi tiếp theo"
        },
        totalCost: {
          bsonType: ["string", "double", "int"],
          description: "Tổng chi phí khám, xét nghiệm và tiền thuốc"
        },
        isDeleted: {
          bsonType: "bool",
          description: "Cờ xóa mềm hồ sơ bệnh án (mặc định false)"
        },
        createdAt: {
          bsonType: "date",
          description: "Ngày giờ khởi tạo hồ sơ bệnh án"
        },
        updatedAt: {
          bsonType: "date",
          description: "Ngày giờ cập nhật hồ sơ gần nhất"
        }
      }
    }
  }
});

/* ============================================================================
 * 3. TẠO INDEXES TỐI ƯU HIỆU NĂNG TRUY VẤN CHO medical_records
 * ============================================================================ */
// 1. Mã bệnh án là duy nhất
db.medical_records.createIndex({ recordCode: 1 }, { unique: true, name: "idx_unique_recordCode" });

// 2. Tra cứu lịch sử bệnh theo thú cưng, sắp xếp theo ngày khám giảm dần (mới nhất lên đầu)
db.medical_records.createIndex({ petId: 1, dateISO: -1 }, { name: "idx_pet_date" });

// 3. Lọc theo trạng thái và chuyên khoa điều trị
db.medical_records.createIndex({ status: 1, category: 1 }, { name: "idx_status_category" });

// 4. Tra cứu theo dõi thể trạng cân nặng
db.medical_records.createIndex({ petId: 1, "vitalSigns.weight": 1 }, { name: "idx_pet_weight" });

// 5. Index tìm kiếm toàn văn (Full-Text Search) trên triệu chứng và chẩn đoán
db.medical_records.createIndex(
  { title: "text", confirmedDiagnosis: "text", preliminaryDiagnosis: "text", "symptoms": "text" },
  { default_language: "none", name: "idx_fulltext_medical_record" }
);

print("✓ Đã tạo collection 'medical_records' và 5 Indexes tối ưu truy vấn thành công.");


/* ============================================================================
 * 4. NẠP DỮ LIỆU MẪU (SEED DATA) CHUẨN NGHIỆP VỤ Y KHOA THÚ Y
 * ============================================================================ */

// 4.1 Seed Hồ sơ sức khỏe nền (pet_health_profiles)
db.pet_health_profiles.insertMany([
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
    updatedAt: new Date("2026-10-15T10:00:00Z")
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
    updatedAt: new Date("2026-09-20T15:30:00Z")
  }
]);

print("✓ Đã nạp dữ liệu mẫu vào 'pet_health_profiles'.");

// 4.2 Seed Hồ sơ bệnh án chi tiết (medical_records)
db.medical_records.insertMany([
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
      hydration: "Bình thường, độ đàn hồi da tốt"
    },
    symptoms: [
      "Ngứa ngáy dữ dội",
      "Rụng lông vùng cổ và gốc tai",
      "Vảy gàu li ti",
      "Da ửng đỏ có mùi men chua"
    ],
    preliminaryDiagnosis: "Nghi ngờ viêm da do dị ứng thức ăn hoặc ký sinh trùng ngoài da (Demodex/Nấm)",
    confirmedDiagnosis: "Viêm da dị ứng tiếp xúc (Allergic Contact Dermatitis) kết hợp nhiễm nấm men Malassezia thứ phát",
    testResults: [
      {
        name: "Soi tươi biểu bì da cạo sâu",
        sample: "Mẫu biểu bì cổ & vành tai",
        result: "Phát hiện nhiều tế bào nấm Malassezia dạng hồ lô (++), âm tính với ve mò Demodex",
        status: "Bất thường"
      },
      {
        name: "Tổng phân tích tế bào máu ngoại vi (CBC)",
        sample: "Máu tĩnh mạch cảnh",
        result: "Bạch cầu ái toan Eosinophil tăng nhẹ 8.2% (phản ứng dị ứng), các dòng khác bình thường",
        status: "Bình thường"
      }
    ],
    prescription: [
      {
        name: "Cefalexin 250mg",
        active: "Cephalosporin thế hệ 1",
        dosage: "1 viên x 2 lần/ngày sau khi ăn",
        duration: "7 ngày",
        notes: "Kháng sinh chống bội nhiễm vi khuẩn cơ hội"
      },
      {
        name: "Sữa tắm trị nấm Malaseb 250ml",
        active: "Chlorhexidine + Miconazole",
        dosage: "Tắm 2 lần/tuần, lưu bọt 10 phút trước khi xả sạch",
        duration: "3 tuần",
        notes: "Tránh để bọt xà phòng tiếp xúc vào mắt và niêm mạc tai"
      },
      {
        name: "Dung dịch vệ sinh tai Otoproct 15ml",
        active: "Dexamethasone + Polymyxin B",
        dosage: "Nhỏ 3 giọt mỗi bên tai ngày 1 lần",
        duration: "5 ngày",
        notes: "Mát-xa nhẹ gốc tai, dùng bông mềm lau sạch cặn bẩn"
      }
    ],
    doctorAdvice: "Chuyển khẩu phần ăn sang dòng Hypoallergenic (đạm thủy phân). Vệ sinh nệm nằm, phơi nắng định kỳ. Giữ nếp da vùng cổ khô ráo sau khi vận động.",
    nextAppointment: "25/10/2026",
    totalCost: "520.000đ",
    isDeleted: false,
    createdAt: new Date("2026-10-15T09:30:00Z"),
    updatedAt: new Date("2026-10-15T11:15:00Z")
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
      hydration: "Mất nước nhẹ (nếp gấp da thu hồi sau 1 giây)"
    },
    symptoms: [
      "Nôn thức ăn chưa tiêu",
      "Đi phân lỏng màu vàng sệt",
      "Bụng chướng nhẹ, sôi ruột",
      "Giảm thèm ăn trong 12 giờ qua"
    ],
    preliminaryDiagnosis: "Viêm dạ dày - ruột cấp (Acute Gastroenteritis), loại trừ bệnh truyền nhiễm do Parvovirus",
    confirmedDiagnosis: "Rối loạn tiêu hóa cấp do kích ứng thức ăn chứa hàm lượng đạm cao đột ngột (Dyspepsia)",
    testResults: [
      {
        name: "Test nhanh kháng nguyên Parvo & Corona virus",
        sample: "Dịch phết trực tràng",
        result: "Âm tính (-) với cả Parvo virus và Corona virus",
        status: "Bình thường"
      },
      {
        name: "Siêu âm ổ bụng tổng quát",
        sample: "Vùng bụng trên & ruột non",
        result: "Thành dạ dày phù nề nhẹ, quai ruột có nhiều hơi và dịch lỏng, không có dị vật",
        status: "Bình thường"
      }
    ],
    prescription: [
      {
        name: "Men vi sinh Enterogermina",
        active: "Bào tử Bacillus clausii",
        dosage: "1 ống/ngày chia làm 2 lần uống",
        duration: "5 ngày",
        notes: "Uống cách xa thời gian ăn 1 giờ để tái lập hệ vi sinh"
      },
      {
        name: "Thuốc tráng niêm mạc Phosphalugel",
        active: "Aluminium phosphate",
        dosage: "1 gói/ngày trước bữa ăn 30 phút",
        duration: "3 ngày",
        notes: "Làm dịu niêm mạc dạ dày và chống trào ngược"
      },
      {
        name: "Dung dịch bù nước & điện giải Pet Hydrate",
        active: "Glucose + Khoáng chất điện giải",
        dosage: "Pha 200ml nước ấm cho uống tự do",
        duration: "2 ngày",
        notes: "Cho uống từng lượng nhỏ, không ép uống dồn dập"
      }
    ],
    doctorAdvice: "Nấu cháo thịt nạc băm loãng cho ăn làm nhiều bữa nhỏ trong 2 ngày đầu. Tránh hoàn toàn sữa tươi và thức ăn nhiều dầu mỡ. Đưa bé đi khám lại ngay nếu xuất hiện nôn khan hoặc đi ngoài ra máu.",
    nextAppointment: "02/09/2026",
    totalCost: "350.000đ",
    isDeleted: false,
    createdAt: new Date("2026-08-28T14:20:00Z"),
    updatedAt: new Date("2026-08-28T15:45:00Z")
  },
  {
    recordCode: "MED-2026-003",
    petId: "pet_1",
    petName: "Bé Bơ",
    petSpecies: "Chó",
    petBreed: "Golden Retriever",
    date: "10/05/2026",
    dateISO: "2026-05-10",
    title: "Tiêm phòng định kỳ Vaccine 7 bệnh & Sổ giun chuyên sâu",
    category: "Tiêm chủng",
    status: "Đã hoàn thành",
    veterinarian: "BS. CKI. Nguyễn Văn Hùng",
    clinicBranch: "PawnCare 123 Nguyễn Văn Linh, Hải Châu, Đà Nẵng",
    reason: "Đến lịch tiêm nhắc lại hàng năm theo lịch hẹn sổ khám sức khỏe",
    vitalSigns: {
      temperature: 38.4,
      weight: 18.2,
      heartRate: 104,
      respiratoryRate: 22,
      mucousMembranes: "Hồng hào",
      hydration: "Bình thường"
    },
    symptoms: [
      "Bé khỏe mạnh, năng động, ăn uống và tiêu hóa bình thường"
    ],
    preliminaryDiagnosis: "Đủ tiêu chuẩn thể trạng tốt để tiếp nhận tiêm vaccine phòng bệnh",
    confirmedDiagnosis: "Hoàn thành tiêm nhắc mũi Vaccine Vanguard Plus 5/L (7 bệnh) và tẩy giun định kỳ",
    testResults: [
      {
        name: "Khám lâm sàng sàng lọc trước tiêm chủng",
        sample: "Toàn thân",
        result: "Thân nhiệt ổn định, không ho sốt, hạch ngoại biên không sưng, tim phổi êm dịu",
        status: "Bình thường"
      }
    ],
    prescription: [
      {
        name: "Vaccine Vanguard Plus 5/L (Zoetis Mỹ)",
        active: "Ngừa Carred, Parvo, Viêm gan, Ho cũi chó, Lepto",
        dosage: "1 liều tiêm dưới da",
        duration: "1 năm",
        notes: "Lô sản xuất H8921B, bảo quản lạnh tiêu chuẩn"
      },
      {
        name: "Viên tẩy giun Drontal Plus",
        active: "Febantel + Pyrantel + Praziquantel",
        dosage: "2 viên uống trực tiếp vào buổi sáng",
        duration: "Định kỳ 3 tháng/lần",
        notes: "Tẩy sạch giun đũa, giun móc, giun tóc và sán dây"
      }
    ],
    doctorAdvice: "Theo dõi phản ứng của bé tại nhà trong 24 giờ đầu. Kiêng tắm trong vòng 7 ngày sau tiêm để đảm bảo đáp ứng miễn dịch tối đa. Tránh cho bé tiếp xúc với chó lạ chưa tiêm phòng.",
    nextAppointment: "10/05/2027",
    totalCost: "280.000đ",
    isDeleted: false,
    createdAt: new Date("2026-05-10T08:15:00Z"),
    updatedAt: new Date("2026-05-10T09:00:00Z")
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
      hydration: "Bình thường"
    },
    symptoms: [
      "Tiểu rắt, tiểu khó (Stranguria)",
      "Nước tiểu màu hồng nhạt có lẫn tia máu (Hematuria)",
      "Liếm lông vùng sinh dục quá mức",
      "Kêu đau khi dùng lực chạm vào bụng dưới"
    ],
    preliminaryDiagnosis: "Viêm bàng quang vô căn hoặc sỏi tiết niệu gây tắc nghẽn bán phần (FLUTD)",
    confirmedDiagnosis: "Viêm bàng quang cấp có cặn tinh thể Struvite (Feline Idiopathic Cystitis with Struvite Crystalluria)",
    testResults: [
      {
        name: "Tổng phân tích nước tiểu 10 thông số & Soi cặn lắng",
        sample: "Nước tiểu lấy bằng chọc dò bàng quang (Cystocentesis)",
        result: "pH = 7.5 (Kiềm hóa), Protein (++), Hồng cầu (+++), phát hiện tinh thể Struvite hình nắp quan tài",
        status: "Bất thường"
      },
      {
        name: "Siêu âm hệ tiết niệu (Bàng quang & Thận)",
        sample: "Hạ vị & vùng hông lưng",
        result: "Thành bàng quang dày 3.8mm (bình thường < 2mm), lòng bàng quang nhiều cặn lắng di động, không thấy sỏi san hô",
        status: "Bất thường"
      }
    ],
    prescription: [
      {
        name: "Kháng sinh Marbofloxacin 20mg",
        active: "Marbofloxacin (Fluoroquinolone)",
        dosage: "1/2 viên x 1 lần/ngày",
        duration: "10 ngày",
        notes: "Uống vào buổi sáng cùng một lượng thức ăn nhỏ"
      },
      {
        name: "Thuốc giãn cơ trơn đường niệu Prazosin 0.5mg",
        active: "Prazosin hydrochloride",
        dosage: "1/4 viên x 2 lần/ngày",
        duration: "5 ngày",
        notes: "Giảm co thắt niệu đạo, giúp bé đi tiểu dễ dàng hơn"
      },
      {
        name: "Gel dinh dưỡng hỗ trợ tan sỏi Uro-Pet 120g",
        active: "DL-Methionine (Axit hóa nước tiểu)",
        dosage: "1 muỗng cà phê (5g) trộn vào pate hàng ngày",
        duration: "30 ngày",
        notes: "Kiểm soát đưa pH nước tiểu về mức lý tưởng 6.0 - 6.5"
      }
    ],
    doctorAdvice: "Bắt buộc đổi sang hạt Royal Canin Urinary S/O hoặc Hills c/d. Đặt thêm đài phun nước tự động trong nhà để kích thích bé uống nhiều nước. Dọn khay cát tối thiểu 2 lần/ngày.",
    nextAppointment: "30/09/2026",
    totalCost: "680.000đ",
    isDeleted: false,
    createdAt: new Date("2026-09-20T10:00:00Z"),
    updatedAt: new Date("2026-09-20T11:40:00Z")
  }
]);

print("✓ Đã nạp thành công 4 hồ sơ bệnh án mẫu vào 'medical_records'.");
print("[DATABASE SETUP] Hoàn tất toàn bộ quy trình thiết lập Cơ sở dữ liệu Medical Record!");
