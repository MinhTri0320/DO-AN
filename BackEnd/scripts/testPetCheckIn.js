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
const Cage = require("../models/cage");
const Boarding = require("../models/boarding");
const boardingsC = require("../controllers/boardingsC");

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
  console.log("     BẮT ĐẦU KIỂM THỬ CHỨC NĂNG PET CHECK-IN");
  console.log("========================================================\n");

  try {
    await connectDB();
    await User.init();
    await Pet.init();
    await Cage.init();
    await Boarding.init();

    // Dọn dẹp dữ liệu kiểm thử cũ
    await Boarding.deleteMany({ boardingCode: /^TEST-BRD-/ });
    await Cage.deleteMany({ cageCode: /^TEST-CHECKIN-/ });
    await Pet.deleteMany({ name: /^PetTestCheckin/ });
    await User.deleteMany({ phone: /^0999888/ });

    // Tạo dữ liệu mẫu phục vụ kiểm thử
    // 1. Khách hàng 1 & Khách hàng 2
    const customer1 = await User.create({
      name: "Nguyễn Khách Test 1",
      phone: "0999888111",
      password: "hashedpassword123",
      role: "pet_owner",
    });

    const customer2 = await User.create({
      name: "Trần Khách Test 2",
      phone: "0999888222",
      password: "hashedpassword123",
      role: "pet_owner",
    });

    // 2. Thú cưng 1 (thuộc Khách 1) & Thú cưng 2 (thuộc Khách 2)
    const pet1 = await Pet.create({
      name: "PetTestCheckin-Bơ",
      species: "Chó",
      breed: "Golden",
      ownerId: customer1._id,
    });

    const pet2 = await Pet.create({
      name: "PetTestCheckin-Miu",
      species: "Mèo",
      breed: "Anh lông ngắn",
      ownerId: customer2._id,
    });

    // 3. Chuồng trống (available), Chuồng bận (occupied), Chuồng bảo trì (maintenance)
    const cageAvailable = await Cage.create({
      cageCode: "TEST-CHECKIN-AVAIL",
      name: "Chuồng Test Trống",
      size: "vừa",
      pricePerDay: 150000,
      status: "available",
    });

    const cageOccupied = await Cage.create({
      cageCode: "TEST-CHECKIN-OCC",
      name: "Chuồng Test Đang Dùng",
      size: "vừa",
      pricePerDay: 150000,
      status: "occupied",
    });

    const cageMaint = await Cage.create({
      cageCode: "TEST-CHECKIN-MAINT",
      name: "Chuồng Test Bảo Trì",
      size: "vừa",
      pricePerDay: 150000,
      status: "maintenance",
    });

    // ---------------------------------------------------------
    // TEST 1: Check-in hợp lệ thành công
    // ---------------------------------------------------------
    console.log("--- TEST SUITE 1: CHECK-IN HỢP LỆ THÀNH CÔNG ---");
    let createdBoardingId = null;
    {
      const checkInDate = new Date();
      const expectedCheckOutDate = new Date(Date.now() + 86400000 * 3); // 3 ngày sau

      const { req, res } = createMockReqRes({
        body: {
          customerId: customer1._id,
          petId: pet1._id,
          cageId: cageAvailable._id,
          checkInDate,
          expectedCheckOutDate,
          belongings: "01 chăn ấm, 01 túi hạt Royal Canin, đồ chơi bóng gặm",
          healthNote: "Lanh lợi, mắt sạch, ăn uống bình thường",
          notes: "Khách hẹn đón lúc 17h",
        },
      });

      await boardingsC.checkIn(req, res);
      assert(res.statusCode === 201, "Check-in thành công trả về HTTP 201");
      assert(res.data?.success === true, "Thành công: success === true");
      assert(res.data?.boarding?.status === "checked_in", "Trạng thái lượt lưu chuồng là checked_in");
      assert(res.data?.boarding?.petName === pet1.name, "Tên thú cưng lưu đúng");
      assert(res.data?.boarding?.cageCode === cageAvailable.cageCode, "Mã chuồng lưu đúng");
      assert(res.data?.boarding?.belongings?.includes("chăn ấm"), "Ghi nhận đúng đồ mang theo (belongings)");
      assert(res.data?.boarding?.healthNote?.includes("Lanh lợi"), "Ghi nhận đúng tình trạng sức khỏe (healthNote)");

      createdBoardingId = res.data?.boarding?._id;

      // KIỂM TRA CHUỒNG TỰ ĐỘNG CHUYỂN SANG OCCUPIED
      const updatedCage = await Cage.findById(cageAvailable._id);
      assert(updatedCage.status === "occupied", "Chuồng tự động chuyển sang occupied sau check-in");
      assert(String(updatedCage.currentPetId) === String(pet1._id), "Chuồng lưu đúng ID thú cưng");
      assert(updatedCage.currentPetName === pet1.name, "Chuồng lưu đúng tên thú cưng");
    }

    // ---------------------------------------------------------
    // TEST 2: Từ chối khi thú cưng không thuộc khách đã chọn
    // ---------------------------------------------------------
    console.log("\n--- TEST SUITE 2: TỪ CHỐI KHI THÚ CƯNG KHÔNG THUỘC KHÁCH HÀNG ---");
    {
      // Chọn Customer 1 nhưng lại chọn Pet 2 (thuộc Customer 2)
      const { req, res } = createMockReqRes({
        body: {
          customerId: customer1._id,
          petId: pet2._id, // Không thuộc customer1
          cageId: cageAvailable._id,
          checkInDate: new Date(),
          expectedCheckOutDate: new Date(Date.now() + 86400000 * 2),
        },
      });

      await boardingsC.checkIn(req, res);
      assert(res.statusCode === 400, "Thú cưng không thuộc khách: Trả về HTTP 400");
      assert(res.data?.success === false, "Thú cưng không thuộc khách: success === false");
      assert(
        res.data?.message?.includes("không thuộc về khách hàng"),
        "Thông báo lỗi rõ ràng: Thú cưng không thuộc về khách hàng đã chọn"
      );
    }

    // ---------------------------------------------------------
    // TEST 3: Từ chối khi chuồng không có trạng thái available
    // ---------------------------------------------------------
    console.log("\n--- TEST SUITE 3: TỪ CHỐI KHI CHUỒNG KHÔNG AVAILABLE ---");
    {
      // 1. Chuồng đang occupied
      const { req: reqOcc, res: resOcc } = createMockReqRes({
        body: {
          customerId: customer2._id,
          petId: pet2._id,
          cageId: cageOccupied._id,
          checkInDate: new Date(),
          expectedCheckOutDate: new Date(Date.now() + 86400000 * 2),
        },
      });
      await boardingsC.checkIn(reqOcc, resOcc);
      assert(resOcc.statusCode === 400, "Chuồng occupied: Bị từ chối với HTTP 400");
      assert(
        resOcc.data?.message?.includes("không khả dụng") || resOcc.data?.message?.includes("available"),
        "Thông báo lỗi yêu cầu chọn chuồng trống (available)"
      );

      // 2. Chuồng đang maintenance
      const { req: reqMaint, res: resMaint } = createMockReqRes({
        body: {
          customerId: customer2._id,
          petId: pet2._id,
          cageId: cageMaint._id,
          checkInDate: new Date(),
          expectedCheckOutDate: new Date(Date.now() + 86400000 * 2),
        },
      });
      await boardingsC.checkIn(reqMaint, resMaint);
      assert(resMaint.statusCode === 400, "Chuồng maintenance: Bị từ chối với HTTP 400");
    }

    // ---------------------------------------------------------
    // TEST 4: Từ chối khi thú cưng vẫn đang lưu ở chuồng khác
    // ---------------------------------------------------------
    console.log("\n--- TEST SUITE 4: TỪ CHỐI KHI THÚ CƯNG ĐANG LƯU Ở CHUỒNG KHÁC ---");
    {
      // Tạo một chuồng trống mới
      const cageAvailable2 = await Cage.create({
        cageCode: "TEST-CHECKIN-AVAIL2",
        name: "Chuồng Trống Thứ 2",
        size: "nhỏ",
        pricePerDay: 100000,
        status: "available",
      });

      // Thử check-in pet1 vào chuồng mới trong khi pet1 đang lưu ở TEST-CHECKIN-AVAIL
      const { req, res } = createMockReqRes({
        body: {
          customerId: customer1._id,
          petId: pet1._id, // Đã checked_in ở TEST 1
          cageId: cageAvailable2._id,
          checkInDate: new Date(),
          expectedCheckOutDate: new Date(Date.now() + 86400000 * 2),
        },
      });

      await boardingsC.checkIn(req, res);
      assert(res.statusCode === 400, "Thú cưng đang lưu chuồng khác: Bị từ chối HTTP 400");
      assert(
        res.data?.message?.includes("đang lưu ở chuồng khác"),
        "Thông báo lỗi rõ ràng: Thú cưng hiện đang lưu ở chuồng khác"
      );
    }

    // ---------------------------------------------------------
    // TEST 5: Từ chối khi ngày dự kiến trả không sau ngày nhận
    // ---------------------------------------------------------
    console.log("\n--- TEST SUITE 5: TỪ CHỐI KHI NGÀY TRẢ <= NGÀY NHẬN ---");
    {
      const cageForDateTest = await Cage.create({
        cageCode: "TEST-CHECKIN-DATE",
        name: "Chuồng Test Ngày",
        size: "nhỏ",
        pricePerDay: 100000,
        status: "available",
      });

      // Ngày trả bằng ngày nhận
      const { req: reqSame, res: resSame } = createMockReqRes({
        body: {
          customerId: customer2._id,
          petId: pet2._id,
          cageId: cageForDateTest._id,
          checkInDate: "2026-11-25",
          expectedCheckOutDate: "2026-11-25",
        },
      });
      await boardingsC.checkIn(reqSame, resSame);
      assert(resSame.statusCode === 400, "Ngày trả bằng ngày nhận: Bị từ chối HTTP 400");
      assert(
        resSame.data?.message?.includes("phải sau ngày nhận"),
        "Thông báo lỗi yêu cầu ngày trả phải sau ngày nhận"
      );

      // Ngày trả trước ngày nhận
      const { req: reqBefore, res: resBefore } = createMockReqRes({
        body: {
          customerId: customer2._id,
          petId: pet2._id,
          cageId: cageForDateTest._id,
          checkInDate: "2026-11-25",
          expectedCheckOutDate: "2026-11-24",
        },
      });
      await boardingsC.checkIn(reqBefore, resBefore);
      assert(resBefore.statusCode === 400, "Ngày trả trước ngày nhận: Bị từ chối HTTP 400");
    }

    // ---------------------------------------------------------
    // TEST 6: Từ chối khi thiếu trường dữ liệu bắt buộc
    // ---------------------------------------------------------
    console.log("\n--- TEST SUITE 6: VALIDATION THIẾU DỮ LIỆU BẮT BUỘC ---");
    {
      // Thiếu customerId
      const { req: req1, res: res1 } = createMockReqRes({
        body: { petId: pet2._id, cageId: cageOccupied._id, expectedCheckOutDate: "2026-11-30" },
      });
      await boardingsC.checkIn(req1, res1);
      assert(res1.statusCode === 400 && res1.data?.message?.includes("khách hàng"), "Thiếu customerId bị từ chối");

      // Thiếu petId
      const { req: req2, res: res2 } = createMockReqRes({
        body: { customerId: customer2._id, cageId: cageOccupied._id, expectedCheckOutDate: "2026-11-30" },
      });
      await boardingsC.checkIn(req2, res2);
      assert(res2.statusCode === 400 && res2.data?.message?.includes("thú cưng"), "Thiếu petId bị từ chối");

      // Thiếu cageId
      const { req: req3, res: res3 } = createMockReqRes({
        body: { customerId: customer2._id, petId: pet2._id, expectedCheckOutDate: "2026-11-30" },
      });
      await boardingsC.checkIn(req3, res3);
      assert(res3.statusCode === 400 && res3.data?.message?.includes("chuồng"), "Thiếu cageId bị từ chối");

      // Thiếu expectedCheckOutDate
      const { req: req4, res: res4 } = createMockReqRes({
        body: { customerId: customer2._id, petId: pet2._id, cageId: cageOccupied._id },
      });
      await boardingsC.checkIn(req4, res4);
      assert(res4.statusCode === 400 && res4.data?.message?.includes("ngày dự kiến trả"), "Thiếu expectedCheckOutDate bị từ chối");
    }

    // ---------------------------------------------------------
    // TEST 7: API Lấy danh sách chuồng trống cho Check-in
    // ---------------------------------------------------------
    console.log("\n--- TEST SUITE 7: LẤY DANH SÁCH CHUỒNG TRỐNG (available-cages) ---");
    {
      const { req, res } = createMockReqRes({});
      await boardingsC.getAvailableCages(req, res);
      assert(res.statusCode === 200, "Lấy danh sách chuồng trống trả về HTTP 200");
      assert(Array.isArray(res.data?.cages), "cages là một mảng");
      const onlyAvailable = res.data?.cages.every((c) => c.status === "available");
      assert(onlyAvailable, "Tất cả chuồng trả về đều có trạng thái available");
    }

    // ---------------------------------------------------------
    // TEST 8: API Kiểm tra thú cưng có đang lưu chuồng không
    // ---------------------------------------------------------
    console.log("\n--- TEST SUITE 8: KIỂM TRA TRẠNG THÁI THÚ CƯNG (check-pet) ---");
    {
      // Pet 1 đang lưu
      const { req: req1, res: res1 } = createMockReqRes({ params: { petId: String(pet1._id) } });
      await boardingsC.checkPetBoarding(req1, res1);
      assert(res1.data?.isBoarding === true, "Pet 1 được xác định là isBoarding === true");

      // Pet 2 chưa lưu
      const { req: req2, res: res2 } = createMockReqRes({ params: { petId: String(pet2._id) } });
      await boardingsC.checkPetBoarding(req2, res2);
      assert(res2.data?.isBoarding === false, "Pet 2 được xác định là isBoarding === false");
    }

    // ---------------------------------------------------------
    // TEST 9: API Lấy danh sách đang lưu chuồng (active)
    // ---------------------------------------------------------
    console.log("\n--- TEST SUITE 9: DANH SÁCH ĐANG LƯU CHUỒNG (active) ---");
    {
      const { req, res } = createMockReqRes({});
      await boardingsC.getActiveBoardings(req, res);
      assert(res.statusCode === 200, "Lấy danh sách active trả về HTTP 200");
      assert(res.data?.count >= 1, "Có ít nhất 1 thú cưng đang lưu");
      const allCheckedIn = res.data?.boardings.every((b) => b.status === "checked_in");
      assert(allCheckedIn, "Tất cả các bản ghi đều có status === checked_in");
    }

    // ---------------------------------------------------------
    // TEST 10: API Lấy chi tiết lượt lưu chuồng (getBoardingById)
    // ---------------------------------------------------------
    console.log("\n--- TEST SUITE 10: XEM CHI TIẾT LƯỢT LƯU CHUỒNG ---");
    {
      const { req, res } = createMockReqRes({ params: { id: String(createdBoardingId) } });
      await boardingsC.getBoardingById(req, res);
      assert(res.statusCode === 200, "Lấy chi tiết trả về HTTP 200");
      assert(res.data?.boarding?.petName === pet1.name, "Khớp tên thú cưng");
    }

    // Dọn dẹp dữ liệu test
    await Boarding.deleteMany({ boardingCode: /^TEST-BRD-/ });
    await Cage.deleteMany({ cageCode: /^TEST-CHECKIN-/ });
    await Pet.deleteMany({ name: /^PetTestCheckin/ });
    await User.deleteMany({ phone: /^0999888/ });

    console.log("\n========================================================");
    console.log(`   KẾT QUẢ KIỂM THỬ: ${passedCount} PASS, ${failedCount} FAIL`);
    console.log("========================================================\n");

    await mongoose.connection.close();
    process.exit(failedCount > 0 ? 1 : 0);
  } catch (err) {
    console.error("LỖI NGOẠI LỆ TRONG QUÁ TRÌNH KIỂM THỬ:", err);
    process.exit(1);
  }
}

runTests();