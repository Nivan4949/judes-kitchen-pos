import React, { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, X, ChevronLeft, ChevronRight, Check } from 'lucide-react';

interface CustomDateRangeModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialStartDate?: string;
  initialEndDate?: string;
  onApply: (startDate: string, endDate: string) => void;
}

const formatDateStr = (d: Date): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseDateStr = (str: string): Date => {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
};

const getDaysInMonth = (year: number, month: number) => {
  return new Date(year, month + 1, 0).getDate();
};

const getFirstDayOfMonth = (year: number, month: number) => {
  return new Date(year, month, 1).getDay();
};

const CustomDateRangeModal: React.FC<CustomDateRangeModalProps> = ({
  isOpen,
  onClose,
  initialStartDate,
  initialEndDate,
  onApply
}) => {
  const todayStr = formatDateStr(new Date());
  
  const [startDate, setStartDate] = useState<string>(initialStartDate || todayStr);
  const [endDate, setEndDate] = useState<string>(initialEndDate || initialStartDate || todayStr);
  const [hoverDate, setHoverDate] = useState<string | null>(null);
  const [step, setStep] = useState<1 | 2>(1);

  // Calendar month view date
  const [viewDate, setViewDate] = useState<Date>(() => {
    if (initialStartDate) {
      return parseDateStr(initialStartDate);
    }
    return new Date();
  });

  useEffect(() => {
    if (isOpen) {
      const start = initialStartDate || todayStr;
      const end = initialEndDate || initialStartDate || todayStr;
      setStartDate(start);
      setEndDate(end);
      setStep(1);
      setHoverDate(null);
      if (initialStartDate) {
        setViewDate(parseDateStr(initialStartDate));
      } else {
        setViewDate(new Date());
      }
    }
  }, [isOpen, initialStartDate, initialEndDate, todayStr]);

  if (!isOpen) return null;

  const currentYear = viewDate.getFullYear();
  const currentMonth = viewDate.getMonth();

  const handlePrevMonth = () => {
    setViewDate(new Date(currentYear, currentMonth - 1, 1));
  };

  const handleNextMonth = () => {
    setViewDate(new Date(currentYear, currentMonth + 1, 1));
  };

  const handleDateClick = (dateStr: string) => {
    if (step === 1 || (startDate && endDate)) {
      // First click: select start date
      setStartDate(dateStr);
      setEndDate('');
      setStep(2);
    } else {
      // Second click: select end date
      if (dateStr < startDate) {
        // If clicked date is before start date, treat as new start date
        setStartDate(dateStr);
        setEndDate('');
        setStep(2);
      } else {
        setEndDate(dateStr);
        setStep(1);
      }
    }
  };

  const handleDateDoubleClick = (dateStr: string) => {
    setStartDate(dateStr);
    setEndDate(dateStr);
    setStep(1);
  };

  // Preset shortcuts
  const applyShortcut = (shortcut: 'today' | 'yesterday' | 'thisWeek' | 'thisMonth' | 'lastMonth') => {
    const now = new Date();
    let start = '';
    let end = '';

    if (shortcut === 'today') {
      start = formatDateStr(now);
      end = formatDateStr(now);
    } else if (shortcut === 'yesterday') {
      const y = new Date();
      y.setDate(y.getDate() - 1);
      start = formatDateStr(y);
      end = formatDateStr(y);
    } else if (shortcut === 'thisWeek') {
      const dayOfWeek = now.getDay(); // 0 is Sun
      const sun = new Date(now);
      sun.setDate(now.getDate() - dayOfWeek);
      start = formatDateStr(sun);
      end = formatDateStr(now);
    } else if (shortcut === 'thisMonth') {
      const startM = new Date(now.getFullYear(), now.getMonth(), 1);
      const endM = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      start = formatDateStr(startM);
      end = formatDateStr(endM);
    } else if (shortcut === 'lastMonth') {
      const startLM = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const endLM = new Date(now.getFullYear(), now.getMonth(), 0);
      start = formatDateStr(startLM);
      end = formatDateStr(endLM);
    }

    setStartDate(start);
    setEndDate(end);
    setStep(1);
    if (start) {
      setViewDate(parseDateStr(start));
    }
  };

  const handleApply = () => {
    const finalStart = startDate || todayStr;
    const finalEnd = endDate || startDate || todayStr;
    onApply(finalStart, finalEnd);
    onClose();
  };

  // Calendar matrix calculation
  const totalDays = getDaysInMonth(currentYear, currentMonth);
  const firstDayIndex = getFirstDayOfMonth(currentYear, currentMonth);

  const daysOfWeek = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

  const monthName = viewDate.toLocaleString('default', { month: 'long' });

  // Calculate day difference
  let dayDiffText = '';
  if (startDate && endDate) {
    if (startDate === endDate) {
      dayDiffText = '(Single Day)';
    } else {
      const diffMs = Math.abs(parseDateStr(endDate).getTime() - parseDateStr(startDate).getTime());
      const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1;
      dayDiffText = `(${diffDays} Days)`;
    }
  } else if (startDate) {
    dayDiffText = '(Select End Date)';
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-[2rem] shadow-2xl w-full max-w-xl overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <CalendarIcon className="w-5 h-5 text-emerald-600" />
            <h2 className="text-lg font-bold text-slate-800 tracking-tight">Select Custom Dates</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all"
          >
            <X size={18} />
          </button>
        </div>

        {/* Inner Content */}
        <div className="p-6 space-y-5">
          {/* Yellow / Amber Helper Banner */}
          <div className="bg-amber-50/90 border border-amber-200/80 rounded-2xl px-4 py-3 text-xs font-semibold text-amber-900 shadow-sm flex items-center gap-2">
            <span>👉</span>
            <span>
              {step === 1 || !startDate
                ? 'Step 1: Click START date (or double-click one date for single day)'
                : !endDate
                ? 'Step 2: Click END date (or double-click to select single day)'
                : 'Range selected! Click Apply Range to update reports.'}
            </span>
          </div>

          {/* Body grid: Left Shortcuts, Right Calendar */}
          <div className="grid grid-cols-1 md:grid-cols-[140px_1fr] gap-6 items-start">
            {/* Left Shortcuts */}
            <div className="space-y-1 border-r border-slate-100 pr-4">
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-3 px-2">
                SHORTCUTS
              </p>
              <button
                onClick={() => applyShortcut('today')}
                className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-700 hover:text-emerald-700 hover:bg-emerald-50 rounded-xl transition-all"
              >
                Today
              </button>
              <button
                onClick={() => applyShortcut('yesterday')}
                className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-700 hover:text-emerald-700 hover:bg-emerald-50 rounded-xl transition-all"
              >
                Yesterday
              </button>
              <button
                onClick={() => applyShortcut('thisWeek')}
                className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-700 hover:text-emerald-700 hover:bg-emerald-50 rounded-xl transition-all"
              >
                This Week
              </button>
              <button
                onClick={() => applyShortcut('thisMonth')}
                className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-700 hover:text-emerald-700 hover:bg-emerald-50 rounded-xl transition-all"
              >
                This Month
              </button>
              <button
                onClick={() => applyShortcut('lastMonth')}
                className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-700 hover:text-emerald-700 hover:bg-emerald-50 rounded-xl transition-all"
              >
                Last Month
              </button>
            </div>

            {/* Right Calendar Container */}
            <div>
              {/* Month Navigation */}
              <div className="flex items-center justify-between mb-4 px-2">
                <button
                  onClick={handlePrevMonth}
                  className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-all"
                  title="Previous Month"
                >
                  <ChevronLeft size={18} />
                </button>
                <span className="font-bold text-sm text-slate-800">
                  {monthName} {currentYear}
                </span>
                <button
                  onClick={handleNextMonth}
                  className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-all"
                  title="Next Month"
                >
                  <ChevronRight size={18} />
                </button>
              </div>

              {/* Days of Week Header */}
              <div className="grid grid-cols-7 text-center mb-2">
                {daysOfWeek.map((day) => (
                  <span key={day} className="text-[10px] font-black text-slate-400 uppercase">
                    {day}
                  </span>
                ))}
              </div>

              {/* Days Grid */}
              <div className="grid grid-cols-7 gap-y-1 text-center font-bold text-xs">
                {/* Empty leading cells */}
                {Array.from({ length: firstDayIndex }).map((_, i) => (
                  <div key={`empty-${i}`} className="h-9" />
                ))}

                {/* Days of current month */}
                {Array.from({ length: totalDays }).map((_, i) => {
                  const dayNum = i + 1;
                  const monthStr = String(currentMonth + 1).padStart(2, '0');
                  const dayStr = String(dayNum).padStart(2, '0');
                  const dateStr = `${currentYear}-${monthStr}-${dayStr}`;

                  const isStart = startDate === dateStr;
                  const isEnd = endDate === dateStr;
                  const isSelected = isStart || isEnd;

                  let isInRange = false;
                  if (startDate && endDate) {
                    isInRange = dateStr > startDate && dateStr < endDate;
                  } else if (startDate && step === 2 && hoverDate && hoverDate >= startDate) {
                    isInRange = dateStr > startDate && dateStr <= hoverDate;
                  }

                  return (
                    <div
                      key={dateStr}
                      className="relative h-9 flex items-center justify-center"
                      onMouseEnter={() => step === 2 && setHoverDate(dateStr)}
                    >
                      {/* Range connector background */}
                      {isInRange && (
                        <div className="absolute inset-x-0 h-8 bg-emerald-50 text-emerald-900" />
                      )}

                      <button
                        onClick={() => handleDateClick(dateStr)}
                        onDoubleClick={() => handleDateDoubleClick(dateStr)}
                        className={`relative z-10 w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs transition-all ${
                          isSelected
                            ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30 scale-105'
                            : isInRange
                            ? 'text-emerald-900 font-extrabold'
                            : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                        }`}
                      >
                        {dayNum}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-50/80 border-t border-slate-100">
          {/* Selected Date Summary Pill */}
          <div className="bg-emerald-50/80 border border-emerald-200/80 rounded-xl px-3 py-1.5 text-xs font-bold text-emerald-800 flex items-center gap-1.5">
            <span>{startDate || 'Select Date'}</span>
            {endDate && endDate !== startDate && <span>to {endDate}</span>}
            {dayDiffText && <span className="text-emerald-600 font-medium">{dayDiffText}</span>}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl font-bold text-xs transition-all shadow-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              disabled={!startDate}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs transition-all shadow-md shadow-emerald-600/20 flex items-center gap-1.5 disabled:opacity-50"
            >
              <Check size={14} />
              Apply Range
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomDateRangeModal;
