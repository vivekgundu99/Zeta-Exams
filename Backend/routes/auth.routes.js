// routes/auth.routes.js - Authentication Routes
import express from 'express';
import { Resend } from 'resend';
import User from '../models/User.model.js';
import { OTP } from '../models/Others.js';
import { encryptPhone } from '../config/database.js';
import jwt from 'jsonwebtoken';

const router = express.Router();

// Initialize Resend only when needed (lazy initialization)
let resendClient = null;
const getResendClient = () => {
  if (!resendClient) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error('RESEND_API_KEY is not configured in environment variables');
    }
    resendClient = new Resend(apiKey);
  }
  return resendClient;
};

// Generate 6-digit OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// POST /api/auth/send-otp
router.post('/send-otp', async (req, res) => {
  try {
    const { email, phone } = req.body;

    if (!email || !phone) {
      return res.status(400).json({
        success: false,
        message: 'Email and phone are required'
      });
    }

    // Validate phone (10 digits)
    if (!/^\d{10}$/.test(phone)) {
      return res.status(400).json({
        success: false,
        message: 'Phone number must be 10 digits'
      });
    }

    // Check account limit (max 3 accounts per email)
    const canCreate = await User.checkAccountLimit(email);
    if (!canCreate) {
      return res.status(400).json({
        success: false,
        message: 'Maximum 3 accounts allowed per email'
      });
    }

    // Generate OTP
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Delete old OTPs for this email
    await OTP.deleteMany({ email });

    // Save new OTP
    await OTP.create({ email, otp, expiresAt });

    // Send OTP via Resend
    try {
      const resend = getResendClient();
      await resend.emails.send({
        from: 'Zeta Exams <noreply@zetaexams.com>',
        to: email,
        subject: 'Your Zeta Exams OTP',
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #4F46E5;">Welcome to Zeta Exams!</h2>
            <p>Your One-Time Password (OTP) is:</p>
            <div style="background: #F3F4F6; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
              <h1 style="color: #4F46E5; letter-spacing: 8px; margin: 0;">${otp}</h1>
            </div>
            <p style="color: #6B7280;">This OTP will expire in 10 minutes.</p>
            <p style="color: #6B7280; font-size: 14px;">If you didn't request this, please ignore this email.</p>
          </div>
        `
      });

      res.json({
        success: true,
        message: 'OTP sent successfully',
        expiresAt
      });
    } catch (emailError) {
      console.error('Email sending error:', emailError);
      
      // For development: Return OTP in response if email fails
      if (process.env.NODE_ENV === 'development') {
        return res.json({
          success: true,
          message: 'OTP generated (email service unavailable)',
          expiresAt,
          otp: otp // Only in development!
        });
      }
      
      throw new Error('Failed to send OTP email. Please try again.');
    }

  } catch (error) {
    console.error('Send OTP Error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to send OTP'
    });
  }
});

// POST /api/auth/verify-otp
router.post('/verify-otp', async (req, res) => {
  try {
    const { email, phone, otp } = req.body;

    if (!email || !phone || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Email, phone, and OTP are required'
      });
    }

    // Find OTP
    const otpRecord = await OTP.findOne({ 
      email, 
      otp,
      verified: false,
      expiresAt: { $gt: new Date() }
    });

    if (!otpRecord) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired OTP'
      });
    }

    // Mark OTP as verified
    otpRecord.verified = true;
    await otpRecord.save();

    // Find all accounts for this email
    const existingAccounts = await User.find({ email }).select('-attemptedQuestions -mockTestRecords');

    // Check if account with this phone already exists
    const encryptedPhone = encryptPhone(phone);
    let user = await User.findOne({ email, phone: encryptedPhone });

    if (!user) {
      // Create new account
      user = await User.create({
        email,
        phone: encryptedPhone
      });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '30d' }
    );

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        userId: user.userId,
        email: user.email,
        subscriptionType: user.subscriptionType,
        userDetailsCompleted: user.userDetailsCompleted,
        selectedExam: user.selectedExam
      },
      allAccounts: existingAccounts.map(acc => ({
        userId: acc.userId,
        subscriptionType: acc.subscriptionType,
        selectedExam: acc.selectedExam,
        name: acc.name
      }))
    });

  } catch (error) {
    console.error('Verify OTP Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify OTP'
    });
  }
});

// POST /api/auth/select-account
router.post('/select-account', async (req, res) => {
  try {
    const { email, userId } = req.body;

    const user = await User.findOne({ email, userId }).select('-attemptedQuestions -mockTestRecords');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Account not found'
      });
    }

    // Check and reset daily limits
    user.checkAndResetDailyLimits();
    await user.save();

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '30d' }
    );

    res.json({
      success: true,
      token,
      user: {
        userId: user.userId,
        email: user.email,
        name: user.name,
        subscriptionType: user.subscriptionType,
        subscriptionExpiryDate: user.subscriptionExpiryDate,
        userDetailsCompleted: user.userDetailsCompleted,
        selectedExam: user.selectedExam,
        profession: user.profession,
        grade: user.grade
      }
    });

  } catch (error) {
    console.error('Select Account Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to select account'
    });
  }
});

export default router;