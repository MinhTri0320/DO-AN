require("dotenv").config();
const express = require("express");
const cors = require("cors");

const connectDB = require("./config/database");

const registerR = require("./routes/registerR");
const loginR = require("./routes/loginR");
const formsR = require("./routes/formsR");
const notificationsR = require("./routes/notificationsR");
const campaignsR = require("./routes/campaignsR");
const appointmentsR = require("./routes/appointmentsR");
const customerProfileR = require("./routes/customerProfileR");
const petProfileR = require("./routes/petProfileR");
const medicalRecordsR = require("./routes/medicalRecordsR");
<<<<<<< HEAD
const diagnosisR = require("./routes/diagnosisR");
=======
const prescriptionsR = require("./routes/prescriptionsR");
const reExaminationsR = require("./routes/reExaminationsR");
>>>>>>> 663a16a719947eb2d93a224074e39cf1d15058ec

const { startCampaignReminderScheduler } = require("./services/campaignReminders");
const Appointment = require("./models/appointment");
const MedicalRecord = require("./models/medicalRecord");
const PetHealthProfile = require("./models/petHealthProfile");
<<<<<<< HEAD
const Diagnosis = require("./models/diagnosis");
=======
const Prescription = require("./models/prescription");
const ReExamination = require("./models/reExamination");
>>>>>>> 663a16a719947eb2d93a224074e39cf1d15058ec

const app = express();


// Middleware
app.use(cors());
app.use(express.json());


// Routes
app.use("/api", registerR);
app.use("/api", loginR);
app.use("/api", formsR);
app.use("/api", notificationsR);
app.use("/api", campaignsR);
app.use("/api", appointmentsR);
app.use("/api", customerProfileR);
app.use("/api", petProfileR);
app.use("/api", medicalRecordsR);
<<<<<<< HEAD
app.use("/api", diagnosisR);
=======
app.use("/api", prescriptionsR);
app.use("/api", reExaminationsR);
>>>>>>> 663a16a719947eb2d93a224074e39cf1d15058ec


// Kiểm tra server
app.get("/", (req, res) => {
    res.send("PawnCare Backend đang chạy");
});

app.get("/health", (req, res) => {
    res.json({
        status: "ok",
        database:
            require("mongoose").connection.readyState === 1
                ? "connected"
                : "disconnected"
    });
});


const port = Number(process.env.PORT) || 3000;


async function startServer() {
    try {
        await connectDB();

        await Appointment.init();
        await MedicalRecord.init();
        await PetHealthProfile.init();
<<<<<<< HEAD
        await Diagnosis.init();
=======
        await Prescription.init();
        await ReExamination.init();
>>>>>>> 663a16a719947eb2d93a224074e39cf1d15058ec

        startCampaignReminderScheduler();

        app.listen(port, () => {
            console.log(`SERVER DANG CHAY TAI http://localhost:${port}`);
        });

    } catch (error) {
        console.error("Không thể khởi động backend:", error.message);
        process.exitCode = 1;
    }
}


startServer();