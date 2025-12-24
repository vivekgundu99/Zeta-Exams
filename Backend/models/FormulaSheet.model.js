// ===== Backend/models/FormulaSheet.model.js =====
import mongoose from 'mongoose';

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

export const FormulaSheet = mongoose.model('FormulaSheet', formulaSheetSchema);

// ===== Backend/models/GiftCode.model.js =====
import mongoose from 'mongoose';

const giftCodeSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    length: 12
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

export const GiftCode = mongoose.model('GiftCode', giftCodeSchema);