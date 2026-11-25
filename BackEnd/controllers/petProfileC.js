const mongoose = require("mongoose");
const Pet = require("../models/pet");
const User = require("../models/user");

const ROLE_MAP = {
  admin: 1,
  doctor: 2,
  receptionist: 3,
  pet_owner: 4,
};

const parseGender = (raw) => {
  if (typeof raw !== "string") return undefined;
  const val = raw.trim().toLowerCase();
  if (val === "đực" || val === "male" || val === "m") return "male";
  if (val === "cái" || val === "female" || val === "f") return "female";
  return undefined;
};

const parseVaccinated = (raw) => {
  if (typeof raw === "boolean") return raw;
  if (typeof raw === "string") {
    const val = raw.trim().toLowerCase();
    if (
      val === "true" ||
      val === "1" ||
      val === "đã tiêm phòng đủ" ||
      val === "đã tiêm" ||
      val === "yes"
    ) {
      return true;
    }
    if (
      val === "false" ||
      val === "0" ||
      val === "cần tiêm nhắc lại" ||
      val === "chưa tiêm" ||
      val === "chưa tiêm phòng" ||
      val === "no"
    ) {
      return false;
    }
  }
  return false;
};

const parseSterilized = (raw) => {
  if (typeof raw === "boolean") return raw;
  if (typeof raw === "string") {
    const val = raw.trim().toLowerCase();
    if (val === "true" || val === "1" || val === "đã triệt sản" || val === "yes") {
      return true;
    }
    if (
      val === "false" ||
      val === "0" ||
      val === "chưa triệt sản" ||
      val === "chưa" ||
      val === "no"
    ) {
      return false;
    }
  }
  return false;
};

const parseWeight = (raw) => {
  if (raw === undefined || raw === null || raw === "") return undefined;
  const num =
    typeof raw === "number" ? raw : parseFloat(String(raw).replace(",", "."));
  return !Number.isNaN(num) && num >= 0 ? num : undefined;
};

const formatPet = (pet) => {
  const obj = typeof pet.toJSON === "function" ? pet.toJSON() : { ...pet };
  let computedAge = "";
  if (typeof obj.ageText === "string" && obj.ageText.trim()) {
    computedAge = obj.ageText.trim();
  } else if (obj.birthDate) {
    const birth = new Date(obj.birthDate);
    if (!Number.isNaN(birth.getTime())) {
      computedAge = Math.floor(
        (Date.now() - birth.getTime()) / (365.25 * 24 * 60 * 60 * 1000)
      );
    }
  } else if (obj.age !== null && obj.age !== undefined && obj.age !== "") {
    computedAge = obj.age;
  }

  return {
    ...obj,
    age: computedAge,
  };
};

const checkPetAccess = async (req, pet) => {
  const rawCallerId = req.headers["x-user-id"] || req.headers["user-id"];
  if (
    !rawCallerId ||
    typeof rawCallerId !== "string" ||
    !mongoose.Types.ObjectId.isValid(rawCallerId.trim())
  ) {
    return { allowed: true };
  }

  const callerId = rawCallerId.trim();
  if (String(pet.ownerId) === callerId) {
    return { allowed: true };
  }

  const caller = await User.findOne({
    _id: callerId,
    isDeleted: { $ne: true },
  }).lean();

  if (caller) {
    const roleId = caller.role_id || ROLE_MAP[caller.role] || 4;
    if ([1, 2, 3].includes(roleId)) {
      return { allowed: true };
    }
  }

  return {
    allowed: false,
    status: 403,
    message: "Bạn không có quyền truy cập hồ sơ thú cưng của người khác",
  };
};

