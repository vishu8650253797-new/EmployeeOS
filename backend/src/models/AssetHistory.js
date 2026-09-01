const { Schema, model } = require('mongoose');

const HISTORY_ACTIONS = [
  'CREATED', 'UPDATED', 'ASSIGNED', 'REASSIGNED', 'RETURNED',
  'MAINTENANCE_STARTED', 'MAINTENANCE_COMPLETED',
  'MARKED_DAMAGED', 'MARKED_LOST', 'RECOVERED',
  'MARKED_RETIRED', 'MARKED_DISPOSED', 'REQUEST_FULFILLED',
];

const assetHistorySchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    assetId: { type: Schema.Types.ObjectId, ref: 'Asset', required: true, index: true },
    action: { type: String, enum: HISTORY_ACTIONS, required: true },
    performedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    previousValue: { type: Schema.Types.Mixed },
    newValue: { type: Schema.Types.Mixed },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

assetHistorySchema.index({ organizationId: 1, assetId: 1, createdAt: -1 });

assetHistorySchema.set('toJSON', {
  transform: (doc, ret) => {
    ret.id = ret._id;
    delete ret.__v;
    return ret;
  },
});

module.exports = model('AssetHistory', assetHistorySchema);
module.exports.HISTORY_ACTIONS = HISTORY_ACTIONS;
