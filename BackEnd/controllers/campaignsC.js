const CampaignRegistration = require("../models/campaignRegistration");
const CAMPAIGNS = require("../config/campaigns");

const isPhone = (value) =>
  typeof value === "string" &&
  /^[+()\d\s.-]{7,20}$/.test(value.trim()) &&
  (value.match(/\d/g) || []).length >= 7;

const registerCampaign = async (req, res) => {
  const { campaignId, name, phone, email, userId } = req.body || {};

  if (
    typeof campaignId !== "string" ||
    !CAMPAIGNS[campaignId.trim()] ||
    typeof name !== "string" ||
    name.trim().length < 2 ||
    name.trim().length > 120 ||
    !isPhone(phone) ||
    typeof email !== "string" ||
    email.trim().length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
    (userId !== undefined &&
      (typeof userId !== "string" || !userId.trim() || userId.length > 100))
  ) {
    return res.status(400).json({ message: "Thông tin đăng ký chiến dịch không hợp lệ." });
  }

  const normalizedCampaignId = campaignId.trim();
  const normalizedEmail = email.trim().toLowerCase();

  try {
    const duplicateCriteria = [
      { email: normalizedEmail },
      ...(userId ? [{ userId: userId.trim() }] : []),
    ];
    const existing = await CampaignRegistration.findOne({
      campaignId: normalizedCampaignId,
      $or: duplicateCriteria,
    });
    if (existing) {
      return res.status(409).json({ message: "Thông tin này đã đăng ký chiến dịch." });
    }

    const registration = await CampaignRegistration.create({
      campaignId: normalizedCampaignId,
      name,
      phone,
      email: normalizedEmail,
      userId: userId?.trim(),
    });

    return res.status(201).json({
      message: "Đăng ký chiến dịch thành công.",
      registration: {
        id: registration.id,
        campaignId: registration.campaignId,
        name: registration.name,
        email: registration.email,
        createdAt: registration.createdAt,
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: "Thông tin này đã đăng ký chiến dịch." });
    }
    console.error("Lỗi đăng ký chiến dịch:", error);
    return res.status(500).json({ message: "Không thể đăng ký chiến dịch lúc này." });
  }
};

module.exports = registerCampaign;
