import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { KpiMeta } from '@/types/expr';

const FIELDS: { key: keyof KpiMeta; label: string; placeholder: string }[] = [
  { key: 'name',       label: 'KPI Name',  placeholder: 'e.g. Active Critical Alarms' },
  { key: 'group',      label: 'KPI Group', placeholder: 'e.g. Network Health' },
  { key: 'domain',     label: 'Domain',    placeholder: 'e.g. RAN' },
  { key: 'vendor',     label: 'Vendor',    placeholder: 'e.g. Ericsson' },
  { key: 'technology', label: 'Technology',placeholder: 'e.g. 5G' },
  { key: 'nodeType',   label: 'Node Type', placeholder: 'e.g. gNodeB' },
  { key: 'kpiType',    label: 'KPI Type',  placeholder: 'e.g. Availability' },
];

export default function KpiMetaForm({
  kpi, onChange,
}: {
  kpi: KpiMeta;
  onChange: (patch: Partial<KpiMeta>) => void;
}) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {FIELDS.map(f => (
        <div key={f.key}>
          <Label>{f.label}</Label>
          <Input
            className="mt-1"
            value={kpi[f.key]}
            placeholder={f.placeholder}
            onChange={e => onChange({ [f.key]: e.target.value })}
          />
        </div>
      ))}
    </div>
  );
}
