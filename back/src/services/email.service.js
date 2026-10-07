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
exports.sendEmail = async ({ to, subject, html }) => {
  try {
    await transporter.sendMail({
      from: `"E-Learning Platform" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html
    });
    console.log(` Email envoyé à ${to}`);
  } catch (error) {
    console.error("Email delivery failed");
    throw error;
  }
};
