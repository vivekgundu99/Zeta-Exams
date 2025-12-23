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

const DURATION_MAP = {
  '1M': 30,
  '6M': 180,
  '1Y': 365
};

// CREATE ORDER
router.post('/create-order', async (req, res) => {
  try {
    const { planType, duration, amount } = req.body;

    if (!planType || !duration || !amount) {
      return res.status(400).json({
        success: false,
        message: 'Plan type, duration, and amount are required'
      });
    }

    const order = await razorpay.orders.create({
      amount: amount * 100,
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

// VERIFY PAYMENT
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

    const body = `${razorpay_order_id}|${razorpay_payment_id}`;
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

    const durationDays = DURATION_MAP[duration];
    const startDate = new Date();
    const expiryDate = new Date(startDate);
    expiryDate.setDate(expiryDate.getDate() + durationDays);

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

    await User.findByIdAndUpdate(req.userId, {
      subscriptionType: planType,
      subscriptionExpiryDate: expiryDate,
      subscriptionPlan: {
        duration,
        amountPaid: amount,
        startDate
      }
    });

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

// WEBHOOK
router.post('/webhook', async (req, res) => {
  try {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

    const digest = crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify(req.body))
      .digest('hex');

    if (digest !== req.headers['x-razorpay-signature']) {
      return res.status(400).json({
        success: false,
        message: 'Invalid signature'
      });
    }

    const { event, payload } = req.body;
    const paymentEntity = payload?.payment?.entity;

    if (!paymentEntity) return res.json({ status: 'ok' });

    const paymentRecord = await Payment.findOne({
      razorpayPaymentId: paymentEntity.id
    });

    if (!paymentRecord) return res.json({ status: 'ok' });

    if (event === 'payment.captured') {
      paymentRecord.status = 'success';
      await paymentRecord.save();

      await User.findByIdAndUpdate(paymentRecord.userId, {
        subscriptionType: paymentRecord.planType,
        subscriptionExpiryDate: paymentRecord.planExpiryDate,
        subscriptionPlan: {
          duration: paymentRecord.planDuration,
          amountPaid: paymentRecord.amountPaid,
          startDate: paymentRecord.planStartDate
        }
      });
    }

    if (event === 'payment.failed') {
      paymentRecord.status = 'failed';
      await paymentRecord.save();
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

// REFUND CALCULATE
router.post('/refund/calculate', async (req, res) => {
  try {
    const user = await User.findById(req.userId);

    if (!user || user.subscriptionType === 'free') {
      return res.status(400).json({
        success: false,
        message: 'No active paid subscription found'
      });
    }

    if (user.isGiftCodeUsed) {
      return res.status(400).json({
        success: false,
        message: 'Refund not available for gift code subscriptions'
      });
    }

    const payment = await Payment.findOne({
      userId: req.userId,
      status: 'success',
      refundUsed: false
    }).sort({ createdAt: -1 });

    if (!payment) {
      return res.status(400).json({
        success: false,
        message: 'No eligible payment found'
      });
    }

    const now = new Date();
    const totalDays =
      (payment.planExpiryDate - payment.planStartDate) / 86400000;
    const usedDays = (now - payment.planStartDate) / 86400000;
    const usedPercent = (usedDays / totalDays) * 100;

    let refundPercent = 0;
    if (usedPercent <= 10) refundPercent = 60;
    else if (usedPercent <= 40) refundPercent = 45;
    else if (usedPercent <= 60) refundPercent = 30;

    const refundAmount = Math.floor(
      (payment.amountPaid * refundPercent) / 100
    );

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