const getPets = async (req, res) => {
  try {
    const userId = req.query.userId || req.query.ownerId || req.headers["x-user-id"];

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

    return res.status(200).json({
      pets: pets.map(formatPet)
    });

  } catch (error) {
    console.log("Lỗi lấy danh sách thú cưng:", error);

    return res.status(500).json({
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

    const access = await checkPetAccess(req, pet);
    if (!access.allowed) {
      return res.status(access.status).json({
        message: access.message
      });
    }

    return res.status(200).json({
      pet: formatPet(pet)
    });

  } catch (error) {
    console.log("Lỗi lấy thú cưng:", error);

    return res.status(500).json({
      message: "Lỗi server"
    });
  }
};


const createPet = async (req, res) => {
  try {
    const body = req.body || {};
    const {
      name,
      species,
      breed,
      gender,
      birthDate,
      age,
      ageText,
      weight,
      vaccinated,
      sterilized,
      avatar,
      notes,
      userId,
      ownerId
    } = body;

    const resolvedOwnerId = userId || ownerId || req.headers["x-user-id"];

    if (!name || !species || !resolvedOwnerId) {
      return res.status(400).json({
        message: "Thiếu tên, loài hoặc người sở hữu"
      });
    }

    if (!mongoose.Types.ObjectId.isValid(resolvedOwnerId)) {
      return res.status(400).json({
        message: "userId không hợp lệ"
      });
    }

    const genderValue = parseGender(gender);
    const vaccinatedValue = parseVaccinated(vaccinated);
    const sterilizedValue = parseSterilized(sterilized);
    const weightValue = parseWeight(weight);

    const resolvedAgeText =
      typeof ageText === "string" && ageText.trim() !== ""
        ? ageText.trim()
        : age !== undefined && age !== null && String(age).trim() !== ""
          ? String(age).trim()
          : "";

    const pet = await Pet.create({
      name: name,
      species: species,
      breed: breed,
      gender: genderValue,
      birthDate: birthDate || undefined,
      ageText: resolvedAgeText,
      weight: weightValue,
      vaccinated: vaccinatedValue,
      sterilized: sterilizedValue,
      avatar: avatar,
      notes: notes,
      ownerId: resolvedOwnerId
    });

    return res.status(201).json({
      pet: formatPet(pet)
    });

  } catch (error) {
    console.log("Lỗi thêm thú cưng:", error);

    return res.status(500).json({
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

    const existingPet = await Pet.findById(id);

    if (!existingPet) {
      return res.status(404).json({
        message: "Không tìm thấy thú cưng"
      });
    }

    const access = await checkPetAccess(req, existingPet);
    if (!access.allowed) {
      return res.status(access.status).json({
        message: access.message
      });
    }

    const body = req.body || {};
    const {
      name,
      species,
      breed,
      gender,
      birthDate,
      age,
      ageText,
      weight,
      vaccinated,
      sterilized,
      avatar,
      notes
    } = body;

    const genderValue = parseGender(gender);
    const weightValue = parseWeight(weight);

    const updateFields = {};
    if (name !== undefined) updateFields.name = name;
    if (species !== undefined) updateFields.species = species;
    if (breed !== undefined) updateFields.breed = breed;
    if (genderValue !== undefined) updateFields.gender = genderValue;
    if (birthDate !== undefined) updateFields.birthDate = birthDate || undefined;
    if (ageText !== undefined) {
      updateFields.ageText =
        ageText !== null ? String(ageText).trim() : "";
    } else if (age !== undefined) {
      updateFields.ageText =
        age !== null ? String(age).trim() : "";
    }
    if (weightValue !== undefined) updateFields.weight = weightValue;
    if (avatar !== undefined) updateFields.avatar = avatar;
    if (notes !== undefined) updateFields.notes = notes;

    if (vaccinated !== undefined) {
      updateFields.vaccinated = parseVaccinated(vaccinated);
    }

    if (sterilized !== undefined) {
      updateFields.sterilized = parseSterilized(sterilized);
    }

    const pet = await Pet.findByIdAndUpdate(
      id,
      { $set: updateFields },
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

    return res.status(200).json({
      pet: formatPet(pet)
    });

  } catch (error) {
    console.log("Lỗi cập nhật thú cưng:", error);

    return res.status(500).json({
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

    const existingPet = await Pet.findById(id);

    if (!existingPet) {
      return res.status(404).json({
        message: "Không tìm thấy thú cưng"
      });
    }

    const access = await checkPetAccess(req, existingPet);
    if (!access.allowed) {
      return res.status(access.status).json({
        message: access.message
      });
    }

    await Pet.findByIdAndDelete(id);

    return res.status(200).json({
      message: "Xóa thú cưng thành công"
    });

  } catch (error) {
    console.log("Lỗi xóa thú cưng:", error);

    return res.status(500).json({
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