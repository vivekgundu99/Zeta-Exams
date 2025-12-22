// routes/mocktest.routes.js - Mock Test Routes
import express from 'express';
import { MockTest } from '../models/Others.js';
import User from '../models/User.model.js';
import Question from '../models/Question.model.js';
import { authMiddleware } from '../middleware/auth.middleware.js';

const router = express.Router();
router.use(authMiddleware);

// GET /api/mocktest/list - Get all mock tests for an exam
router.get('/list', async (req, res) => {
  try {
    const { exam } = req.query;

    if (!exam) {
      return res.status(400).json({
        success: false,
        message: 'Exam parameter is required'
      });
    }

    const user = await User.findById(req.userId);
    const mockTests = await MockTest.find({ exam, isActive: true })
      .select('name exam duration totalQuestions')
      .sort({ createdAt: 1 });

    // Add status from user records
    const testsWithStatus = mockTests.map(test => {
      const userRecord = user.mockTestRecords.find(
        r => r.mockTestId.toString() === test._id.toString()
      );

      return {
        _id: test._id,
        name: test.name,
        exam: test.exam,
        duration: test.duration,
        totalQuestions: test.totalQuestions,
        status: userRecord ? userRecord.status : 'unattempted'
      };
    });

    res.json({
      success: true,
      mockTests: testsWithStatus
    });

  } catch (error) {
    console.error('List Mock Tests Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch mock tests'
    });
  }
});

// POST /api/mocktest/:id/start - Start mock test (load all data)
// POST /api/mocktest/:id/start - Start mock test (load all data)
router.post('/:id/start', async (req, res) => {
  try {
    const user = await User.findById(req.userId);

    // Check if user has ongoing mock test
    if (user.ongoingMockTest && user.ongoingMockTest.expiresAt > new Date()) {
      return res.status(400).json({
        success: false,
        message: 'You already have an ongoing mock test. Please complete it first.',
        ongoingTestId: user.ongoingMockTest.mockTestId
      });
    }

    // Check limits
    user.checkAndResetDailyLimits();
    const limits = user.getDailyLimits();

    if (user.dailyUsage.mockTestsAttempted >= limits.mockTests) {
      return res.status(403).json({
        success: false,
        message: 'Daily mock test limit reached. Upgrade to Gold subscription',
        limitReached: true
      });
    }

    const mockTest = await MockTest.findById(req.params.id).populate('questions.questionId');

    if (!mockTest) {
      return res.status(404).json({
        success: false,
        message: 'Mock test not found'
      });
    }

    // Check if already attempted
    const existingRecord = user.mockTestRecords.find(
      r => r.mockTestId.toString() === mockTest._id.toString() && r.status === 'attempted'
    );

    if (existingRecord) {
      return res.status(400).json({
        success: false,
        message: 'Mock test already attempted. You can only review answers.'
      });
    }

    // Load all questions with images
    const questionsWithDetails = mockTest.questions.map(q => ({
      serialNumber: q.serialNumber,
      subject: q.subject,
      _id: q.questionId._id,
      questionType: q.questionId.questionType,
      questionText: q.questionId.questionText,
      questionImageUrl: q.questionId.questionImageUrl,
      options: q.questionId.options,
      // Don't send correct answer yet
    }));

    // Store answer key separately for verification
    const answerKey = mockTest.questions.map(q => ({
      serialNumber: q.serialNumber,
      questionId: q.questionId._id,
      correctAnswer: q.questionId.correctAnswer
    }));

    // Increment mock test count
    // Set ongoing mock test (prevents starting another)
    const expiryTime = new Date();
    expiryTime.setMinutes(expiryTime.getMinutes() + mockTest.duration);
    
    user.ongoingMockTest = {
      mockTestId: mockTest._id,
      startedAt: new Date(),
      expiresAt: expiryTime
    };
    
    // Increment mock test count
    user.dailyUsage.mockTestsAttempted += 1;
    await user.save();

    res.json({
      success: true,
      mockTest: {
        _id: mockTest._id,
        name: mockTest.name,
        exam: mockTest.exam,
        duration: mockTest.duration,
        totalQuestions: mockTest.totalQuestions,
        questions: questionsWithDetails
      },
      // Answer key stored server-side, not sent to client
      message: 'Mock test started. All data loaded for offline use.'
    });

  } catch (error) {
    console.error('Start Mock Test Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to start mock test'
    });
  }
});

