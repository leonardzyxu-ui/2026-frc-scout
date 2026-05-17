import React, { useState, useEffect } from 'react';

interface NumberInputProps {
  value: number;
  onChange: (val: number) => void;
  className?: string;
  placeholder?: string;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}

export default function NumberInput({ value, onChange, className, placeholder = "", onKeyDown }: NumberInputProps) {
  const [localValue, setLocalValue] = useState(value === 0 ? '' : value.toString());

  // Sync from props to local state if the prop changes externally
  useEffect(() => {
    // Only update localValue if it's completely out of sync with value
    // (e.g. value changed from outside, not from our own typing)
    const numLocal = parseInt(localValue, 10);
    const parsedLocal = isNaN(numLocal) ? 0 : numLocal;
    
    // If the external value is 0, and we are currently empty, that's fine (in sync)
    if (value === 0 && localValue === '') return;
    
    // If the external value doesn't match our parsed local value, update local
    if (parsedLocal !== value) {
      setLocalValue(value === 0 ? '' : value.toString());
    }
  }, [value]); // Only re-run if external value changes

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
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
    if (localValue === '') {
      onChange(0);
    } else {
      const num = parseInt(localValue, 10);
      if (!isNaN(num)) {
        onChange(num);
        setLocalValue(num === 0 ? '' : num.toString());
      } else {
        onChange(0);
        setLocalValue('');
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleBlur();
    }
    if (onKeyDown) {
      onKeyDown(e);
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
      onKeyDown={handleKeyDown}
      className={className}
      placeholder={placeholder}
    />
  );
}
