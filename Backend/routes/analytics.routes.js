// routes/analytics.routes.js - Analytics Routes
// routes/analytics.routes.js - Analytics Routes
import express from 'express';
import User from '../models/User.model.js';
import { authMiddleware } from '../middleware/auth.middleware.js';

const analyticsRouter = express.Router();
analyticsRouter.use(authMiddleware);
analyticsRouter.use(authMiddleware);

// GET /api/analytics/overview
analyticsRouter.get('/overview', async (req, res) => {
  try {
    const user = await User.findById(req.userId);

    // Calculate subject-wise stats
    const subjectStats = {};

    user.attemptedQuestions.forEach(q => {
      if (!subjectStats[q.subject]) {
        subjectStats[q.subject] = {
          totalAttempted: 0,
          correct: 0,
          wrong: 0,
          totalTime: 0
        };
      }

      subjectStats[q.subject].totalAttempted++;
      if (q.isCorrect) subjectStats[q.subject].correct++;
      else subjectStats[q.subject].wrong++;
      subjectStats[q.subject].totalTime += q.timeTaken || 0;
    });

    // Calculate accuracy and average time
    const analytics = Object.keys(subjectStats).map(subject => ({
      subject,
      totalAttempted: subjectStats[subject].totalAttempted,
      correct: subjectStats[subject].correct,
      wrong: subjectStats[subject].wrong,
      accuracy: ((subjectStats[subject].correct / subjectStats[subject].totalAttempted) * 100).toFixed(2),
      avgTime: (subjectStats[subject].totalTime / subjectStats[subject].totalAttempted).toFixed(2)
    }));

    res.json({
      success: true,
      analytics,
      totalQuestionsAttempted: user.attemptedQuestions.length,
      mockTestsAttempted: user.mockTestRecords.filter(r => r.status === 'attempted').length
    });

  } catch (error) {
    console.error('Analytics Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch analytics'
    });
  }
});

export default analyticsRouter;  // Changed from: export { analyticsRoutes };