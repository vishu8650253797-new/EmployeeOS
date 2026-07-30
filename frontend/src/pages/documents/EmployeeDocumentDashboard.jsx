import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { documentService } from '../../services/documentService';
import { documentRequestService } from '../../services/documentRequestService';
import { documentAnalyticsService } from '../../services/documentAnalyticsService';
import PageHeader from '../../components/layout/PageHeader';
import Button from '../../components/ui/Button';
import { FileText, Upload, AlertTriangle, CheckCircle, Clock, Calendar, Eye, Download } from 'lucide-react';

export default function EmployeeDocumentDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [documents, setDocuments] = useState([]);
  const [requests, setRequests] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [docs, reqs, analyticsData] = await Promise.all([
        documentService.getDocuments(),
        documentRequestService.getMyRequests(),
        documentAnalyticsService.getOverview(),
      ]);
      setDocuments(docs);
      setRequests(reqs);
      setAnalytics(analyticsData);
    } catch (error) {
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (id, filename) => {
    try {
      const response = await documentService.downloadDocument(id);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Document downloaded');
    } catch (error) {
      toast.error('Failed to download document');
    }
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'VERIFIED': return 'text-green-600 bg-green-100';
      case 'REJECTED': return 'text-red-600 bg-red-100';
      case 'PENDING': return 'text-yellow-600 bg-yellow-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getExpiryColor = (status) => {
    switch (status) {
      case 'EXPIRED': return 'text-red-600 bg-red-100';
      case 'EXPIRING_SOON': return 'text-orange-600 bg-orange-100';
      case 'VALID': return 'text-green-600 bg-green-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
      </div>
    );
  }

  const pendingRequests = requests.filter(r => r.status === 'PENDING');
  const expiringDocuments = documents.filter(d => d.expiryStatus === 'EXPIRING_SOON' || d.expiryStatus === 'EXPIRED');
  const pendingVerification = documents.filter(d => d.verificationStatus === 'PENDING');

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Documents"
        description="Manage your documents and respond to requests"
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          icon={<FileText className="h-5 w-5" />}
          label="Total Documents"
          value={documents.length}
          color="blue"
        />
        <StatCard
          icon={<CheckCircle className="h-5 w-5" />}
          label="Verified"
          value={documents.filter(d => d.verificationStatus === 'VERIFIED').length}
          color="green"
        />
        <StatCard
          icon={<Clock className="h-5 w-5" />}
          label="Pending Requests"
          value={pendingRequests.length}
          color="yellow"
        />
        <StatCard
          icon={<AlertTriangle className="h-5 w-5" />}
          label="Expiring Soon"
          value={expiringDocuments.length}
          color="orange"
        />
      </div>

      {pendingRequests.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h3 className="font-semibold text-yellow-800 mb-2">Pending Document Requests</h3>
          <p className="text-sm text-yellow-700 mb-3">You have {pendingRequests.length} pending document request(s)</p>
          <Button size="sm" onClick={() => navigate('/documents/requests')}>
            View Requests
          </Button>
        </div>
      )}

      {expiringDocuments.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <h3 className="font-semibold text-orange-800 mb-2">Expiring Documents</h3>
          <p className="text-sm text-orange-700 mb-3">You have {expiringDocuments.length} document(s) expiring soon or expired</p>
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">My Documents</h3>
          <Button onClick={() => navigate('/documents/upload')}>
            <Upload className="h-4 w-4 mr-2" />
            Upload Document
          </Button>
        </div>

        <div className="divide-y divide-gray-200">
          {documents.length === 0 ? (
            <div className="p-12 text-center">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 mb-4">No documents uploaded yet</p>
              <Button onClick={() => navigate('/documents/upload')}>
                Upload Your First Document
              </Button>
            </div>
          ) : (
            documents.map((doc) => (
              <DocumentCard
                key={doc.id}
                document={doc}
                onDownload={() => handleDownload(doc.id, doc.originalFileName)}
                onView={() => navigate(`/documents/${doc.id}`)}
                getStatusColor={getStatusColor}
                getExpiryColor={getExpiryColor}
                formatDate={formatDate}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color }) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    yellow: 'bg-yellow-50 text-yellow-600',
    orange: 'bg-orange-50 text-orange-600',
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between">
        <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
          {icon}
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          <p className="text-sm text-gray-500">{label}</p>
        </div>
      </div>
    </div>
  );
}

function DocumentCard({ document, onDownload, onView, getStatusColor, getExpiryColor, formatDate }) {
  return (
    <div className="p-6 hover:bg-gray-50 transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-blue-50 rounded-lg">
            <FileText className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h4 className="font-semibold text-gray-900">{document.title}</h4>
            <p className="text-sm text-gray-500 mt-1">{document.categoryName}</p>
            <div className="flex items-center gap-2 mt-2">
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(document.verificationStatus)}`}>
                {document.verificationStatus}
              </span>
              {document.expiryStatus !== 'NO_EXPIRY' && (
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getExpiryColor(document.expiryStatus)}`}>
                  {document.expiryStatus}
                </span>
              )}
            </div>
            <div className="flex items-center gap-4 text-sm text-gray-500 mt-2">
              <div className="flex items-center">
                <Calendar className="h-4 w-4 mr-1" />
                <span>Uploaded: {formatDate(document.createdAt)}</span>
              </div>
              {document.expiryDate && (
                <div className="flex items-center">
                  <Clock className="h-4 w-4 mr-1" />
                  <span>Expires: {formatDate(document.expiryDate)}</span>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={onView}>
            <Eye className="h-4 w-4 mr-1" />
            View
          </Button>
          <Button size="sm" onClick={onDownload}>
            <Download className="h-4 w-4 mr-1" />
            Download
          </Button>
        </div>
      </div>
    </div>
  );
}
