import React from 'react';

// Define a type for the 'as' prop, which can be any valid React element type
type AsProp<C extends React.ElementType> = {
  as?: C;
};

// Props that should be Omitted when 'as' is used
type PropsToOmit<C extends React.ElementType, P> = keyof (AsProp<C> & P);

// Base props for the Button component
interface ButtonBaseProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'link'; // Added 'link'
  size?: 'sm' | 'md' | 'lg';
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  className?: string;
}

// Polymorphic component props
type ButtonProps<C extends React.ElementType = 'button'> = 
  ButtonBaseProps &
  AsProp<C> &
  Omit<React.ComponentPropsWithoutRef<C>, PropsToOmit<C, ButtonBaseProps>>;


const Button = <C extends React.ElementType = 'button',>(
  { 
    children, 
    variant = 'primary', 
    size = 'md', 
    leftIcon,
    rightIcon,
    className = '', 
    as,
    ...props 
  }: ButtonProps<C>
) => {
  const Component = as || 'button';

  const baseStyles = "inline-flex items-center justify-center font-semibold rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 transition-all duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed";
  
  const variantStyles = {
    primary: "bg-sky-500 hover:bg-sky-600 text-white focus:ring-sky-400",
    secondary: "bg-slate-600 hover:bg-slate-500 text-slate-100 focus:ring-slate-400",
    danger: "bg-red-500 hover:bg-red-600 text-white focus:ring-red-400",
    ghost: "bg-transparent hover:bg-slate-700 text-slate-200 focus:ring-slate-500 border border-slate-600 hover:border-slate-500",
    link: "bg-transparent text-sky-400 hover:text-sky-300 hover:underline focus:ring-sky-500 focus:ring-offset-transparent disabled:text-slate-400 disabled:no-underline disabled:hover:text-slate-400 disabled:hover:no-underline", // Added link styles
  };

  const sizeStyles = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-4 py-2 text-base",
    lg: "px-6 py-3 text-lg",
  };

  return (
    <Component 
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      {...props} // Spread the rest of the props, including `to` if Component is Link
    >
      {leftIcon && <span className="mr-2">{leftIcon}</span>}
      {children}
      {rightIcon && <span className="ml-2">{rightIcon}</span>}
    </Component>
  );
};

export default Button;