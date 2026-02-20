// src/components/PmoForm/StepIcon.jsx
// Refatorado — Zero MUI. Usa Tailwind + lucide-react.

import React from 'react';
import { Check, Pencil } from 'lucide-react';

function StepIconMUI(props) {
  const { active, completed, className, icon } = props;

  let bgClass = 'bg-gray-300 text-white';
  let shadowClass = '';

  if (completed) {
    bgClass = 'bg-green-600 text-white';
  } else if (active) {
    bgClass = 'bg-blue-600 text-white';
    shadowClass = 'shadow-md shadow-blue-300/50';
  }

  return (
    <div
      className={`flex items-center justify-center w-7 h-7 rounded-full text-sm font-medium transition-all ${bgClass} ${shadowClass} ${className || ''}`}
    >
      {completed ? (
        <Check size={16} strokeWidth={3} />
      ) : active ? (
        <Pencil size={14} />
      ) : (
        <span className="text-xs">{icon}</span>
      )}
    </div>
  );
}

export default StepIconMUI;