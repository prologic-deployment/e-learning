const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST, // smtp.office365.com
  port: Number(process.env.EMAIL_PORT), // 587
  secure: false, // MUST be false for port 587 (STARTTLS)
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  tls: {
    ciphers: "TLSv1.2",
  },
});
exports.sendOTPEmail = async (to, otp) => {
  try {
    await transporter.sendMail({
      from: `"E-Learning Platform" <${process.env.EMAIL_USER}>`,
      to,
      subject: "Your OTP Code",
      html: `
        <h2>🔐 Your Login OTP</h2>
        <p>Your verification code is:</p>
        <h1 style="color:#4CAF50;">${otp}</h1>
        <p>This code expires in 5 minutes.</p>
      `
    });
    // ✅ LOG HYGIENE: the OTP code is never written to logs
  } catch (error) {
    console.log("Erreur envoi mail:", error);
    throw error;
  }
};

exports.sendEmail = async ({ to, subject, html }) => {
  try {
    await transporter.sendMail({
      from: `"E-Learning Platform" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html
    });
    console.log(`✅ Email envoyé à ${to}`);
  } catch (error) {
    console.log("❌ Erreur envoi mail:", error);
    throw error;
  }
};