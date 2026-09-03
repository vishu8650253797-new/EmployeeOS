import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Upload, X, FileText, AlertCircle } from 'lucide-react';
import { documentService } from '../../services/documentService';
import { documentRequestService } from '../../services/documentRequestService';
import { documentCategoryService } from '../../services/documentCategoryService';
import { employeeService } from '../../services/employeeService';
import { useAuth } from '../../context/AuthContext';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { useToast } from '../../context/ToastContext';

const EMPLOYEE_PICKER_ROLES = ['SUPER_ADMIN', 'HR_ADMIN', 'MANAGER'];

export default function DocumentUpload() {
  const navigate = useNavigate();
  const { id: requestId } = useParams();
  const isRequestUpload = Boolean(requestId);
  const { user } = useAuth();
  const { toast } = useToast();
  const canPickEmployee = EMPLOYEE_PICKER_ROLES.includes(user?.role);
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [file, setFile] = useState(null);
  const [formData, setFormData] = useState({
    employeeId: '',
    categoryId: '',
    title: '',
    description: '',
  });

  useEffect(() => {
    // A request-fulfillment upload derives the employee/category from the
    // request itself server-side — no need for these pickers on that path.
    if (isRequestUpload) return;
    loadCategories();
    if (canPickEmployee) loadEmployees();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRequestUpload]);

  const loadCategories = async () => {
    try {
      const categories = await documentCategoryService.getCategories();
      setCategories(categories);
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

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      if (!formData.title) {
        setFormData(prev => ({ ...prev, title: selectedFile.name.split('.')[0] }));
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!file) {
      toast.error('Please select a file');
      return;
    }

    if (!isRequestUpload) {
      if (canPickEmployee && !formData.employeeId) {
        toast.error('Please select an employee');
        return;
      }

      if (!formData.categoryId) {
        toast.error('Please select a category');
        return;
      }
    }

    if (!formData.title) {
      toast.error('Please enter a title');
      return;
    }

    const formDataToSend = new FormData();
    formDataToSend.append('file', file);
    formDataToSend.append('title', formData.title);
    formDataToSend.append('description', formData.description);
    if (!isRequestUpload) {
      // Omit employeeId entirely for self-service uploads — the backend
      // falls back to the authenticated user's own employee record.
      if (formData.employeeId) formDataToSend.append('employeeId', formData.employeeId);
      formDataToSend.append('categoryId', formData.categoryId);
    }

    try {
      setLoading(true);
      if (isRequestUpload) {
        await documentRequestService.uploadForRequest(requestId, formDataToSend);
        toast.success('Document submitted for the request');
        navigate('/documents/requests');
      } else {
        await documentService.uploadDocument(formDataToSend);
        toast.success('Document uploaded successfully');
        navigate('/documents');
      }
    } catch (error) {
      toast.error(error.response?.data?.message || error.message || 'Failed to upload document');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <button
          onClick={() => navigate('/documents')}
          className="text-sm text-gray-600 hover:text-gray-900 mb-4"
        >
          ← Back to Documents
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Upload Document</h1>
        <p className="text-sm text-gray-600 mt-1">Upload a new document for an employee</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select File
          </label>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors cursor-pointer"
               onClick={() => !file && document.getElementById('file-upload').click()}>
            {file ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <FileText className="h-8 w-8 text-blue-600 mr-3" />
                  <div className="text-left">
                    <div className="text-sm font-medium text-gray-900">{file.name}</div>
                    <div className="text-xs text-gray-500">{(file.size / 1024).toFixed(2)} KB</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setFile(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                  aria-label="Remove selected file"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            ) : (
              <div>
                <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-sm text-gray-600 mb-2">
                  Drag and drop a file here, or click to select
                </p>
                <input
                  type="file"
                  onChange={handleFileChange}
                  className="hidden"
                  id="file-upload"
                  accept=".pdf,.jpg,.jpeg,.png"
                />
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    document.getElementById('file-upload').click();
                  }}
                  className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg cursor-pointer hover:bg-blue-700"
                >
                  Select File
                </button>
              </div>
            )}
          </div>
        </div>

        {!isRequestUpload && canPickEmployee && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Employee
            </label>
            <select
              value={formData.employeeId}
              onChange={(e) => setFormData(prev => ({ ...prev, employeeId: e.target.value }))}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Select an employee</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.firstName} {emp.lastName} ({emp.employeeId})
                </option>
              ))}
            </select>
          </div>
        )}

        {!isRequestUpload && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Category
          </label>
          <select
            value={formData.categoryId}
            onChange={(e) => setFormData(prev => ({ ...prev, categoryId: e.target.value }))}
            required
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Select a category</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>
        )}

        <Input
          label="Title"
          value={formData.title}
          onChange={(v) => setFormData(prev => ({ ...prev, title: v }))}
          required
        />

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Description
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            rows={3}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div className="flex items-center gap-4 pt-4">
          <button
            type="submit"
            disabled={loading || !file}
            className={`flex-1 h-10 px-4 text-sm font-medium rounded-lg transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
              loading || !file
                ? 'bg-gray-400 text-white cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {loading ? 'Uploading...' : 'Upload Document'}
          </button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => navigate('/documents')}
            className="flex-1"
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
