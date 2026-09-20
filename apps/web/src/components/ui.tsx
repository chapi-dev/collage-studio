import type { ChangeEvent, ReactNode } from 'react';

interface SectionProps {
  title: string;
  hint?: string;
  action?: ReactNode;
  children: ReactNode;
}

export function Section({ title, hint, action, children }: SectionProps) {
  return (
    <section className="section">
      <header className="section__header">
        <div>
          <h2 className="section__title">{title}</h2>
          {hint ? <p className="section__hint">{hint}</p> : null}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

export interface ChipOption {
  id: string;
  label: string;
  sublabel?: string;
  title?: string;
}

interface ChipGroupProps {
  options: ChipOption[];
  value: string | null;
  onChange: (id: string) => void;
  ariaLabel: string;
  columns?: boolean;
}

export function ChipGroup({ options, value, onChange, ariaLabel, columns }: ChipGroupProps) {
  return (
    <div
      className={columns ? 'chips chips--columns' : 'chips'}
      role="radiogroup"
      aria-label={ariaLabel}
    >
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          role="radio"
          aria-checked={value === option.id}
          title={option.title}
          className={`chip${value === option.id ? ' chip--active' : ''}`}
          onClick={() => onChange(option.id)}
        >
          <span className="chip__label">{option.label}</span>
          {option.sublabel ? <span className="chip__sub">{option.sublabel}</span> : null}
        </button>
      ))}
    </div>
  );
}

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  format?: (value: number) => string;
  disabled?: boolean;
}

export function Slider({ label, value, min, max, step, onChange, format, disabled }: SliderProps) {
  const handle = (event: ChangeEvent<HTMLInputElement>) => onChange(Number(event.target.value));
  return (
    <label className={`slider${disabled ? ' slider--disabled' : ''}`}>
      <span className="slider__row">
        <span className="slider__label">{label}</span>
        <span className="slider__value">{format ? format(value) : value.toFixed(2)}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={handle}
      />
    </label>
  );
}

interface SwatchesProps {
  colors: string[];
  value: string;
  onChange: (color: string) => void;
}

export function Swatches({ colors, value, onChange }: SwatchesProps) {
  return (
    <div className="swatches" role="radiogroup" aria-label="Background colour">
      {colors.map((color) => (
        <button
          key={color}
          type="button"
          role="radio"
          aria-checked={value.toLowerCase() === color.toLowerCase()}
          aria-label={color}
          title={color}
          className={`swatch${value.toLowerCase() === color.toLowerCase() ? ' swatch--active' : ''}`}
          style={{ background: color }}
          onClick={() => onChange(color)}
        />
      ))}
      <label className="swatch swatch--custom" title="Custom colour">
        <input
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-label="Custom background colour"
        />
      </label>
    </div>
  );
}
