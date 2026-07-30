const { Schema, model } = require('mongoose');

const documentVersionSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    documentId: { type: Schema.Types.ObjectId, ref: 'EmployeeDocument', required: true, index: true },
    versionNumber: { type: Number, required: true },
    originalFileName: { type: String, required: true },
    storageKey: { type: String, required: true },
    mimeType: { type: String, required: true },
    fileExtension: { type: String, required: true, lowercase: true },
    fileSize: { type: Number, required: true },
    checksum: { type: String },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    replacedReason: { type: String, trim: true },
  },
  { timestamps: true }
);

documentVersionSchema.index({ organizationId: 1, documentId: 1, versionNumber: -1 }, { unique: true });

documentVersionSchema.set('toJSON', {
  transform: (doc, ret) => {
    ret.id = ret._id;
    delete ret.__v;
    delete ret.storageKey;
    return ret;
  },
});

module.exports = model('DocumentVersion', documentVersionSchema);
