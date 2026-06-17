export interface AlarmRow {
  [key: string]: unknown;
  alarm_id: number;
  severity: string;
  network_type: string;
  node: string;
  vendor: string;
  raised_time: string;
  cleared_time: string;
  is_active: boolean;
  mttr_min: number | null;
}

export function makeSampleData(): AlarmRow[] {
  const networks: Record<string, string[]> = {
    Mobile: ['RAN', 'Core', 'IP'],
    Fixed:  ['Optical', 'IP', 'Micro'],
    Infra:  ['Compute', 'DB', 'Etc'],
  };
  const vendors = ['Nokia', 'Ericsson', 'Cisco'];
  const rows: AlarmRow[] = [];
  let id = 1000;
  const now = Date.now();
  const rnd  = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1));
  const pick = <T,>(arr: T[]): T => arr[rnd(0, arr.length - 1)];

  const activePlan: Record<string, number> = { Critical: 142, Major: 318, Minor: 506, Warning: 88 };

  const addRow = (sev: string, active: boolean) => {
    const net    = pick(Object.keys(networks));
    const raised = now - rnd(1, 30 * 24 * 60) * 60000;
    const mttr   = rnd(8, 540);
    rows.push({
      alarm_id:     id++,
      severity:     sev,
      network_type: net,
      node:         pick(networks[net]),
      vendor:       pick(vendors),
      raised_time:  new Date(raised).toISOString().slice(0, 16).replace('T', ' '),
      cleared_time: active ? '' : new Date(raised + mttr * 60000).toISOString().slice(0, 16).replace('T', ' '),
      is_active:    active,
      mttr_min:     active ? null : mttr,
    });
  };

  Object.entries(activePlan).forEach(([sev, n]) => {
    for (let i = 0; i < n; i++) addRow(sev, true);
  });
  ['Critical', 'Major', 'Minor', 'Warning'].forEach(sev => {
    for (let i = 0; i < rnd(40, 90); i++) addRow(sev, false);
  });

  // shuffle
  for (let i = rows.length - 1; i > 0; i--) {
    const j = rnd(0, i);
    [rows[i], rows[j]] = [rows[j], rows[i]];
  }
  return rows;
}

export interface VendorRow {
  [key: string]: unknown;
  vendor: string;
  region: string;
  support_tier: string;
}

/** A small bundled dimension table, joinable on fact_alarms.vendor — gives the Join Builder something real to demo out of the box. */
export function makeDimVendorData(): VendorRow[] {
  return [
    { vendor: 'Nokia',    region: 'EMEA', support_tier: 'Gold' },
    { vendor: 'Ericsson', region: 'EMEA', support_tier: 'Platinum' },
    { vendor: 'Cisco',    region: 'AMER', support_tier: 'Gold' },
  ];
}
