import React, { useEffect, useState } from 'react';

export interface EvaluatableEmployee {
  id: string;
  employee_code: string;
  full_name: string;
  position_title: string;
  department: string;
  status: string;
  base_salary?: number;
  bonus_amount?: number;
  performance_score?: number;
  training_type?: string;
  evaluation_note?: string;
}

interface PerformanceEvaluationModalProps {
  employee: EvaluatableEmployee | null;
  onClose: () => void;
  onSave: (
    employeeId: string,
    updates: {
      performance_score: number;
      bonus_amount: number;
      training_type: string;
      status: string;
      evaluation_note: string;
    }
  ) => Promise<void> | void;
}

function getPerformanceGrade(score: number): { label: string; badgeClass: string } {
  if (score >= 90) {
    return { label: 'A • Онцгой гүйцэтгэл', badgeClass: 'bg-emerald-100 text-emerald-800' };
  }
  if (score >= 80) {
    return { label: 'B • Сайн гүйцэтгэл', badgeClass: 'bg-blue-100 text-blue-800' };
  }
  if (score >= 70) {
    return { label: 'C • Хэвийн түвшин', badgeClass: 'bg-amber-100 text-amber-800' };
  }
  return { label: 'D • Сайжруулах шаардлагатай', badgeClass: 'bg-rose-100 text-rose-800' };
}

export const PerformanceEvaluationModal: React.FC<PerformanceEvaluationModalProps> = ({
  employee,
  onClose,
  onSave,
}) => {
  const [score, setScore] = useState<number>(80);
  const [bonus, setBonus] = useState<number>(0);
  const [trainingType, setTrainingType] = useState<string>('technical');
  const [status, setStatus] = useState<string>('active');
  const [note, setNote] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);

  useEffect(() => {
    if (!employee) return;
    setScore(Number(employee.performance_score ?? 80));
    setBonus(Number(employee.bonus_amount ?? 0));
    setTrainingType(employee.training_type ?? 'technical');
    setStatus(employee.status ?? 'active');
    setNote(employee.evaluation_note ?? '');
  }, [employee]);

  if (!employee) return null;

  const grade = getPerformanceGrade(score);
  const baseSalary = Number(employee.base_salary ?? 0);

  const suggestBonusByScore = (nextScore: number) => {
    setScore(nextScore);
    if (nextScore >= 90) {
      setBonus(Math.round((baseSalary * 0.2) / 10000) * 10000);
    } else if (nextScore >= 80) {
      setBonus(Math.round((baseSalary * 0.1) / 10000) * 10000);
    } else {
      setBonus(0);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave(employee.id, {
        performance_score: Math.min(100, Math.max(0, Number(score))),
        bonus_amount: Math.max(0, Number(bonus)),
        training_type: trainingType,
        status,
        evaluation_note: note.trim(),
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white border border-slate-200 shadow-xl overflow-hidden">
        <div className="bg-blue-950 text-white px-5 py-4 flex items-center justify-between">
          <div>
            <div className="text-xs text-blue-200 font-mono">{employee.employee_code}</div>
            <h3 className="text-base font-bold">{employee.full_name}</h3>
            <p className="text-xs text-blue-100">
              {employee.position_title} • {employee.department}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-blue-200 hover:text-white text-sm px-2 py-1 rounded cursor-pointer"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl p-3">
            <div>
              <div className="text-slate-500">Үндсэн цалин</div>
              <div className="text-sm font-bold text-slate-900">
                {baseSalary.toLocaleString('en-US')} ₮
              </div>
            </div>
            <span className={`px-2.5 py-1 rounded-full font-semibold ${grade.badgeClass}`}>
              {grade.label}
            </span>
          </div>

          <div>
            <div className="flex justify-between mb-1">
              <label className="font-semibold text-slate-700">KPI гүйцэтгэлийн оноо</label>
              <span className="font-bold text-indigo-700">{score} / 100</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={score}
              onChange={(e) => suggestBonusByScore(Number(e.target.value))}
              className="w-full accent-indigo-600 cursor-pointer"
            />
            <div className="flex justify-between text-[11px] text-slate-400 mt-0.5">
              <span>0</span>
              <span>50</span>
              <span>80 (Бонус)</span>
              <span>90+ (Өндөр бонус)</span>
              <span>100</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Урамшуулал (₮)
              </label>
              <input
                type="number"
                min={0}
                step={10000}
                value={bonus}
                onChange={(e) => setBonus(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:outline-none focus:border-blue-900"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Сургалтын чиглэл
              </label>
              <select
                value={trainingType}
                onChange={(e) => setTrainingType(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 bg-white focus:outline-none focus:border-blue-900"
              >
                <option value="technical">Мэргэжлийн</option>
                <option value="compliance">Хууль / Аюулгүй</option>
                <option value="leadership">Удирдлага</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Ажилтны төлөв</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 bg-white focus:outline-none focus:border-blue-900"
            >
              <option value="active">active</option>
              <option value="probation">probation</option>
              <option value="on_leave">on_leave</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Үнэлгээний тайлбар / зөвлөмж
            </label>
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Жишээ: Төлөвлөгөөт зорилтоо хугацаанд нь давуулан биелүүлсэн..."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:outline-none focus:border-blue-900"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              Болих
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-blue-900 text-white font-semibold hover:bg-blue-800 disabled:opacity-60 cursor-pointer"
            >
              {saving ? 'Хадгалж байна...' : 'Үнэлгээ хадгалах'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
