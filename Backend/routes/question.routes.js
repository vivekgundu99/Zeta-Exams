// routes/question.routes.js - Question Practice Routes
import express from 'express';
import Question from '../models/Question.model.js';
import User from '../models/User.model.js';
import { authMiddleware } from '../middleware/auth.middleware.js';

const router = express.Router();
router.use(authMiddleware);

// GET /api/questions/filters - Get available subjects for an exam
router.get('/filters', async (req, res) => {
  try {
    const { exam } = req.query;

    if (!exam) {
      return res.status(400).json({
        success: false,
        message: 'Exam parameter is required'
      });
    }

    const subjects = await Question.distinct('subject', { exam, isActive: true });

    res.json({
      success: true,
      subjects
    });

  } catch (error) {
    console.error('Get Filters Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch filters'
    });
  }
});

// GET /api/questions/chapters - Get chapters for subject
router.get('/chapters', async (req, res) => {
  try {
    const { exam, subject } = req.query;

    if (!exam || !subject) {
      return res.status(400).json({
        success: false,
        message: 'Exam and subject are required'
      });
    }

    const chapters = await Question.distinct('chapter', { 
      exam, 
      subject, 
      isActive: true 
    });

    res.json({
      success: true,
      chapters
    });

  } catch (error) {
    console.error('Get Chapters Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch chapters'
    });
  }
});

// GET /api/questions/topics - Get topics for chapter
router.get('/topics', async (req, res) => {
  try {
    const { exam, subject, chapter } = req.query;

    if (!exam || !subject || !chapter) {
      return res.status(400).json({
        success: false,
        message: 'Exam, subject, and chapter are required'
      });
    }

    const topics = await Question.distinct('topic', { 
      exam, 
      subject, 
      chapter, 
      isActive: true 
    });

    res.json({
      success: true,
      topics
    });

  } catch (error) {
    console.error('Get Topics Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch topics'
    });
  }
});

// POST /api/questions/practice - Get practice questions
router.post('/practice', async (req, res) => {
  try {
    const { exam, subject, chapters, topics, questionTypes, offset = 0 } = req.body;
    const user = await User.findById(req.userId);

    // Check and reset daily limits
    user.checkAndResetDailyLimits();
    await user.save();

    // Build query
    const query = {
      exam,
      subject,
      isActive: true
    };

    if (chapters && chapters.length > 0) {
      query.chapter = { $in: chapters };
    }

    if (topics && topics.length > 0 && !topics.includes('all')) {
      query.topic = { $in: topics };
    }

    if (questionTypes && questionTypes.length > 0 && !questionTypes.includes('all')) {
      query.questionType = { $in: questionTypes };
    }

    // Exclude already attempted questions
    const attemptedIds = user.attemptedQuestions.map(q => q.questionId);
    query._id = { $nin: attemptedIds };

    // Fetch 30 questions
    const questions = await Question.find(query)
      .select('-createdBy -solution -solutionImageUrl -__v')
      .skip(offset)
      .limit(30);

    res.json({
      success: true,
      questions
    });

  } catch (error) {
    console.error('Get Practice Questions Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch questions'
    });
  }
});

// POST /api/questions/verify-answer - Verify user's answer
router.post('/verify-answer', async (req, res) => {
  try {
    const { questionId, userAnswer, timeTaken } = req.body;
    const user = await User.findById(req.userId);

    // Check limits
    user.checkAndResetDailyLimits();
    const limits = user.getDailyLimits();

    if (user.dailyUsage.questionsAttempted >= limits.questions) {
      return res.status(403).json({
        success: false,
        message: `Daily limit of ${limits.questions} questions reached. Upgrade your plan.`,
        limitReached: true
      });
    }

    const question = await Question.findById(questionId);

    if (!question) {
      return res.status(404).json({
        success: false,
        message: 'Question not found'
      });
    }

    // Check answer
    let isCorrect = false;

    if (question.questionType === 'MCQ') {
      isCorrect = userAnswer.toUpperCase() === question.correctAnswer.toUpperCase();
    } else {
      // Numerical - normalize and compare
      const normalizedUser = parseFloat(userAnswer).toString();
      const normalizedCorrect = parseFloat(question.correctAnswer).toString();
      isCorrect = normalizedUser === normalizedCorrect;
    }

    // Track attempt
    user.attemptedQuestions.push({
      questionId: question._id,
      subject: question.subject,
      chapter: question.chapter,
      topic: question.topic,
      isCorrect,
      attemptedAt: new Date(),
      timeTaken
    });

    user.dailyUsage.questionsAttempted += 1;
    await user.save();

    res.json({
      success: true,
      isCorrect,
      correctAnswer: question.correctAnswer,
      questionText: question.questionText,
      options: question.options || null
    });

  } catch (error) {
    console.error('Verify Answer Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify answer'
    });
  }
});

// POST /api/questions/generate-test - Generate small test (10 questions)
router.post('/generate-test', async (req, res) => {
  try {
    const { exam, subject, chapters, topics } = req.body;
    const user = await User.findById(req.userId);

    // Check limits
    user.checkAndResetDailyLimits();
    const limits = user.getDailyLimits();

    if (user.dailyUsage.chapterTestsGenerated >= limits.chapterTests) {
      return res.status(403).json({
        success: false,
        message: `Daily chapter test limit reached. ${
          user.subscriptionType === 'free' ? 'Upgrade to Silver or Gold' : 
          'Upgrade to Gold for more tests'
        }`,
        limitReached: true
      });
    }

    // Build query
    const query = {
      exam,
      subject,
      isActive: true
    };

    if (chapters && chapters.length > 0) {
      query.chapter = { $in: chapters };
    }

    if (topics && topics.length > 0 && !topics.includes('all')) {
      query.topic = { $in: topics };
    }

    // Get 10 random questions
    const questions = await Question.aggregate([
      { $match: query },
      { $sample: { size: 10 } }
    ]);

    if (questions.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No questions found for the selected filters'
      });
    }

    // Increment test count
    user.dailyUsage.chapterTestsGenerated += 1;
    await user.save();

    res.json({
      success: true,
      questions
    });

  } catch (error) {
    console.error('Generate Test Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate test'
    });
  }
});

// GET /api/questions/:id/image - Get question image (if exists)
router.get('/:id/image', async (req, res) => {
  try {
    const question = await Question.findById(req.params.id);

    if (!question) {
      return res.status(404).json({
        success: false,
        message: 'Question not found'
      });
    }

    res.json({
      success: true,
      imageUrl: question.questionImageUrl
    });

  } catch (error) {
    console.error('Get Question Image Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch image'
    });
  }
});

export default router;