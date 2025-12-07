const express = require("express");
const path = require("path");
const bodyParser = require("body-parser");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const nodemailer = require("nodemailer");
const cors = require("cors");

// Load environment variables
const {
    SMTP_HOST,
    SMTP_PORT,
    SMTP_USER,
    SMTP_PASS,
    FROM_EMAIL,
    SENDGRID_API_KEY,
    EMAIL_ENABLED
} = process.env;

const app = express();
app.use(bodyParser.json());
app.use(cors());
app.use(express.static("public"));

console.log("📨 Initializing email transporter...");
console.log("SMTP_HOST:", SMTP_HOST);
console.log("SMTP_PORT:", SMTP_PORT);
console.log("SMTP_USER:", SMTP_USER);
console.log("FROM_EMAIL:", FROM_EMAIL);

// Validate required variables
if (!SMTP_PASS && !SENDGRID_API_KEY) {
    console.error("❌ ERROR: SMTP_PASS or SENDGRID_API_KEY missing!");
}

const apiKey = SMTP_PASS || SENDGRID_API_KEY;

// Setup SendGrid SMTP transporter
const transporter = nodemailer.createTransport({
    host: SMTP_HOST || "smtp.sendgrid.net",
    port: SMTP_PORT ? parseInt(SMTP_PORT) : 587,
    secure: false,
    auth: {
        user: SMTP_USER || "apikey",
        pass: apiKey
    }
});

// Check SMTP connection
transporter.verify((error, success) => {
    if (error) {
        console.error("❌ Email transporter failed:", error);
    } else {
        console.log("✔ Email transporter is ready.");
    }
});

// Send verification email
async function sendVerificationEmail(email, token) {
    if (EMAIL_ENABLED !== "true") {
        console.log("📭 Email disabled — skipping send");
        return;
    }

    const verifyUrl = `https://event-flow.co.uk/verify.html?token=${token}`;

    const mailOptions = {
        from: FROM_EMAIL,
        to: email,
        subject: "Verify your EventFlow account",
        html: `
            <h2>Welcome to EventFlow!</h2>
            <p>Please verify your email by clicking below:</p>
            <a href="${verifyUrl}">Verify Account</a>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log("📧 Verification email sent to:", email);
    } catch (err) {
        console.error("❌ Email send error:", err);
    }
}

// User database (replace with real DB later)
let users = [];

// Register
app.post("/api/auth/register", async (req, res) => {
    const { name, email, password, role } = req.body;

    if (users.find(u => u.email === email)) {
        return res.status(409).json({ message: "Email already registered" });
    }

    const hashed = await bcrypt.hash(password, 10);

    const newUser = {
        id: users.length + 1,
        name,
        email,
        password: hashed,
        role,
        verified: false
    };

    users.push(newUser);

    // Generate JWT token
    const token = jwt.sign({ email: newUser.email }, "secretkey", { expiresIn: "1d" });

    // Send verification email
    sendVerificationEmail(newUser.email, token);

    res.json({ message: "Account created. Check your email to verify." });
});

// Verify email
app.get("/api/auth/verify", (req, res) => {
    const { token } = req.query;

    try {
        const decoded = jwt.verify(token, "secretkey");
        const user = users.find(u => u.email === decoded.email);
        if (user) {
            user.verified = true;
            return res.send("Email verified! You may now log in.");
        }
        res.status(400).send("Invalid token.");
    } catch (err) {
        res.status(400).send("Verification failed.");
    }
});

// Serve website pages
app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`🚀 EventFlow server running on port ${PORT}`));
