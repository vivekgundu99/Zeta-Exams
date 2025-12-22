// routes/question.routes.js - Question Practice Routes
import express from 'express';
import Question from '../models/Question.model.js';
import User from '../models/User.model.js';
import { authMiddleware } from '../middleware/auth.middleware.js';

const router = express.Router();
router.use(authMiddleware);

// GET /api/questions/filters - Get available subjects/chapters/topics
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

// GET /api/questions/chapters - Get chapters for a subject
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

// GET /api/questions/topics - Get topics for a chapter
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

// POST /api/questions/practice - Get practice questions (text only, 30 at a time)
router.post('/practice', async (req, res) => {
  try {
    const { exam, subject, chapters, topics, questionTypes, offset = 0 } = req.body;

    const user = await User.findById(req.userId);

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

    // Get attempted question IDs for this user
    const attemptedIds = user.attemptedQuestions.map(q => q.questionId.toString());

    // Exclude attempted questions
    query._id = { $nin: attemptedIds.map(id => id) };

    // Fetch 30 questions (text only)
    const questions = await Question.find(query)
      .select('_id subject chapter topic questionType questionText options correctAnswer')
      .skip(offset)
      .limit(30)
      .lean();

    // Remove correctAnswer from response (security)
    const questionsWithoutAnswer = questions.map(q => {
      const { correctAnswer, ...rest } = q;
      return rest;
    });

    res.json({
      success: true,
      questions: questionsWithoutAnswer,
      hasMore: questions.length === 30
    });

  } catch (error) {
    console.error('Get Practice Questions Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch questions'
    });
  }
});

// GET /api/questions/:id/image - Get question image URL
router.get('/:id/image', async (req, res) => {
  try {
    const question = await Question.findById(req.params.id).select('questionImageUrl');

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

// POST /api/questions/verify-answer - Verify answer and track
// POST /api/questions/verify-answer - Verify answer and track (NO LIMIT CHECK)
router.post('/verify-answer', async (req, res) => {
  try {
    const { questionId, userAnswer, timeTaken } = req.body;

    const question = await Question.findById(questionId);
    const user = await User.findById(req.userId);

    if (!question || !user) {
      return res.status(404).json({
        success: false,
        message: 'Question or user not found'
      });
    }

    // NO LIMIT CHECK - Only attempted questions count is stored

    // Verify answer
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
    // Track attempt (NO daily count increment for regular practice)
    user.attemptedQuestions.push({
      questionId: question._id,
      subject: question.subject,
      chapter: question.chapter,
      topic: question.topic,
      isCorrect,
      attemptedAt: new Date(),
      timeTaken: timeTaken || 0
    });

    await user.save();
    res.json({
      success: true,
      isCorrect,
      correctAnswer: question.correctAnswer,
      questionText: question.questionText,
      options: question.options
      // NO usage data returned
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

    // Check chapter test limits
    user.checkAndResetDailyLimits();
    const limits = user.getDailyLimits();

    if (user.dailyUsage.chapterTestsGenerated >= limits.chapterTests) {
      return res.status(403).json({
        success: false,
        message: `Daily chapter test limit reached. ${
          user.subscriptionType === 'free' ? 'Upgrade to Silver or Gold' : 
          'Upgrade to Gold'
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

    // Get attempted question IDs
    const attemptedIds = user.attemptedQuestions.map(q => q.questionId);

    // Get 8 random MCQ questions
    const mcqQuestions = await Question.getRandomQuestions(
      { ...query, questionType: 'MCQ', _id: { $nin: attemptedIds } },
      8
    );

    // Get 2 random numerical questions
    const numericalQuestions = await Question.getRandomQuestions(
      { ...query, questionType: 'NUMERICAL', _id: { $nin: attemptedIds } },
      2
    );

    const allQuestions = [...mcqQuestions, ...numericalQuestions];

    if (allQuestions.length < 10) {
      return res.status(400).json({
        success: false,
        message: 'Not enough unattempted questions available for test'
      });
    }

    // Shuffle questions
    const shuffled = allQuestions.sort(() => Math.random() - 0.5);

    // Increment chapter test count
    user.dailyUsage.chapterTestsGenerated += 1;
    await user.save();

    // Remove correct answers
    const testQuestions = shuffled.map(q => {
      const { correctAnswer, ...rest } = q;
      return rest;
    });

    res.json({
      success: true,
      questions: testQuestions,
      usage: {
        chapterTestsGenerated: user.dailyUsage.chapterTestsGenerated,
        limit: limits.chapterTests
      }
    });

  } catch (error) {
    console.error('Generate Test Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate test'
    });
  }
});

export default router;