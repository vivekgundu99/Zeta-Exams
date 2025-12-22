// models/Payment.model.js
const paymentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  razorpayPaymentId: String,
  razorpayOrderId: String,
  razorpaySignature: String,
  amountPaid: {
    type: Number,
    required: true
  },
  planType: {
    type: String,
    enum: ['silver', 'gold'],
    required: true
  },
  planDuration: {
    type: String,
    enum: ['1M', '6M', '1Y'],
    required: true
  },
  planDurationDays: Number,
  planStartDate: Date,
  planExpiryDate: Date,
  status: {
    type: String,
    enum: ['pending', 'success', 'failed'],
    default: 'pending'
  },
  refundUsed: {
    type: Boolean,
    default: false
  },
  refundAmount: Number,
  refundPercent: Number,
  refundId: String,
  refundDate: Date,
  refundStatus: {
    type: String,
    enum: ['none', 'requested', 'processing', 'completed'],
    default: 'none'
  }
}, {
  timestamps: true
});

export const Payment = mongoose.model('Payment', paymentSchema);