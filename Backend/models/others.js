// models/Others.js - Complete Fixed Version
import mongoose from 'mongoose';

// ===== ADMIN SCHEMA =====
const adminSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['admin', 'co-admin'],
    default: 'admin'
  },
  name: String,
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// ===== OTP SCHEMA =====
const otpSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true
  },
  otp: {
    type: String,
    required: true
  },
  expiresAt: {
    type: Date,
    required: true
  },
  verified: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// ===== GIFT CODE SCHEMA =====
const giftCodeSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    minlength: 12,
    maxlength: 12
  },
  duration: {
    type: String,
    required: true,
    enum: ['1M', '6M', '1Y']
  },
  isUsed: {
    type: Boolean,
    default: false
  },
  usedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  usedAt: Date,
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  }
}, {
  timestamps: true
});

// ===== PAYMENT SCHEMA =====
const paymentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  razorpayPaymentId: String,
  razorpayOrderId: String,
  razorpaySignature: String,
  amountPaid: {
    type: Number,
    required: true
  },
  planType: {
    type: String,
    enum: ['silver', 'gold'],
    required: true
  },
  planDuration: {
    type: String,
    enum: ['1M', '6M', '1Y'],
    required: true
  },
  planDurationDays: Number,
  planStartDate: Date,
  planExpiryDate: Date,
  status: {
    type: String,
    enum: ['pending', 'success', 'failed'],
    default: 'pending'
  },
  refundUsed: {
    type: Boolean,
    default: false
  },
  refundAmount: Number,
  refundPercent: Number,
  refundId: String,
  refundDate: Date,
  refundStatus: {
    type: String,
    enum: ['none', 'requested', 'processing', 'completed'],
    default: 'none'
  }
}, {
  timestamps: true
});

// ===== FEEDBACK SCHEMA =====
const feedbackSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  email: {
    type: String,
    required: true
  },
  phone: String,
  feedbackType: {
    type: String,
    enum: ['refund', 'query'],
    required: true
  },
  message: String,
  rating: {
    type: Number,
    min: 1,
    max: 5
  },
  refundStatus: {
    type: String,
    enum: ['incomplete', 'complete'],
    default: 'incomplete'
  },
  adminNotes: String
}, {
  timestamps: true
});

// ===== FORMULA SHEET SCHEMA =====
const formulaSheetSchema = new mongoose.Schema({
  exam: {
    type: String,
    required: true,
    enum: ['JEE', 'NEET']
  },
  subject: {
    type: String,
    required: true
  },
  chapter: {
    type: String,
    required: true
  },
  title: String,
  pdfUrl: {
    type: String,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// ===== MOCK TEST SCHEMA =====
const mockTestSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true
  },
  exam: {
    type: String,
    required: true,
    enum: ['JEE', 'NEET']
  },
  duration: {
    type: Number,
    required: true
  },
  questions: [{
    serialNumber: Number,
    questionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Question'
    },
    subject: String
  }],
  totalQuestions: Number,
  explanationPdfUrl: String,
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// ===== EXPORTS =====
export const Admin = mongoose.model('Admin', adminSchema);
export const OTP = mongoose.model('OTP', otpSchema);
export const GiftCode = mongoose.model('GiftCode', giftCodeSchema);
export const Payment = mongoose.model('Payment', paymentSchema);
export const Feedback = mongoose.model('Feedback', feedbackSchema);
export const FormulaSheet = mongoose.model('FormulaSheet', formulaSheetSchema);
export const MockTest = mongoose.model('MockTest', mockTestSchema);