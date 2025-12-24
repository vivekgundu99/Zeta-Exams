// models/User.model.js - User Schema with Password
import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    unique: true,
    default: () => `USR${Date.now()}${Math.random().toString(36).substr(2, 9)}`
  },
  phone: {
    type: String,
    required: true,
    // Stored encrypted
  },
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
  },
  password: {
    type: String,
    required: true, // Password is required for all users
  },
  subscriptionType: {
    type: String,
    enum: ['free', 'silver', 'gold'],
    default: 'free'
  },
  subscriptionExpiryDate: {
    type: Date,
    default: null
  },
  subscriptionPlan: {
    duration: String,
    amountPaid: Number,
    startDate: Date
  },
  userDetailsCompleted: {
    type: Boolean,
    default: false
  },
  dailySessionLimitReached: {
    type: Boolean,
    default: false
  },
  isGiftCodeUsed: {
    type: Boolean,
    default: false
  },
  giftCodeDetails: {
    code: String,
    usedAt: Date
  },
  name: String,
  profession: {
    type: String,
    enum: ['student', 'teacher']
  },
  grade: String,
  preparingFor: String,
  collegeName: String,
  schoolName: String,
  state: String,
  lifeAmbition: {
    type: String,
    maxlength: 50
  },
  selectedExam: {
    type: String,
    enum: ['JEE', 'NEET']
  },
  dailyUsage: {
    date: {
      type: Date,
      default: () => {
        const now = new Date();
        return new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
      }
    },
    questionsAttempted: {
      type: Number,
      default: 0
    },
    chapterTestsGenerated: {
      type: Number,
      default: 0
    },
    mockTestsAttempted: {
      type: Number,
      default: 0
    }
  },
  ongoingMockTest: {
    mockTestId: mongoose.Schema.Types.ObjectId,
    startedAt: Date,
    expiresAt: Date
  },
  attemptedQuestions: [{
    questionId: mongoose.Schema.Types.ObjectId,
    subject: String,
    chapter: String,
    topic: String,
    isCorrect: Boolean,
    attemptedAt: Date,
    timeTaken: Number
  }],
  mockTestRecords: [{
    mockTestId: mongoose.Schema.Types.ObjectId,
    mockTestName: String,
    exam: String,
    status: {
      type: String,
      enum: ['attempted', 'unattempted'],
      default: 'unattempted'
    },
    score: Number,
    totalQuestions: Number,
    correctAnswers: Number,
    wrongAnswers: Number,
    unanswered: Number,
    timeTaken: Number,
    attemptedAt: Date,
    answers: [{
      questionNumber: Number,
      selectedAnswer: String,
      isCorrect: Boolean
    }]
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastLogin: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

userSchema.index({ email: 1 });

userSchema.statics.checkAccountLimit = async function(email) {
  const count = await this.countDocuments({ email });
  return count < 3;
};

userSchema.methods.checkAndResetDailyLimits = function() {
  const now = new Date();
  const istNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const lastReset = new Date(this.dailyUsage.date);
  
  if (istNow.toDateString() !== lastReset.toDateString()) {
    this.dailyUsage = {
      date: istNow,
      questionsAttempted: 0,
      chapterTestsGenerated: 0,
      mockTestsAttempted: 0
    };
    this.dailySessionLimitReached = false;
    return true;
  }
  return false;
};

userSchema.methods.isSubscriptionActive = function() {
  if (this.subscriptionType === 'free') return true;
  if (!this.subscriptionExpiryDate) return false;
  return new Date() < new Date(this.subscriptionExpiryDate);
};

userSchema.methods.getDailyLimits = function() {
  const limits = {
    free: {
      questions: 50,
      chapterTests: 0,
      mockTests: 0
    },
    silver: {
      questions: 200,
      chapterTests: 10,
      mockTests: 0
    },
    gold: {
      questions: 5000,
      chapterTests: 50,
      mockTests: 8
    }
  };
  return limits[this.subscriptionType] || limits.free;
};

export default mongoose.model('User', userSchema);