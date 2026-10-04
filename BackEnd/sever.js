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

const { startCampaignReminderScheduler } = require("./services/campaignReminders");
const Appointment = require("./models/appointment");

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