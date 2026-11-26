import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import type { Session, AuthChangeEvent } from '@supabase/supabase-js';
import { AnalyticsCards } from './components/AnalyticsCards';
import type { BranchAnalyticsRow, EmployeeAnalyticsRow } from './components/AnalyticsCards';
import {
  PerformanceEvaluationModal,
  type EvaluatableEmployee,
} from './components/PerformanceEvaluationModal';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface EmployeeRecord extends EmployeeAnalyticsRow {
  pending_leave_requests?: number;
  base_salary?: number;
  bonus_amount?: number;
  training_type?: 'technical' | 'compliance' | 'leadership' | string;
  performance_score?: number;
  evaluation_note?: string;
}

type PerformanceFilter = 'all' | 'high' | 'medium' | 'low';
type SortKey = 'name' | 'kpi_desc' | 'salary_desc';

function getKpiBadge(score: number): { label: string; className: string } {
  if (score >= 90) {
    return { label: `${score} • A`, className: 'bg-emerald-100 text-emerald-800' };
  }
  if (score >= 80) {
    return { label: `${score} • B`, className: 'bg-blue-100 text-blue-800' };
  }
  if (score >= 70) {
    return { label: `${score} • C`, className: 'bg-amber-100 text-amber-800' };
  }
  return { label: `${score} • D`, className: 'bg-rose-100 text-rose-800' };
}

