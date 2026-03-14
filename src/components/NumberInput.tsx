import React, { useState, useEffect } from 'react';

interface NumberInputProps {
  value: number;
  onChange: (val: number) => void;
  className?: string;
  placeholder?: string;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}

export default function NumberInput({ value, onChange, className, placeholder = "0", onKeyDown }: NumberInputProps) {
  const [localValue, setLocalValue] = useState(value === 0 ? '' : value.toString());

  // Sync from props to local state if the prop changes externally
  useEffect(() => {
    if (value === 0 && localValue === '') return; // Don't overwrite empty string with '0' if user just cleared it
    if (parseInt(localValue, 10) !== value) {
      setLocalValue(value === 0 ? '' : value.toString());
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    // Only allow digits
    if (!/^\d*$/.test(val)) return;
    
    setLocalValue(val);
    
    if (val === '') {
      onChange(0);
    } else {
      const num = parseInt(val, 10);
      if (!isNaN(num)) {
        onChange(num);
      }
    }
  };

  const handleBlur = () => {
    // Optional: format on blur, e.g., remove leading zeros
    if (localValue !== '') {
      const num = parseInt(localValue, 10);
      setLocalValue(num === 0 ? '' : num.toString());
    }
  };

  return (
    <input
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      value={localValue}
      onChange={handleChange}
      onBlur={handleBlur}
      onKeyDown={onKeyDown}
      className={className}
      placeholder={placeholder}
    />
  );
}
