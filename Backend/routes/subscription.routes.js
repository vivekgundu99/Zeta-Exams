import express from 'express';
import User from '../models/User.model.js';
import { GiftCode } from '../models/others.js';
import { authMiddleware } from '../middleware/auth.middleware.js';

const router = express.Router();
router.use(authMiddleware);

const DURATION_MAP = {
  '1M': 30,
  '6M': 180,
  '1Y': 365
};

// APPLY GIFT CODE
router.post('/apply-giftcode', async (req, res) => {
  try {
    const { code } = req.body;

    if (!code || code.length !== 12) {
      return res.status(400).json({
        success: false,
        message: 'Invalid gift code format'
      });
    }

    const giftCode = await GiftCode.findOne({
      code: code.toUpperCase(),
      isUsed: false
    });

    if (!giftCode) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or already used gift code'
      });
    }

    const durationDays = DURATION_MAP[giftCode.duration];
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + durationDays);

    await User.findByIdAndUpdate(req.userId, {
      subscriptionType: 'gold',
      subscriptionExpiryDate: expiryDate,
      isGiftCodeUsed: true,
      giftCodeDetails: {
        code: giftCode.code,
        usedAt: new Date()
      }
    });

    giftCode.isUsed = true;
    giftCode.usedBy = req.userId;
    giftCode.usedAt = new Date();
    await giftCode.save();

    res.json({
      success: true,
      message: 'Gift code applied successfully',
      subscription: {
        type: 'gold',
        expiryDate,
        duration: giftCode.duration
      }
    });
  } catch (error) {
    console.error('Apply Gift Code Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to apply gift code'
    });
  }
});

// GET PLANS
router.get('/plans', async (req, res) => {
  try {
    res.json({
      success: true,
      plans: {
        free: {
          name: 'Free',
          price: 0,
          features: {
            questionsPerDay: 50,
            chapterTests: 0,
            mockTests: 0,
            formulas: false,
            flashcards: false
          }
        },
        silver: {
          name: 'Silver',
          plans: [
            { duration: '1M', mrp: 100, price: 49, savings: 51 },
            { duration: '6M', mrp: 500, price: 249, savings: 50 },
            { duration: '1Y', mrp: 1000, price: 399, savings: 60 }
          ],
          features: {
            questionsPerDay: 200,
            chapterTests: 10,
            mockTests: 0,
            formulas: false,
            flashcards: false
          }
        },
        gold: {
          name: 'Gold',
          plans: [
            { duration: '1M', mrp: 600, price: 299, savings: 50 },
            { duration: '6M', mrp: 2500, price: 1299, savings: 48 },
            { duration: '1Y', mrp: 5000, price: 2000, savings: 60 }
          ],
          features: {
            questionsPerDay: 5000,
            chapterTests: 50,
            mockTests: 8,
            formulas: true,
            flashcards: true
          }
        }
      }
    });
  } catch (error) {
    console.error('Get Plans Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch plans'
    });
  }
});

export default router;