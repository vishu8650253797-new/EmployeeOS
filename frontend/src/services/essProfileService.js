import api from './api';

export const essProfileService = {
  async getProfile() {
    const { data } = await api.get('/ess/me/profile');
    return data.data;
  },

  async updateProfile(payload) {
    const { data } = await api.patch('/ess/me/profile', payload);
    return data.data;
  },

  async addEmergencyContact(payload) {
    const { data } = await api.post('/ess/me/profile/emergency-contacts', payload);
    return data.data;
  },

  async updateEmergencyContact(contactId, payload) {
    const { data } = await api.patch(`/ess/me/profile/emergency-contacts/${contactId}`, payload);
    return data.data;
  },

  async removeEmergencyContact(contactId) {
    const { data } = await api.delete(`/ess/me/profile/emergency-contacts/${contactId}`);
    return data;
  },

  // Profile photo reuses the existing, already self-service-capable
  // /api/employees/:id/photo endpoint (see employeeService.updatePhoto on the
  // backend) rather than a new ESS-specific one.
  async updatePhoto(employeeId, formData) {
    const { data } = await api.patch(`/employees/${employeeId}/photo`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data.data;
  },

  // That endpoint requires an Authorization header, so a plain <img src="...">
  // can't load it (browsers don't attach custom headers to image requests).
  // Fetch it as a blob instead and hand back an object URL for <img>. Callers
  // must revoke the URL when done (see EssProfile.jsx).
  async getPhotoObjectUrl(employeeId) {
    const response = await api.get(`/employees/${employeeId}/photo`, { responseType: 'blob' });
    return URL.createObjectURL(response.data);
  },
};
