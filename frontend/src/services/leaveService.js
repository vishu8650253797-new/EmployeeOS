import { leaveRequestService } from './leaveRequestService';
import { leaveBalanceService } from './leaveBalanceService';

// Leave service — proxies to REST APIs and normalizes data for UI compatibility.

export const leaveService = {
  async getLeaveRequests(params = {}) {
    const status = params.status === 'all' || params.status === 'ALL' ? undefined : params.status;
    const res = await leaveRequestService.getLeaveRequests({ ...params, status });
    return res.data || [];
  },

  async getLeaveBalance() {
    const res = await leaveBalanceService.getMyLeaveBalances();
    return res.data || [];
  },

  async approveLeave(id) {
    const res = await leaveRequestService.approveLeaveRequest(id);
    return res.data;
  },

  async rejectLeave(id, rejectionReason = '') {
    const res = await leaveRequestService.rejectLeaveRequest(id, rejectionReason);
    return res.data;
  },
};
