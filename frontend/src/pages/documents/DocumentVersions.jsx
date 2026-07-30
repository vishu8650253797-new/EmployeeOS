import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useToast } from '../../context/ToastContext';
import { documentService } from '../../services/documentService';
import PageHeader from '../../components/layout/PageHeader';
import Button from '../../components/ui/Button';
import { FileText, Download, Eye, Calendar, User, Clock } from 'lucide-react';

export default function DocumentVersions() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [versions, setVersions] = useState([]);
  const [document, setDocument] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadVersions();
    loadDocument();
  }, [id]);

  const loadVersions = async () => {
    try {
      setLoading(true);
      const data = await documentService.getDocumentVersions(id);
      setVersions(data);
    } catch (error) {
      toast.error('Failed to load document versions');
    } finally {
      setLoading(false);
    }
  };

  const loadDocument = async () => {
    try {
      const data = await documentService.getDocument(id);
      setDocument(data);
    } catch (error) {
      toast.error('Failed to load document');
    }
  };

  const handleDownload = async (versionId) => {
    try {
      const response = await documentService.downloadDocument(versionId === 'current' ? id : versionId);
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

  const handlePreview = async (versionId) => {
    try {
      const response = await documentService.previewDocument(versionId === 'current' ? id : versionId);
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
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return 'N/A';
    return (bytes / 1024).toFixed(2) + ' KB';
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
        title="Document Versions"
        description={`Version history for ${document?.title || 'document'}`}
        breadcrumbs={[
          { label: 'Documents', to: '/documents' },
          { label: document?.title || 'Document', to: `/documents/${id}` },
          { label: 'Versions' },
        ]}
      />

      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">{document?.title}</h3>
          <p className="text-sm text-gray-500 mt-1">Current Version: {document?.currentVersion || 1}</p>
        </div>

        <div className="divide-y divide-gray-200">
          {versions.length === 0 ? (
            <div className="p-12 text-center">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No version history available</p>
            </div>
          ) : (
            versions.map((version, index) => (
              <VersionCard
                key={version.id}
                version={version}
                isCurrent={version.isCurrent}
                onDownload={() => handleDownload(version.id)}
                onPreview={() => handlePreview(version.id)}
                formatDate={formatDate}
                formatFileSize={formatFileSize}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function VersionCard({ version, isCurrent, onDownload, onPreview, formatDate, formatFileSize }) {
  return (
    <div className={`p-6 ${isCurrent ? 'bg-blue-50' : ''}`}>
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <div className={`p-3 rounded-lg ${isCurrent ? 'bg-blue-100' : 'bg-gray-100'}`}>
            <FileText className={`h-6 w-6 ${isCurrent ? 'text-blue-600' : 'text-gray-600'}`} />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-semibold text-gray-900">
                Version {version.versionNumber}
              </h4>
              {isCurrent && (
                <span className="px-2 py-1 bg-blue-600 text-white text-xs rounded-full">Current</span>
              )}
            </div>
            <p className="text-sm text-gray-600 mb-2">{version.originalFileName}</p>
            <div className="flex items-center gap-4 text-sm text-gray-500">
              <div className="flex items-center">
                <User className="h-4 w-4 mr-1" />
                <span>{version.uploadedBy?.name || 'Unknown'}</span>
              </div>
              <div className="flex items-center">
                <Calendar className="h-4 w-4 mr-1" />
                <span>{formatDate(version.createdAt)}</span>
              </div>
              <div className="flex items-center">
                <Clock className="h-4 w-4 mr-1" />
                <span>{formatFileSize(version.fileSize)}</span>
              </div>
            </div>
            {version.replacedReason && (
              <p className="text-sm text-gray-600 mt-2 italic">"{version.replacedReason}"</p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={onPreview}>
            <Eye className="h-4 w-4 mr-1" />
            Preview
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
