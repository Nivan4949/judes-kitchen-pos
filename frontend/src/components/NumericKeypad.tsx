import React from 'react';
import { Delete } from 'lucide-react';

interface NumericKeypadProps {
  onInput: (val: string) => void;
  onClear: () => void;
  onDelete: () => void;
  onConfirm: () => void;
}

const NumericKeypad: React.FC<NumericKeypadProps> = ({ onInput, onClear, onDelete, onConfirm }) => {
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0'];

  return (
    <div className="grid grid-cols-3 gap-2 bg-slate-800 p-4 rounded-2xl shadow-inner">
      {keys.map((key) => (
        <button
          key={key}
          onClick={() => onInput(key)}
          className="h-16 bg-slate-700 hover:bg-slate-600 text-white text-2xl font-bold rounded-xl shadow-sm active:scale-95 transition-all"
        >
          {key}
        </button>
      ))}
      <button
        onClick={onDelete}
        className="h-16 bg-orange-600 hover:bg-orange-500 text-white text-2xl font-bold rounded-xl shadow-sm active:scale-95 transition-all flex items-center justify-center"
      >
        <Delete size={28} />
      </button>
      <button
        onClick={onClear}
        className="col-span-1 h-16 bg-red-600 hover:bg-red-500 text-white text-xl font-bold rounded-xl shadow-sm active:scale-95 transition-all"
      >
        CLR
      </button>
      <button
        onClick={onConfirm}
        className="col-span-2 h-16 bg-green-600 hover:bg-green-500 text-white text-xl font-black rounded-xl shadow-sm active:scale-95 transition-all uppercase tracking-widest flex items-center justify-center"
      >
        ENTER
      </button>
    </div>
  );
};

export default NumericKeypad;
