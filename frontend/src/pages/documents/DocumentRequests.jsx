import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { documentRequestService } from '../../services/documentRequestService';
import { documentCategoryService } from '../../services/documentCategoryService';
import { employeeService } from '../../services/employeeService';
import PageHeader from '../../components/layout/PageHeader';
import Button from '../../components/ui/Button';
import { MessageSquare, Calendar, AlertCircle, CheckCircle, XCircle, Clock, Upload } from 'lucide-react';

const STATUS_COLORS = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  UPLOADED: 'bg-blue-100 text-blue-800',
  UNDER_REVIEW: 'bg-purple-100 text-purple-800',
  APPROVED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-800',
  EXPIRED: 'bg-gray-100 text-gray-800',
  CANCELLED: 'bg-gray-100 text-gray-800',
};

const PRIORITY_COLORS = {
  LOW: 'bg-gray-100 text-gray-800',
  MEDIUM: 'bg-blue-100 text-blue-800',
  HIGH: 'bg-orange-100 text-orange-800',
  URGENT: 'bg-red-100 text-red-800',
};

export default function DocumentRequests() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [requests, setRequests] = useState([]);
  const [categories, setCategories] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState({
    employeeId: '',
    categoryId: '',
    title: '',
    description: '',
    priority: 'MEDIUM',
    dueDate: '',
  });

  const isHR = ['SUPER_ADMIN', 'HR_ADMIN', 'MANAGER'].includes(user?.role);

  useEffect(() => {
    loadRequests();
    if (isHR) {
      loadCategories();
      loadEmployees();
    }
  }, []);

  const loadRequests = async () => {
    try {
      setLoading(true);
      const data = isHR 
        ? await documentRequestService.getRequests()
        : await documentRequestService.getMyRequests();
      setRequests(data);
    } catch (error) {
      toast.error('Failed to load document requests');
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const data = await documentCategoryService.getCategories();
      setCategories(data);
    } catch (error) {
      toast.error('Failed to load categories');
    }
  };

  const loadEmployees = async () => {
    try {
      const response = await employeeService.getEmployees();
      setEmployees(response.data || []);
    } catch (error) {
      toast.error('Failed to load employees');
    }
  };

  const handleCreateRequest = async (e) => {
    e.preventDefault();
    try {
      await documentRequestService.createRequest(formData);
      toast.success('Document request created');
      setShowCreateModal(false);
      setFormData({
        employeeId: '',
        categoryId: '',
        title: '',
        description: '',
        priority: 'MEDIUM',
        dueDate: '',
      });
      loadRequests();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to create request');
    }
  };

  const handleCancelRequest = async (id) => {
    if (!window.confirm('Are you sure you want to cancel this request?')) return;
    try {
      await documentRequestService.cancelRequest(id);
      toast.success('Request cancelled');
      loadRequests();
    } catch (error) {
      toast.error('Failed to cancel request');
    }
  };

  const formatDate = (date) => {
    if (!date) return 'No due date';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Document Requests"
        description={isHR ? 'Manage document requests from employees' : 'View and respond to document requests'}
      />

      {isHR && (
        <Button onClick={() => setShowCreateModal(true)}>
          <MessageSquare className="h-4 w-4 mr-2" />
          Create Request
        </Button>
      )}

      <div className="space-y-4">
        {requests.length === 0 ? (
          <div className="text-center py-12">
            <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No document requests found</p>
          </div>
        ) : (
          requests.map((request) => (
            <RequestCard
              key={request.id}
              request={request}
              isHR={isHR}
              onCancel={handleCancelRequest}
              onUpload={() => navigate(`/documents/requests/${request.id}/upload`)}
            />
          ))
        )}
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-semibold mb-4">Create Document Request</h2>
            <form onSubmit={handleCreateRequest} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Employee</label>
                <select
                  value={formData.employeeId}
                  onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  required
                >
                  <option value="">Select employee</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.firstName} {emp.lastName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Document Category</label>
                <select
                  value={formData.categoryId}
                  onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  required
                >
                  <option value="">Select category</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  rows={3}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                <select
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">Urgent</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
                <input
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <Button type="submit" className="flex-1">Create Request</Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function RequestCard({ request, isHR, onCancel, onUpload }) {
  const getStatusIcon = (status) => {
    switch (status) {
      case 'PENDING': return <Clock className="h-4 w-4" />;
      case 'UPLOADED': return <Upload className="h-4 w-4" />;
      case 'UNDER_REVIEW': return <AlertCircle className="h-4 w-4" />;
      case 'APPROVED': return <CheckCircle className="h-4 w-4" />;
      case 'REJECTED': return <XCircle className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 rounded-lg">
            <MessageSquare className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">{request.title}</h3>
            <p className="text-sm text-gray-500">{request.categoryName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[request.status]}`}>
            {request.status}
          </span>
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${PRIORITY_COLORS[request.priority]}`}>
            {request.priority}
          </span>
        </div>
      </div>

      <p className="text-gray-700 mb-4">{request.description}</p>

      <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
        <div className="flex items-center">
          <Calendar className="h-4 w-4 mr-1" />
          <span>Due: {formatDate(request.dueDate)}</span>
        </div>
        {request.employeeName && (
          <div>
            <span>Employee: {request.employeeName}</span>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        {request.status === 'PENDING' && !isHR && (
          <Button onClick={onUpload} size="sm">
            <Upload className="h-4 w-4 mr-1" />
            Upload Document
          </Button>
        )}
        {isHR && request.status === 'PENDING' && (
          <Button variant="danger" size="sm" onClick={() => onCancel(request.id)}>
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
}
