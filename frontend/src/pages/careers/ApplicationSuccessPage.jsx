import { useNavigate } from 'react-router-dom';
import { CheckCircle, ArrowLeft, Home } from 'lucide-react';
import Button from '../../components/ui/Button';

export default function ApplicationSuccessPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-canvas">
      <div className="mx-auto max-w-2xl px-4 py-12">
        <div className="rounded-xl border border-line bg-surface p-8 text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-success-50">
            <CheckCircle size={40} className="text-success-600" />
          </div>
          <h1 className="text-3xl font-bold text-ink-900">Application Submitted!</h1>
          <p className="mt-4 text-lg text-ink-600">
            Thank you for your interest. We have received your application and will review it shortly.
          </p>
          <p className="mt-2 text-sm text-ink-500">
            If your qualifications match our requirements, we will contact you for the next steps.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Button variant="secondary" onClick={() => navigate('/careers')} icon={<ArrowLeft size={16} />}>
              Browse More Jobs
            </Button>
            <Button onClick={() => navigate('/')} icon={<Home size={16} />}>
              Go to Homepage
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
