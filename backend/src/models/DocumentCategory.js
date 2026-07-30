const { Schema, model } = require('mongoose');

const DOCUMENT_TYPES = [
  'IDENTITY_DOCUMENT', 'ADDRESS_PROOF', 'EDUCATION_CERTIFICATE', 'EXPERIENCE_LETTER',
  'OFFER_LETTER', 'EMPLOYMENT_CONTRACT', 'NDA', 'TAX_DOCUMENT', 'BANK_DOCUMENT',
  'PASSPORT', 'WORK_PERMIT', 'VISA', 'MEDICAL_DOCUMENT', 'CERTIFICATION', 'OTHER',
];

const documentCategorySchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    name: { type: String, required: true, trim: true },
    code: { type: String, trim: true, uppercase: true, default: 'OTHER', enum: DOCUMENT_TYPES },
    description: { type: String, trim: true },
    allowedExtensions: { type: [String], default: ['pdf', 'jpg', 'jpeg', 'png', 'doc', 'docx'] },
    maxFileSizeMB: { type: Number, default: 10, min: 1 },
    isConfidentialByDefault: { type: Boolean, default: false },
    isMandatory: { type: Boolean, default: false },
    requiresExpiry: { type: Boolean, default: false },
    requiresVerification: { type: Boolean, default: true },
    expiryWarningDays: { type: Number, default: 30, min: 1 },
    isActive: { type: Boolean, default: true, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

documentCategorySchema.index({ organizationId: 1, name: 1 }, { unique: true });
documentCategorySchema.index({ organizationId: 1, isActive: 1 });

documentCategorySchema.set('toJSON', {
  transform: (doc, ret) => {
    ret.id = ret._id;
    delete ret.__v;
    return ret;
  },
});

module.exports = model('DocumentCategory', documentCategorySchema);
