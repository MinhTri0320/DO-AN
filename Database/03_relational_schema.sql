-- ============================================================================
-- PAWNCARE PET HEALTHCARE SYSTEM - DATABASE MODULE
-- SPRINT 3 TASK: Medical Record (Hồ sơ bệnh án điện tử thú cưng)
-- Người thực hiện phụ trách DataBase: Trần Minh Trí
-- 
-- PHẦN 3: THIẾT KẾ CƠ SỞ DỮ LIỆU QUAN HỆ (RDBMS - SQL SCHEMA DDL & DML)
-- Tương thích: MySQL 8.0+, MariaDB, PostgreSQL, SQL Server
-- Phục vụ: Báo cáo đồ án, thiết kế lược đồ quan hệ chuẩn (3NF), nộp bài cho Giảng viên
-- ============================================================================

CREATE DATABASE IF NOT EXISTS pawncare_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE pawncare_db;

-- ----------------------------------------------------------------------------
-- 1. BẢNG THÚ CƯNG (Pets)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pets (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    species VARCHAR(50) NOT NULL,
    breed VARCHAR(100),
    gender ENUM('male', 'female', 'other') DEFAULT 'male',
    birth_date DATE,
    avatar VARCHAR(255),
    owner_id VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ----------------------------------------------------------------------------
-- 2. BẢNG HỒ SƠ SỨC KHỎE NỀN (Pet Health Profiles)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pet_health_profiles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    pet_id VARCHAR(50) NOT NULL UNIQUE,
    blood_type VARCHAR(50) NOT NULL,
    microchip VARCHAR(50) UNIQUE,
    allergies TEXT,
    chronic_conditions TEXT,
    sterilized VARCHAR(50) DEFAULT 'Chưa triệt sản',
    vaccination_status VARCHAR(150),
    deworming_status VARCHAR(150),
    overall_status ENUM('Khỏe mạnh', 'Cần theo dõi', 'Đang điều trị đặc biệt', 'Hồi phục sau phẫu thuật') DEFAULT 'Khỏe mạnh',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (pet_id) REFERENCES pets(id) ON DELETE CASCADE
);

-- ----------------------------------------------------------------------------
-- 3. BẢNG HỒ SƠ BỆNH ÁN ĐỢT KHÁM (Medical Records)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS medical_records (
    id INT AUTO_INCREMENT PRIMARY KEY,
    record_code VARCHAR(30) NOT NULL UNIQUE,
    pet_id VARCHAR(50) NOT NULL,
    visit_date DATE NOT NULL,
    title VARCHAR(255) NOT NULL,
    category ENUM(
        'Da liễu', 'Tiêu hóa', 'Tiêm chủng', 'Tiết niệu', 'Hô hấp',
        'Ngoại khoa', 'Cơ xương khớp', 'Mắt - Tai - Mũi', 'Nội khoa tổng quát', 'Khác'
    ) NOT NULL,
    status ENUM('Đang điều trị', 'Đã hoàn thành', 'Chờ tái khám', 'Đã hủy') DEFAULT 'Đang điều trị',
    veterinarian VARCHAR(150) NOT NULL,
    clinic_branch VARCHAR(255) DEFAULT 'PawnCare 123 Nguyễn Văn Linh, Đà Nẵng',
    reason TEXT,
    preliminary_diagnosis TEXT,
    confirmed_diagnosis TEXT NOT NULL,
    doctor_advice TEXT,
    next_appointment DATE,
    total_cost DECIMAL(12, 2) DEFAULT 0.00,
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (pet_id) REFERENCES pets(id) ON DELETE CASCADE,
    INDEX idx_pet_date (pet_id, visit_date DESC),
    INDEX idx_category_status (category, status)
);

