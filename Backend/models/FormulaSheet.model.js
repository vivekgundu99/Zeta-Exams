// models/FormulaSheet.model.js
const formulaSheetSchema = new mongoose.Schema({
  exam: {
    type: String,
    required: true,
    enum: ['JEE', 'NEET']
  },
  subject: {
    type: String,
    required: true
  },
  chapter: {
    type: String,
    required: true
  },
  title: String,
  pdfUrl: {
    type: String,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

export const FormulaSheet = mongoose.model('FormulaSheet', formulaSheetSchema);