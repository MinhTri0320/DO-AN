const CampaignRegistration = require("../models/campaignRegistration");
const Notification = require("../models/notification");
const CAMPAIGNS = require("../config/campaigns");

const INTERVAL_MS = 60 * 1000;
let schedulerStarted = false;
let dispatchRunning = false;

async function dispatchDueCampaignReminders(now = new Date()) {
  const dueCampaignIds = Object.entries(CAMPAIGNS)
    .filter(([, campaign]) => campaign.reminderAt <= now)
    .map(([campaignId]) => campaignId);
  if (dueCampaignIds.length === 0) return 0;

  const registrations = await CampaignRegistration.find({
    campaignId: { $in: dueCampaignIds },
    reminderSentAt: null,
  }).lean();

  let sentCount = 0;
  for (const registration of registrations) {
    const campaign = CAMPAIGNS[registration.campaignId];
    const userId = registration.userId || registration.email;
    const eventKey = `campaign-reminder:${registration._id}`;

    await Notification.updateOne(
      { eventKey },
      {
        $setOnInsert: {
          userId,
          type: "campaign",
          title: `Hôm nay diễn ra: ${campaign.title}`,
          message: `Chiến dịch ${campaign.title} sẽ bắt đầu hôm nay (${campaign.date}) lúc 08:00. PawnCare rất mong được gặp bạn!`,
          icon: "🐾",
          link: "/campaigns.html",
          eventKey,
        },
      },
      { upsert: true }
    );

    await CampaignRegistration.updateOne(
      { _id: registration._id, reminderSentAt: null },
      { $set: { reminderSentAt: now } }
    );
    sentCount += 1;
  }

  return sentCount;
}

function startCampaignReminderScheduler() {
  if (schedulerStarted) return;
  schedulerStarted = true;

  const dispatch = async () => {
    if (dispatchRunning) return;
    dispatchRunning = true;
    try {
      const sentCount = await dispatchDueCampaignReminders();
      if (sentCount > 0) {
        console.log(`Đã tạo ${sentCount} thông báo nhắc lịch chiến dịch.`);
      }
    } catch (error) {
      console.error("Lỗi gửi thông báo chiến dịch:", error);
    } finally {
      dispatchRunning = false;
    }
  };

  dispatch();
  setInterval(dispatch, INTERVAL_MS);
}

module.exports = { dispatchDueCampaignReminders, startCampaignReminderScheduler };
