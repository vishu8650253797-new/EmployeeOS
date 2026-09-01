const { Schema, model } = require('mongoose');

const REQUEST_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'FULFILLED', 'CANCELLED'];
const REQUEST_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

const assetRequestSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    requesterId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    assetCategoryId: { type: Schema.Types.ObjectId, ref: 'AssetCategory', required: true },
    requestedAssetType: { type: String, trim: true },
    reason: { type: String, required: true, trim: true },
    priority: { type: String, enum: REQUEST_PRIORITIES, default: 'MEDIUM' },
    status: { type: String, enum: REQUEST_STATUSES, default: 'PENDING', index: true },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    approvedAt: { type: Date },
    rejectionReason: { type: String, trim: true },
    fulfilledAssetId: { type: Schema.Types.ObjectId, ref: 'Asset' },
    cancelledAt: { type: Date },
    cancelledBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

assetRequestSchema.index({ organizationId: 1, requesterId: 1, status: 1 });
assetRequestSchema.index({ organizationId: 1, status: 1, createdAt: -1 });

assetRequestSchema.set('toJSON', {
  transform: (doc, ret) => {
    ret.id = ret._id;
    delete ret.__v;
    return ret;
  },
});

module.exports = model('AssetRequest', assetRequestSchema);
module.exports.REQUEST_STATUSES = REQUEST_STATUSES;
module.exports.REQUEST_PRIORITIES = REQUEST_PRIORITIES;