// POST /api/mocktest/:id/submit - Submit mock test results
router.post('/:id/submit', async (req, res) => {
  try {
    const { answers, timeTaken } = req.body;

    const mockTest = await MockTest.findById(req.params.id).populate('questions.questionId');
    const user = await User.findById(req.userId);

    if (!mockTest) {
      return res.status(404).json({
        success: false,
        message: 'Mock test not found'
      });
    }

    // Evaluate answers
    let correctAnswers = 0;
    let wrongAnswers = 0;
    let unanswered = 0;

    const evaluatedAnswers = mockTest.questions.map((q, index) => {
      const userAnswer = answers.find(a => a.questionNumber === q.serialNumber);
      const correctAnswer = q.questionId.correctAnswer;

      let isCorrect = false;

      if (!userAnswer || !userAnswer.selectedAnswer) {
        unanswered++;
      } else {
        if (q.questionId.questionType === 'MCQ') {
          isCorrect = userAnswer.selectedAnswer.toUpperCase() === correctAnswer.toUpperCase();
        } else {
          // Numerical
          const normalizedUser = parseFloat(userAnswer.selectedAnswer).toString();
          const normalizedCorrect = parseFloat(correctAnswer).toString();
          isCorrect = normalizedUser === normalizedCorrect;
        }

        if (isCorrect) correctAnswers++;
        else wrongAnswers++;
      }

      return {
        questionNumber: q.serialNumber,
        selectedAnswer: userAnswer?.selectedAnswer || null,
        correctAnswer,
        isCorrect
      };
    });

    // Calculate score (JEE: +4 correct, -1 wrong; NEET: +4 correct, -1 wrong)
    const score = (correctAnswers * 4) - wrongAnswers;

    // Save mock test record
    user.mockTestRecords.push({
      mockTestId: mockTest._id,
      mockTestName: mockTest.name,
      exam: mockTest.exam,
      status: 'attempted',
      score,
      totalQuestions: mockTest.totalQuestions,
      correctAnswers,
      wrongAnswers,
      unanswered,
      timeTaken,
      attemptedAt: new Date(),
      answers: evaluatedAnswers
    });

    user.ongoingMockTest = undefined;
    await user.save();

    res.json({
      success: true,
      message: 'Mock test submitted successfully',
      results: {
        score,
        correctAnswers,
        wrongAnswers,
        unanswered,
        totalQuestions: mockTest.totalQuestions,
        timeTaken
      }
    });

  } catch (error) {
    console.error('Submit Mock Test Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit mock test'
    });
  }
});

// GET /api/mocktest/:id/review - Get review for attempted mock test
router.get('/:id/review', async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    const mockTest = await MockTest.findById(req.params.id).populate('questions.questionId');

    const userRecord = user.mockTestRecords.find(
      r => r.mockTestId.toString() === mockTest._id.toString()
    );

    if (!userRecord || userRecord.status !== 'attempted') {
      return res.status(400).json({
        success: false,
        message: 'Mock test not attempted yet'
      });
    }

    // Return full review with correct answers
    const reviewData = mockTest.questions.map(q => {
      const userAnswer = userRecord.answers.find(a => a.questionNumber === q.serialNumber);

      return {
        serialNumber: q.serialNumber,
        subject: q.subject,
        questionText: q.questionId.questionText,
        questionImageUrl: q.questionId.questionImageUrl,
        questionType: q.questionId.questionType,
        options: q.questionId.options,
        correctAnswer: q.questionId.correctAnswer,
        selectedAnswer: userAnswer?.selectedAnswer,
        isCorrect: userAnswer?.isCorrect
      };
    });

    res.json({
      success: true,
      mockTest: {
        name: mockTest.name,
        exam: mockTest.exam
      },
      results: {
        score: userRecord.score,
        correctAnswers: userRecord.correctAnswers,
        wrongAnswers: userRecord.wrongAnswers,
        unanswered: userRecord.unanswered,
        timeTaken: userRecord.timeTaken
      },
      questions: reviewData,
      explanationPdfUrl: mockTest.explanationPdfUrl
    });

  } catch (error) {
    console.error('Review Mock Test Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch review'
    });
  }
});

export default router;
