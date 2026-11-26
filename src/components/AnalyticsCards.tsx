import React from 'react';

export interface EmployeeAnalyticsRow {
  id: string;
  employee_code: string;
  full_name: string;
  position_title: string;
  department: string;
  branch_id: string;
  status: string;
  training_completed_count?: number;
  training_hours?: number;
  training_status?: 'completed' | 'in_progress' | 'not_started' | string;
  total_worked_hours?: number;
  total_leave_hours?: number;
  vacation_days_allocated?: number;
  vacation_days_used?: number;
  vacation_days_remaining?: number;
}

export interface BranchAnalyticsRow {
  id: string;
  code: string;
  name: string;
}

interface AnalyticsCardsProps {
  employees: EmployeeAnalyticsRow[];
  branches: BranchAnalyticsRow[];
}

export const AnalyticsCards: React.FC<AnalyticsCardsProps> = ({ employees, branches }) => {
  const totalTrainingHours = employees.reduce((acc, e) => acc + Number(e.training_hours ?? 0), 0);
  const completedTrainingCount = employees.filter((e) => e.training_status === 'completed').length;
  const inProgressTrainingCount = employees.filter((e) => e.training_status === 'in_progress').length;
  const notStartedTrainingCount = employees.filter((e) => e.training_status === 'not_started').length;

  const totalWorkedHours = employees.reduce((acc, e) => acc + Number(e.total_worked_hours ?? 0), 0);
  const totalLeaveHours = employees.reduce((acc, e) => acc + Number(e.total_leave_hours ?? 0), 0);

  const totalVacationAllocated = employees.reduce((acc, e) => acc + Number(e.vacation_days_allocated ?? 15), 0);
  const totalVacationUsed = employees.reduce((acc, e) => acc + Number(e.vacation_days_used ?? 0), 0);
  const totalVacationRemaining = employees.reduce((acc, e) => acc + Number(e.vacation_days_remaining ?? 0), 0);

  const branchMetrics = branches.map((b) => {
    const bEmps = employees.filter((e) => e.branch_id === b.id);
    return {
      id: b.id,
      code: b.code,
      name: b.name,
      workedHours: bEmps.reduce((sum, e) => sum + Number(e.total_worked_hours ?? 0), 0),
      leaveHours: bEmps.reduce((sum, e) => sum + Number(e.total_leave_hours ?? 0), 0),
      trainingHours: bEmps.reduce((sum, e) => sum + Number(e.training_hours ?? 0), 0),
      vacationUsed: bEmps.reduce((sum, e) => sum + Number(e.vacation_days_used ?? 0), 0),
    };
  });

  const maxWorked = Math.max(...branchMetrics.map((m) => m.workedHours), 1);
  const maxLeave = Math.max(...branchMetrics.map((m) => m.leaveHours), 1);
  const maxTraining = Math.max(...branchMetrics.map((m) => m.trainingHours), 1);
  const maxVacation = Math.max(...branchMetrics.map((m) => m.vacationUsed), 1);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-6">
      {/* 1. Сургалтад хамрагдсан байдал */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">Сургалтад хамрагдсан байдал</h3>
            <p className="text-xs text-slate-500">Нийт {totalTrainingHours.toFixed(1)} сургалтын цаг</p>
          </div>
          <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-blue-50 text-blue-700">
            Дууссан: {completedTrainingCount}/{employees.length}
          </span>
        </div>

        <div className="space-y-2.5 text-xs mb-4">
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-slate-600">Бүрэн хамрагдсан</span>
              <span className="font-semibold text-emerald-700">{completedTrainingCount}</span>
            </div>
            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
              <div
                className="bg-emerald-500 h-2 rounded-full"
                style={{ width: `${(completedTrainingCount / Math.max(employees.length, 1)) * 100}%` }}
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between mb-1">
              <span className="text-slate-600">Хамрагдаж буй</span>
              <span className="font-semibold text-blue-700">{inProgressTrainingCount}</span>
            </div>
            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
              <div
                className="bg-blue-500 h-2 rounded-full"
                style={{ width: `${(inProgressTrainingCount / Math.max(employees.length, 1)) * 100}%` }}
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between mb-1">
              <span className="text-slate-600">Эхлээгүй</span>
              <span className="font-semibold text-amber-700">{notStartedTrainingCount}</span>
            </div>
            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
              <div
                className="bg-amber-400 h-2 rounded-full"
                style={{ width: `${(notStartedTrainingCount / Math.max(employees.length, 1)) * 100}%` }}
              />
            </div>
          </div>
        </div>

        <div className="space-y-1.5 pt-2 border-t border-slate-100">
          {branchMetrics.map((m) => (
            <div key={m.id} className="flex items-center gap-2 text-xs">
              <span className="w-14 font-medium text-slate-600">{m.code}</span>
              <div className="flex-1 bg-slate-100 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-indigo-500 h-2 rounded-full"
                  style={{ width: `${(m.trainingHours / maxTraining) * 100}%` }}
                />
              </div>
              <span className="w-16 text-right font-semibold text-slate-700">{m.trainingHours.toFixed(0)}ц</span>
            </div>
          ))}
        </div>
      </div>

      {/* 2. Нийт ажилласан цаг */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">Нийт ажилласан цаг</h3>
            <p className="text-xs text-slate-500">5 байршлын нэгдсэн цагийн дүн</p>
          </div>
          <span className="text-sm font-bold text-slate-900">
            {totalWorkedHours.toLocaleString('en-US', { maximumFractionDigits: 1 })} цаг
          </span>
        </div>

        <div className="space-y-2.5 mt-4">
          {branchMetrics.map((m) => (
            <div key={m.id} className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="font-medium text-slate-700">{m.name}</span>
                <span className="font-semibold text-slate-800">
                  {m.workedHours.toLocaleString('en-US', { maximumFractionDigits: 1 })} цаг
                </span>
              </div>
              <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                <div
                  className="bg-blue-600 h-2.5 rounded-full"
                  style={{ width: `${(m.workedHours / maxWorked) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 3. Нийт чөлөө авсан цаг */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">Нийт чөлөө авсан цаг</h3>
            <p className="text-xs text-slate-500">Салбар хоорондын чөлөөний цагийн харьцуулалт</p>
          </div>
          <span className="text-sm font-bold text-amber-700">
            {totalLeaveHours.toLocaleString('en-US', { maximumFractionDigits: 1 })} цаг
          </span>
        </div>

        <div className="space-y-2.5 mt-4">
          {branchMetrics.map((m) => (
            <div key={m.id} className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="font-medium text-slate-700">{m.name}</span>
                <span className="font-semibold text-amber-700">{m.leaveHours.toFixed(1)} цаг</span>
              </div>
              <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                <div
                  className="bg-amber-500 h-2.5 rounded-full"
                  style={{ width: `${(m.leaveHours / maxLeave) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 4. Ээлжит амралтын ашиглалт ба үлдэгдэл */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">Амралтын хоногийн шинжилгээ</h3>
            <p className="text-xs text-slate-500">
              Нийт эрх: {totalVacationAllocated} хоног • Үлдэгдэл: {totalVacationRemaining} хоног
            </p>
          </div>
          <span className="text-sm font-bold text-emerald-700">Ашигласан: {totalVacationUsed} хоног</span>
        </div>

        <div className="space-y-2.5 mt-4">
          {branchMetrics.map((m) => (
            <div key={m.id} className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="font-medium text-slate-700">{m.name}</span>
                <span className="font-semibold text-emerald-700">{m.vacationUsed} хоног</span>
              </div>
              <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-500 h-2.5 rounded-full"
                  style={{ width: `${(m.vacationUsed / maxVacation) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};