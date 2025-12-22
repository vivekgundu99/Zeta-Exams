// routes/giftcode.routes.js - Gift Code Management (Admin Only)
import express from 'express';
import { GiftCode } from '../models/Others.js';
import { adminAuthMiddleware } from '../middleware/auth.middleware.js';

const router = express.Router();
router.use(adminAuthMiddleware);

// POST /api/giftcode/generate - Generate gift codes
router.post('/generate', async (req, res) => {
  try {
    if (req.adminRole !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admins can generate gift codes'
      });
    }

    const { count, duration } = req.body;

    if (!count || !duration) {
      return res.status(400).json({
        success: false,
        message: 'Count and duration are required'
      });
    }

    const giftCodes = [];

    for (let i = 0; i < count; i++) {
      const code = Array.from({ length: 12 }, () => 
        'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[Math.floor(Math.random() * 36)]
      ).join('');

      giftCodes.push({
        code,
        duration,
        createdBy: req.adminId
      });
    }

    const inserted = await GiftCode.insertMany(giftCodes);

    res.json({
      success: true,
      message: `${inserted.length} gift codes generated`,
      codes: inserted.map(c => c.code)
    });

  } catch (error) {
    console.error('Generate Gift Codes Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate gift codes'
    });
  }
});

// GET /api/giftcode/list - List all gift codes
router.get('/list', async (req, res) => {
  try {
    const codes = await GiftCode.find()
      .sort({ createdAt: -1 })
      .populate('usedBy', 'name email');

    res.json({
      success: true,
      codes
    });

  } catch (error) {
    console.error('List Gift Codes Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch gift codes'
    });
  }
});

export default router;