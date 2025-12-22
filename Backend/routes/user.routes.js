// routes/user.routes.js - User Profile & Details Routes
import express from 'express';
import User from '../models/User.model.js';
import { authMiddleware } from '../middleware/auth.middleware.js';

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

// GET /api/user/profile
router.get('/profile', async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-attemptedQuestions -mockTestRecords');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check and reset daily limits
    user.checkAndResetDailyLimits();
    await user.save();

    res.json({
      success: true,
      user: {
        userId: user.userId,
        email: user.email,
        name: user.name,
        subscriptionType: user.subscriptionType,
        subscriptionExpiryDate: user.subscriptionExpiryDate,
        isSubscriptionActive: user.isSubscriptionActive(),
        userDetailsCompleted: user.userDetailsCompleted,
        selectedExam: user.selectedExam,
        profession: user.profession,
        grade: user.grade,
        preparingFor: user.preparingFor,
        collegeName: user.collegeName,
        schoolName: user.schoolName,
        state: user.state,
        lifeAmbition: user.lifeAmbition,
        dailyUsage: user.dailyUsage,
        dailyLimits: user.getDailyLimits()
      }
    });

  } catch (error) {
    console.error('Get Profile Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch profile'
    });
  }
});

// POST /api/user/complete-details
router.post('/complete-details', async (req, res) => {
  try {
    const {
      name,
      profession,
      grade,
      preparingFor,
      collegeName,
      schoolName,
      state,
      lifeAmbition
    } = req.body;

    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Validate required fields
    if (!name || !profession || !preparingFor || !state) {
      return res.status(400).json({
        success: false,
        message: 'Name, profession, preparing for, and state are required'
      });
    }

    // Validate life ambition length
    if (lifeAmbition && lifeAmbition.length > 50) {
      return res.status(400).json({
        success: false,
        message: 'Life ambition cannot exceed 50 characters'
      });
    }

    // Update user details
    user.name = name;
    user.profession = profession;
    user.grade = profession === 'student' ? grade : 'other';
    user.preparingFor = preparingFor;
    user.collegeName = collegeName;
    user.schoolName = schoolName;
    user.state = state;
    user.lifeAmbition = lifeAmbition;
    user.userDetailsCompleted = true;

    await user.save();

    res.json({
      success: true,
      message: 'User details saved successfully',
      user: {
        name: user.name,
        profession: user.profession,
        grade: user.grade,
        preparingFor: user.preparingFor,
        userDetailsCompleted: user.userDetailsCompleted
      }
    });

  } catch (error) {
    console.error('Complete Details Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save user details'
    });
  }
});

// POST /api/user/select-exam
router.post('/select-exam', async (req, res) => {
  try {
    const { exam } = req.body;

    if (!exam || !['JEE', 'NEET'].includes(exam)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid exam selection'
      });
    }

    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    user.selectedExam = exam;
    await user.save();

    res.json({
      success: true,
      message: 'Exam selected successfully',
      selectedExam: user.selectedExam
    });

  } catch (error) {
    console.error('Select Exam Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to select exam'
    });
  }
});

// GET /api/user/check-limits
router.get('/check-limits', async (req, res) => {
  try {
    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check and reset daily limits
    user.checkAndResetDailyLimits();
    await user.save();

    const limits = user.getDailyLimits();
    const usage = user.dailyUsage;

    res.json({
      success: true,
      limits,
      usage: {
        questionsAttempted: usage.questionsAttempted,
        chapterTestsGenerated: usage.chapterTestsGenerated,
        mockTestsAttempted: usage.mockTestsAttempted
      },
      canAttemptQuestions: usage.questionsAttempted < limits.questions,
      canGenerateChapterTest: usage.chapterTestsGenerated < limits.chapterTests,
      canAttemptMockTest: usage.mockTestsAttempted < limits.mockTests,
      subscriptionType: user.subscriptionType
    });

  } catch (error) {
    console.error('Check Limits Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check limits'
    });
  }
});

// POST /api/user/track-question-attempt
router.post('/track-question-attempt', async (req, res) => {
  try {
    const { questionId, subject, chapter, topic, isCorrect, timeTaken } = req.body;

    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check daily limits
    user.checkAndResetDailyLimits();
    const limits = user.getDailyLimits();

    if (user.dailyUsage.questionsAttempted >= limits.questions) {
      return res.status(403).json({
        success: false,
        message: `Daily limit of ${limits.questions} questions reached. ${
          user.subscriptionType === 'free' ? 'Upgrade to Silver or Gold' : 
          user.subscriptionType === 'silver' ? 'Upgrade to Gold' : 
          'Please come back tomorrow'
        }`,
        limitReached: true
      });
    }

    // Add to attempted questions
    user.attemptedQuestions.push({
      questionId,
      subject,
      chapter,
      topic,
      isCorrect,
      attemptedAt: new Date(),
      timeTaken
    });

    // Increment daily usage
    user.dailyUsage.questionsAttempted += 1;

    await user.save();

    res.json({
      success: true,
      message: 'Question attempt tracked',
      usage: {
        questionsAttempted: user.dailyUsage.questionsAttempted,
        limit: limits.questions
      }
    });

  } catch (error) {
    console.error('Track Question Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to track question attempt'
    });
  }
});
// GET /api/user/attempted-questions
router.get('/attempted-questions', async (req, res) => {
  try {
    const user = await User.findById(req.userId)
      .select('attemptedQuestions');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Return attempted questions with full details
    res.json({
      success: true,
      attemptedQuestions: user.attemptedQuestions,
      stats: {
        total: user.attemptedQuestions.length,
        correct: user.attemptedQuestions.filter(q => q.isCorrect).length,
        wrong: user.attemptedQuestions.filter(q => !q.isCorrect).length
      }
    });

  } catch (error) {
    console.error('Get Attempted Questions Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch attempted questions'
    });
  }
});
export default router;