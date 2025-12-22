// routes/feedback.routes.js - Feedback Routes
// routes/feedback.routes.js - Feedback Routes
import express from 'express';
import { Feedback } from '../models/Others.js';
import User from '../models/User.model.js';
import { authMiddleware } from '../middleware/auth.middleware.js';

const feedbackRouter = express.Router();
feedbackRouter.use(authMiddleware);

// POST /api/feedback/submit
feedbackRouter.post('/submit', async (req, res) => {
  try {
    const { feedbackType, message, rating } = req.body;

    const user = await User.findById(req.userId);

    const feedback = await Feedback.create({
      userId: req.userId,
      email: user.email,
      phone: user.phone,
      feedbackType,
      message,
      rating,
      refundStatus: feedbackType === 'refund' ? 'incomplete' : undefined
    });

    res.json({
      success: true,
      message: 'Feedback submitted successfully',
      feedback
    });

  } catch (error) {
    console.error('Submit Feedback Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit feedback'
    });
  }
});

export default feedbackRouter;  // Changed from: export { feedbackRoutes };