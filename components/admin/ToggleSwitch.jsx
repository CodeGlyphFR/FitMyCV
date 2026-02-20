'use client';

export function ToggleSwitch({ enabled, onChange, disabled = false }) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!enabled)}
      disabled={disabled}
      className={`
        relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ease-in-out
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        ${enabled
          ? 'bg-emerald-500/30 border border-emerald-400/50'
          : 'bg-white/10 border border-white/20'
        }
        backdrop-blur-xl
      `}
      aria-pressed={enabled}
    >
      <span
        className={`
          inline-block h-4 w-4 transform rounded-full transition-transform duration-200 ease-in-out
          ${enabled
            ? 'translate-x-6 bg-emerald-400 shadow-[0_0_8px_rgba(52,211.1.5.0.6)]'
            : 'translate-x-1 bg-white/70'
          }
        `}
      />
    </button>
  );
}
