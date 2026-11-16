# 🐾 BÁO CÁO NHIỆM VỤ SPRINT 3: DATABASE MODULE
## THẺ CÔNG VIỆC: MEDICAL RECORD (HỒ SƠ BỆNH ÁN ĐIỆN TỬ THÚ CƯNG)
**Người thực hiện phụ trách DataBase:** Trần Minh Trí  
**Dự án:** PawnCare — Hệ sinh thái Chăm sóc Thú cưng Toàn diện  
**Trạng thái:** ✅ Đã hoàn thành 100% cả 2 mục trong Checklist  

---

## 🎯 1. TỔNG QUAN YÊU CẦU & CHECKLIST
Trong Sprint 3, nhiệm vụ **Medical Record** có mô tả:
> *"Cho phép người dùng quản lý hồ sơ y tế của thú cưng, bao gồm các thông tin liên quan đến quá trình khám và điều trị. Người dùng có thể xem và theo dõi các thông tin bệnh án được lưu trữ trong hệ thống."*

Phân chia trách nhiệm trong thẻ:
- **FE:** Thiết kế & Code giao diện Medical Record (Toàn)
- **BE:** Xử lý & API Medical Record (Thịnh)
- **DataBase (Trần Minh Trí):**
  - [x] **Lưu thông tin Medical Record (Trí)**
  - [x] **Truy vấn Medical Record (Trí)**

---

