import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useToast } from '../../context/ToastContext';
import { documentService } from '../../services/documentService';
import PageHeader from '../../components/layout/PageHeader';
import Button from '../../components/ui/Button';
import { FileText, CheckCircle, XCircle, AlertCircle, Calendar, User, Download, Eye } from 'lucide-react';

export default function DocumentVerification() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [document, setDocument] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    loadDocument();
  }, [id]);

  const loadDocument = async () => {
    try {
      setLoading(true);
      const data = await documentService.getDocument(id);
      setDocument(data);
    } catch (error) {
      toast.error('Failed to load document');
      navigate('/documents');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    try {
      setProcessing(true);
      await documentService.verifyDocument(id);
      toast.success('Document verified successfully');
      loadDocument();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to verify document');
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      toast.error('Please provide a rejection reason');
      return;
    }
    try {
      setProcessing(true);
      await documentService.rejectDocument(id, { rejectionReason });
      toast.success('Document rejected');
      setShowRejectModal(false);
      setRejectionReason('');
      loadDocument();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to reject document');
    } finally {
      setProcessing(false);
    }
  };

  const handleDownload = async () => {
    try {
      const response = await documentService.downloadDocument(id);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', document?.originalFileName || 'document');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Document downloaded');
    } catch (error) {
      toast.error('Failed to download document');
    }
  };

  const handlePreview = async () => {
    try {
      const response = await documentService.previewDocument(id);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      window.open(url, '_blank');
    } catch (error) {
      toast.error('Failed to preview document');
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
      </div>
    );
  }

  if (!document) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-500">Document not found</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Document Verification"
        description="Review and verify employee documents"
        breadcrumbs={[
          { label: 'Documents', to: '/documents' },
          { label: document.title, to: `/documents/${id}` },
          { label: 'Verification' },
        ]}
      />

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-blue-50 rounded-lg">
              <FileText className="h-8 w-8 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">{document.title}</h2>
              <p className="text-sm text-gray-500 mt-1">{document.categoryName}</p>
            </div>
          </div>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(document.verificationStatus)}`}>
            {document.verificationStatus}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
              <User className="h-4 w-4" />
              <span>Employee</span>
            </div>
            <p className="font-medium text-gray-900">{document.employeeName}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
              <Calendar className="h-4 w-4" />
              <span>Uploaded</span>
            </div>
            <p className="font-medium text-gray-900">{formatDate(document.createdAt)}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
              <FileText className="h-4 w-4" />
              <span>File</span>
            </div>
            <p className="font-medium text-gray-900">{document.originalFileName}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
              <AlertCircle className="h-4 w-4" />
              <span>Version</span>
            </div>
            <p className="font-medium text-gray-900">{document.currentVersion}</p>
          </div>
        </div>

        {document.description && (
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Description</h3>
            <p className="text-gray-600">{document.description}</p>
          </div>
        )}

        {document.rejectionReason && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <h3 className="text-sm font-medium text-red-800 mb-2">Rejection Reason</h3>
            <p className="text-red-700">{document.rejectionReason}</p>
          </div>
        )}

        <div className="flex gap-3 mb-6">
          <Button onClick={handlePreview} variant="secondary">
            <Eye className="h-4 w-4 mr-2" />
            Preview
          </Button>
          <Button onClick={handleDownload} variant="secondary">
            <Download className="h-4 w-4 mr-2" />
            Download
          </Button>
        </div>

        {document.verificationStatus === 'PENDING' && (
          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <Button
              onClick={handleVerify}
              disabled={processing}
              className="flex-1"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              {processing ? 'Processing...' : 'Verify Document'}
            </Button>
            <Button
              onClick={() => setShowRejectModal(true)}
              variant="danger"
              disabled={processing}
              className="flex-1"
            >
              <XCircle className="h-4 w-4 mr-2" />
              Reject
            </Button>
          </div>
        )}
      </div>

      {showRejectModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-semibold mb-4">Reject Document</h2>
            <p className="text-sm text-gray-600 mb-4">
              Please provide a reason for rejecting this document. The employee will be notified.
            </p>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-4"
              rows={4}
              placeholder="Enter rejection reason..."
              required
            />
            <div className="flex gap-3">
              <Button
                onClick={handleReject}
                disabled={processing}
                className="flex-1"
              >
                {processing ? 'Processing...' : 'Reject'}
              </Button>
              <Button
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectionReason('');
                }}
                variant="secondary"
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
