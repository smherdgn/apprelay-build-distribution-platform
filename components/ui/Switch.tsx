import React from 'react';

interface SwitchProps {
  id?: string;
  label: string;
  srLabel?: string; // Screen reader label for more context
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  wrapperClassName?: string;
}

const Switch: React.FC<SwitchProps> = ({
  id,
  label,
  srLabel,
  checked,
  onChange,
  disabled = false,
  wrapperClassName = "",
}) => {
  const uniqueId = id || React.useId();

  return (
    <div className={`flex items-center ${wrapperClassName}`}>
      <button
        type="button"
        id={uniqueId}
        role="switch"
        aria-checked={checked}
        aria-label={srLabel || label}
        onClick={() => !disabled && onChange(!checked)}
        disabled={disabled}
        className={`relative inline-flex items-center h-6 rounded-full w-11 transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-sky-500 ${
          checked ? 'bg-sky-500' : 'bg-slate-600'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <span
          className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform duration-200 ease-in-out ${
            checked ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
      <label htmlFor={uniqueId} className="ml-3 text-sm font-medium text-slate-300 select-none">
        {label}
      </label>
    </div>
  );
};

export default Switch;