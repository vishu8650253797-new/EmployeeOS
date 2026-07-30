import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { documentService } from '../../services/documentService';
import { documentRequestService } from '../../services/documentRequestService';
import { documentAnalyticsService } from '../../services/documentAnalyticsService';
import PageHeader from '../../components/layout/PageHeader';
import Button from '../../components/ui/Button';
import { FileText, Upload, AlertTriangle, CheckCircle, Clock, Users, Search, Filter, Eye, Download, Shield } from 'lucide-react';

export default function HRDocumentDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [documents, setDocuments] = useState([]);
  const [requests, setRequests] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterVerification, setFilterVerification] = useState('all');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [docs, reqs, analyticsData] = await Promise.all([
        documentService.getDocuments(),
        documentRequestService.getRequests(),
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

  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = 
      doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.categoryName.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = filterStatus === 'all' || doc.status === filterStatus;
    const matchesVerification = filterVerification === 'all' || doc.verificationStatus === filterVerification;
    
    return matchesSearch && matchesStatus && matchesVerification;
  });

  const pendingVerification = documents.filter(d => d.verificationStatus === 'PENDING');
  const expiringDocuments = documents.filter(d => d.expiryStatus === 'EXPIRING_SOON' || d.expiryStatus === 'EXPIRED');
  const pendingRequests = requests.filter(r => r.status === 'PENDING' || r.status === 'UPLOADED');

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
        title="HR Document Dashboard"
        description="Manage employee documents and verification"
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          icon={<FileText className="h-5 w-5" />}
          label="Total Documents"
          value={analytics?.totalDocuments || 0}
          color="blue"
        />
        <StatCard
          icon={<Shield className="h-5 w-5" />}
          label="Pending Verification"
          value={analytics?.pendingVerification || 0}
          color="yellow"
        />
        <StatCard
          icon={<AlertTriangle className="h-5 w-5" />}
          label="Expiring Soon"
          value={analytics?.expiringSoon || 0}
          color="orange"
        />
        <StatCard
          icon={<Users className="h-5 w-5" />}
          label="Pending Requests"
          value={pendingRequests.length}
          color="purple"
        />
      </div>

      {pendingVerification.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h3 className="font-semibold text-yellow-800 mb-2">Documents Pending Verification</h3>
          <p className="text-sm text-yellow-700 mb-3">{pendingVerification.length} document(s) awaiting your review</p>
          <Button size="sm" onClick={() => navigate('/documents?verification=PENDING')}>
            Review Documents
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="p-6 border-b border-gray-200 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Pending Requests</h3>
            <Button size="sm" variant="secondary" onClick={() => navigate('/documents/requests')}>
              View All
            </Button>
          </div>
          <div className="divide-y divide-gray-200">
            {pendingRequests.length === 0 ? (
              <div className="p-6 text-center text-gray-500">No pending requests</div>
            ) : (
              pendingRequests.slice(0, 5).map((req) => (
                <RequestRow key={req.id} request={req} navigate={navigate} formatDate={formatDate} />
              ))
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200">
          <div className="p-6 border-b border-gray-200 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Expiring Documents</h3>
            <Button size="sm" variant="secondary" onClick={() => navigate('/documents?expiry=EXPIRING_SOON')}>
              View All
            </Button>
          </div>
          <div className="divide-y divide-gray-200">
            {expiringDocuments.length === 0 ? (
              <div className="p-6 text-center text-gray-500">No expiring documents</div>
            ) : (
              expiringDocuments.slice(0, 5).map((doc) => (
                <ExpiringDocRow key={doc.id} document={doc} formatDate={formatDate} getExpiryColor={getExpiryColor} />
              ))
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">All Documents</h3>
            <Button onClick={() => navigate('/documents/upload')}>
              <Upload className="h-4 w-4 mr-2" />
              Upload Document
            </Button>
          </div>
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search documents..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg"
            >
              <option value="all">All Status</option>
              <option value="ACTIVE">Active</option>
              <option value="EXPIRED">Expired</option>
              <option value="ARCHIVED">Archived</option>
            </select>
            <select
              value={filterVerification}
              onChange={(e) => setFilterVerification(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg"
            >
              <option value="all">All Verification</option>
              <option value="PENDING">Pending</option>
              <option value="VERIFIED">Verified</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>
        </div>

        <div className="divide-y divide-gray-200">
          {filteredDocuments.length === 0 ? (
            <div className="p-12 text-center">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No documents found</p>
            </div>
          ) : (
            filteredDocuments.map((doc) => (
              <DocumentRow
                key={doc.id}
                document={doc}
                onDownload={() => handleDownload(doc.id, doc.originalFileName)}
                onVerify={() => navigate(`/documents/${doc.id}/verify`)}
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
    purple: 'bg-purple-50 text-purple-600',
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

function RequestRow({ request, navigate, formatDate }) {
  return (
    <div className="p-4 hover:bg-gray-50 transition-colors">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium text-gray-900">{request.title}</p>
          <p className="text-sm text-gray-500">{request.employeeName}</p>
          <p className="text-xs text-gray-400 mt-1">Due: {formatDate(request.dueDate)}</p>
        </div>
        <Button size="sm" variant="secondary" onClick={() => navigate(`/documents/requests/${request.id}`)}>
          Review
        </Button>
      </div>
    </div>
  );
}

function ExpiringDocRow({ document, formatDate, getExpiryColor }) {
  return (
    <div className="p-4 hover:bg-gray-50 transition-colors">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium text-gray-900">{document.title}</p>
          <p className="text-sm text-gray-500">{document.employeeName}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getExpiryColor(document.expiryStatus)}`}>
              {document.expiryStatus}
            </span>
            <p className="text-xs text-gray-400">Expires: {formatDate(document.expiryDate)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function DocumentRow({ document, onDownload, onVerify, getStatusColor, getExpiryColor, formatDate }) {
  return (
    <div className="p-6 hover:bg-gray-50 transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-blue-50 rounded-lg">
            <FileText className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h4 className="font-semibold text-gray-900">{document.title}</h4>
            <p className="text-sm text-gray-500 mt-1">{document.employeeName} • {document.categoryName}</p>
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
            <p className="text-xs text-gray-400 mt-1">Uploaded: {formatDate(document.createdAt)}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {document.verificationStatus === 'PENDING' && (
            <Button size="sm" onClick={onVerify}>
              <Shield className="h-4 w-4 mr-1" />
              Verify
            </Button>
          )}
          <Button size="sm" variant="secondary" onClick={onDownload}>
            <Download className="h-4 w-4 mr-1" />
            Download
          </Button>
        </div>
      </div>
    </div>
  );
}
