
import React from 'react';
import { ChevronDownIcon } from '../icons';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  wrapperClassName?: string;
  options: Array<{ value: string | number; label: string }>;
  placeholder?: string; 
}

const Select: React.FC<SelectProps> = ({ label, id, options, placeholder, wrapperClassName = "", className = "", ...props }) => {
  const baseStyles = "block w-full bg-slate-700/50 border border-slate-600 rounded-md shadow-sm py-2 px-3 pr-8 text-slate-100 focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm appearance-none transition-colors";

  return (
    <div className={`relative ${wrapperClassName}`}>
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-slate-300 mb-1">
          {label}
          {props.required && <span className="text-red-400 ml-1">*</span>}
        </label>
      )}
      <select
        id={id}
        className={`${baseStyles} ${className}`}
        {...props} 
      >
        {placeholder && <option value="" disabled hidden={props.value !== ""}>{placeholder}</option>}
        {options.map(option => (
          <option key={option.value} value={option.value} className="bg-slate-700 text-slate-100">
            {option.label}
          </option>
        ))}
      </select>
      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-400 pt-1">
         {label && <div className="h-5"></div>} {/* spacer for label */}
        <ChevronDownIcon className="w-5 h-5" />
      </div>
    </div>
  );
};

export default Select;