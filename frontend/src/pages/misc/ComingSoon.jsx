import { Hammer } from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import Card from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/States';

export default function ComingSoon({ title = 'Coming Soon' }) {
  return (
    <div>
      <PageHeader title={title} />
      <Card padding={false}>
        <EmptyState
          icon={Hammer}
          title={`${title} is under construction`}
          message="This module is part of the EmployeeOS roadmap and will be available in an upcoming release."
        />
      </Card>
    </div>
  );
}