-- ----------------------------------------------------------------------------
-- 4. BẢNG CHỈ SỐ SINH TỒN (Vital Signs)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS vital_signs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    medical_record_id INT NOT NULL UNIQUE,
    temperature DECIMAL(4, 1) NOT NULL COMMENT 'Thân nhiệt °C',
    weight DECIMAL(5, 2) NOT NULL COMMENT 'Cân nặng kg',
    heart_rate INT COMMENT 'Nhịp tim bpm',
    respiratory_rate INT COMMENT 'Nhịp thở lần/phút',
    mucous_membranes VARCHAR(100) DEFAULT 'Hồng hào',
    hydration VARCHAR(100) DEFAULT 'Bình thường',
    FOREIGN KEY (medical_record_id) REFERENCES medical_records(id) ON DELETE CASCADE
);

-- ----------------------------------------------------------------------------
-- 5. BẢNG TRIỆU CHỨNG LÂM SÀNG (Symptoms)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS symptoms (
    id INT AUTO_INCREMENT PRIMARY KEY,
    medical_record_id INT NOT NULL,
    symptom_description VARCHAR(255) NOT NULL,
    FOREIGN KEY (medical_record_id) REFERENCES medical_records(id) ON DELETE CASCADE
);

-- ----------------------------------------------------------------------------
-- 6. BẢNG KẾT QUẢ XÉT NGHIỆM CẬN LÂM SÀNG (Test Results)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS test_results (
    id INT AUTO_INCREMENT PRIMARY KEY,
    medical_record_id INT NOT NULL,
    test_name VARCHAR(150) NOT NULL,
    sample_type VARCHAR(100),
    result_text TEXT NOT NULL,
    status ENUM('Bình thường', 'Bất thường', 'Cần theo dõi', 'Nghi ngờ') DEFAULT 'Bình thường',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (medical_record_id) REFERENCES medical_records(id) ON DELETE CASCADE
);

-- ----------------------------------------------------------------------------
-- 7. BẢNG ĐƠN THUỐC & PHÁC ĐỒ ĐIỀU TRỊ (Prescriptions)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS prescriptions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    medical_record_id INT NOT NULL,
    drug_name VARCHAR(150) NOT NULL,
    active_ingredient VARCHAR(150),
    dosage VARCHAR(150) NOT NULL,
    duration VARCHAR(50) NOT NULL,
    notes TEXT,
    FOREIGN KEY (medical_record_id) REFERENCES medical_records(id) ON DELETE CASCADE
);


-- ============================================================================
-- DỮ LIỆU MẪU (SEED DATA DML)
-- ============================================================================
INSERT INTO pets (id, name, species, breed, gender, birth_date)
VALUES 
('pet_1', 'Bé Bơ', 'Chó', 'Golden Retriever', 'male', '2024-05-15'),
('pet_2', 'Miu Miu', 'Mèo', 'Mèo Anh lông ngắn', 'female', '2025-02-10')
ON DUPLICATE KEY UPDATE name=VALUES(name);

INSERT INTO pet_health_profiles (pet_id, blood_type, microchip, allergies, chronic_conditions, sterilized, overall_status)
VALUES 
('pet_1', 'DEA 1.1 Dương tính', '985141002348912', 'Dị ứng thịt gà công nghiệp & Penicillin', 'Không có bệnh mãn tính', 'Đã triệt sản', 'Khỏe mạnh'),
('pet_2', 'Nhóm A (Mèo)', '985141005891244', 'Chưa ghi nhận dị ứng', 'Cơ địa bàng quang nhạy cảm', 'Chưa triệt sản', 'Cần theo dõi')
ON DUPLICATE KEY UPDATE blood_type=VALUES(blood_type);

