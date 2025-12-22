// routes/payment.routes.js - Razorpay Payment Routes
import express from 'express';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import { Payment } from '../models/Others.js';
import User from '../models/User.model.js';
import { authMiddleware } from '../middleware/auth.middleware.js';

const router = express.Router();
router.use(authMiddleware);

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

// POST /api/payment/create-order
router.post('/create-order', async (req, res) => {
  try {
    const { planType, duration, amount } = req.body;

    if (!planType || !duration || !amount) {
      return res.status(400).json({
        success: false,
        message: 'Plan type, duration, and amount are required'
      });
    }

    // Create Razorpay order
    const order = await razorpay.orders.create({
      amount: amount * 100, // Convert to paise
      currency: 'INR',
      receipt: `receipt_${Date.now()}`,
      notes: {
        userId: req.userId,
        planType,
        duration
      }
    });

    res.json({
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID
    });

  } catch (error) {
    console.error('Create Order Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create payment order'
    });
  }
});

// POST /api/payment/verify
router.post('/verify', async (req, res) => {
  try {
    const {
      razorpay_payment_id,
      razorpay_order_id,
      razorpay_signature,
      planType,
      duration,
      amount
    } = req.body;

    // Verify signature
    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment signature'
      });
    }

    // Calculate plan duration
    const durationMap = {
      '1M': 30,
      '6M': 180,
      '1Y': 365
    };

    const durationDays = durationMap[duration];
    const startDate = new Date();
    const expiryDate = new Date(startDate);
    expiryDate.setDate(expiryDate.getDate() + durationDays);

    // Save payment record
    const payment = await Payment.create({
      userId: req.userId,
      razorpayPaymentId: razorpay_payment_id,
      razorpayOrderId: razorpay_order_id,
      razorpaySignature: razorpay_signature,
      amountPaid: amount,
      planType,
      planDuration: duration,
      planDurationDays: durationDays,
      planStartDate: startDate,
      planExpiryDate: expiryDate,
      status: 'success'
    });

    // Update user subscription
    const user = await User.findById(req.userId);
    user.subscriptionType = planType;
    user.subscriptionExpiryDate = expiryDate;
    user.subscriptionPlan = {
      duration,
      amountPaid: amount,
      startDate
    };
    await user.save();

    res.json({
      success: true,
      message: 'Payment verified successfully',
      subscription: {
        type: planType,
        expiryDate
      }
    });

  } catch (error) {
    console.error('Verify Payment Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify payment'
    });
  }
});

// POST /api/payment/webhook - Razorpay Webhook Handler
router.post('/webhook', async (req, res) => {
  try {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    
    // Verify webhook signature
    const shasum = crypto.createHmac('sha256', secret);
    shasum.update(JSON.stringify(req.body));
    const digest = shasum.digest('hex');
    
    if (digest !== req.headers['x-razorpay-signature']) {
      return res.status(400).json({
        success: false,
        message: 'Invalid signature'
      });
    }
    
    const event = req.body.event;
    const payload = req.body.payload;
    
    // Handle payment.captured event
    if (event === 'payment.captured') {
      const payment = payload.payment.entity;
      
      // Find payment record
      const paymentRecord = await Payment.findOne({
        razorpayPaymentId: payment.id
      });
      
      if (paymentRecord) {
        paymentRecord.status = 'success';
        await paymentRecord.save();
        
        // Update user subscription
        const user = await User.findById(paymentRecord.userId);
        if (user) {
          user.subscriptionType = paymentRecord.planType;
          user.subscriptionExpiryDate = paymentRecord.planExpiryDate;
          user.subscriptionPlan = {
            duration: paymentRecord.planDuration,
            amountPaid: paymentRecord.amountPaid,
            startDate: paymentRecord.planStartDate
          };
          await user.save();
        }
      }
    }
    
    // Handle payment.failed event
    if (event === 'payment.failed') {
      const payment = payload.payment.entity;
      
      const paymentRecord = await Payment.findOne({
        razorpayPaymentId: payment.id
      });
      
      if (paymentRecord) {
        paymentRecord.status = 'failed';
        await paymentRecord.save();
      }
    }
    
    res.json({ status: 'ok' });
    
  } catch (error) {
    console.error('Webhook Error:', error);
    res.status(500).json({
      success: false,
      message: 'Webhook processing failed'
    });
  }
});

// POST /api/payment/refund/calculate
router.post('/refund/calculate', async (req, res) => {
  try {
    const user = await User.findById(req.userId);

    if (!user || user.subscriptionType === 'free') {
      return res.status(400).json({
        success: false,
        message: 'No active paid subscription found'
      });
    }

    // Check if gift code was used
    if (user.isGiftCodeUsed) {
      return res.status(400).json({
        success: false,
        message: 'Refund not available for gift code subscriptions'
      });
    }

    // Find payment record
    const payment = await Payment.findOne({
      userId: req.userId,
      status: 'success',
      refundUsed: false
    }).sort({ createdAt: -1 });

    if (!payment) {
      return res.status(400).json({
        success: false,
        message: 'No eligible payment found for refund'
      });
    }

    // Calculate refund percentage
    const now = new Date();
    const start = new Date(payment.planStartDate);
    const expiry = new Date(payment.planExpiryDate);

    const totalDays = (expiry - start) / (1000 * 60 * 60 * 24);
    const usedDays = (now - start) / (1000 * 60 * 60 * 24);
    const usedPercent = (usedDays / totalDays) * 100;

    let refundPercent = 0;
    if (usedPercent <= 10) refundPercent = 60;
    else if (usedPercent <= 40) refundPercent = 45;
    else if (usedPercent <= 60) refundPercent = 30;

    const refundAmount = Math.floor((payment.amountPaid * refundPercent) / 100);

    res.json({
      success: true,
      eligible: refundPercent > 0,
      refundPercent,
      refundAmount,
      amountPaid: payment.amountPaid,
      usedDays: Math.floor(usedDays),
      totalDays: Math.floor(totalDays)
    });

  } catch (error) {
    console.error('Calculate Refund Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to calculate refund'
    });
  }
});

// routes/subscription.routes.js - Subscription & Gift Code Routes
import { GiftCode } from '../models/Others.js';

const subRouter = express.Router();
subRouter.use(authMiddleware);

// POST /api/subscription/apply-giftcode
subRouter.post('/apply-giftcode', async (req, res) => {
  try {
    const { code } = req.body;

    if (!code || code.length !== 12) {
      return res.status(400).json({
        success: false,
        message: 'Invalid gift code format'
      });
    }

    // Find gift code
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

    // Calculate expiry date based on duration
    const durationMap = {
      '1M': 30,
      '6M': 180,
      '1Y': 365
    };

    const durationDays = durationMap[giftCode.duration];
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + durationDays);

    // Update user
    const user = await User.findById(req.userId);
    user.subscriptionType = 'gold';
    user.subscriptionExpiryDate = expiryDate;
    user.isGiftCodeUsed = true;
    user.giftCodeDetails = {
      code: giftCode.code,
      usedAt: new Date()
    };
    await user.save();

    // Mark gift code as used
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

// GET /api/subscription/plans
subRouter.get('/plans', async (req, res) => {
  try {
    const plans = {
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
    };

    res.json({
      success: true,
      plans
    });

  } catch (error) {
    console.error('Get Plans Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch plans'
    });
  }
});

export { subRouter as subscriptionRoutes };
export default router;