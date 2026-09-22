import { useState } from 'react';
import { FolderOpen, Download, Eye } from 'lucide-react';
import { documentService } from '../../services/documentService';
import { useFetch } from '../../hooks/useFetch';
import { useToast } from '../../context/ToastContext';
import { formatDate } from '../../utils/format';
import PageHeader from '../../components/layout/PageHeader';
import Badge, { StatusBadge } from '../../components/ui/Badge';
import Tooltip from '../../components/ui/Tooltip';
import { TableSkeleton } from '../../components/ui/Skeleton';
import { EmptyState, ErrorState } from '../../components/ui/States';
import { TableContainer, Table, THead, TH, TBody, TR, TD } from '../../components/ui/Table';

const PREVIEWABLE_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];

export default function EssDocuments() {
  const { toast } = useToast();
  const [busyId, setBusyId] = useState(null);

  const { data, loading, error, refetch } = useFetch(() => documentService.getMyDocuments({ limit: 50 }), []);
  const documents = data?.data || [];

  async function handleDownload(doc) {
    setBusyId(doc.id);
    try {
      const response = await documentService.downloadDocument(doc.id);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', doc.originalFileName || doc.title);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err.message || 'Failed to download document');
    } finally {
      setBusyId(null);
    }
  }

  async function handlePreview(doc) {
    setBusyId(doc.id);
    try {
      const response = await documentService.previewDocument(doc.id);
      const url = window.URL.createObjectURL(new Blob([response.data], { type: doc.mimeType }));
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      toast.error(err.message || 'Failed to preview document');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <PageHeader title="My Documents" subtitle="Employment and HR-provided documents authorized for you" />
      <TableContainer>
        {loading ? (
          <TableSkeleton rows={6} cols={4} />
        ) : error ? (
          <ErrorState message={error} onRetry={refetch} />
        ) : documents.length === 0 ? (
          <EmptyState icon={FolderOpen} title="No documents yet" message="Documents HR shares with you will appear here." />
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Document</TH>
                <TH>Category</TH>
                <TH>Uploaded</TH>
                <TH>Status</TH>
                <TH className="text-right">Actions</TH>
              </tr>
            </THead>
            <TBody>
              {documents.map((doc) => (
                <TR key={doc.id}>
                  <TD className="font-medium text-ink-900">{doc.title}</TD>
                  <TD><Badge tone="neutral" dot={false}>{doc.categoryId?.name || '—'}</Badge></TD>
                  <TD className="text-ink-500">{formatDate(doc.createdAt)}</TD>
                  <TD><StatusBadge status={doc.status} /></TD>
                  <TD className="text-right">
                    <span className="inline-flex items-center gap-1">
                      {PREVIEWABLE_MIME_TYPES.includes(doc.mimeType) && (
                        <Tooltip label="Preview">
                          <button
                            type="button"
                            aria-label="Preview document"
                            disabled={busyId === doc.id}
                            onClick={() => handlePreview(doc)}
                            className="focus-ring rounded-lg p-1.5 text-ink-400 transition-colors hover:bg-ink-400/10 hover:text-ink-700 disabled:opacity-50"
                          >
                            <Eye size={16} />
                          </button>
                        </Tooltip>
                      )}
                      <Tooltip label="Download">
                        <button
                          type="button"
                          aria-label="Download document"
                          disabled={busyId === doc.id}
                          onClick={() => handleDownload(doc)}
                          className="focus-ring rounded-lg p-1.5 text-ink-400 transition-colors hover:bg-ink-400/10 hover:text-ink-700 disabled:opacity-50"
                        >
                          <Download size={16} />
                        </button>
                      </Tooltip>
                    </span>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </TableContainer>
    </div>
  );
}
