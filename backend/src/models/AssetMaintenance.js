const { Schema, model } = require('mongoose');

const MAINTENANCE_STATUSES = ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_FOR_PARTS', 'COMPLETED', 'CANCELLED'];
const MAINTENANCE_ISSUE_TYPES = ['HARDWARE', 'SOFTWARE', 'PERFORMANCE', 'DAMAGE', 'OTHER'];
const MAINTENANCE_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

const assetMaintenanceSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    assetId: { type: Schema.Types.ObjectId, ref: 'Asset', required: true, index: true },
    reportedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    issueType: { type: String, enum: MAINTENANCE_ISSUE_TYPES, default: 'OTHER' },
    description: { type: String, required: true, trim: true },
    priority: { type: String, enum: MAINTENANCE_PRIORITIES, default: 'MEDIUM' },
    status: { type: String, enum: MAINTENANCE_STATUSES, default: 'OPEN', index: true },
    assignedTechnicianId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    startedAt: { type: Date },
    completedAt: { type: Date },
    maintenanceCost: { type: Number, min: 0 },
    vendorId: { type: Schema.Types.ObjectId, ref: 'AssetVendor' },
    resolution: { type: String, trim: true },
    notes: { type: String, trim: true },
  },
  { timestamps: true }
);

assetMaintenanceSchema.index({ organizationId: 1, assetId: 1, status: 1 });
assetMaintenanceSchema.index({ organizationId: 1, status: 1, createdAt: -1 });
assetMaintenanceSchema.index({ organizationId: 1, assignedTechnicianId: 1 });

assetMaintenanceSchema.set('toJSON', {
  transform: (doc, ret) => {
    ret.id = ret._id;
    delete ret.__v;
    return ret;
  },
});

module.exports = model('AssetMaintenance', assetMaintenanceSchema);
module.exports.MAINTENANCE_STATUSES = MAINTENANCE_STATUSES;
module.exports.MAINTENANCE_ISSUE_TYPES = MAINTENANCE_ISSUE_TYPES;
module.exports.MAINTENANCE_PRIORITIES = MAINTENANCE_PRIORITIES;
