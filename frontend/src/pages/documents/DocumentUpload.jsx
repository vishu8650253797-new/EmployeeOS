import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, X, FileText, AlertCircle } from 'lucide-react';
import { documentService } from '../../services/documentService';
import { documentCategoryService } from '../../services/documentCategoryService';
import { employeeService } from '../../services/employeeService';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { useToast } from '../../context/ToastContext';

export default function DocumentUpload() {
  const navigate = useNavigate();
  const { toast } = useToast();
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
    loadCategories();
    loadEmployees();
  }, []);

  const loadCategories = async () => {
    try {
      const categories = await documentCategoryService.getCategories();
      console.log('Categories loaded:', categories);
      setCategories(categories);
    } catch (error) {
      console.error('Failed to load categories:', error);
      toast.error('Failed to load categories');
    }
  };

  const loadEmployees = async () => {
    try {
      const response = await employeeService.getEmployees();
      console.log('Employees loaded:', response);
      setEmployees(response.data || []);
    } catch (error) {
      console.error('Failed to load employees:', error);
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
    console.log('Form submitted');
    console.log('File:', file);
    console.log('FormData:', formData);
    
    if (!file) {
      toast.error('Please select a file');
      return;
    }

    if (!formData.employeeId) {
      toast.error('Please select an employee');
      return;
    }

    if (!formData.categoryId) {
      toast.error('Please select a category');
      return;
    }

    if (!formData.title) {
      toast.error('Please enter a title');
      return;
    }

    const formDataToSend = new FormData();
    formDataToSend.append('file', file);
    formDataToSend.append('employeeId', formData.employeeId);
    formDataToSend.append('categoryId', formData.categoryId);
    formDataToSend.append('title', formData.title);
    formDataToSend.append('description', formData.description);

    console.log('FormDataToSend entries:', Array.from(formDataToSend.entries()));

    try {
      setLoading(true);
      console.log('Calling uploadDocument...');
      await documentService.uploadDocument(formDataToSend);
      console.log('Upload successful');
      toast.success('Document uploaded successfully');
      navigate('/documents');
    } catch (error) {
      console.error('Upload error:', error);
      console.error('Error response:', error.response);
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

        <Input
          label="Title"
          value={formData.title}
          onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
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
