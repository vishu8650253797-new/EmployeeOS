const { Schema, model } = require('mongoose');

const assetVendorSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    name: { type: String, required: true, trim: true },
    contactPerson: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    address: { type: String, trim: true },
    website: { type: String, trim: true },
    notes: { type: String, trim: true },
    isActive: { type: Boolean, default: true, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

assetVendorSchema.index({ organizationId: 1, name: 1 }, { unique: true });
assetVendorSchema.index({ organizationId: 1, isActive: 1 });

assetVendorSchema.set('toJSON', {
  transform: (doc, ret) => {
    ret.id = ret._id;
    delete ret.__v;
    return ret;
  },
});

module.exports = model('AssetVendor', assetVendorSchema);
