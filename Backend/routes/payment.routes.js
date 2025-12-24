// routes/payment.routes.js - Razorpay Payment Routes with conditional initialization
import express from 'express';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import { Payment } from '../models/Others.js';
import User from '../models/User.model.js';
import { authMiddleware } from '../middleware/auth.middleware.js';

const router = express.Router();
router.use(authMiddleware);

// Initialize Razorpay only if credentials are available
let razorpay = null;
const RAZORPAY_ENABLED = !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);

if (RAZORPAY_ENABLED) {
  razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
  });
  console.log('✅ Razorpay initialized successfully');
} else {
  console.warn('⚠️  Razorpay not configured - Payment routes will return errors');
}

const DURATION_MAP = {
  '1M': 30,
  '6M': 180,
  '1Y': 365
};

// Middleware to check if Razorpay is enabled
const checkRazorpayEnabled = (req, res, next) => {
  if (!RAZORPAY_ENABLED) {
    return res.status(503).json({
      success: false,
      message: 'Payment service not configured. Please contact administrator.'
    });
  }
  next();
};

// POST /api/payment/create-order
router.post('/create-order', checkRazorpayEnabled, async (req, res) => {
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
router.post('/verify', checkRazorpayEnabled, async (req, res) => {
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
    const durationDays = DURATION_MAP[duration];
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
    
    if (!secret) {
      return res.status(503).json({
        success: false,
        message: 'Webhook not configured'
      });
    }
    
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

export default router;