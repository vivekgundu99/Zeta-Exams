// models/OTP.model.js
const otpSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true
  },
  otp: {
    type: String,
    required: true
  },
  expiresAt: {
    type: Date,
    required: true
  },
  verified: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Auto-delete OTPs after expiry
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const OTP = mongoose.model('OTP', otpSchema);