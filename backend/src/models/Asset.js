const { Schema, model } = require('mongoose');

const ASSET_STATUSES = [
  'AVAILABLE', 'RESERVED', 'ASSIGNED', 'IN_MAINTENANCE', 'DAMAGED', 'LOST', 'RETURNED', 'RETIRED', 'DISPOSED',
];
const ASSET_CONDITIONS = ['NEW', 'EXCELLENT', 'GOOD', 'FAIR', 'DAMAGED'];
const ATTACHMENT_CATEGORIES = [
  'PURCHASE_INVOICE', 'WARRANTY_CARD', 'PURCHASE_ORDER', 'PHOTOGRAPH', 'REPAIR_INVOICE', 'MAINTENANCE_DOCUMENT', 'OTHER',
];

// Statuses an asset can never be assigned from directly — a reassignment/return
// workflow (or maintenance completion) must run first.
const NON_ASSIGNABLE_STATUSES = ['DISPOSED', 'RETIRED', 'IN_MAINTENANCE', 'ASSIGNED', 'LOST'];

const assetAttachmentSchema = new Schema(
  {
    title: { type: String, trim: true, required: true },
    category: { type: String, enum: ATTACHMENT_CATEGORIES, default: 'OTHER' },
    originalFileName: { type: String, required: true, trim: true },
    storageKey: { type: String, required: true, select: false },
    mimeType: { type: String, required: true },
    fileSize: { type: Number, required: true },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const assetSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    assetTag: { type: String, required: true, trim: true, uppercase: true },
    serialNumber: { type: String, trim: true },
    name: { type: String, required: true, trim: true },
    categoryId: { type: Schema.Types.ObjectId, ref: 'AssetCategory', required: true, index: true },
    brand: { type: String, trim: true },
    model: { type: String, trim: true },
    description: { type: String, trim: true },

    purchaseDate: { type: Date },
    purchasePrice: { type: Number, min: 0 },
    currency: { type: String, trim: true, uppercase: true, default: 'INR' },

    vendorId: { type: Schema.Types.ObjectId, ref: 'AssetVendor', index: true },

    warrantyStartDate: { type: Date },
    warrantyEndDate: { type: Date, index: true },

    status: { type: String, enum: ASSET_STATUSES, default: 'AVAILABLE', index: true },
    condition: { type: String, enum: ASSET_CONDITIONS, default: 'NEW' },

    location: { type: String, trim: true },

    assignedTo: { type: Schema.Types.ObjectId, ref: 'Employee', index: true },
    assignedDepartment: { type: Schema.Types.ObjectId, ref: 'Department', index: true },
    assignedAt: { type: Date },
    returnedAt: { type: Date },

    purchaseOrderNumber: { type: String, trim: true },
    invoiceNumber: { type: String, trim: true },

    notes: { type: String, trim: true },
    attachments: { type: [assetAttachmentSchema], default: [] },

    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },

    isDeleted: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

assetSchema.index({ organizationId: 1, assetTag: 1 }, { unique: true });
// A plain `sparse: true` compound index only excludes a document when ALL of
// its keys are missing — since organizationId is always present, two assets
// without a serial number would still collide as duplicate (org, null) keys.
// A partial index scoped to "serialNumber actually set" is what we want.
assetSchema.index(
  { organizationId: 1, serialNumber: 1 },
  { unique: true, partialFilterExpression: { serialNumber: { $exists: true, $type: 'string' } } }
);
assetSchema.index({ organizationId: 1, status: 1 });
assetSchema.index({ organizationId: 1, isDeleted: 1 });
assetSchema.index({ organizationId: 1, createdAt: -1 });
assetSchema.index({ organizationId: 1, name: 1 });

assetSchema.set('toJSON', {
  transform: (doc, ret) => {
    ret.id = ret._id;
    delete ret.__v;
    return ret;
  },
});

module.exports = model('Asset', assetSchema);
module.exports.ASSET_STATUSES = ASSET_STATUSES;
module.exports.ASSET_CONDITIONS = ASSET_CONDITIONS;
module.exports.ATTACHMENT_CATEGORIES = ATTACHMENT_CATEGORIES;
module.exports.NON_ASSIGNABLE_STATUSES = NON_ASSIGNABLE_STATUSES;
