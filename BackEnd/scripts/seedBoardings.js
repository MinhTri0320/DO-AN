const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
const dns = require("dns");
try {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
} catch (e) {}

const mongoose = require("mongoose");
const connectDB = require("../config/database");

// Nạp các models liên quan
const User = require("../models/user");
const Pet = require("../models/pet");
const Cage = require("../models/cage");
const Boarding = require("../models/boarding");

async function seedBoardings() {
  try {
    await connectDB();
    console.log("-> Đang đồng bộ thông tin Boarding (Pet Check-in) vào MongoDB...");

    await Boarding.init();
    console.log("✓ Đã khởi tạo Indexes cho Boarding (status, customerId, petId, cageId)");

    // Lấy dữ liệu thực tế từ database
    const users = await User.find({}).lean();
    const pets = await Pet.find({}).lean();
    const cages = await Cage.find({}).lean();

    if (pets.length === 0 || cages.length === 0) {
      console.warn("Chưa đủ dữ liệu thú cưng hoặc chuồng để tạo Boarding.");
      process.exit(0);
    }

    // Tìm các chuồng và thú cưng tương ứng
    const cageM02 = cages.find((c) => c.cageCode === "CAGE-M02") || cages[0];
    const cageS02 = cages.find((c) => c.cageCode === "CAGE-S02") || cages[1];
    const cageL02 = cages.find((c) => c.cageCode === "CAGE-L02") || cages[2];
    const cageM01 = cages.find((c) => c.cageCode === "CAGE-M01") || cages[3];

    const petHuy = pets.find((p) => p.name === "Huy") || pets[0];
    const petThinh = pets.find((p) => p.name === "Thịnh") || pets[1];
    const petTriz = pets.find((p) => p.name === "triz") || pets[2];
    const petToan = pets.find((p) => p.name === "toàn") || pets[3];

    const sampleBoardings = [
      // 1. Bé Huy đang lưu chuồng CAGE-M02 (Đang lưu - checked_in)
      {
        boardingCode: "BRD-2026-693",
        customerId: petHuy.ownerId,
        customerName: "Nguyễn Văn Chủ Bé Huy",
        customerPhone: "0364938914",
        petId: petHuy._id,
        petName: petHuy.name,
        petSpecies: petHuy.species || "Chó",
        cageId: cageM02._id,
        cageCode: cageM02.cageCode,
        checkInDate: new Date("2026-11-20T09:00:00Z"),
        expectedCheckOutDate: new Date("2026-11-25T11:00:00Z"),
        actualCheckOutDate: null,
        belongings: "Chăn ấm riêng, khay thức ăn, đồ chơi gặm nướu",
        healthNote: "Theo dõi sát sau đợt điều trị, ăn uống ổn định, lanh lợi",
        status: "checked_in",
        dailyPrice: cageM02.pricePerDay || 150000,
        estimatedTotalCost: (cageM02.pricePerDay || 150000) * 5,
        notes: "Lưu trú phòng tĩnh cách ly theo dõi sau điều trị",
        isDeleted: false,
      },

      // 2. Bé triz đang lưu chuồng CAGE-S02 (Đang lưu - checked_in)
      {
        boardingCode: "BRD-2026-777",
        customerId: petTriz.ownerId,
        customerName: "Khách hàng triz",
        customerPhone: "0369633139",
        petId: petTriz._id,
        petName: petTriz.name,
        petSpecies: petTriz.species || "Chó",
        cageId: cageS02._id,
        cageCode: cageS02.cageCode,
        checkInDate: new Date("2026-11-19T08:30:00Z"),
        expectedCheckOutDate: new Date("2026-11-23T17:00:00Z"),
        actualCheckOutDate: null,
        belongings: "Áo len ấm, 2 gói pate royal canin",
        healthNote: "Sức khỏe tốt, da hơi khô cần bổ sung dầu cá",
        status: "checked_in",
        dailyPrice: cageS02.pricePerDay || 100000,
        estimatedTotalCost: (cageS02.pricePerDay || 100000) * 4,
        notes: "Khách gửi đi công tác cuối tuần",
        isDeleted: false,
      },

      // 3. Bé Thịnh đang lưu chuồng CAGE-L02 (Đang lưu - checked_in)
      {
        boardingCode: "BRD-2026-904",
        customerId: petThinh.ownerId,
        customerName: "Khách hàng Thịnh",
        customerPhone: "0961009332",
        petId: petThinh._id,
        petName: petThinh.name,
        petSpecies: petThinh.species || "Chó",
        cageId: cageL02._id,
        cageCode: cageL02.cageCode,
        checkInDate: new Date("2026-11-18T10:00:00Z"),
        expectedCheckOutDate: new Date("2026-11-22T18:00:00Z"),
        actualCheckOutDate: null,
        belongings: "Đệm nằm cá nhân, vòng cổ, đồ chơi bóng tròn",
        healthNote: "Khỏe mạnh, thể trạng 6.6kg, thích chạy nhảy",
        status: "checked_in",
        dailyPrice: cageL02.pricePerDay || 250000,
        estimatedTotalCost: (cageL02.pricePerDay || 250000) * 4,
        notes: "Dịch vụ khách sạn thú cưng cao cấp",
        isDeleted: false,
      },

      // 4. Bé toàn từng lưu chuồng CAGE-M01 (Đã hoàn thành trả thú cưng - checked_out)
      {
        boardingCode: "BRD-2026-001",
        customerId: petToan.ownerId,
        customerName: "Nguyễn Văn Chủ Bé Toàn",
        customerPhone: "0364938914",
        petId: petToan._id,
        petName: petToan.name,
        petSpecies: petToan.species || "Chó",
        cageId: cageM01._id,
        cageCode: cageM01.cageCode,
        checkInDate: new Date("2026-11-10T08:00:00Z"),
        expectedCheckOutDate: new Date("2026-11-14T17:00:00Z"),
        actualCheckOutDate: new Date("2026-11-14T16:30:00Z"),
        belongings: "Khăn lau, bình nước tự động",
        healthNote: "Bình thường, đã tiêm phòng đầy đủ",
        status: "checked_out",
        dailyPrice: cageM01.pricePerDay || 150000,
        estimatedTotalCost: (cageM01.pricePerDay || 150000) * 4,
        notes: "Đã bàn giao lại thú cưng cho khách hàng, thanh toán đầy đủ",
        isDeleted: false,
      },
    ];

    for (const b of sampleBoardings) {
      await Boarding.findOneAndUpdate(
        { boardingCode: b.boardingCode },
        { $set: b },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      console.log(`✓ Đã nạp lượt Boarding: [${b.boardingCode}] - Bé: ${b.petName} - Chuồng: ${b.cageCode} - Trạng thái: ${b.status}`);
    }

    // Kiểm tra các hàm truy vấn Model của Trí
    console.log("\n--- KIỂM TRA TRUY VẤN MODEL (TRÍ) ---");
    const activeList = await Boarding.findActiveBoardings();
    console.log(`1. Danh sách thú cưng đang lưu chuồng (checked_in): ${activeList.length} bé`);
    activeList.forEach((item) => {
      console.log(`   + [${item.boardingCode}] ${item.petName} tại chuồng ${item.cageCode} (Nhận: ${item.checkInDate.toISOString().slice(0, 10)})`);
    });

    const petHistory = await Boarding.findByPet(petHuy._id);
    console.log(`2. Lịch sử lưu chuồng theo thú cưng (${petHuy.name}): ${petHistory.length} lượt`);

    const customerHistory = await Boarding.findByCustomer(petHuy.ownerId);
    console.log(`3. Lịch sử lưu chuồng theo khách hàng: ${customerHistory.length} lượt`);

    console.log("\n================ KẾT QUẢ TRÊN MONGODB ================");
    const totalDocs = await Boarding.countDocuments({ isDeleted: false });
    const checkedInCount = await Boarding.countDocuments({ status: "checked_in", isDeleted: false });
    const checkedOutCount = await Boarding.countDocuments({ status: "checked_out", isDeleted: false });
    console.log(`Collection: boardings`);
    console.log(`- Tổng số lượt lưu chuồng: ${totalDocs}`);
    console.log(`- Đang lưu (checked_in):   ${checkedInCount}`);
    console.log(`- Đã trả (checked_out):    ${checkedOutCount}`);
    console.log("======================================================");

    await mongoose.connection.close();
    console.log("=> HOÀN TẤT NẠP DỮ LIỆU BOARDING VÀO MONGODB THÀNH CÔNG!");
    process.exit(0);
  } catch (err) {
    console.error("X Lỗi khi nạp Boarding:", err.message);
    process.exit(1);
  }
}

seedBoardings();
