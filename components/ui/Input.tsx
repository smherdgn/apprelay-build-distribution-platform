
import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  wrapperClassName?: string;
}

const Input: React.FC<InputProps> = ({ label, id, wrapperClassName = "", className = "", ...props }) => {
  const baseStyles = "block w-full bg-slate-700/50 border border-slate-600 rounded-md shadow-sm py-2 px-3 text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm transition-colors";
  
  return (
    <div className={wrapperClassName}>
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-slate-300 mb-1">
          {label}
          {props.required && <span className="text-red-400 ml-1">*</span>}
        </label>
      )}
      <input
        id={id}
        className={`${baseStyles} ${className}`}
        {...props}
      />
    </div>
  );
};

export default Input;