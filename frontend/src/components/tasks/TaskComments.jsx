import { useState } from 'react';
import { MessageSquare, Send, MoreHorizontal, Edit, Trash2 } from 'lucide-react';
import { taskCommentService } from '../../services/taskCommentService';
import { useFetch } from '../../hooks/useFetch';
import { useToast } from '../../context/ToastContext';
import { fullName } from '../../utils/format';
import Avatar from '../ui/Avatar';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Dropdown, { DropdownItem, DropdownSeparator } from '../ui/Dropdown';
import ConfirmDialog from '../ui/ConfirmDialog';
import { CardSkeleton } from '../ui/Skeleton';
import { EmptyState } from '../ui/States';

export default function TaskComments({ taskId }) {
  const { toast } = useToast();
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [editing, setEditing] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const { data, loading, error, refetch } = useFetch(
    () => taskCommentService.getTaskComments(taskId),
    [taskId]
  );
  const comments = data?.data || [];

  async function handleSubmit(e) {
    e.preventDefault();
    if (!content.trim()) return;
    setSubmitting(true);
    try {
      await taskCommentService.createTaskComment(taskId, { content });
      setContent('');
      toast.success('Comment added');
      refetch();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add comment');
    } finally {
      setSubmitting(false);
    }
  }

  function openEdit(comment) {
    setEditing(comment);
    setEditContent(comment.content);
  }

  async function handleUpdate() {
    if (!editContent.trim()) return;
    setSubmitting(true);
    try {
      await taskCommentService.updateTaskComment(editing.id, { content: editContent });
      toast.success('Comment updated');
      setEditing(null);
      setEditContent('');
      refetch();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update comment');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await taskCommentService.deleteTaskComment(deleteTarget.id);
      toast.success('Comment deleted');
      setDeleteTarget(null);
      refetch();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete comment');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <MessageSquare className="w-5 h-5" />
        Comments ({comments.length})
      </h3>

      <form onSubmit={handleSubmit} className="mb-6">
        <div className="flex gap-3">
          <Input
            value={content}
            onChange={setContent}
            placeholder="Add a comment..."
            className="flex-1"
          />
          <Button type="submit" loading={submitting} icon={<Send />}>
            Send
          </Button>
        </div>
      </form>

      {loading ? (
        <CardSkeleton count={2} />
      ) : comments.length === 0 ? (
        <EmptyState
          icon={<MessageSquare className="w-8 h-8" />}
          title="No comments yet"
          description="Be the first to comment on this task"
        />
      ) : (
        <div className="space-y-4">
          {comments.map((comment) => (
            <div key={comment.id} className="flex gap-3">
              <Avatar src={comment.author?.avatar} name={fullName(comment.author)} size="sm" />
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-sm">{fullName(comment.author)}</span>
                  <span className="text-xs text-gray-500">
                    {new Date(comment.createdAt).toLocaleString()}
                  </span>
                </div>
                {editing?.id === comment.id ? (
                  <div className="flex gap-2 mt-2">
                    <Input
                      value={editContent}
                      onChange={setEditContent}
                      className="flex-1"
                      autoFocus
                    />
                    <Button size="sm" onClick={handleUpdate} loading={submitting}>
                      Save
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => { setEditing(null); setEditContent(''); }}>
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-gray-700 mb-2">{comment.content}</p>
                    <Dropdown
                      trigger={
                        <button className="p-1 hover:bg-gray-100 rounded">
                          <MoreHorizontal className="w-4 h-4 text-gray-400" />
                        </button>
                      }
                    >
                      <DropdownItem onClick={() => openEdit(comment)} icon={<Edit />}>
                        Edit
                      </DropdownItem>
                      <DropdownSeparator />
                      <DropdownItem onClick={() => setDeleteTarget(comment)} icon={<Trash2 />} className="text-red-600">
                        Delete
                      </DropdownItem>
                    </Dropdown>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Delete Comment"
        message="Are you sure you want to delete this comment?"
      />
    </div>
  );
}
