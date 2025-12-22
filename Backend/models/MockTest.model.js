// models/MockTest.model.js
import mongoose from 'mongoose';

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
    required: true // in minutes
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

export const MockTest = mongoose.model('MockTest', mockTestSchema);