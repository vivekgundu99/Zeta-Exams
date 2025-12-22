// models/GiftCode.model.js
const giftCodeSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    length: 12
  },
  duration: {
    type: String,
    required: true,
    enum: ['1M', '6M', '1Y']
  },
  isUsed: {
    type: Boolean,
    default: false
  },
  usedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  usedAt: Date,
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  }
}, {
  timestamps: true
});

export const GiftCode = mongoose.model('GiftCode', giftCodeSchema);