// -----------------------------------------------------------------------------
// EventFlow - FULLY FIXED PRODUCTION SERVER WITH WORKING SENDGRID EMAILS
// -----------------------------------------------------------------------------

const express = require('express');
const fs = require('fs');
const path = require('path');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const cors = require('cors');
const { uid } = require('uid');

const app = express();
const PORT = process.env.PORT || 3000;

// Fix Express Proxy Warning (required for Railway)
app.set("trust proxy", true);

// -----------------------------------------------------------------------------
// BASIC MIDDLEWARE
// -----------------------------------------------------------------------------
app.use(express.json());
app.use(cookieParser());
app.use(cors());
app.use(express.static(path.join(__dirname, "public")));

// -----------------------------------------------------------------------------
// DATA HELPERS
// -----------------------------------------------------------------------------
const DATA_DIR = path.join(__dirname, "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

function read(name) {
    const file = path.join(DATA_DIR, `${name}.json`);
    if (!fs.existsSync(file)) return [];
    return JSON.parse(fs.readFileSync(file, "utf-8"));
}

function write(name, data) {
    fs.writeFileSync(path.join(DATA_DIR, `${name}.json`), JSON.stringify(data, null, 2));
}

// -----------------------------------------------------------------------------
// ENABLE EMAIL SYSTEM ALWAYS (YOUR CHOICE: OPTION A)
// -----------------------------------------------------------------------------
const EMAIL_ENABLED = true;  // always TRUE

// REQUIRED Railway variables:
const FROM_EMAIL = process.env.FROM_EMAIL || "no-reply@event-flow.co.uk";

const SMTP_HOST = process.env.SMTP_HOST || "smtp.sendgrid.net";
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_USER = process.env.SMTP_USER || "apikey"; // REQUIRED by SendGrid
const SMTP_PASS = process.env.SMTP_PASS || process.env.SENDGRID_API_KEY;

let transporter = null;

// VALIDATE SMTP Configuration
if (!SMTP_PASS || SMTP_PASS.trim() === "") {
    console.error("❌ ERROR: No SMTP_PASS or SENDGRID_API_KEY provided.");
} else {
    try {
        transporter = nodemailer.createTransport({
            host: SMTP_HOST.trim(),
            port: SMTP_PORT,
            secure: false,
            auth: {
                user: SMTP_USER.trim(),
                pass: SMTP_PASS.trim()
            }
        });

        console.log("✅ Email transporter created successfully.");
        console.log("SMTP_HOST:", SMTP_HOST);
        console.log("SMTP_USER:", SMTP_USER);
        console.log("FROM_EMAIL:", FROM_EMAIL);

    } catch (err) {
        console.error("❌ Failed creating email transporter:", err);
    }
}

// -----------------------------------------------------------------------------
// SEND EMAIL FUNCTION (used by ALL email events)
// -----------------------------------------------------------------------------
async function sendMail(to, subject, text) {
    console.log("📨 Preparing email to:", to);

    // Always write .eml to outbox for debugging
    const outboxDir = path.join(__dirname, "outbox");
    if (!fs.existsSync(outboxDir)) fs.mkdirSync(outboxDir);

    fs.writeFileSync(
        path.join(outboxDir, `${Date.now()}-${to}.eml`),
        `From: ${FROM_EMAIL}\nTo: ${to}\nSubject: ${subject}\n\n${text}`
    );

    if (!transporter) {
        console.error("❌ Email transporter NOT initialized. Email NOT sent.");
        return;
    }

    try {
        await transporter.sendMail({
            from: FROM_EMAIL,
            to,
            subject,
            text
        });
        console.log("✅ Email successfully sent to:", to);
    } catch (err) {
        console.error("❌ ERROR sending email:", err);
    }
}

// -----------------------------------------------------------------------------
// AUTH HELPERS
// -----------------------------------------------------------------------------
const JWT_SECRET = process.env.JWT_SECRET || "supersecret";

function setAuthCookie(res, user) {
    const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: "30d" });
    res.cookie("token", token, { httpOnly: true, sameSite: "lax" });
}

function authOnly(req, res, next) {
    const token = req.cookies.token;
    if (!token) return res.status(401).json({ error: "Not logged in" });

    try {
        req.auth = jwt.verify(token, JWT_SECRET);
        next();
    } catch (err) {
        return res.status(401).json({ error: "Invalid session" });
    }
}

// -----------------------------------------------------------------------------
// RATE LIMITERS
// -----------------------------------------------------------------------------
const authLimiter = rateLimit({
    windowMs: 10000,
    max: 20,
});

// -----------------------------------------------------------------------------
// REGISTER USER (THIS NOW SENDS EMAIL CORRECTLY)
// -----------------------------------------------------------------------------
app.post("/api/auth/register", authLimiter, async (req, res) => {
    const { name, email, password, role, marketingOptIn } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: "Email & password required" });
    }

    const users = read("users");
    if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
        return res.status(409).json({ error: "Email already registered" });
    }

    const user = {
        id: uid(8),
        name: name || "",
        email: email.toLowerCase(),
        passwordHash: bcrypt.hashSync(password, 10),
        role: role || "customer",
        verified: false,
        verificationToken: uid(16),
        marketingOptIn: !!marketingOptIn,
        createdAt: new Date().toISOString()
    };

    users.push(user);
    write("users", users);

    // SEND VERIFICATION EMAIL
    const verifyUrl = `${process.env.BASE_URL || "https://event-flow.co.uk"}/verify.html?token=${user.verificationToken}`;

    await sendMail(
        user.email,
        "Confirm your EventFlow account",
        `Hi ${user.name},\n\nPlease confirm your EventFlow account:\n${verifyUrl}\n\nThanks,\nEventFlow`
    );

    // Auto-login user
    setAuthCookie(res, user);

    return res.json({ success: true });
});

// -----------------------------------------------------------------------------
// VERIFY USER ACCOUNT
// -----------------------------------------------------------------------------
app.get("/api/auth/verify", (req, res) => {
    const token = req.query.token;
    if (!token) return res.status(400).send("Invalid link");

    const users = read("users");
    const user = users.find(u => u.verificationToken === token);
    if (!user) return res.status(404).send("Invalid or expired link");

    user.verified = true;
    user.verificationToken = null;

    write("users", users);

    res.send("<h1>Account Verified!</h1>You can now close this tab and log in.");
});

// -----------------------------------------------------------------------------
// LOGIN USER
// -----------------------------------------------------------------------------
app.post("/api/auth/login", authLimiter, (req, res) => {
    const { email, password } = req.body;
    const users = read("users");

    const user = users.find(u => u.email === email.toLowerCase());
    if (!user) return res.status(400).json({ error: "Invalid login" });

    if (!bcrypt.compareSync(password, user.passwordHash)) {
        return res.status(400).json({ error: "Invalid login" });
    }

    setAuthCookie(res, user);
    res.json({ success: true });
});

// -----------------------------------------------------------------------------
// PUBLIC FILES + FRONTEND
// -----------------------------------------------------------------------------
app.use(express.static("public"));

app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

// -----------------------------------------------------------------------------
// START SERVER
// -----------------------------------------------------------------------------
app.listen(PORT, () => {
    console.log(`🚀 EventFlow server running on port ${PORT}`);
});
