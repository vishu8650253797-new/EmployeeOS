const { Schema, model } = require('mongoose');

const assetCategorySchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    icon: { type: String, trim: true, default: 'Package' },
    isActive: { type: Boolean, default: true, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

assetCategorySchema.index({ organizationId: 1, name: 1 }, { unique: true });
assetCategorySchema.index({ organizationId: 1, isActive: 1 });

assetCategorySchema.set('toJSON', {
  transform: (doc, ret) => {
    ret.id = ret._id;
    delete ret.__v;
    return ret;
  },
});

module.exports = model('AssetCategory', assetCategorySchema);
