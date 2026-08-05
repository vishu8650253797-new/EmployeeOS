const { Schema, model } = require('mongoose');

const PROCESS_TYPES = ['ONBOARDING', 'OFFBOARDING'];
const TASK_CATEGORIES = ['DOCUMENTATION', 'IT_SETUP', 'TRAINING', 'HR', 'FINANCE', 'FACILITIES', 'COMPLIANCE', 'HANDOVER', 'OTHER'];
const ASSIGNEE_ROLES = ['HR_ADMIN', 'MANAGER', 'IT_ADMIN', 'FINANCE', 'EMPLOYEE'];

const templateTaskSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    category: { type: String, enum: TASK_CATEGORIES, default: 'OTHER' },
    defaultAssigneeRole: { type: String, enum: ASSIGNEE_ROLES, default: 'HR_ADMIN' },
    dueOffsetDays: { type: Number, default: 0, min: 0 },
    order: { type: Number, default: 0 },
    isRequired: { type: Boolean, default: true },
  },
  { _id: true }
);

const onboardingTemplateSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    type: { type: String, enum: PROCESS_TYPES, required: true },
    departmentId: { type: Schema.Types.ObjectId, ref: 'Department' },
    tasks: { type: [templateTaskSchema], default: [] },
    status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

onboardingTemplateSchema.index({ organizationId: 1, type: 1, status: 1 });

onboardingTemplateSchema.set('toJSON', {
  transform: (doc, ret) => {
    ret.id = ret._id;
    delete ret.__v;
    return ret;
  },
});

module.exports = model('OnboardingTemplate', onboardingTemplateSchema);
module.exports.PROCESS_TYPES = PROCESS_TYPES;
module.exports.TASK_CATEGORIES = TASK_CATEGORIES;
module.exports.ASSIGNEE_ROLES = ASSIGNEE_ROLES;
