import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import type { Session, AuthChangeEvent } from '@supabase/supabase-js';
import { AnalyticsCards } from './components/AnalyticsCards';
import type { BranchAnalyticsRow, EmployeeAnalyticsRow } from './components/AnalyticsCards';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface EmployeeRecord extends EmployeeAnalyticsRow {
  pending_leave_requests?: number;
  base_salary?: number;
  bonus_amount?: number;
  training_type?: 'technical' | 'compliance' | 'leadership' | string;
  performance_score?: number;
}

export function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [branches, setBranches] = useState<BranchAnalyticsRow[]>([]);
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
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
    return employees.filter((emp) => {
      const matchBranch = selectedBranchId === 'all' || emp.branch_id === selectedBranchId;
      const matchSearch =
        !q ||
        emp.full_name?.toLowerCase().includes(q) ||
        emp.employee_code?.toLowerCase().includes(q) ||
        emp.department?.toLowerCase().includes(q) ||
        emp.position_title?.toLowerCase().includes(q);
      return matchBranch && matchSearch;
    });
  }, [employees, selectedBranchId, searchQuery]);

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
    return {
      totalEmployees,
      activeEmployees,
      pendingLeavesCount,
      totalPayroll,
    };
  }, [filteredEmployees]);

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

        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <div className="text-xs text-slate-500">Нийт ажилтан</div>
            <div className="text-2xl font-bold text-slate-900 mt-1">
              {loading ? '...' : metrics.totalEmployees}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <div className="text-xs text-slate-500">Идэвхтэй ажилтан</div>
            <div className="text-2xl font-bold text-emerald-700 mt-1">
              {loading ? '...' : metrics.activeEmployees}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <div className="text-xs text-slate-500">Нийт цалин, урамшууллын сан</div>
            <div className="text-2xl font-bold text-blue-950 mt-1">
              {loading ? '...' : `${Math.round(metrics.totalPayroll).toLocaleString('en-US')} ₮`}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <div className="text-xs text-slate-500">Хүлээгдэж буй чөлөө</div>
            <div className="text-2xl font-bold text-amber-700 mt-1">
              {loading ? '...' : metrics.pendingLeavesCount}
            </div>
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
                    <span className="text-xs font-semibold text-blue-900">
                      {branch.code}
                    </span>
                    <span className="text-xs font-bold text-slate-800">
                      {count} хүн
                    </span>
                  </div>
                  <div className="text-xs text-slate-600 mt-1 truncate">
                    {branch.name}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <AnalyticsCards employees={filteredEmployees} branches={branches} />

        <section className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm overflow-x-auto">
          <h2 className="text-sm font-semibold text-slate-800 mb-3">
            Ажилчдын жагсаалт ({filteredEmployees.length})
          </h2>
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2 pr-3 font-medium">Код</th>
                <th className="py-2 pr-3 font-medium">Овог, нэр</th>
                <th className="py-2 pr-3 font-medium">Албан тушаал</th>
                <th className="py-2 pr-3 font-medium">Сургалтын төрөл</th>
                <th className="py-2 pr-3 font-medium">Үндсэн цалин</th>
                <th className="py-2 pr-3 font-medium">Урамшуулал</th>
                <th className="py-2 pr-3 font-medium">KPI оноо</th>
                <th className="py-2 pr-3 font-medium">Төлөв</th>
              </tr>
            </thead>
            <tbody>
              {filteredEmployees.map((emp) => {
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
                    <td className="py-2 pr-3 font-semibold text-indigo-700">
                      {Number(emp.performance_score ?? 0).toFixed(0)}
                    </td>
                    <td className="py-2 pr-3 text-slate-700">{emp.status}</td>
                  </tr>
                );
              })}
              {!loading && filteredEmployees.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-slate-500">
                    Тохирох ажилтны мэдээлэл олдсонгүй.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      </main>
    </div>
  );
}

export default App;