const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
const dns = require("dns");
try {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
} catch (e) {}

const mongoose = require("mongoose");
const connectDB = require("../config/database");

const User = require("../models/user");
const Pet = require("../models/pet");
const Grooming = require("../models/grooming");

async function seedGrooming() {
  try {
    await connectDB();
    console.log("-> Đang đồng bộ thông tin Grooming (Schedule & Status) vào MongoDB...\n");

    await Grooming.init();
    console.log("✓ Đã khởi tạo Indexes cho Grooming (dateISO, startMinutes, customerId, petId, status)");

    // Lấy thú cưng thực tế
    const petHuy = await Pet.findOne({ name: "Huy" }).lean();
    const petThinh = await Pet.findOne({ name: "Thịnh" }).lean();
    const petTriz = await Pet.findOne({ name: "triz" }).lean();
    const petToan = await Pet.findOne({ name: "toàn" }).lean();

    if (!petHuy) {
      console.warn("Chưa tìm thấy thú cưng để seed Grooming.");
      process.exit(0);
    }

    const sampleGroomings = [
      // 1. Bé Huy - Dịch vụ "Cắt tỉa lông toàn thân Poodle" - Trạng thái: completed
      {
        groomingCode: "GRM-2026-001",
        customerId: petHuy.ownerId,
        customerName: "Nguyễn Văn Chủ Bé Huy",
        customerPhone: "0364938914",
        petId: petHuy._id,
        petName: petHuy.name,
        petSpecies: petHuy.species || "Chó",
        serviceName: "Cắt tỉa lông toàn thân Poodle",
        price: 250000,
        date: "20/11/2026",
        dateISO: "2026-11-20",
        startTime: "09:00",
        duration: 60,
        endTime: "10:00",
        startMinutes: 540,
        endMinutes: 600,
        note: "Tỉa dáng gấu bông Teddy bear, vệ sinh sạch tai",
        status: "completed",
        groomerName: "Kỹ thuật viên Lan Anh",
        isDeleted: false,
      },

      // 2. Bé Thịnh - Dịch vụ "Tắm dưỡng mượt & Vắt tuyến hôi" - Trạng thái: in_progress
      {
        groomingCode: "GRM-2026-002",
        customerId: petThinh ? petThinh.ownerId : petHuy.ownerId,
        customerName: "Khách hàng Thịnh",
        customerPhone: "0961009332",
        petId: petThinh ? petThinh._id : petHuy._id,
        petName: petThinh ? petThinh.name : "Thịnh",
        petSpecies: "Chó",
        serviceName: "Tắm dưỡng mượt & Vắt tuyến hôi",
        price: 180000,
        date: "22/11/2026",
        dateISO: "2026-11-22",
        startTime: "10:30",
        duration: 45,
        endTime: "11:15",
        startMinutes: 630,
        endMinutes: 675,
        note: "Dùng sữa tắm dịu nhẹ dưỡng ẩm, sấy phồng lông",
        status: "in_progress",
        groomerName: "Kỹ thuật viên Minh Hoàng",
        isDeleted: false,
      },

      // 3. Bé triz - Dịch vụ "Cắt móng & Cạo lông bàn chân" - Trạng thái: pending (Chờ làm)
      {
        groomingCode: "GRM-2026-003",
        customerId: petTriz ? petTriz.ownerId : petHuy.ownerId,
        customerName: "Khách hàng triz",
        customerPhone: "0369633139",
        petId: petTriz ? petTriz._id : petHuy._id,
        petName: petTriz ? petTriz.name : "triz",
        petSpecies: "Chó",
        serviceName: "Cắt móng & Cạo lông bàn chân",
        price: 80000,
        date: "22/11/2026",
        dateISO: "2026-11-22",
        startTime: "14:00",
        duration: 30,
        endTime: "14:30",
        startMinutes: 840,
        endMinutes: 870,
        note: "Mài dũa móng bo tròn tránh cào xước",
        status: "pending",
        groomerName: "Kỹ thuật viên Lan Anh",
        isDeleted: false,
      },

      // 4. Bé toàn - Dịch vụ "Nhuộm tai đuôi thời trang" - Trạng thái: cancelled (Đã hủy)
      {
        groomingCode: "GRM-2026-004",
        customerId: petToan ? petToan.ownerId : petHuy.ownerId,
        customerName: "Nguyễn Văn Chủ Bé Toàn",
        customerPhone: "0364938914",
        petId: petToan ? petToan._id : petHuy._id,
        petName: petToan ? petToan.name : "toàn",
        petSpecies: "Chó",
        serviceName: "Nhuộm tai đuôi thời trang",
        price: 200000,
        date: "22/11/2026",
        dateISO: "2026-11-22",
        startTime: "15:00",
        duration: 45,
        endTime: "15:45",
        startMinutes: 900,
        endMinutes: 945,
        note: "Khách bận việc đột xuất xin hủy lịch hẹn",
        status: "cancelled",
        groomerName: "Kỹ thuật viên Minh Hoàng",
        isDeleted: false,
      },

      // 5. Bé Huy - Lịch hẹn Grooming toàn diện sắp tới - Trạng thái: pending
      {
        groomingCode: "GRM-2026-005",
        customerId: petHuy.ownerId,
        customerName: "Nguyễn Văn Chủ Bé Huy",
        customerPhone: "0364938914",
        petId: petHuy._id,
        petName: petHuy.name,
        petSpecies: petHuy.species || "Chó",
        serviceName: "Gói Grooming Toàn Diện (Tắm + Cắt tỉa + Spa)",
        price: 320000,
        date: "25/11/2026",
        dateISO: "2026-11-25",
        startTime: "09:30",
        duration: 75,
        endTime: "10:45",
        startMinutes: 570,
        endMinutes: 645,
        note: "Ngâm bồn sục massage ozone khử mùi",
        status: "pending",
        groomerName: "Kỹ thuật viên Lan Anh",
        isDeleted: false,
      },
    ];

    for (const g of sampleGroomings) {
      await Grooming.findOneAndUpdate(
        { groomingCode: g.groomingCode },
        { $set: g },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      console.log(`✓ Đã nạp lịch Grooming: [${g.groomingCode}] - Bé: ${g.petName} - Dịch vụ: "${g.serviceName}" - Giờ: ${g.startTime} (${g.date}) - Trạng thái: ${g.status}`);
    }

    // Kiểm tra các hàm nghiệp vụ trên Model
    console.log("\n--- KIỂM TRA NGHIỆP VỤ CẤP MODEL (TRÍ) ---");

    // 1. Thử nghiệm kiểm tra trùng giờ
    console.log("1. Kiểm tra phát hiện trùng giờ:");
    // Thử đặt lịch vào ngày 22/11/2026 lúc 10:45 (giao với 10:30-11:15 của GRM-2026-002)
    const isOverlapped = await Grooming.checkOverlap({
      dateISO: "2026-11-22",
      startTime: "10:45",
      duration: 30,
    });
    if (isOverlapped) {
      console.log(`   ✓ Phát hiện trùng giờ chính xác: Trùng với lịch [${isOverlapped.groomingCode}] (${isOverlapped.startTime} - ${isOverlapped.endTime})`);
    }

    // Thử đặt trùng giờ với lịch đã hủy (GRM-2026-004 lúc 15:00)
    const isOverlapCancelled = await Grooming.checkOverlap({
      dateISO: "2026-11-22",
      startTime: "15:00",
      duration: 30,
    });
    console.log(`   ✓ Lịch đã hủy "cancelled" KHÔNG bị tính trùng giờ: overlap = ${isOverlapCancelled ? "Có" : "Không (Hợp lệ)"}`);

    // 2. Thử nghiệm chuyển trạng thái đúng thứ tự & chặn chuyển ngược
    console.log("2. Kiểm tra chuyển trạng thái đúng thứ tự:");
    const testDoc = await Grooming.findOne({ groomingCode: "GRM-2026-003" });
    if (testDoc) {
      console.log(`   - Trạng thái hiện tại: ${testDoc.status}`);
      // Chuyển pending -> in_progress (hợp lệ)
      await testDoc.changeStatus("in_progress");
      console.log(`   ✓ Chuyển sang "in_progress" thành công: ${testDoc.status}`);

      // Chuyển in_progress -> completed (hợp lệ)
      await testDoc.changeStatus("completed");
      console.log(`   ✓ Chuyển tiếp sang "completed" thành công: ${testDoc.status}`);

      // Thử chuyển ngược completed -> pending (không hợp lệ)
      try {
        await testDoc.changeStatus("pending");
        console.log("   X Lỗi: Lẽ ra phải chặn chuyển ngược!");
      } catch (err) {
        console.log(`   ✓ Chặn chuyển ngược thành công: "${err.message}"`);
      }

      // Khôi phục lại trạng thái pending cho testDoc
      await Grooming.updateOne({ _id: testDoc._id }, { $set: { status: "pending" } });
    }

    // 3. Kiểm tra các hàm truy vấn của Trí
    console.log("\n--- KIỂM TRA TRUY VẤN LỊCH GROOMING (TRÍ) ---");
    // Theo ngày
    const listByDate = await Grooming.findByDate("22/11/2026");
    console.log(`1. Danh sách lịch ngày 22/11/2026 (sắp xếp tăng dần theo giờ): ${listByDate.length} lịch`);
    listByDate.forEach((g) => {
      console.log(`   + [${g.groomingCode}] ${g.startTime} - ${g.endTime} | Bé: ${g.petName} | ${g.serviceName} | Trạng thái: ${g.status}`);
    });

    // Theo khoảng ngày
    const listRange = await Grooming.findByDateRange("2026-11-20", "2026-11-25");
    console.log(`2. Danh sách lịch theo khoảng ngày (20/11 - 25/11): ${listRange.length} lịch`);

    // Theo khách hàng
    const listCustomer = await Grooming.findByCustomer(petHuy.ownerId);
    console.log(`3. Danh sách lịch theo khách hàng: ${listCustomer.length} lịch`);

    // Theo thú cưng
    const listPet = await Grooming.findByPet(petHuy._id);
    console.log(`4. Danh sách lịch theo thú cưng (Huy): ${listPet.length} lịch`);

    console.log("\n================ KẾT QUẢ TRÊN MONGODB ================");
    const totalDocs = await Grooming.countDocuments({ isDeleted: false });
    const pendingCount = await Grooming.countDocuments({ status: "pending", isDeleted: false });
    const inProgressCount = await Grooming.countDocuments({ status: "in_progress", isDeleted: false });
    const completedCount = await Grooming.countDocuments({ status: "completed", isDeleted: false });
    const cancelledCount = await Grooming.countDocuments({ status: "cancelled", isDeleted: false });
    console.log(`Collection: groomings (Tổng: ${totalDocs} lịch)`);
    console.log(`- pending (Chờ thực hiện):   ${pendingCount}`);
    console.log(`- in_progress (Đang làm):    ${inProgressCount}`);
    console.log(`- completed (Đã hoàn thành): ${completedCount}`);
    console.log(`- cancelled (Đã hủy):        ${cancelledCount}`);
    console.log("======================================================");

    await mongoose.connection.close();
    console.log("=> HOÀN TẤT NẠP DỮ LIỆU GROOMING VÀO MONGODB THÀNH CÔNG!");
    process.exit(0);
  } catch (err) {
    console.error("X Lỗi:", err);
    process.exit(1);
  }
}

seedGrooming();
