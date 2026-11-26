import { useEffect, useMemo, useState, type FormEvent } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import type { Branch, Employee, LeaveRequest, AuditLog, Profile } from './types/hr';
import { AnalyticsCards } from './components/AnalyticsCards';

const ROLE_LABELS: Record<string, string> = {
  admin: "Системийн админ",
  hr_manager: "Хүний нөөцийн менежер",
  branch_lead: "Салбарын ахлах",
  employee: "Ажилтан",
};

const STATUS_LABELS: Record<string, string> = {
  active: "Идэвхтэй",
  on_leave: "Чөлөөтэй",
  probation: "Туршилтын хугацаа",
  terminated: "Ажлаас чөлөөлөгдсөн",
};

const LEAVE_STATUS_LABELS: Record<string, string> = {
  pending: "Хүлээгдэж буй",
  approved: "Зөвшөөрөгдсөн",
  rejected: "Татгалзсан",
  cancelled: "Цуцлагдсан",
};

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [submittingAuth, setSubmittingAuth] = useState(false);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  const [selectedBranchId, setSelectedBranchId] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"employees" | "leaves" | "audit">(
    "employees"
  );
  const [dataLoading, setDataLoading] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event: AuthChangeEvent, nextSession: Session | null) => {
        setSession(nextSession);
      }
    );

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session?.user) {
      setProfile(null);
      setBranches([]);
      setEmployees([]);
      setLeaves([]);
      setAuditLogs([]);
      return;
    }

    let cancelled = false;

    async function loadWorkspace() {
      setDataLoading(true);
      setDataError(null);

      try {
        const userId = session!.user.id;

        const [
          profileRes,
          branchesRes,
          employeesRes,
          leavesRes,
          auditRes,
        ] = await Promise.all([
          supabase.from("profiles").select("*").eq("id", userId).single(),
          supabase
            .from("branches")
            .select("*")
            .order("is_hq", { ascending: false })
            .order("name"),
          supabase.from("employees").select("*").order("employee_code"),
          supabase
            .from("leave_requests")
            .select("*")
            .order("created_at", { ascending: false }),
          supabase
            .from("audit_logs")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(30),
        ]);

        if (cancelled) return;

        if (profileRes.error) {
          throw new Error(
            `Профайл уншихад алдаа гарлаа: ${profileRes.error.message}`
          );
        }
        setProfile(profileRes.data as Profile);

        if (!branchesRes.error && branchesRes.data) {
          setBranches(branchesRes.data as Branch[]);
        }
        if (!employeesRes.error && employeesRes.data) {
          setEmployees(employeesRes.data as Employee[]);
        }
        if (!leavesRes.error && leavesRes.data) {
          setLeaves(leavesRes.data as LeaveRequest[]);
        }
        if (!auditRes.error && auditRes.data) {
          setAuditLogs(auditRes.data as AuditLog[]);
        }
      } catch (err) {
        if (!cancelled) {
          setDataError(
            err instanceof Error ? err.message : "Өгөгдөл татахад алдаа гарлаа."
          );
        }
      } finally {
        if (!cancelled) {
          setDataLoading(false);
        }
      }
    }

    loadWorkspace();

    return () => {
      cancelled = true;
    };
  }, [session]);

  async function handleSignIn(e: FormEvent) {
    e.preventDefault();
    setAuthError(null);
    setSubmittingAuth(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    setSubmittingAuth(false);
    if (error) {
      setAuthError("Нэвтрэх имэйл эсвэл нууц үг буруу байна.");
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
  }

  const branchMap = useMemo(() => {
    const map = new Map<string, Branch>();
    for (const b of branches) map.set(b.id, b);
    return map;
  }, [branches]);

  const employeeMap = useMemo(() => {
    const map = new Map<string, Employee>();
    for (const emp of employees) map.set(emp.id, emp);
    return map;
  }, [employees]);

  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      const matchesBranch =
        selectedBranchId === "all" || emp.branch_id === selectedBranchId;
      const q = searchQuery.trim().toLowerCase();
      const matchesQuery =
        !q ||
        emp.full_name.toLowerCase().includes(q) ||
        emp.employee_code.toLowerCase().includes(q) ||
        emp.position_title.toLowerCase().includes(q) ||
        emp.department.toLowerCase().includes(q);
      return matchesBranch && matchesQuery;
    });
  }, [employees, selectedBranchId, searchQuery]);

  const metrics = useMemo(() => {
    const totalHeadcount = employees.length;
    const activeCount = employees.filter((e) => e.status === "active").length;
    const onLeaveCount = employees.filter((e) => e.status === "on_leave").length;
    const pendingLeavesCount = leaves.filter(
      (l) => l.status === "pending"
    ).length;
    const targetTotal =
      branches.reduce((sum, b) => sum + (b.target_headcount || 0), 0) || 80;

    return {
      totalHeadcount,
      activeCount,
      onLeaveCount,
      pendingLeavesCount,
      targetTotal,
    };
  }, [employees, leaves, branches]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-600">
        Системийн төлвийг шалгаж байна...
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          <div className="mb-6">
            <span className="inline-block text-xs font-semibold uppercase tracking-wider text-blue-900 bg-blue-50 px-3 py-1 rounded-full">
              EGR Хүний Нөөц
            </span>
            <h1 className="text-2xl font-bold text-slate-900 mt-3">
              Ажилтны Нэгдсэн Бүртгэл
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Төв болон 4 салбарын нэгдсэн системд байгууллагын бүртгэлээр нэвтэрнэ үү.
            </p>
          </div>

          <form onSubmit={handleSignIn} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Байгууллагын имэйл
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.mn"
                className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-900"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Нууц үг
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-900"
              />
            </div>

            {authError && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-3.5 py-2.5 text-sm text-red-700">
                {authError}
              </div>
            )}

            <button
              type="submit"
              disabled={submittingAuth}
              className="w-full rounded-lg bg-blue-900 hover:bg-blue-800 disabled:opacity-60 text-white font-medium py-2.5 text-sm transition cursor-pointer"
            >
              {submittingAuth ? "Нэвтэрч байна..." : "Системд нэвтрэх"}
            </button>
          </form>

          <footer className="mt-6 pt-4 border-t border-slate-100 text-xs text-slate-500 text-center">
            боловсруулсан Б.Бямбадорж
          </footer>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-900 text-white font-bold flex items-center justify-center text-sm">
              EGR
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900 leading-tight">
                Ажилтны Нэгдсэн Бүртгэл (EGR)
              </h1>
              <p className="text-xs text-slate-500">
                5 байршил • Зорилтот орон тоо: {metrics.targetTotal}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <div className="text-sm font-medium text-slate-800">
                {profile?.full_name ?? session.user.email}
              </div>
              <div className="text-xs text-slate-500">
                {profile
                  ? ROLE_LABELS[profile.role] ?? profile.role
                  : "Хэрэглэгч"}
              </div>
            </div>
            <button
              onClick={handleSignOut}
              className="rounded-lg border border-slate-300 hover:bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 transition cursor-pointer"
            >
              Гарах
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {dataError && (
          <div className="rounded-xl bg-amber-50 border border-amber-300 p-4 text-sm text-amber-900">
            {dataError}
          </div>
        )}

        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="text-xs font-medium text-slate-500">
              Нийт бүртгэлтэй
            </div>
            <div className="text-2xl font-bold text-slate-900 mt-1">
              {metrics.totalHeadcount}{" "}
              <span className="text-sm font-normal text-slate-400">
                / {metrics.targetTotal}
              </span>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="text-xs font-medium text-slate-500">
              Идэвхтэй ажиллаж буй
            </div>
            <div className="text-2xl font-bold text-emerald-700 mt-1">
              {metrics.activeCount}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="text-xs font-medium text-slate-500">
              Чөлөөтэй байгаа
            </div>
            <div className="text-2xl font-bold text-blue-900 mt-1">
              {metrics.onLeaveCount}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="text-xs font-medium text-slate-500">
              Хүлээгдэж буй чөлөө
            </div>
            <div className="text-2xl font-bold text-amber-700 mt-1">
              {metrics.pendingLeavesCount}
            </div>
          </div>
        </section>

        <section className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-800">
              Салбар ба Төв нэгжийн тархалт
            </h2>
            <button
              onClick={() => setSelectedBranchId("all")}
              className={`text-xs font-medium px-2.5 py-1 rounded-md cursor-pointer ${
                selectedBranchId === "all"
                  ? "bg-blue-900 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              Бүх байршил ({employees.length})
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {branches.map((branch) => {
              const count = employees.filter(
                (e) => e.branch_id === branch.id
              ).length;
              const isSelected = selectedBranchId === branch.id;
              return (
                <button
                  key={branch.id}
                  onClick={() => setSelectedBranchId(branch.id)}
                  className={`text-left rounded-xl border p-3.5 transition cursor-pointer ${
                    isSelected
                      ? "border-blue-900 bg-blue-50/60"
                      : "border-slate-200 hover:border-slate-300 bg-white"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-blue-900">
                      {branch.code}
                    </span>
                    {branch.is_hq && (
                      <span className="text-[10px] font-semibold bg-slate-900 text-white px-2 py-0.5 rounded-full">
                        ТӨВ
                      </span>
                    )}
                  </div>
                  <div className="text-sm font-semibold text-slate-900 mt-1 truncate">
                    {branch.name}
                  </div>
                  <div className="text-xs text-slate-500 mt-2">
                    Орон тоо:{" "}
                    <strong className="text-slate-800">{count}</strong> /{" "}
                    {branch.target_headcount}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveTab("employees")}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium cursor-pointer ${
                  activeTab === "employees"
                    ? "bg-blue-900 text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                Ажилтнууд ({filteredEmployees.length})
              </button>
              <button
                onClick={() => setActiveTab("leaves")}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium cursor-pointer ${
                  activeTab === "leaves"
                    ? "bg-blue-900 text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                Чөлөөний хүсэлт ({leaves.length})
              </button>
              <button
                onClick={() => setActiveTab("audit")}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium cursor-pointer ${
                  activeTab === "audit"
                    ? "bg-blue-900 text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                Аудитын бүртгэл
              </button>
            </div>

            {activeTab === "employees" && (
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Нэр, код, албан тушаалаар хайх..."
                className="w-full sm:w-72 rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-900"
              />
            )}
          </div>

          {dataLoading ? (
            <div className="p-8 text-center text-sm text-slate-500">
              Өгөгдөл ачааллаж байна...
            </div>
          ) : activeTab === "employees" ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 text-xs uppercase">
                  <tr>
                    <th className="py-3 px-4">Код</th>
                    <th className="py-3 px-4">Овог, нэр</th>
                    <th className="py-3 px-4">Албан тушаал</th>
                    <th className="py-3 px-4">Байршил</th>
                    <th className="py-3 px-4">Төлөв</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredEmployees.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="py-8 text-center text-slate-500"
                      >
                        Бүртгэлтэй ажилтан олдсонгүй.
                      </td>
                    </tr>
                  ) : (
                    filteredEmployees.map((emp) => (
                      <tr key={emp.id} className="hover:bg-slate-50/70">
                        <td className="py-3 px-4 font-mono text-xs text-slate-600">
                          {emp.employee_code}
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-900">
                          {emp.full_name}
                        </td>
                        <td className="py-3 px-4 text-slate-700">
                          {emp.position_title}
                        </td>
                        <td className="py-3 px-4 text-slate-700">
                          {branchMap.get(emp.branch_id)?.name ?? "—"}
                        </td>
                        <td className="py-3 px-4">
                          <span className="inline-block text-xs font-medium px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-800">
                            {STATUS_LABELS[emp.status] ?? emp.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          ) : activeTab === "leaves" ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 text-xs uppercase">
                  <tr>
                    <th className="py-3 px-4">Ажилтан</th>
                    <th className="py-3 px-4">Хугацаа</th>
                    <th className="py-3 px-4">Хоног</th>
                    <th className="py-3 px-4">Төлөв</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {leaves.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="py-8 text-center text-slate-500"
                      >
                        Чөлөөний хүсэлт алга байна.
                      </td>
                    </tr>
                  ) : (
                    leaves.map((lv) => (
                      <tr key={lv.id}>
                        <td className="py-3 px-4 font-medium text-slate-900">
                          {employeeMap.get(lv.employee_id)?.full_name ??
                            lv.employee_id}
                        </td>
                        <td className="py-3 px-4 text-slate-700">
                          {lv.start_date} – {lv.end_date}
                        </td>
                        <td className="py-3 px-4 text-slate-700">
                          {lv.total_days}
                        </td>
                        <td className="py-3 px-4">
                          <span className="inline-block text-xs font-medium px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-800">
                            {LEAVE_STATUS_LABELS[lv.status] ?? lv.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {auditLogs.length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-500">
                  Аудитын бүртгэл хоосон байна.
                </div>
              ) : (
                auditLogs.map((log) => (
                  <div
                    key={log.id}
                    className="px-4 py-3 flex items-center justify-between text-sm"
                  >
                    <div>
                      <span className="font-semibold text-slate-900">
                        {log.action}
                      </span>{" "}
                      <span className="text-slate-500">
                        ({log.entity_table})
                      </span>
                    </div>
                    <span className="text-xs text-slate-400">
                      {new Date(log.created_at).toLocaleString("mn-MN")}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}