// routes/auth.routes.js - Updated Authentication with Password Login
import express from 'express';
import { Resend } from 'resend';
import bcrypt from 'bcryptjs';
import User from '../models/User.model.js';
import { OTP } from '../models/others.js';
import { encryptPhone } from '../config/database.js';
import jwt from 'jsonwebtoken';

const router = express.Router();

// Initialize Resend
let resendClient = null;
const getResendClient = () => {
  if (!resendClient) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error('RESEND_API_KEY is not configured');
    }
    resendClient = new Resend(apiKey);
  }
  return resendClient;
};

const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// ===== NEW: Check if user exists =====
router.post('/check-user', async (req, res) => {
  try {
    const { email, phone } = req.body;

    if (!email || !phone) {
      return res.status(400).json({
        success: false,
        message: 'Email and phone are required'
      });
    }

    // Validate phone
    if (!/^\d{10}$/.test(phone)) {
      return res.status(400).json({
        success: false,
        message: 'Phone number must be 10 digits'
      });
    }

    // Check if user exists
    const encryptedPhone = encryptPhone(phone);
    const existingUser = await User.findOne({ email, phone: encryptedPhone });

    res.json({
      success: true,
      userExists: !!existingUser,
      message: existingUser ? 'User found. Please login with password.' : 'New user. OTP will be sent for registration.'
    });

  } catch (error) {
    console.error('Check User Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check user'
    });
  }
});

// ===== NEW: Login with Password =====
router.post('/login', async (req, res) => {
  try {
    const { email, phone, password } = req.body;

    if (!email || !phone || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email, phone, and password are required'
      });
    }

    // Find user
    const encryptedPhone = encryptPhone(phone);
    const user = await User.findOne({ email, phone: encryptedPhone });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found. Please register first.'
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid password'
      });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate JWT
    const token = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '30d' }
    );

    // Get all accounts for this email
    const allAccounts = await User.find({ email }).select('-attemptedQuestions -mockTestRecords -password');

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        userId: user.userId,
        email: user.email,
        subscriptionType: user.subscriptionType,
        userDetailsCompleted: user.userDetailsCompleted,
        selectedExam: user.selectedExam,
        name: user.name
      },
      allAccounts: allAccounts.map(acc => ({
        userId: acc.userId,
        subscriptionType: acc.subscriptionType,
        selectedExam: acc.selectedExam,
        name: acc.name
      }))
    });

  } catch (error) {
    console.error('Login Error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed'
    });
  }
});

// ===== UPDATED: Send OTP (Only for Registration) =====
router.post('/send-otp', async (req, res) => {
  try {
    const { email, phone } = req.body;

    if (!email || !phone) {
      return res.status(400).json({
        success: false,
        message: 'Email and phone are required'
      });
    }

    if (!/^\d{10}$/.test(phone)) {
      return res.status(400).json({
        success: false,
        message: 'Phone number must be 10 digits'
      });
    }

    // Check if user already exists
    const encryptedPhone = encryptPhone(phone);
    const existingUser = await User.findOne({ email, phone: encryptedPhone });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User already exists. Please login with your password.',
        userExists: true
      });
    }

    // Check account limit
    const canCreate = await User.checkAccountLimit(email);
    if (!canCreate) {
      return res.status(400).json({
        success: false,
        message: 'Maximum 3 accounts allowed per email'
      });
    }

    // Generate OTP
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    // Delete old OTPs
    await OTP.deleteMany({ email });

    // Save new OTP
    await OTP.create({ email, otp, expiresAt });

    // Send OTP via Resend
    try {
      const resend = getResendClient();
      const emailResult = await resend.emails.send({
        from: 'Zeta Exams <onboarding@resend.dev>', // Use verified domain
        to: email,
        subject: 'Your Zeta Exams Registration OTP',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #4F46E5; margin: 0;">Zeta Exams</h1>
              <p style="color: #6B7280; margin-top: 8px;">JEE & NEET Preparation Platform</p>
            </div>
            
            <div style="background: #F9FAFB; padding: 30px; border-radius: 12px; margin-bottom: 20px;">
              <h2 style="color: #111827; margin-top: 0;">Registration OTP</h2>
              <p style="color: #4B5563; font-size: 16px;">Your One-Time Password for registration is:</p>
              
              <div style="background: white; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0; border: 2px solid #E5E7EB;">
                <h1 style="color: #4F46E5; letter-spacing: 8px; margin: 0; font-size: 36px;">${otp}</h1>
              </div>
              
              <p style="color: #6B7280; font-size: 14px; margin-bottom: 0;">
                This OTP is valid for <strong>10 minutes</strong>.
              </p>
            </div>
            
            <div style="background: #FEF3C7; padding: 16px; border-radius: 8px; border-left: 4px solid #F59E0B;">
              <p style="color: #92400E; margin: 0; font-size: 14px;">
                <strong>Security Notice:</strong> Never share this OTP with anyone. Zeta Exams will never ask for your OTP.
              </p>
            </div>
            
            <div style="margin-top: 30px; text-align: center; color: #9CA3AF; font-size: 12px;">
              <p>If you didn't request this OTP, please ignore this email.</p>
              <p style="margin-top: 16px;">© 2025 Zeta Exams. All rights reserved.</p>
            </div>
          </div>
        `
      });

      console.log('✅ Email sent successfully:', emailResult.id);

      res.json({
        success: true,
        message: 'OTP sent successfully to your email',
        expiresAt,
        emailId: emailResult.id
      });

    } catch (emailError) {
      console.error('❌ Email sending error:', emailError);
      
      // For development: Return OTP in response if email fails
      if (process.env.NODE_ENV === 'development') {
        return res.json({
          success: true,
          message: 'OTP generated (email service unavailable - DEV MODE)',
          expiresAt,
          otp: otp // Only in development!
        });
      }
      
      throw new Error('Failed to send OTP email. Please check your email configuration.');
    }

  } catch (error) {
    console.error('Send OTP Error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to send OTP'
    });
  }
});

// ===== UPDATED: Verify OTP and Create Account with Password =====
router.post('/verify-otp', async (req, res) => {
  try {
    const { email, phone, otp, password } = req.body;

    if (!email || !phone || !otp || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email, phone, OTP, and password are required'
      });
    }

    // Validate password length
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long'
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

    // Check if user already exists (safety check)
    const encryptedPhone = encryptPhone(phone);
    let user = await User.findOne({ email, phone: encryptedPhone });

    if (user) {
      return res.status(400).json({
        success: false,
        message: 'User already exists. Please login with password.'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new user
    user = await User.create({
      email,
      phone: encryptedPhone,
      password: hashedPassword
    });

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate JWT
    const token = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '30d' }
    );

    // Get all accounts for this email
    const allAccounts = await User.find({ email }).select('-attemptedQuestions -mockTestRecords -password');

    res.json({
      success: true,
      message: 'Registration successful',
      token,
      user: {
        userId: user.userId,
        email: user.email,
        subscriptionType: user.subscriptionType,
        userDetailsCompleted: user.userDetailsCompleted,
        selectedExam: user.selectedExam
      },
      allAccounts: allAccounts.map(acc => ({
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

// Select Account (unchanged)
router.post('/select-account', async (req, res) => {
  try {
    const { email, userId } = req.body;

    const user = await User.findOne({ email, userId }).select('-attemptedQuestions -mockTestRecords -password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Account not found'
      });
    }

    user.checkAndResetDailyLimits();
    await user.save();

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