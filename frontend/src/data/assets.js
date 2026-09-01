// Static option lists for the asset management module — mirrors the backend's
// controlled enums (backend/src/models/Asset.js, AssetMaintenance.js, AssetRequest.js).

export const ASSET_STATUSES = [
  { value: 'AVAILABLE', label: 'Available' },
  { value: 'RESERVED', label: 'Reserved' },
  { value: 'ASSIGNED', label: 'Assigned' },
  { value: 'IN_MAINTENANCE', label: 'In Maintenance' },
  { value: 'DAMAGED', label: 'Damaged' },
  { value: 'LOST', label: 'Lost' },
  { value: 'RETURNED', label: 'Returned' },
  { value: 'RETIRED', label: 'Retired' },
  { value: 'DISPOSED', label: 'Disposed' },
];

export const ASSET_CONDITIONS = [
  { value: 'NEW', label: 'New' },
  { value: 'EXCELLENT', label: 'Excellent' },
  { value: 'GOOD', label: 'Good' },
  { value: 'FAIR', label: 'Fair' },
  { value: 'DAMAGED', label: 'Damaged' },
];

export const ATTACHMENT_CATEGORIES = [
  { value: 'PURCHASE_INVOICE', label: 'Purchase Invoice' },
  { value: 'WARRANTY_CARD', label: 'Warranty Card' },
  { value: 'PURCHASE_ORDER', label: 'Purchase Order' },
  { value: 'PHOTOGRAPH', label: 'Photograph' },
  { value: 'REPAIR_INVOICE', label: 'Repair Invoice' },
  { value: 'MAINTENANCE_DOCUMENT', label: 'Maintenance Document' },
  { value: 'OTHER', label: 'Other' },
];

export const REQUEST_STATUSES = [
  { value: 'PENDING', label: 'Pending' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'FULFILLED', label: 'Fulfilled' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

export const PRIORITIES = [
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
  { value: 'URGENT', label: 'Urgent' },
];

export const MAINTENANCE_STATUSES = [
  { value: 'OPEN', label: 'Open' },
  { value: 'ASSIGNED', label: 'Assigned' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'WAITING_FOR_PARTS', label: 'Waiting for Parts' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

export const MAINTENANCE_ISSUE_TYPES = [
  { value: 'HARDWARE', label: 'Hardware' },
  { value: 'SOFTWARE', label: 'Software' },
  { value: 'PERFORMANCE', label: 'Performance' },
  { value: 'DAMAGE', label: 'Damage' },
  { value: 'OTHER', label: 'Other' },
];

export const WARRANTY_STATUSES = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'EXPIRING_SOON', label: 'Expiring Soon' },
  { value: 'EXPIRED', label: 'Expired' },
  { value: 'NONE', label: 'No Warranty' },
];

export const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP'];