## 📂 2. CẤU TRÚC TỆP TIN DATABASE
Thư mục `c:\DO-AN\Database\` được thiết kế độc lập, **không can thiệp hay sửa đổi mã nguồn FrontEnd và BackEnd hiện hữu**:

| Tên tệp | Định dạng | Mục đích & Nghiệp vụ |
| :--- | :--- | :--- |
| `01_schema_and_seed.mongodb.js` | MongoDB Script | Khởi tạo Collection, thiết lập JSON Schema Validation, đánh Indexes và nạp Seed Data mẫu. |
| `02_queries_and_analytics.mongodb.js` | MongoDB Script | Toàn bộ các câu truy vấn thực tế: Insert, Update, Soft-delete, Filter, Full-text Search, Aggregation Pipelines. |
| `03_relational_schema.sql` | SQL DDL & DML | Lược đồ quan hệ chuẩn (RDBMS 3NF) phục vụ nộp báo cáo đồ án / môn học Cơ sở dữ liệu. |
| `README.md` | Markdown | Tài liệu giải trình thiết kế và hướng dẫn chạy kiểm thử. |

---

## 🏗️ 3. THIẾT KẾ CƠ SỞ DỮ LIỆU (DATABASE DESIGN)

### 3.1. Collection: `pet_health_profiles` (Hồ sơ sức khỏe nền)
Lưu trữ thông tin nhận diện sinh học và bệnh lý nền cố định của thú cưng:
- `petId`: Mã thú cưng (Unique Index, liên kết bảng Thú cưng).
- `bloodType`: Nhóm máu (vd: `DEA 1.1 Dương tính`, `Nhóm A`).
- `microchip`: Mã số vi mạch cấy dưới da (Unique, Sparse Index).
- `allergies`: Tiền sử dị ứng (thức ăn, kháng sinh penicillin, hóa chất).
- `chronicConditions`: Bệnh lý mãn tính (suy thận, bàng quang nhạy cảm, tim mạch).
- `sterilized`: Tình trạng triệt sản (`Đã triệt sản` / `Chưa triệt sản`).
- `vaccinationStatus`: Trạng thái tiêm phòng vaccine và hạn bảo hộ.
- `dewormingStatus`: Tình trạng tẩy giun / nhỏ gáy phòng ve rận.
- `overallStatus`: Đánh giá thể trạng (`Khỏe mạnh`, `Cần theo dõi`, `Đang điều trị đặc biệt`).

### 3.2. Collection: `medical_records` (Hồ sơ bệnh án điện tử)
Lưu trữ từng lần khám chữa bệnh của thú cưng tại phòng khám PawnCare:
- `recordCode`: Mã bệnh án chuẩn `MED-YYYY-XXX` (Unique Index, vd: `MED-2026-001`).
- `petId`: Mã thú cưng được khám (Compound Index cùng `dateISO`).
- `petName`, `petSpecies`, `petBreed`: Thông tin thú cưng tại thời điểm khám.
- `date` / `dateISO`: Ngày khám (Định dạng hiển thị `DD/MM/YYYY` và ISO `YYYY-MM-DD` để sắp xếp).
- `title`: Tiêu đề tóm tắt ca bệnh.
- `category`: Chuyên khoa khám (`Da liễu`, `Tiêu hóa`, `Tiêm chủng`, `Tiết niệu`, `Ngoại khoa`, `Cơ xương khớp`, `Mắt - Tai - Mũi`, `Nội khoa tổng quát`).
- `status`: Tiến trình điều trị (`Đang điều trị`, `Đã hoàn thành`, `Chờ tái khám`, `Đã hủy`).
- `veterinarian`: Bác sĩ thú y trực tiếp thăm khám (vd: `BS. CKI. Nguyễn Văn Hùng`).
- `clinicBranch`: Chi nhánh phòng khám tiếp nhận.
- `reason`: Lý do chủ nuôi đưa bé đến khám.
- `vitalSigns`: Đối tượng nhúng (Embedded Document) chứa các chỉ số sinh tồn:
  - `temperature`: Thân nhiệt (°C).
  - `weight`: Cân nặng (kg) — phục vụ vẽ biểu đồ thể trạng.
  - `heartRate`: Nhịp tim (nhịp/phút).
  - `respiratoryRate`: Nhịp thở (lần/phút).
  - `mucousMembranes`: Tình trạng niêm mạc (Hồng hào, Tái nhợt...).
  - `hydration`: Đánh giá mức độ ngậm nước / mất nước.
- `symptoms`: Mảng các triệu chứng lâm sàng ghi nhận được.
- `preliminaryDiagnosis`: Chẩn đoán sơ bộ ban đầu.
- `confirmedDiagnosis`: Chẩn đoán xác định (sau cận lâm sàng).
- `testResults`: Mảng kết quả xét nghiệm (soi tươi, X-Quang, siêu âm, xét nghiệm máu CBC...).
- `prescription`: Mảng đơn thuốc (tên biệt dược, hoạt chất, liều dùng, liệu trình, lưu ý).
- `doctorAdvice`: Lời dặn dò chế độ dinh dưỡng, cách ly và chăm sóc tại nhà.
- `nextAppointment`: Ngày hẹn tái khám.
- `totalCost`: Tổng chi phí đợt điều trị.
- `isDeleted`: Cờ xóa mềm (Soft-delete).

---

## ⚡ 4. CHIẾN LƯỢC ĐÁNH CHỈ MỤC (INDEXING STRATEGY)
Để đảm bảo hệ thống phản hồi dưới **10ms** ngay cả khi có hàng chục ngàn lượt khám:

1. **Unique Index trên `recordCode`:** Ngăn ngừa trùng lặp mã hồ sơ bệnh án.
   ```javascript
   db.medical_records.createIndex({ recordCode: 1 }, { unique: true });
   ```
2. **Compound Index trên `{ petId: 1, dateISO: -1 }`:** Tối ưu hóa truy vấn xem danh sách lịch sử khám bệnh của một thú cưng từ mới nhất đến cũ nhất.
3. **Compound Index trên `{ status: 1, category: 1 }`:** Tăng tốc độ lọc theo trạng thái điều trị và chuyên khoa.
4. **Index trên `{ petId: 1, "vitalSigns.weight": 1 }`:** Phục vụ truy vấn biểu đồ biến thiên cân nặng (Weight trend).
5. **Full-Text Index trên `{ title: "text", confirmedDiagnosis: "text", preliminaryDiagnosis: "text", symptoms: "text" }`:** Hỗ trợ tìm kiếm từ khóa chẩn đoán, triệu chứng cực nhanh.

---

## 📋 5. TỔNG HỢP CÁC TRUY VẤN ĐÃ HOÀN THÀNH (CHECKLIST BẠN TRÍ)

### ✅ Checklist 1: Lưu thông tin Medical Record
- **Thêm mới bệnh án (`insertOne`):** Lưu trữ trọn vẹn thông tin đợt khám, dấu hiệu sinh tồn, xét nghiệm, đơn thuốc.
- **Cập nhật hồ sơ sức khỏe nền (`updateOne` với `upsert: true`):** Cập nhật dị ứng mới hoặc mã microchip.
- **Cập nhật xét nghiệm bổ sung (`$push` vào `testResults`):** Tiếp nhận kết quả cận lâm sàng từ phòng Lab sau khi gửi mẫu.
- **Cập nhật trạng thái (`status transition`):** Chuyển ca bệnh từ `Đang điều trị` sang `Đã hoàn thành`.
- **Cơ chế xóa mềm (`Soft-delete`):** Bật cờ `isDeleted = true` để bảo toàn dữ liệu lịch sử y tế.

### ✅ Checklist 2: Truy vấn Medical Record
- **Truy vấn danh sách theo thú cưng (`find({ petId })`):** Sắp xếp theo ngày khám mới nhất `dateISO: -1`.
- **Truy vấn chi tiết một bệnh án (`findOne({ recordCode })`):** Trả về đầy đủ mọi thông tin y tế để xem hoặc in ấn.
- **Lọc theo chuyên khoa (`category: { $in: [...] }`):** Phục vụ bộ lọc danh mục.
- **Tìm kiếm ca bệnh bất thường (`"testResults.status": "Bất thường"`):** Cảnh báo theo dõi đặc biệt.
- **Tìm kiếm toàn văn (`$text: { $search: "nấm" }`):** Tìm kiếm triệu chứng và bệnh lý nhanh chóng.
- **Phân trang (`skip` & `limit`):** Đảm bảo tải trang mượt mà khi dữ liệu lớn.
- **Aggregation Pipeline 1 — Xu hướng cân nặng (`Weight Trend`):** Lọc theo `petId`, sắp xếp theo thời gian để vẽ biểu đồ tăng trưởng.
- **Aggregation Pipeline 2 — Thống kê chuyên khoa & Tỷ lệ khỏi bệnh:** Tính tổng số ca, số ca khỏi, phần trăm thành công của từng chuyên khoa.
- **Aggregation Pipeline 3 — Hiệu suất bác sĩ:** Đếm số ca khám và số lượng bệnh nhân theo từng bác sĩ phụ trách.
- **Aggregation Pipeline 4 — Nhắc lịch tái khám:** Tự động quét các ca có ngày hẹn tái khám trong tương lai.
- **Aggregation Pipeline 5 — Lookup đa bảng:** Tự động JOIN giữa `pet_health_profiles` và `medical_records` để lấy cái nhìn toàn diện (360-degree view).

---

## 🚀 6. HƯỚNG DẪN THỰC THI (HOW TO RUN)

### Cách 1: Sử dụng MongoDB Shell (mongosh)
```bash
# Mở terminal và chạy lệnh:
mongosh "mongodb://localhost:27017/pawncare" "c:\DO-AN\Database\01_schema_and_seed.mongodb.js"
mongosh "mongodb://localhost:27017/pawncare" "c:\DO-AN\Database\02_queries_and_analytics.mongodb.js"
```

### Cách 2: Sử dụng MongoDB Compass / VS Code MongoDB Extension
1. Mở file `01_schema_and_seed.mongodb.js` trong VS Code hoặc Compass Playground.
2. Bấm nút **Run Playground** (hoặc tổ hợp phím `Ctrl + Alt + R`).
3. Mở file `02_queries_and_analytics.mongodb.js` và bấm **Run** để kiểm tra kết quả trả về của từng câu truy vấn.

### Cách 3: Chạy trên MySQL / HeidiSQL / DBeaver (Nếu cần nộp file SQL)
1. Mở công cụ quản lý cơ sở dữ liệu MySQL.
2. Import và chạy toàn bộ tệp `03_relational_schema.sql`.

---
*Báo cáo được chuẩn bị đầy đủ, chuyên nghiệp, sẵn sàng để nộp tiến độ Sprint 3 cho bạn Trí!*
