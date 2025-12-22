// models/Question.model.js - Question Schema
import mongoose from 'mongoose';

const questionSchema = new mongoose.Schema({
  exam: {
    type: String,
    required: true,
    enum: ['JEE', 'NEET'],
    index: true
  },
  subject: {
    type: String,
    required: true,
    index: true
  },
  chapter: {
    type: String,
    required: true,
    index: true
  },
  topic: {
    type: String,
    required: true,
    index: true
  },
  questionType: {
    type: String,
    required: true,
    enum: ['MCQ', 'NUMERICAL'],
    default: 'MCQ'
  },
  questionText: {
    type: String,
    required: true
  },
  questionImageUrl: {
    type: String,
    default: null
  },
  // For MCQ Questions
  options: [{
    label: {
      type: String,
      enum: ['A', 'B', 'C', 'D']
    },
    text: String,
    imageUrl: String
  }],
  correctAnswer: {
    type: String,
    required: true
  },
  // For Numerical Questions (store as string to handle decimals)
  numericalAnswer: String,
  // Metadata
  difficulty: {
    type: String,
    enum: ['easy', 'medium', 'hard'],
    default: 'medium'
  },
  year: Number,
  source: String,
  solution: String,
  solutionImageUrl: String,
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

// Compound index for efficient filtering
questionSchema.index({ exam: 1, subject: 1, chapter: 1, topic: 1 });
questionSchema.index({ exam: 1, subject: 1, chapter: 1 });
questionSchema.index({ isActive: 1 });

// Method to normalize numerical answer (remove trailing zeros)
questionSchema.methods.normalizeNumericalAnswer = function(answer) {
  if (!answer) return null;
  const num = parseFloat(answer);
  if (isNaN(num)) return null;
  return num.toString();
};

// Static method to get random questions for small test
questionSchema.statics.getRandomQuestions = async function(filters, count, excludeIds = []) {
  const query = { ...filters, isActive: true };
  if (excludeIds.length > 0) {
    query._id = { $nin: excludeIds };
  }

  const questions = await this.aggregate([
    { $match: query },
    { $sample: { size: count } }
  ]);

  return questions;
};

export default mongoose.model('Question', questionSchema);