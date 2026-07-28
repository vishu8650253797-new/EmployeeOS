import { mockRequest } from './api';
import { LEAVE_REQUESTS, LEAVE_BALANCE_SUMMARY } from '../data/leaveRequests';

// Leave service — currently backed by mock data.

let leaveRequests = structuredClone(LEAVE_REQUESTS);

export const leaveService = {
  async getLeaveRequests(params = {}) {
    let result = [...leaveRequests];
    if (params.status && params.status !== 'all') {
      result = result.filter((r) => r.status === params.status);
    }
    return mockRequest(result);
  },

  async getLeaveBalance() {
    return mockRequest(LEAVE_BALANCE_SUMMARY);
  },

  async approveLeave(id) {
    const index = leaveRequests.findIndex((r) => r.id === id);
    if (index === -1) throw new Error('Leave request not found');
    leaveRequests[index] = { ...leaveRequests[index], status: 'Approved' };
    return mockRequest(leaveRequests[index], 500);
  },

  async rejectLeave(id, rejectionReason = '') {
    const index = leaveRequests.findIndex((r) => r.id === id);
    if (index === -1) throw new Error('Leave request not found');
    leaveRequests[index] = { ...leaveRequests[index], status: 'Rejected', rejectionReason };
    return mockRequest(leaveRequests[index], 500);
  },
};
