const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
const dns = require("dns");
try {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
} catch (e) {}

const mongoose = require("mongoose");
const connectDB = require("../config/database");
const Cage = require("../models/cage");
const cagesC = require("../controllers/cagesC");

// Mock Express req & res
function createMockReqRes({ params = {}, query = {}, body = {} } = {}) {
  const req = { params, query, body };
  const res = {
    statusCode: 200,
    data: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.data = payload;
      return this;
    },
  };
  return { req, res };
}

let passedCount = 0;
let failedCount = 0;

function assert(condition, testName, details = "") {
  if (condition) {
    console.log(`  ✓ PASS: ${testName}`);
    passedCount++;
  } else {
    console.error(`  ✗ FAIL: ${testName} - ${details}`);
    failedCount++;
  }
}

async function runTests() {
  console.log("\n========================================================");
  console.log("   BẮT ĐẦU KIỂM THỬ CHỨC NĂNG CAGE LIST AND STATUS");
  console.log("========================================================\n");

  try {
    await connectDB();
    await Cage.init();

    // Dọn dẹp dữ liệu test cũ nếu có
    await Cage.deleteMany({ cageCode: /^TEST-CAGE-/ });

    // ---------------------------------------------------------
    // TEST 1: Thêm chuồng mới (POST /api/cages)
    // ---------------------------------------------------------
    console.log("--- TEST SUITE 1: THÊM CHUỒNG MỚI (createCage) ---");
    {
      const { req, res } = createMockReqRes({
        body: {
          cageCode: "TEST-CAGE-01",
          name: "Chuồng Test 01 - Kính Cường Lực",
          size: "nhỏ",
          pricePerDay: 120000,
          status: "available",
          notes: "Chuồng kiểm thử tự động",
        },
      });

      await cagesC.createCage(req, res);
      assert(res.statusCode === 201, "Tạo chuồng mới trả về HTTP 201");
      assert(res.data?.success === true, "Thành công: success === true");
      assert(res.data?.cage?.cageCode === "TEST-CAGE-01", "Mã chuồng lưu đúng TEST-CAGE-01");
      assert(res.data?.cage?.status === "available", "Trạng thái ban đầu là available");
    }

    // ---------------------------------------------------------
    // TEST 2: Kiểm tra trùng mã chuồng & giá không hợp lệ
    // ---------------------------------------------------------
    console.log("\n--- TEST SUITE 2: VALIDATION TRÙNG MÃ & GIÁ (createCage) ---");
    {
      // Trùng mã
      const { req, res } = createMockReqRes({
        body: {
          cageCode: "TEST-CAGE-01",
          size: "vừa",
          pricePerDay: 150000,
        },
      });
      await cagesC.createCage(req, res);
      assert(res.statusCode === 400, "Trùng mã chuồng bị từ chối với HTTP 400");
      assert(res.data?.message?.includes("đã tồn tại"), "Thông báo lỗi trùng mã chuồng chính xác");

      // Cố tình tạo chuồng occupied
      const { req: reqOcc, res: resOcc } = createMockReqRes({
        body: {
          cageCode: "TEST-CAGE-OCC",
          size: "vừa",
          pricePerDay: 150000,
          status: "occupied",
        },
      });
      await cagesC.createCage(reqOcc, resOcc);
      assert(resOcc.statusCode === 400, "Cấm tạo chuồng mới ở trạng thái occupied");

      // Giá âm
      const { req: reqNeg, res: resNeg } = createMockReqRes({
        body: {
          cageCode: "TEST-CAGE-NEG",
          size: "vừa",
          pricePerDay: -50000,
        },
      });
      await cagesC.createCage(reqNeg, resNeg);
      assert(resNeg.statusCode === 400, "Giá âm bị từ chối với HTTP 400");
    }

    // Tạo thêm chuồng test để phục vụ kiểm thử lọc và chuyển trạng thái
    {
      const { req, res } = createMockReqRes({
        body: {
          cageCode: "TEST-CAGE-02",
          name: "Chuồng Test 02 - Cỡ Vừa",
          size: "vừa",
          pricePerDay: 180000,
          status: "available",
        },
      });
      await cagesC.createCage(req, res);
    }
    {
      const { req, res } = createMockReqRes({
        body: {
          cageCode: "TEST-CAGE-03",
          name: "Chuồng Test 03 - Cỡ Lớn",
          size: "lớn",
          pricePerDay: 250000,
          status: "maintenance",
        },
      });
      await cagesC.createCage(req, res);
    }

    // ---------------------------------------------------------
    // TEST 3: Lấy danh sách chuồng & Thống kê KPI (getCages)
    // ---------------------------------------------------------
    console.log("\n--- TEST SUITE 3: LẤY DANH SÁCH & THỐNG KÊ (getCages) ---");
    {
      const { req, res } = createMockReqRes({});
      await cagesC.getCages(req, res);
      assert(res.statusCode === 200, "Lấy danh sách chuồng trả về HTTP 200");
      assert(Array.isArray(res.data?.cages), "Kết quả cages là một mảng");
      assert(res.data?.kpi?.total >= 3, "KPI total >= 3 chuồng");
      assert(typeof res.data?.kpi?.available === "number", "KPI available là số");
      assert(typeof res.data?.kpi?.occupied === "number", "KPI occupied là số");
      assert(typeof res.data?.kpi?.maintenance === "number", "KPI maintenance là số");
    }

    // ---------------------------------------------------------
    // TEST 4: Lọc theo trạng thái (status filter)
    // ---------------------------------------------------------
    console.log("\n--- TEST SUITE 4: LỌC THEO TRẠNG THÁI (status filter) ---");
    {
      // Lọc available
      const { req, res } = createMockReqRes({ query: { status: "available" } });
      await cagesC.getCages(req, res);
      const allAvailable = res.data?.cages.every((c) => c.status === "available");
      assert(allAvailable, "Lọc status=available chỉ trả về chuồng trống");

      // Lọc maintenance
      const { req: reqM, res: resM } = createMockReqRes({ query: { status: "maintenance" } });
      await cagesC.getCages(reqM, resM);
      const allMaint = resM.data?.cages?.length > 0 && resM.data.cages.every((c) => c.status === "maintenance");
      assert(allMaint, "Lọc status=maintenance chỉ trả về chuồng bảo trì");
    }

    // ---------------------------------------------------------
    // TEST 5: Lọc theo kích cỡ (size filter)
    // ---------------------------------------------------------
    console.log("\n--- TEST SUITE 5: LỌC THEO KÍCH CỠ (size filter) ---");
    {
      const { req, res } = createMockReqRes({ query: { size: "nhỏ" } });
      await cagesC.getCages(req, res);
      const allSmall = res.data?.cages?.length > 0 && res.data.cages.every((c) => ["nhỏ", "small", "Small"].includes(c.size));
      assert(allSmall, "Lọc size=nhỏ chỉ trả về chuồng cỡ nhỏ");

      // Test tương thích size=large
      const { req: reqL, res: resL } = createMockReqRes({ query: { size: "large" } });
      await cagesC.getCages(reqL, resL);
      const allLarge = resL.data?.cages?.length > 0 && resL.data.cages.every((c) => ["lớn", "large", "Large"].includes(c.size));
      assert(allLarge, "Lọc size=large tương thích tiếng Anh trả về đúng cỡ lớn");
    }

    // ---------------------------------------------------------
    // TEST 6: Tìm kiếm theo từ khóa (search)
    // ---------------------------------------------------------
    console.log("\n--- TEST SUITE 6: TÌM KIẾM THEO TỪ KHÓA (search) ---");
    {
      const { req, res } = createMockReqRes({ query: { search: "TEST-CAGE-01" } });
      await cagesC.getCages(req, res);
      assert(res.data?.cages?.length === 1, "Tìm kiếm chính xác trả về 1 kết quả");
      assert(res.data?.cages[0]?.cageCode === "TEST-CAGE-01", "Kết quả tìm kiếm khớp mã TEST-CAGE-01");
    }

    // ---------------------------------------------------------
    // TEST 7: Chỉnh sửa thông tin chuồng (updateCage)
    // ---------------------------------------------------------
    console.log("\n--- TEST SUITE 7: CHỈNH SỬA THÔNG TIN CHUỒNG (updateCage) ---");
    {
      const { req, res } = createMockReqRes({
        params: { id: "TEST-CAGE-01" },
        body: {
          name: "Chuồng Test 01 - Đã Cập Nhật Tên",
          pricePerDay: 135000,
          status: "maintenance", // Chuyển sang bảo trì hợp lệ
        },
      });
      await cagesC.updateCage(req, res);
      assert(res.statusCode === 200, "Cập nhật chuồng thành công HTTP 200");
      assert(res.data?.cage?.name === "Chuồng Test 01 - Đã Cập Nhật Tên", "Tên chuồng được cập nhật");
      assert(res.data?.cage?.pricePerDay === 135000, "Giá chuồng được cập nhật");
      assert(res.data?.cage?.status === "maintenance", "Chuyển sang maintenance thành công");

      // Chuyển lại về available
      const { req: reqBack, res: resBack } = createMockReqRes({
        params: { id: "TEST-CAGE-01" },
        body: { status: "available" },
      });
      await cagesC.updateCage(reqBack, resBack);
      assert(resBack.data?.cage?.status === "available", "Chuyển lại về available thành công");

      // Cố tình chuyển sang occupied bằng tay -> Phải từ chối!
      const { req: reqOcc, res: resOcc } = createMockReqRes({
        params: { id: "TEST-CAGE-01" },
        body: { status: "occupied" },
      });
      await cagesC.updateCage(reqOcc, resOcc);
      assert(resOcc.statusCode === 400, "Cấm nhân viên chỉnh tay sang occupied bằng PUT");
    }

    // ---------------------------------------------------------
    // TEST 8: Chuyển đổi nhanh bảo trì (toggleMaintenance)
    // ---------------------------------------------------------
    console.log("\n--- TEST SUITE 8: CHUYỂN ĐỔI BẢO TRÌ (toggleMaintenance) ---");
    {
      // Đang available -> chuyển sang maintenance
      const { req, res } = createMockReqRes({
        params: { id: "TEST-CAGE-02" },
        body: { notes: "Khử khuẩn định kỳ" },
      });
      await cagesC.toggleMaintenance(req, res);
      assert(res.statusCode === 200, "Toggle maintenance thành công");
      assert(res.data?.cage?.status === "maintenance", "Chuồng chuyển sang maintenance");

      // Đang maintenance -> mở lại available
      const { req: req2, res: res2 } = createMockReqRes({
        params: { id: "TEST-CAGE-02" },
      });
      await cagesC.toggleMaintenance(req2, res2);
      assert(res2.data?.cage?.status === "available", "Chuồng mở lại available thành công");
    }

    // ---------------------------------------------------------
    // TEST 9: Check-in tự động chuyển sang occupied (checkIn)
    // ---------------------------------------------------------
    console.log("\n--- TEST SUITE 9: CHECK-IN CHUỒNG TỰ ĐỘNG CHUYỂN OCCUPIED ---");
    {
      const { req, res } = createMockReqRes({
        params: { id: "TEST-CAGE-01" },
        body: {
          petId: "pet_test_123",
          petName: "Bé Cún Mẫu",
          checkOutDate: new Date(Date.now() + 86400000 * 3),
        },
      });
      await cagesC.checkIn(req, res);
      assert(res.statusCode === 200, "Check-in thành công HTTP 200");
      assert(res.data?.cage?.status === "occupied", "Chuồng tự động chuyển sang occupied");
      assert(res.data?.cage?.currentPetName === "Bé Cún Mẫu", "Lưu đúng tên thú cưng lưu trú");
    }

    // ---------------------------------------------------------
    // TEST 10: RÀNG BUỘC CỐT LÕI - CHUỒNG OCCUPIED KHÔNG ĐƯỢC XÓA!
    // ---------------------------------------------------------
    console.log("\n--- TEST SUITE 10: RÀNG BUỘC CẤM XÓA CHUỒNG OCCUPIED (deleteCage) ---");
    {
      // 1. Thử xóa chuồng đang occupied
      const { req, res } = createMockReqRes({ params: { id: "TEST-CAGE-01" } });
      await cagesC.deleteCage(req, res);
      assert(res.statusCode === 400, "Cấm xóa chuồng occupied: Trả về HTTP 400");
      assert(res.data?.success === false, "Cấm xóa chuồng occupied: success === false");
      assert(res.data?.message?.includes("occupied") || res.data?.message?.includes("thú cưng"), "Thông báo lỗi cấm xóa rõ ràng");

      // 2. Thử sửa đổi status bằng tay khi chuồng đang occupied -> Phải từ chối!
      const { req: reqEdit, res: resEdit } = createMockReqRes({
        params: { id: "TEST-CAGE-01" },
        body: { status: "available" },
      });
      await cagesC.updateCage(reqEdit, resEdit);
      assert(resEdit.statusCode === 400, "Cấm sửa trạng thái bằng tay khi chuồng đang occupied");

      // 3. Thử toggle bảo trì khi chuồng đang occupied -> Phải từ chối!
      const { req: reqMaint, res: resMaint } = createMockReqRes({
        params: { id: "TEST-CAGE-01" },
      });
      await cagesC.toggleMaintenance(reqMaint, resMaint);
      assert(resMaint.statusCode === 400, "Cấm đưa chuồng occupied vào bảo trì");
    }

    // ---------------------------------------------------------
    // TEST 11: Check-out tự động chuyển về available (checkOut)
    // ---------------------------------------------------------
    console.log("\n--- TEST SUITE 11: CHECK-OUT CHUỒNG TỰ ĐỘNG CHUYỂN AVAILABLE ---");
    {
      const { req, res } = createMockReqRes({ params: { id: "TEST-CAGE-01" } });
      await cagesC.checkOut(req, res);
      assert(res.statusCode === 200, "Check-out thành công HTTP 200");
      assert(res.data?.cage?.status === "available", "Chuồng tự động chuyển về available");
      assert(res.data?.cage?.currentPetId == null, "Thông tin thú cưng được giải phóng");
    }

    // ---------------------------------------------------------
    // TEST 12: Xóa chuồng đã available thành công
    // ---------------------------------------------------------
    console.log("\n--- TEST SUITE 12: XÓA CHUỒNG AVAILABLE (deleteCage) ---");
    {
      const { req, res } = createMockReqRes({ params: { id: "TEST-CAGE-01" } });
      await cagesC.deleteCage(req, res);
      assert(res.statusCode === 200, "Xóa chuồng available thành công HTTP 200");

      // Xác minh chuồng đã bị đánh dấu xóa (soft deleted)
      const deletedCage = await Cage.findOne({ cageCode: "TEST-CAGE-01" });
      assert(deletedCage?.isDeleted === true, "Chuồng được đánh dấu isDeleted = true");
    }

    // Dọn dẹp dữ liệu test
    await Cage.deleteMany({ cageCode: /^TEST-CAGE-/ });

    console.log("\n========================================================");
    console.log(`   KẾT QUẢ KIỂM THỬ: ${passedCount} PASS, ${failedCount} FAIL`);
    console.log("========================================================\n");

    await mongoose.connection.close();
    process.exit(failedCount > 0 ? 1 : 0);
  } catch (err) {
    console.error("LỖI NGOẠI LỆ TRONG QUÁ TRÌNH TEST:", err);
    process.exit(1);
  }
}

runTests();