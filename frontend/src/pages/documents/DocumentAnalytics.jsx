import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { documentAnalyticsService } from '../../services/documentAnalyticsService';
import PageHeader from '../../components/layout/PageHeader';
import { FileText, TrendingUp, AlertTriangle, CheckCircle, Users, Building2, PieChart } from 'lucide-react';

export default function DocumentAnalytics() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [overview, setOverview] = useState(null);
  const [expiry, setExpiry] = useState(null);
  const [categories, setCategories] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [compliance, setCompliance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [overviewData, expiryData, categoryData, departmentData, complianceData] = await Promise.all([
        documentAnalyticsService.getOverview(),
        documentAnalyticsService.getExpiryAnalytics(),
        documentAnalyticsService.getCategoryAnalytics(),
        documentAnalyticsService.getDepartmentAnalytics(),
        documentAnalyticsService.getComplianceReport(),
      ]);
      setOverview(overviewData);
      setExpiry(expiryData);
      setCategories(categoryData);
      setDepartments(departmentData);
      setCompliance(complianceData);
    } catch (error) {
      toast.error('Failed to load analytics data');
    } finally {
      setLoading(false);
    }
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
        title="Document Analytics"
        description="Comprehensive document compliance and analytics"
      />

      <div className="flex gap-2 border-b border-gray-200">
        <TabButton active={activeTab === 'overview'} onClick={() => setActiveTab('overview')}>
          Overview
        </TabButton>
        <TabButton active={activeTab === 'expiry'} onClick={() => setActiveTab('expiry')}>
          Expiry
        </TabButton>
        <TabButton active={activeTab === 'categories'} onClick={() => setActiveTab('categories')}>
          Categories
        </TabButton>
        <TabButton active={activeTab === 'departments'} onClick={() => setActiveTab('departments')}>
          Departments
        </TabButton>
        <TabButton active={activeTab === 'compliance'} onClick={() => setActiveTab('compliance')}>
          Compliance
        </TabButton>
      </div>

      {activeTab === 'overview' && <OverviewTab overview={overview} />}
      {activeTab === 'expiry' && <ExpiryTab expiry={expiry} />}
      {activeTab === 'categories' && <CategoriesTab categories={categories} />}
      {activeTab === 'departments' && <DepartmentsTab departments={departments} />}
      {activeTab === 'compliance' && <ComplianceTab compliance={compliance} />}
    </div>
  );
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 font-medium transition-colors ${
        active
          ? 'text-brand-600 border-b-2 border-brand-600'
          : 'text-gray-500 hover:text-gray-700'
      }`}
    >
      {children}
    </button>
  );
}

function OverviewTab({ overview }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <MetricCard
          icon={<FileText className="h-5 w-5" />}
          label="Total Documents"
          value={overview?.totalDocuments || 0}
          color="blue"
        />
        <MetricCard
          icon={<CheckCircle className="h-5 w-5" />}
          label="Verified"
          value={overview?.verified || 0}
          color="green"
        />
        <MetricCard
          icon={<AlertTriangle className="h-5 w-5" />}
          label="Pending Verification"
          value={overview?.pendingVerification || 0}
          color="yellow"
        />
        <MetricCard
          icon={<TrendingUp className="h-5 w-5" />}
          label="Request Completion"
          value={`${overview?.requestCompletionRate || 0}%`}
          color="purple"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Document Status</h3>
          <div className="space-y-4">
            <ProgressBar label="Verified" value={overview?.verified || 0} total={overview?.totalDocuments || 1} color="green" />
            <ProgressBar label="Pending" value={overview?.pendingVerification || 0} total={overview?.totalDocuments || 1} color="yellow" />
            <ProgressBar label="Rejected" value={overview?.rejected || 0} total={overview?.totalDocuments || 1} color="red" />
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Expiry Status</h3>
          <div className="space-y-4">
            <ProgressBar label="Expiring Soon" value={overview?.expiringSoon || 0} total={overview?.totalDocuments || 1} color="orange" />
            <ProgressBar label="Expired" value={overview?.expired || 0} total={overview?.totalDocuments || 1} color="red" />
          </div>
        </div>
      </div>
    </div>
  );
}

function ExpiryTab({ expiry }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <MetricCard
          icon={<FileText className="h-5 w-5" />}
          label="Total"
          value={expiry?.total || 0}
          color="blue"
        />
        <MetricCard
          icon={<CheckCircle className="h-5 w-5" />}
          label="Valid"
          value={expiry?.valid || 0}
          color="green"
        />
        <MetricCard
          icon={<AlertTriangle className="h-5 w-5" />}
          label="Expiring Soon"
          value={expiry?.expiringSoon || 0}
          color="orange"
        />
        <MetricCard
          icon={<AlertTriangle className="h-5 w-5" />}
          label="Expired"
          value={expiry?.expired || 0}
          color="red"
        />
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Expiry Distribution</h3>
        <div className="space-y-4">
          <ProgressBar label="Valid" value={expiry?.valid || 0} total={expiry?.total || 1} color="green" />
          <ProgressBar label="Expiring Soon" value={expiry?.expiringSoon || 0} total={expiry?.total || 1} color="orange" />
          <ProgressBar label="Expired" value={expiry?.expired || 0} total={expiry?.total || 1} color="red" />
          <ProgressBar label="No Expiry" value={expiry?.noExpiry || 0} total={expiry?.total || 1} color="gray" />
        </div>
        <p className="text-sm text-gray-500 mt-4">Warning period: {expiry?.warningDays || 30} days</p>
      </div>
    </div>
  );
}

function CategoriesTab({ categories }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200">
      <div className="p-6 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">Documents by Category</h3>
      </div>
      <div className="divide-y divide-gray-200">
        {categories.length === 0 ? (
          <div className="p-12 text-center text-gray-500">No category data available</div>
        ) : (
          categories.map((cat) => (
            <CategoryRow key={cat.categoryId} category={cat} />
          ))
        )}
      </div>
    </div>
  );
}

function CategoryRow({ category }) {
  const total = category.total || 1;
  const verifiedPercent = Math.round((category.verified / total) * 100);
  const pendingPercent = Math.round((category.pending / total) * 100);
  const rejectedPercent = Math.round((category.rejected / total) * 100);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h4 className="font-semibold text-gray-900">{category.categoryName}</h4>
          <p className="text-sm text-gray-500">{category.total} documents</p>
        </div>
        <div className="flex gap-2">
          <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">{verifiedPercent}% Verified</span>
        </div>
      </div>
      <div className="space-y-2">
        <ProgressBar label="Verified" value={category.verified} total={total} color="green" showPercent />
        <ProgressBar label="Pending" value={category.pending} total={total} color="yellow" showPercent />
        <ProgressBar label="Rejected" value={category.rejected} total={total} color="red" showPercent />
      </div>
    </div>
  );
}

function DepartmentsTab({ departments }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200">
      <div className="p-6 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">Documents by Department</h3>
      </div>
      <div className="divide-y divide-gray-200">
        {departments.length === 0 ? (
          <div className="p-12 text-center text-gray-500">No department data available</div>
        ) : (
          departments.map((dept) => (
            <DepartmentRow key={dept.departmentId} department={dept} />
          ))
        )}
      </div>
    </div>
  );
}

function DepartmentRow({ department }) {
  const total = department.total || 1;
  const verifiedPercent = Math.round((department.verified / total) * 100);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-blue-50 rounded-lg">
            <Building2 className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h4 className="font-semibold text-gray-900">{department.departmentName}</h4>
            <p className="text-sm text-gray-500">{department.total} documents</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-gray-900">{verifiedPercent}%</p>
          <p className="text-sm text-gray-500">Verified</p>
        </div>
      </div>
    </div>
  );
}

function ComplianceTab({ compliance }) {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Overall Compliance</h3>
          <div className="text-right">
            <p className="text-3xl font-bold text-gray-900">{compliance?.averageCompliance || 0}%</p>
            <p className="text-sm text-gray-500">Average Compliance</p>
          </div>
        </div>
        <p className="text-sm text-gray-500">
          Based on {compliance?.mandatoryCategoryCount || 0} mandatory document categories
        </p>
      </div>

      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Employee Compliance</h3>
        </div>
        <div className="divide-y divide-gray-200">
          {compliance?.data?.length === 0 ? (
            <div className="p-12 text-center text-gray-500">No compliance data available</div>
          ) : (
            compliance?.data?.map((emp) => (
              <ComplianceRow key={emp.employeeId} employee={emp} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function ComplianceRow({ employee }) {
  const complianceColor = employee.compliancePercent >= 80 ? 'green' : employee.compliancePercent >= 50 ? 'yellow' : 'red';

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h4 className="font-semibold text-gray-900">{employee.employeeName}</h4>
          <p className="text-sm text-gray-500">{employee.employeeCode}</p>
        </div>
        <div className="text-right">
          <p className={`text-2xl font-bold ${complianceColor === 'green' ? 'text-green-600' : complianceColor === 'yellow' ? 'text-yellow-600' : 'text-red-600'}`}>
            {employee.compliancePercent}%
          </p>
          <p className="text-sm text-gray-500">{employee.completedCount}/{employee.requiredCount} completed</p>
        </div>
      </div>
      {employee.missingCategories.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-sm text-red-800">Missing: {employee.missingCategories.join(', ')}</p>
        </div>
      )}
    </div>
  );
}

function MetricCard({ icon, label, value, color }) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    yellow: 'bg-yellow-50 text-yellow-600',
    orange: 'bg-orange-50 text-orange-600',
    red: 'bg-red-50 text-red-600',
    purple: 'bg-purple-50 text-purple-600',
    gray: 'bg-gray-50 text-gray-600',
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

function ProgressBar({ label, value, total, color, showPercent = false }) {
  const percent = total > 0 ? Math.round((value / total) * 100) : 0;
  const colorClasses = {
    green: 'bg-green-500',
    yellow: 'bg-yellow-500',
    orange: 'bg-orange-500',
    red: 'bg-red-500',
    gray: 'bg-gray-500',
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm text-gray-600">{label}</span>
        <span className="text-sm text-gray-500">{showPercent ? `${percent}%` : `${value}/${total}`}</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className={`h-2 rounded-full ${colorClasses[color]}`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
