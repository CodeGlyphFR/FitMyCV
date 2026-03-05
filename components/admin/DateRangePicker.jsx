'use client';

import { CustomSelect } from './CustomSelect';

const DATE_RANGE_OPTIONS = [
  { value: '24h', label: '24h' },
  { value: '7d', label: '7j' },
  { value: '30d', label: '30j' },
  { value: 'all', label: 'Tout' },
];

/**
 * Date Range Picker for analytics filtering
 */
export function DateRangePicker({ value, onChange }) {

  return (
    <div className="w-20 md:w-auto">
      <CustomSelect
        value={value}
        onChange={onChange}
        options={DATE_RANGE_OPTIONS}
      />
    </div>
  );
}
