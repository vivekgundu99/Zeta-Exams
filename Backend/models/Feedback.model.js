// models/Feedback.model.js
import mongoose from 'mongoose';

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

export const Feedback = mongoose.model('Feedback', feedbackSchema);