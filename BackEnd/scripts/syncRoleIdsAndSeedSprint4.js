const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
const dns = require("dns");
try {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
} catch (e) {}

const mongoose = require("mongoose");
const connectDB = require("../config/database");

const User = require("../models/user");
const Doctor = require("../models/doctor");
const Medicine = require("../models/medicine");
const Grooming = require("../models/grooming");
const Dispensing = require("../models/dispensing");
const Invoice = require("../models/invoice");
const Payment = require("../models/payment");

const sampleMedicines = [
  {
    medicineCode: "MED-2026-001",
    name: "Cefalexin 250mg",
    activeIngredient: "Cephalosporin thế hệ 1",
    unit: "viên",
    price: 10000,
    quantity: 100,
    expiryDate: new Date("2027-12-31"),
    description: "Kháng sinh phổ rộng chống nhiễm khuẩn cơ hội đường hô hấp, da và mô mềm",
    manufacturer: "Dược phẩm Thú y Vemedim",
  },
  {
    medicineCode: "MED-2026-002",
    name: "Sữa tắm trị nấm Malaseb 250ml",
    activeIngredient: "Chlorhexidine + Miconazole",
    unit: "chai",
    price: 260000,
    quantity: 25,
    expiryDate: new Date("2027-10-30"),
    description: "Đặc trị viêm da tăng tiết bã nhờn và nấm men Malassezia ở chó mèo",
    manufacturer: "Dermcare Úc",
  },
  {
    medicineCode: "MED-2026-003",
    name: "Dung dịch vệ sinh tai Otoproct 15ml",
    activeIngredient: "Dexamethasone + Polymyxin B",
    unit: "lọ",
    price: 120000,
    quantity: 35,
    expiryDate: new Date("2027-08-15"),
    description: "Trị viêm tai ngoài cấp và mãn tính, giảm ngứa và tiêu diệt vi khuẩn tai",
    manufacturer: "Marphavet",
  },
  {
    medicineCode: "MED-2026-004",
    name: "Men vi sinh Enterogermina",
    activeIngredient: "Bào tử Bacillus clausii",
    unit: "ống",
    price: 30000,
    quantity: 60,
    expiryDate: new Date("2027-11-20"),
    description: "Hỗ trợ phục hồi cân bằng hệ vi sinh đường ruột và giảm tiêu chảy cấp",
    manufacturer: "Sanofi",
  },
  {
    medicineCode: "MED-2026-005",
    name: "Thuốc tráng niêm mạc Phosphalugel",
    activeIngredient: "Aluminium phosphate",
    unit: "gói",
    price: 65000,
    quantity: 45,
    expiryDate: new Date("2027-09-10"),
    description: "Kháng acid dịch vị, làm dịu niêm mạc dạ dày và chống trào ngược",
    manufacturer: "Boehringer Ingelheim",
  },
  {
    medicineCode: "MED-2026-006",
    name: "Kháng sinh Marbofloxacin 20mg",
    activeIngredient: "Marbofloxacin (Fluoroquinolone)",
    unit: "viên",
    price: 56000,
    quantity: 50,
    expiryDate: new Date("2027-12-01"),
    description: "Đặc trị nhiễm trùng đường tiết niệu và hô hấp dưới ở chó mèo",
    manufacturer: "Vétoquinol Pháp",
  },
  {
    medicineCode: "MED-2026-007",
    name: "Gel dinh dưỡng hỗ trợ tan sỏi Uro-Pet 120g",
    activeIngredient: "DL-Methionine",
    unit: "tuýp",
    price: 400000,
    quantity: 18,
    expiryDate: new Date("2027-06-25"),
    description: "Hỗ trợ làm tan sỏi và cặn Struvite bàng quang, axit hóa nước tiểu an toàn",
    manufacturer: "Vetoquinol",
  },
  // Thuốc mẫu quá hạn dùng (để test chặn cấp thuốc hết hạn)
  {
    medicineCode: "MED-EXPIRED-001",
    name: "Amoxicillin Thú y 500mg (Mẫu thử hết hạn)",
    activeIngredient: "Amoxicillin trihydrate",
    unit: "vỉ",
    price: 45000,
    quantity: 20,
    expiryDate: new Date("2024-01-01"), // Đã hết hạn
    description: "Mẫu kiểm thử tính năng chặn cấp thuốc quá hạn dùng của hệ thống",
    manufacturer: "PawnCare Lab",
  },
  // Thuốc mẫu hết hàng (để test nhãn Hết hàng & chặn cấp thiếu tồn kho)
  {
    medicineCode: "MED-OUTOFSTOCK-001",
    name: "Viên nhai trị ve rận NexGard Spectra (Mẫu hết hàng)",
    activeIngredient: "Afoxolaner + Milbemycin oxime",
    unit: "hộp",
    price: 350000,
    quantity: 0, // Hết hàng
    expiryDate: new Date("2027-12-31"),
    description: "Mẫu kiểm thử tính năng nhãn Hết hàng và chặn cấp khi tồn kho = 0",
    manufacturer: "Boehringer Ingelheim",
  },
];

async function syncAndSeed() {
  try {
    await connectDB();
    console.log("-> Đang kết nối database:", mongoose.connection.name);

    // 1. Khởi tạo Indexes
    await User.init();
    await Doctor.init();
    await Medicine.init();
    await Grooming.init();
    await Dispensing.init();
    await Invoice.init();
    await Payment.init();
    console.log("✓ Đã khởi tạo Indexes cho toàn bộ Models");

    // 2. Đồng bộ trường role_id cho TẤT CẢ người dùng hiện có trong collection users
    const users = await User.find({});
    console.log(`\n-> Tìm thấy ${users.length} tài khoản trong collection "users". Bắt đầu cập nhật role_id...`);

    const roleMap = {
      admin: 1,
      doctor: 2,
      receptionist: 3,
      pet_owner: 4,
    };

    let updatedCount = 0;
    for (const u of users) {
      const targetRoleId = roleMap[u.role] || (u.phone === "0369633139" ? 1 : 4);
      await User.updateOne(
        { _id: u._id },
        {
          $set: {
            role_id: targetRoleId,
            role: u.role || (targetRoleId === 1 ? "admin" : "pet_owner"),
          },
        }
      );
      console.log(`   + Cập nhật [${u.phone}] - "${u.name}": role = "${u.role || "pet_owner"}" -> role_id = ${targetRoleId}`);
      updatedCount++;
    }
    console.log(`✓ Đã cập nhật thành công role_id cho ${updatedCount} tài khoản trong MongoDB Atlas!`);

    // 3. Nạp danh mục thuốc mẫu (medicines)
    console.log(`\n-> Đang nạp ${sampleMedicines.length} loại thuốc vào collection "medicines"...`);
    for (const med of sampleMedicines) {
      await Medicine.findOneAndUpdate(
        { medicineCode: med.medicineCode },
        { $set: med },
        { upsert: true, new: true }
      );
    }
    console.log(`✓ Đã nạp danh mục thuốc mẫu thành công!`);

    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log("\nDANH SÁCH COLLECTIONS HIỆN TẠI TRÊN MONGODB ATLAS:");
    collections.forEach((c) => console.log(` - ${c.name}`));

    await mongoose.connection.close();
    console.log("\n=> HOÀN TẤT ĐỒNG BỘ ROLE_ID VÀ DỮ LIỆU! Bạn có thể Refresh MongoDB Compass để xem ngay.");
    process.exit(0);
  } catch (error) {
    console.error("Lỗi đồng bộ:", error);
    process.exit(1);
  }
}

syncAndSeed();
