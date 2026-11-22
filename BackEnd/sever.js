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
const diagnosisR = require("./routes/diagnosisR");
const prescriptionsR = require("./routes/prescriptionsR");
const reExaminationsR = require("./routes/reExaminationsR");
const adminUsersR = require("./routes/adminUsersR");
const doctorFeaturesR = require("./routes/doctorFeaturesR");
const groomingR = require("./routes/groomingR");
const medicinesR = require("./routes/medicinesR");
const dispensingR = require("./routes/dispensingR");
const invoicesR = require("./routes/invoicesR");
const paymentsR = require("./routes/paymentsR");
const receptionistR = require("./routes/receptionistR");

const { startCampaignReminderScheduler } = require("./services/campaignReminders");
const Appointment = require("./models/appointment");
const MedicalRecord = require("./models/medicalRecord");
const PetHealthProfile = require("./models/petHealthProfile");
const Diagnosis = require("./models/diagnosis");
const Prescription = require("./models/prescription");
const ReExamination = require("./models/reExamination");
const Doctor = require("./models/doctor");
const Grooming = require("./models/grooming");
const Medicine = require("./models/medicine");
const Dispensing = require("./models/dispensing");
const Invoice = require("./models/invoice");
const Payment = require("./models/payment");
const Role = require("./models/role");

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
app.use("/api", diagnosisR);
app.use("/api", prescriptionsR);
app.use("/api", reExaminationsR);
app.use("/api", adminUsersR);
app.use("/api", doctorFeaturesR);
app.use("/api", groomingR);
app.use("/api", medicinesR);
app.use("/api", dispensingR);
app.use("/api", invoicesR);
app.use("/api", paymentsR);
app.use("/api", receptionistR);


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
        await Diagnosis.init();
        await Prescription.init();
        await ReExamination.init();
        await Doctor.init();
        await Grooming.init();
        await Medicine.init();
        await Dispensing.init();
        await Invoice.init();
        await Payment.init();
        await Role.init();
        await Role.seedDefaultRoles();

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