INSERT INTO medical_records (id, record_code, pet_id, visit_date, title, category, status, veterinarian, reason, confirmed_diagnosis, total_cost)
VALUES 
(1, 'MED-2026-001', 'pet_1', '2026-10-15', 'Viêm da dị ứng tiếp xúc & Nhiễm nấm Malassezia', 'Da liễu', 'Đã hoàn thành', 'BS. CKI. Nguyễn Văn Hùng', 'Gãi nhiều vùng cổ, rụng lông', 'Viêm da dị ứng kết hợp nấm men Malassezia', 520000.00),
(2, 'MED-2026-002', 'pet_1', '2026-08-28', 'Rối loạn tiêu hóa cấp tính do kích ứng thức ăn', 'Tiêu hóa', 'Đã hoàn thành', 'BS. Lê Thị Thảo', 'Nôn mửa, đi phân lỏng', 'Rối loạn tiêu hóa cấp do đạm cao', 350000.00),
(3, 'MED-2026-004', 'pet_2', '2026-09-20', 'Hội chứng viêm đường tiết niệu dưới ở mèo (FLUTD)', 'Tiết niệu', 'Đang điều trị', 'BS. CKI. Nguyễn Văn Hùng', 'Tiểu rắt, tiểu máu', 'Viêm bàng quang cấp có cặn Struvite', 680000.00)
ON DUPLICATE KEY UPDATE record_code=VALUES(record_code);

INSERT INTO vital_signs (medical_record_id, temperature, weight, heart_rate, respiratory_rate)
VALUES 
(1, 38.6, 19.5, 110, 24),
(2, 38.8, 19.0, 118, 26),
(3, 38.9, 4.2, 140, 32)
ON DUPLICATE KEY UPDATE temperature=VALUES(temperature);

INSERT INTO test_results (medical_record_id, test_name, sample_type, result_text, status)
VALUES 
(1, 'Soi tươi biểu bì da cạo sâu', 'Biểu bì cổ & vành tai', 'Phát hiện tế bào nấm Malassezia dạng hồ lô (++)', 'Bất thường'),
(3, 'Tổng phân tích nước tiểu 10 thông số', 'Nước tiểu chọc dò', 'pH=7.5, Protein (++), Hồng cầu (+++)', 'Bất thường');

INSERT INTO prescriptions (medical_record_id, drug_name, active_ingredient, dosage, duration, notes)
VALUES 
(1, 'Cefalexin 250mg', 'Cephalosporin thế hệ 1', '1 viên x 2 lần/ngày', '7 ngày', 'Uống sau ăn'),
(1, 'Sữa tắm trị nấm Malaseb 250ml', 'Chlorhexidine + Miconazole', 'Tắm 2 lần/tuần', '3 tuần', 'Lưu bọt 10 phút'),
(3, 'Kháng sinh Marbofloxacin 20mg', 'Marbofloxacin', '1/2 viên x 1 lần/ngày', '10 ngày', 'Uống buổi sáng');


-- ============================================================================
-- CÁC TRUY VẤN SQL ĐIỂN HÌNH (SAMPLE QUERIES)
-- ============================================================================

-- Q1: Lấy danh sách bệnh án chi tiết cùng chỉ số sinh tồn của thú cưng
SELECT 
    mr.record_code,
    p.name AS pet_name,
    p.species,
    mr.visit_date,
    mr.category,
    mr.confirmed_diagnosis,
    vs.temperature,
    vs.weight,
    mr.veterinarian,
    mr.status
FROM medical_records mr
JOIN pets p ON mr.pet_id = p.id
LEFT JOIN vital_signs vs ON mr.id = vs.medical_record_id
WHERE mr.pet_id = 'pet_1' AND mr.is_deleted = FALSE
ORDER BY mr.visit_date DESC;

-- Q2: Thống kê số ca khám và doanh thu theo từng chuyên khoa
SELECT 
    category AS chuyen_khoa,
    COUNT(id) AS tong_so_ca,
    SUM(CASE WHEN status = 'Đã hoàn thành' THEN 1 ELSE 0 END) AS so_ca_khoi_benh,
    SUM(total_cost) AS tong_doanh_thu
FROM medical_records
WHERE is_deleted = FALSE
GROUP BY category
ORDER BY tong_so_ca DESC;
