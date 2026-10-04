const mongoose = require("mongoose");
const Pet = require("../models/pet");


const getPets = async (req, res) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({
        message: "Thiếu userId"
      });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        message: "userId không hợp lệ"
      });
    }

    const pets = await Pet.find({
      ownerId: userId
    }).sort({ createdAt: -1 });

    res.status(200).json({
      pets: pets
    });

  } catch (error) {
    console.log("Lỗi lấy danh sách thú cưng:", error);

    res.status(500).json({
      message: "Lỗi server"
    });
  }
};


const getPetById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: "ID thú cưng không hợp lệ"
      });
    }

    const pet = await Pet.findById(id);

    if (!pet) {
      return res.status(404).json({
        message: "Không tìm thấy thú cưng"
      });
    }

    res.status(200).json({
      pet: pet
    });

  } catch (error) {
    console.log("Lỗi lấy thú cưng:", error);

    res.status(500).json({
      message: "Lỗi server"
    });
  }
};


const createPet = async (req, res) => {
  try {
    const {
      name,
      species,
      breed,
      gender,
      birthDate,
      weight,
      vaccinated,
      sterilized,
      avatar,
      notes,
      userId
    } = req.body;

    if (!name || !species || !userId) {
      return res.status(400).json({
        message: "Thiếu tên, loài hoặc người sở hữu"
      });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        message: "userId không hợp lệ"
      });
    }

    // FE: "Đực" -> DB: "male"
    // FE: "Cái" -> DB: "female"
    let genderValue;

    if (gender === "Đực" || gender === "male") {
      genderValue = "male";
    } else if (gender === "Cái" || gender === "female") {
      genderValue = "female";
    }

    // FE: "Đã tiêm phòng đủ" -> true
    let vaccinatedValue = false;

    if (
      vaccinated === true ||
      vaccinated === "true" ||
      vaccinated === "Đã tiêm phòng đủ"
    ) {
      vaccinatedValue = true;
    }

    // FE: "Đã triệt sản" -> true
    let sterilizedValue = false;

    if (
      sterilized === true ||
      sterilized === "true" ||
      sterilized === "Đã triệt sản"
    ) {
      sterilizedValue = true;
    }

    const pet = await Pet.create({
      name: name,
      species: species,
      breed: breed,
      gender: genderValue,
      birthDate: birthDate || undefined,
      weight: weight !== undefined && weight !== "" ? Number(weight) : undefined,
      vaccinated: vaccinatedValue,
      sterilized: sterilizedValue,
      avatar: avatar,
      notes: notes,
      ownerId: userId
    });

    res.status(201).json({
      pet: pet
    });

  } catch (error) {
    console.log("Lỗi thêm thú cưng:", error);

    res.status(500).json({
      message: "Lỗi server"
    });
  }
};


const updatePet = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: "ID thú cưng không hợp lệ"
      });
    }

    const {
      name,
      species,
      breed,
      gender,
      birthDate,
      weight,
      vaccinated,
      sterilized,
      avatar,
      notes
    } = req.body;

    let genderValue;

    if (gender === "Đực" || gender === "male") {
      genderValue = "male";
    } else if (gender === "Cái" || gender === "female") {
      genderValue = "female";
    }

    let vaccinatedValue = false;

    if (
      vaccinated === true ||
      vaccinated === "true" ||
      vaccinated === "Đã tiêm phòng đủ"
    ) {
      vaccinatedValue = true;
    }

    let sterilizedValue = false;

    if (
      sterilized === true ||
      sterilized === "true" ||
      sterilized === "Đã triệt sản"
    ) {
      sterilizedValue = true;
    }

    const pet = await Pet.findByIdAndUpdate(
      id,
      {
        name: name,
        species: species,
        breed: breed,
        gender: genderValue,
        birthDate: birthDate || undefined,
        weight: weight !== undefined && weight !== "" ? Number(weight) : undefined,
        vaccinated: vaccinatedValue,
        sterilized: sterilizedValue,
        avatar: avatar,
        notes: notes
      },
      {
        new: true,
        runValidators: true
      }
    );

    if (!pet) {
      return res.status(404).json({
        message: "Không tìm thấy thú cưng"
      });
    }

    res.status(200).json({
      pet: pet
    });

  } catch (error) {
    console.log("Lỗi cập nhật thú cưng:", error);

    res.status(500).json({
      message: "Lỗi server"
    });
  }
};


const deletePet = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: "ID thú cưng không hợp lệ"
      });
    }

    const pet = await Pet.findByIdAndDelete(id);

    if (!pet) {
      return res.status(404).json({
        message: "Không tìm thấy thú cưng"
      });
    }

    res.status(200).json({
      message: "Xóa thú cưng thành công"
    });

  } catch (error) {
    console.log("Lỗi xóa thú cưng:", error);

    res.status(500).json({
      message: "Lỗi server"
    });
  }
};


module.exports = {
  getPets,
  getPetById,
  createPet,
  updatePet,
  deletePet
};