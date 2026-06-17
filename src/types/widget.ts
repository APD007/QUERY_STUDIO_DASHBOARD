export type ChartType = 'pie' | 'bar' | 'line' | 'area' | 'kpi' | 'table';

export interface Widget {
  id: string;
  name: string;
  queryId: string;
  chart: ChartType;
  dim: string;
  metric: string;
}
