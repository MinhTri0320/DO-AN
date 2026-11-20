const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
const dns = require("dns");
try {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
} catch (e) {}

const mongoose = require("mongoose");
const connectDB = require("../config/database");
const Cage = require("../models/cage");

const sampleCages = [
  // 1. Chuồng kích cỡ NHỎ (dành cho mèo hoặc chó nhỏ < 5kg)
  {
    cageCode: "CAGE-S01",
    size: "nhỏ",
    pricePerDay: 100000,
    status: "available",
    notes: "Chuồng inox tầng 1, khay đệm sạch sẽ thoáng mát",
    isDeleted: false,
  },
  {
    cageCode: "CAGE-S02",
    size: "nhỏ",
    pricePerDay: 100000,
    status: "occupied",
    currentPetId: "pet_2",
    currentPetName: "Miu Miu",
    checkInDate: new Date("2026-11-19T08:30:00Z"),
    checkOutDate: new Date("2026-11-23T17:00:00Z"),
    notes: "Đang lưu trú theo dõi sau điều trị viêm bàng quang",
    isDeleted: false,
  },
  {
    cageCode: "CAGE-S03",
    size: "nhỏ",
    pricePerDay: 100000,
    status: "maintenance",
    notes: "Đang khử trùng tia cực tím & thay chốt khóa an toàn",
    isDeleted: false,
  },

  // 2. Chuồng kích cỡ VỪA (dành cho chó mèo 5 - 12kg)
  {
    cageCode: "CAGE-M01",
    size: "vừa",
    pricePerDay: 150000,
    status: "available",
    notes: "Chuồng đệm êm, khay ăn uống tự động, sẵn sàng đón thú cưng",
    isDeleted: false,
  },
  {
    cageCode: "CAGE-M02",
    size: "vừa",
    pricePerDay: 150000,
    status: "occupied",
    currentPetId: "6afb3d4929cc539c893f82d3",
    currentPetName: "Huy",
    checkInDate: new Date("2026-11-20T09:00:00Z"),
    checkOutDate: new Date("2026-11-25T11:00:00Z"),
    notes: "Lưu trú phòng tĩnh cách ly theo dõi sau điều trị",
    isDeleted: false,
  },
  {
    cageCode: "CAGE-M03",
    size: "vừa",
    pricePerDay: 150000,
    status: "available",
    notes: "Khu vực sưởi ấm mùa đông, đệm lông cừu",
    isDeleted: false,
  },

  // 3. Chuồng kích cỡ LỚN (dành cho cún lớn > 12kg)
  {
    cageCode: "CAGE-L01",
    size: "lớn",
    pricePerDay: 250000,
    status: "available",
    notes: "Chuồng VIP rộng rãi có camera giám sát 24/7",
    isDeleted: false,
  },
  {
    cageCode: "CAGE-L02",
    size: "lớn",
    pricePerDay: 250000,
    status: "occupied",
    currentPetId: "pet_1",
    currentPetName: "Bé Bơ",
    checkInDate: new Date("2026-11-18T10:00:00Z"),
    checkOutDate: new Date("2026-11-22T18:00:00Z"),
    notes: "Lưu trú dịch vụ khách sạn thú cưng",
    isDeleted: false,
  },
  {
    cageCode: "CAGE-L03",
    size: "lớn",
    pricePerDay: 250000,
    status: "maintenance",
    notes: "Bảo dưỡng hệ thống điều hòa & cấp nước tự động",
    isDeleted: false,
  },
];

async function seedCages() {
  try {
    await connectDB();
    console.log("-> Đang đồng bộ danh sách chuồng (Cage List & Status) vào MongoDB...");

    await Cage.init();
    console.log("✓ Đã khởi tạo Indexes cho Cage (cageCode, status, size)");

    for (const cageData of sampleCages) {
      await Cage.findOneAndUpdate(
        { cageCode: cageData.cageCode },
        { $set: cageData },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      console.log(`✓ Đã nạp chuồng: [${cageData.cageCode}] - Cỡ: ${cageData.size} - Giá: ${cageData.pricePerDay.toLocaleString()}đ/ngày - Trạng thái: ${cageData.status}`);
    }

    const totalCages = await Cage.countDocuments({ isDeleted: false });
    const availableCages = await Cage.countDocuments({ status: "available", isDeleted: false });
    const occupiedCages = await Cage.countDocuments({ status: "occupied", isDeleted: false });
    const maintenanceCages = await Cage.countDocuments({ status: "maintenance", isDeleted: false });

    console.log("\n================ KẾT QUẢ TRÊN MONGODB ================");
    console.log(`Tổng số chuồng (cages): ${totalCages}`);
    console.log(`- Trống (available):    ${availableCages}`);
    console.log(`- Đang dùng (occupied): ${occupiedCages}`);
    console.log(`- Bảo trì (maintenance): ${maintenanceCages}`);
    console.log("======================================================");

    await mongoose.connection.close();
    console.log("=> HOÀN TẤT NẠP DỮ LIỆU CAGE VÀO MONGODB THÀNH CÔNG!");
    process.exit(0);
  } catch (err) {
    console.error("X Lỗi khi nạp danh sách chuồng:", err.message);
    process.exit(1);
  }
}

seedCages();
