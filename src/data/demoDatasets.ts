import { makeSampleData } from './sampleData';

const rnd = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1));
const rndf = (a: number, b: number, dp = 1) => Number((a + Math.random() * (b - a)).toFixed(dp));
const pick = <T,>(arr: T[]): T => arr[rnd(0, arr.length - 1)];

export function makeNetworkPerformance(): Record<string, unknown>[] {
  const regions = ['North', 'South', 'East', 'West', 'Central'];
  const techs = ['2G', '3G', '4G', '5G'];
  const nodes = ['eNodeB-101', 'gNodeB-204', 'RNC-12', 'BSC-7', 'Core-RTR-3', 'Core-RTR-9'];
  const now = Date.now();
  const rows: Record<string, unknown>[] = [];
  for (let i = 0; i < 400; i++) {
    rows.push({
      record_id: 5000 + i,
      node: pick(nodes),
      technology: pick(techs),
      region: pick(regions),
      throughput_mbps: rndf(5, 950),
      latency_ms: rndf(2, 180),
      packet_loss_pct: rndf(0, 4, 2),
      availability_pct: rndf(95, 100, 2),
      timestamp: new Date(now - rnd(0, 30 * 24 * 60) * 60000).toISOString().slice(0, 16).replace('T', ' '),
    });
  }
  return rows;
}

export function makeServiceHealth(): Record<string, unknown>[] {
  const services = ['VoLTE', 'SMS', 'Data-PDP', 'IMS-Registration', 'Roaming-Gateway', 'Billing-API', 'OTT-Video', 'IoT-Gateway'];
  const regions = ['North', 'South', 'East', 'West', 'Central'];
  const statuses = ['Healthy', 'Degraded', 'Down'];
  const weights = [0.78, 0.17, 0.05];
  const pickStatus = () => {
    const r = Math.random();
    return r < weights[0] ? statuses[0] : r < weights[0] + weights[1] ? statuses[1] : statuses[2];
  };
  const now = Date.now();
  const rows: Record<string, unknown>[] = [];
  for (let i = 0; i < 220; i++) {
    const status = pickStatus();
    rows.push({
      check_id: 7000 + i,
      service_name: pick(services),
      region: pick(regions),
      status,
      uptime_pct: status === 'Healthy' ? rndf(99, 100, 2) : status === 'Degraded' ? rndf(90, 99, 2) : rndf(0, 60, 2),
      response_time_ms: status === 'Down' ? rnd(2000, 8000) : rnd(20, 800),
      error_rate_pct: status === 'Healthy' ? rndf(0, 0.5, 2) : status === 'Degraded' ? rndf(0.5, 8, 2) : rndf(8, 100, 2),
      last_checked: new Date(now - rnd(0, 1440) * 60000).toISOString().slice(0, 16).replace('T', ' '),
    });
  }
  return rows;
}

export function makeTelecomKpis(): Record<string, unknown>[] {
  const domains = ['RAN', 'Core', 'Transport', 'IT'];
  const vendors = ['Nokia', 'Ericsson', 'Cisco', 'Huawei'];
  const techs = ['2G', '3G', '4G', '5G'];
  const kpis: Record<string, { unit: string; range: [number, number]; target: number }> = {
    'Call Drop Rate':        { unit: '%',    range: [0.1, 5],    target: 1.5 },
    'Handover Success Rate': { unit: '%',    range: [85, 99.9],  target: 97 },
    'RRC Setup Success':     { unit: '%',    range: [90, 100],   target: 98 },
    'Throughput DL':         { unit: 'Mbps', range: [10, 900],   target: 300 },
    'Throughput UL':         { unit: 'Mbps', range: [5, 300],    target: 100 },
    'PRB Utilization':       { unit: '%',    range: [10, 95],    target: 70 },
    'VoLTE MOS':             { unit: 'score', range: [2.5, 4.5], target: 4 },
  };
  const periods = ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06'];
  const rows: Record<string, unknown>[] = [];
  let id = 9000;
  Object.entries(kpis).forEach(([name, def]) => {
    for (let i = 0; i < 60; i++) {
      rows.push({
        kpi_id: id++,
        kpi_name: name,
        domain: pick(domains),
        vendor: pick(vendors),
        technology: pick(techs),
        value: rndf(def.range[0], def.range[1], 2),
        target: def.target,
        unit: def.unit,
        period: pick(periods),
      });
    }
  });
  return rows;
}

export function makeGnnDataset(): Record<string, unknown>[] {
  const nodeTypes = ['Tower', 'Router', 'Switch', 'Core'];
  const regions = ['North', 'South', 'East', 'West', 'Central'];
  const nodeCount = 60;
  const rows: Record<string, unknown>[] = [];
  for (let i = 0; i < nodeCount; i++) {
    const connections = rnd(1, 4);
    for (let c = 0; c < connections; c++) {
      let target = rnd(0, nodeCount - 1);
      if (target === i) target = (target + 1) % nodeCount;
      rows.push({
        edge_id: i * 10 + c,
        node_id: `N${i}`,
        node_type: pick(nodeTypes),
        connected_to: `N${target}`,
        region: pick(regions),
        latency_ms: rndf(1, 60),
        load_pct: rndf(5, 98),
      });
    }
  }
  return rows;
}

export interface DemoDataset {
  key: string;
  label: string;
  description: string;
  make(): Record<string, unknown>[];
}

export const DEMO_DATASETS: DemoDataset[] = [
  { key: 'fact_alarms', label: 'fact_alarms', description: 'Telecom alarm events by severity, network type and vendor.', make: makeSampleData },
  { key: 'network_performance', label: 'network_performance', description: 'Per-node throughput, latency, packet loss and availability.', make: makeNetworkPerformance },
  { key: 'service_health', label: 'service_health', description: 'Service-level health checks across regions (VoLTE, SMS, Data...).', make: makeServiceHealth },
  { key: 'telecom_kpis', label: 'telecom_kpis', description: 'Rolled-up network KPIs by domain, vendor and technology.', make: makeTelecomKpis },
  { key: 'gnn_dataset', label: 'gnn_dataset', description: 'Network topology as a node/edge graph (towers, routers, switches).', make: makeGnnDataset },
];
