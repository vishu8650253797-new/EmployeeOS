import Breadcrumb from '../ui/Breadcrumb';

export default function PageHeader({ title, subtitle, breadcrumbs, actions }) {
  return (
    <div className="mb-6">
      {breadcrumbs && <Breadcrumb items={breadcrumbs} />}
      <div className={`flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between ${breadcrumbs ? 'mt-2.5' : ''}`}>
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-ink-900">{title}</h1>
          {subtitle && <p className="mt-1 text-[13px] text-ink-500">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