export function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [branches, setBranches] = useState<BranchAnalyticsRow[]>([]);
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [performanceFilter, setPerformanceFilter] = useState<PerformanceFilter>('all');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [editingEmployee, setEditingEmployee] = useState<EvaluatableEmployee | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (mounted) {
        setSession(data.session ?? null);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event: AuthChangeEvent, nextSession: Session | null) => {
        if (mounted) {
          setSession(nextSession);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function loadDashboardData() {
      setLoading(true);
      setErrorMsg(null);

      try {
        const [branchRes, employeeRes] = await Promise.all([
          supabase.from('branches').select('id, code, name').order('code', { ascending: true }),
          supabase.from('employees').select('*').order('full_name', { ascending: true }),
        ]);

        if (!active) return;

        if (branchRes.error) {
          throw new Error(branchRes.error.message);
        }
        if (employeeRes.error) {
          throw new Error(employeeRes.error.message);
        }

        setBranches((branchRes.data ?? []) as BranchAnalyticsRow[]);
        setEmployees((employeeRes.data ?? []) as EmployeeRecord[]);
      } catch (err) {
        if (active) {
          setErrorMsg(err instanceof Error ? err.message : 'Өгөгдөл татахад алдаа гарлаа.');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadDashboardData();

    return () => {
      active = false;
    };
  }, []);

  const filteredEmployees = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    const list = employees.filter((emp) => {
      const matchBranch = selectedBranchId === 'all' || emp.branch_id === selectedBranchId;
      const matchSearch =
        !q ||
        emp.full_name?.toLowerCase().includes(q) ||
        emp.employee_code?.toLowerCase().includes(q) ||
        emp.department?.toLowerCase().includes(q) ||
        emp.position_title?.toLowerCase().includes(q);

      const score = Number(emp.performance_score ?? 0);
      const matchPerformance =
        performanceFilter === 'all' ||
        (performanceFilter === 'high' && score >= 85) ||
        (performanceFilter === 'medium' && score >= 75 && score < 85) ||
        (performanceFilter === 'low' && score < 75);

      return matchBranch && matchSearch && matchPerformance;
    });

    return [...list].sort((a, b) => {
      if (sortKey === 'kpi_desc') {
        return Number(b.performance_score ?? 0) - Number(a.performance_score ?? 0);
      }
      if (sortKey === 'salary_desc') {
        const totalA = Number(a.base_salary ?? 0) + Number(a.bonus_amount ?? 0);
        const totalB = Number(b.base_salary ?? 0) + Number(b.bonus_amount ?? 0);
        return totalB - totalA;
      }
      return (a.full_name ?? '').localeCompare(b.full_name ?? '', 'mn');
    });
  }, [employees, selectedBranchId, searchQuery, performanceFilter, sortKey]);

  const metrics = useMemo(() => {
    const totalEmployees = filteredEmployees.length;
    const activeEmployees = filteredEmployees.filter((e) => e.status === 'active').length;
    const pendingLeavesCount = filteredEmployees.reduce(
      (sum, e) => sum + Number(e.pending_leave_requests ?? 0),
      0
    );
    const totalPayroll = filteredEmployees.reduce(
      (sum, e) => sum + Number(e.base_salary ?? 0) + Number(e.bonus_amount ?? 0),
      0
    );
    const avgKpi =
      totalEmployees > 0
        ? filteredEmployees.reduce((sum, e) => sum + Number(e.performance_score ?? 0), 0) /
          totalEmployees
        : 0;

    return {
      totalEmployees,
      activeEmployees,
      pendingLeavesCount,
      totalPayroll,
      avgKpi,
    };
  }, [filteredEmployees]);

  const handleSaveEvaluation = async (
    employeeId: string,
    updates: {
      performance_score: number;
      bonus_amount: number;
      training_type: string;
      status: string;
      evaluation_note: string;
    }
  ) => {
    setErrorMsg(null);

    const { error } = await supabase
      .from('employees')
      .update({
        performance_score: updates.performance_score,
        bonus_amount: updates.bonus_amount,
        training_type: updates.training_type,
        status: updates.status,
      })
      .eq('id', employeeId);

    if (error) {
      setErrorMsg(`Хадгалахад алдаа гарлаа: ${error.message}`);
      throw error;
    }

    setEmployees((prev) =>
      prev.map((emp) =>
        emp.id === employeeId
          ? {
              ...emp,
              performance_score: updates.performance_score,
              bonus_amount: updates.bonus_amount,
              training_type: updates.training_type,
              status: updates.status,
              evaluation_note: updates.evaluation_note,
            }
          : emp
      )
    );

    setToastMsg('Гүйцэтгэлийн үнэлгээ амжилттай шинэчлэгдлээ.');
    setTimeout(() => setToastMsg(null), 3500);
  };

  const handleExportCsv = () => {
    const headers = [
      'Код',
      'Овог нэр',
      'Албан тушаал',
      'Хэлтэс',
      'Сургалтын төрөл',
      'Үндсэн цалин',
      'Урамшуулал',
      'KPI оноо',
      'Төлөв',
    ];

    const rows = filteredEmployees.map((emp) => [
      emp.employee_code ?? '',
      emp.full_name ?? '',
      emp.position_title ?? '',
      emp.department ?? '',
      emp.training_type ?? '',
      Number(emp.base_salary ?? 0),
      Number(emp.bonus_amount ?? 0),
      Number(emp.performance_score ?? 0),
      emp.status ?? '',
    ]);

    const csvContent =
      '\uFEFF' +
      [headers, ...rows]
        .map((r) =>
          r
            .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
            .join(',')
        )
        .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'egr-hr-performance-report.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="bg-blue-950 text-white border-b border-blue-900 px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold tracking-tight">
              EGR Хүний Нөөцийн Удирдлагын Систем
            </h1>
            <p className="text-xs text-blue-200">
              Салбар ба төв нэгжийн ажилтан, цалин урамшуулал, сургалт ба KPI гүйцэтгэлийн хяналт
            </p>
          </div>
          <div className="text-xs text-blue-100">
            {session?.user?.email ? `Нэвтэрсэн: ${session.user.email}` : 'Хяналтын самбар'}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {errorMsg && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
            {errorMsg}
          </div>
        )}

        {toastMsg && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-800">
            {toastMsg}
          </div>
        )}

        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <div className="text-xs text-slate-500">Нийт ажилтан</div>
            <div className="text-2xl font-bold text-slate-900 mt-1">
              {loading ? '...' : metrics.totalEmployees}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              Идэвхтэй: {loading ? '...' : metrics.activeEmployees}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <div className="text-xs text-slate-500">Дундаж KPI үнэлгээ</div>
            <div className="text-2xl font-bold text-indigo-700 mt-1">
              {loading ? '...' : `${metrics.avgKpi.toFixed(1)} оноо`}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">100 онооны системээр</div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <div className="text-xs text-slate-500">Нийт цалин, урамшууллын сан</div>
            <div className="text-2xl font-bold text-blue-950 mt-1">
              {loading ? '...' : `${Math.round(metrics.totalPayroll).toLocaleString('en-US')} ₮`}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">Үндсэн цалин + бонус</div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <div className="text-xs text-slate-500">Хүлээгдэж буй чөлөө</div>
            <div className="text-2xl font-bold text-amber-700 mt-1">
              {loading ? '...' : metrics.pendingLeavesCount}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">Шийдвэрлэх хүсэлт</div>
          </div>
        </section>

        <section className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
            <h2 className="text-sm font-semibold text-slate-800">
              Салбар ба Төв нэгжийн тархалт
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Нэр, код, албан тушаалаар хайх..."
                className="text-xs border border-slate-300 rounded-md px-3 py-1.5 bg-white text-slate-800 focus:outline-none focus:border-blue-900"
              />
              <button
                onClick={() => setSelectedBranchId('all')}
                className={`text-xs font-medium px-2.5 py-1.5 rounded-md cursor-pointer ${
                  selectedBranchId === 'all'
                    ? 'bg-blue-900 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Бүх байршил
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {branches.map((branch) => {
              const count = employees.filter((emp) => emp.branch_id === branch.id).length;
              const isSelected = selectedBranchId === branch.id;

              return (
                <button
                  key={branch.id}
                  onClick={() => setSelectedBranchId(branch.id)}
                  className={`text-left rounded-lg border p-3 transition cursor-pointer ${
                    isSelected
                      ? 'border-blue-900 bg-blue-50/70'
                      : 'border-slate-200 bg-slate-50/60 hover:bg-slate-100/70'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-blue-900">{branch.code}</span>
                    <span className="text-xs font-bold text-slate-800">{count} хүн</span>
                  </div>
                  <div className="text-xs text-slate-600 mt-1 truncate">{branch.name}</div>
                </button>
              );
            })}
          </div>
        </section>

        <AnalyticsCards employees={filteredEmployees} branches={branches} />

        <section className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm overflow-x-auto">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-800">
                Ажилчдын гүйцэтгэл ба цалингийн жагсаалт ({filteredEmployees.length})
              </h2>
              <p className="text-xs text-slate-500">
                Ажилтныг үнэлж KPI оноо болон урамшууллыг шууд шинэчлэх боломжтой
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              {(
                [
                  { key: 'all', label: 'Бүгд' },
                  { key: 'high', label: 'Өндөр (≥85)' },
                  { key: 'medium', label: 'Дунд (75–84)' },
                  { key: 'low', label: 'Анхаарах (<75)' },
                ] as const
              ).map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setPerformanceFilter(item.key)}
                  className={`px-2.5 py-1.5 rounded-md font-medium cursor-pointer ${
                    performanceFilter === item.key
                      ? 'bg-indigo-700 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {item.label}
                </button>
              ))}

              <select
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as SortKey)}
                className="border border-slate-300 rounded-md px-2.5 py-1.5 bg-white text-slate-800 focus:outline-none focus:border-blue-900"
              >
                <option value="name">Эрэмбэ: Нэрээр</option>
                <option value="kpi_desc">Эрэмбэ: KPI (Ихээс бага)</option>
                <option value="salary_desc">Эрэмбэ: Нийт цалин (Ихээс бага)</option>
              </select>

              <button
                type="button"
                onClick={handleExportCsv}
                className="px-3 py-1.5 rounded-md bg-emerald-700 text-white font-semibold hover:bg-emerald-800 cursor-pointer"
              >
                CSV татах
              </button>
            </div>
          </div>

          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2 pr-3 font-medium">Код</th>
                <th className="py-2 pr-3 font-medium">Овог, нэр</th>
                <th className="py-2 pr-3 font-medium">Албан тушаал</th>
                <th className="py-2 pr-3 font-medium">Сургалтын төрөл</th>
                <th className="py-2 pr-3 font-medium">Үндсэн цалин</th>
                <th className="py-2 pr-3 font-medium">Урамшуулал</th>
                <th className="py-2 pr-3 font-medium">KPI зэрэглэл</th>
                <th className="py-2 pr-3 font-medium">Төлөв</th>
                <th className="py-2 text-right font-medium">Үйлдэл</th>
              </tr>
            </thead>
            <tbody>
              {filteredEmployees.map((emp) => {
                const score = Number(emp.performance_score ?? 0);
                const kpiBadge = getKpiBadge(score);
                const trainingLabel =
                  emp.training_type === 'compliance'
                    ? 'Хууль / Аюулгүй'
                    : emp.training_type === 'leadership'
                    ? 'Удирдлага'
                    : 'Мэргэжлийн';

                return (
                  <tr key={emp.id} className="border-b border-slate-100 hover:bg-slate-50/70">
                    <td className="py-2 pr-3 font-mono text-slate-600">{emp.employee_code}</td>
                    <td className="py-2 pr-3 font-medium text-slate-900">{emp.full_name}</td>
                    <td className="py-2 pr-3 text-slate-700">{emp.position_title}</td>
                    <td className="py-2 pr-3 text-slate-700">{trainingLabel}</td>
                    <td className="py-2 pr-3 font-medium text-slate-800">
                      {Number(emp.base_salary ?? 0).toLocaleString('en-US')} ₮
                    </td>
                    <td className="py-2 pr-3 font-medium text-emerald-700">
                      {Number(emp.bonus_amount ?? 0).toLocaleString('en-US')} ₮
                    </td>
                    <td className="py-2 pr-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full font-semibold ${kpiBadge.className}`}
                      >
                        {kpiBadge.label}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-slate-700">{emp.status}</td>
                    <td className="py-2 text-right">
                      <button
                        type="button"
                        onClick={() => setEditingEmployee(emp)}
                        className="px-2.5 py-1 rounded-md bg-blue-900 text-white font-medium hover:bg-blue-800 cursor-pointer"
                      >
                        Үнэлэх
                      </button>
                    </td>
                  </tr>
                );
              })}
              {!loading && filteredEmployees.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-6 text-center text-slate-500">
                    Тохирох ажилтны мэдээлэл олдсонгүй.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      </main>

      <PerformanceEvaluationModal
        employee={editingEmployee}
        onClose={() => setEditingEmployee(null)}
        onSave={handleSaveEvaluation}
      />
    </div>
  );
}

export default App;