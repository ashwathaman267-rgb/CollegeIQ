'use client';

import * as React from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { BarChart3 } from 'lucide-react';

import { cn } from '@/lib/utils';
import { EmptyState } from './states';

/**
 * Recharts wrappers themed with the CampusIQ CSS variables so every chart
 * follows light/dark mode without a re-mount.
 */

export const CHART_VARS = ['--chart-1', '--chart-2', '--chart-3', '--chart-4', '--chart-5', '--chart-6'] as const;
export const chartColor = (index: number) => `rgb(var(${CHART_VARS[index % CHART_VARS.length]}))`;

const AXIS = {
  stroke: 'rgb(var(--subtle))',
  fontSize: 11,
  tickLine: false as const,
  axisLine: false as const,
};

function ChartTooltip({ active, payload, label, suffix }: { active?: boolean; payload?: { name?: string; value?: number; color?: string; dataKey?: string }[]; label?: string | number; suffix?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-line bg-surface px-2.5 py-2 shadow-pop">
      {label !== undefined ? <p className="mb-1 text-2xs font-semibold uppercase tracking-wide text-subtle">{label}</p> : null}
      <ul className="space-y-0.5">
        {payload.map((entry, i) => (
          <li key={i} className="flex items-center gap-2 text-xs">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: entry.color }} aria-hidden />
            <span className="text-muted">{entry.name}</span>
            <span className="tnum ml-auto font-semibold text-ink">
              {typeof entry.value === 'number' ? entry.value.toFixed(1) : entry.value}
              {suffix}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export interface Series {
  key: string;
  label: string;
  color?: string;
}

function ChartShell({ height, children, className }: { height: number; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('w-full', className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        {children as React.ReactElement}
      </ResponsiveContainer>
    </div>
  );
}

function NoData({ height, message }: { height?: number; message?: string }) {
  return (
    <div style={{ minHeight: height ?? 240 }} className="grid place-items-center">
      <EmptyState
        compact
        icon={<BarChart3 />}
        title="No data to chart yet"
        description={message ?? 'Records will appear here as data is added.'}
      />
    </div>
  );
}

export interface TrendChartProps {
  data: Record<string, string | number | null>[];
  xKey: string;
  series: Series[];
  height?: number;
  suffix?: string;
  area?: boolean;
  yDomain?: [number, number];
  emptyMessage?: string;
}

/** Line/area chart for trends over time (monthly attendance, IA averages). */
export function TrendChart({ data, xKey, series, height = 260, suffix = '%', area, yDomain, emptyMessage }: TrendChartProps) {
  if (!data.length) return <NoData height={height} message={emptyMessage} />;
  const Chart = area ? AreaChart : LineChart;
  return (
    <ChartShell height={height}>
      <Chart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
        <CartesianGrid stroke="rgb(var(--line))" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey={xKey} {...AXIS} />
        <YAxis {...AXIS} domain={yDomain ?? [0, 'auto']} width={48} tickFormatter={(v: number) => `${v}${suffix}`} />
        <Tooltip content={<ChartTooltip suffix={suffix} />} cursor={{ stroke: 'rgb(var(--line-strong))' }} />
        <Legend
          verticalAlign="top"
          height={28}
          iconType="plainline"
          wrapperStyle={{ fontSize: 11, color: 'rgb(var(--muted))' }}
        />
        {series.map((s, i) =>
          area ? (
            <Area
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={s.color ?? chartColor(i)}
              strokeWidth={2}
              fill={s.color ?? chartColor(i)}
              fillOpacity={0.14}
              dot={false}
              activeDot={{ r: 4 }}
            />
          ) : (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={s.color ?? chartColor(i)}
              strokeWidth={2}
              dot={{ r: 2.5, strokeWidth: 0, fill: s.color ?? chartColor(i) }}
              activeDot={{ r: 4 }}
            />
          ),
        )}
      </Chart>
    </ChartShell>
  );
}

export interface CategoryBarsProps {
  data: Record<string, string | number | null>[];
  xKey: string;
  yKey: string;
  height?: number;
  suffix?: string;
  horizontal?: boolean;
  color?: (row: Record<string, unknown>, index: number) => string;
  referenceLines?: { value: number; label: string }[];
  emptyMessage?: string;
  label?: string;
}

/** Bar chart for subject/class comparisons. */
export function CategoryBars({
  data,
  xKey,
  yKey,
  height = 260,
  suffix = '%',
  horizontal,
  color,
  referenceLines,
  emptyMessage,
  label,
}: CategoryBarsProps) {
  if (!data.length) return <NoData height={height} message={emptyMessage} />;

  const bars = (
    <BarChart data={data} layout={horizontal ? 'vertical' : 'horizontal'} margin={{ top: 8, right: 12, bottom: 0, left: horizontal ? 8 : -18 }}>
      <CartesianGrid stroke="rgb(var(--line))" strokeDasharray="3 3" vertical={horizontal} horizontal={!horizontal} />
      {horizontal ? (
        <>
          <XAxis type="number" {...AXIS} domain={[0, 'auto']} tickFormatter={(v: number) => `${v}${suffix}`} />
          <YAxis type="category" dataKey={xKey} {...AXIS} width={112} />
        </>
      ) : (
        <>
          <XAxis dataKey={xKey} {...AXIS} interval={0} angle={data.length > 6 ? -18 : 0} dy={data.length > 6 ? 10 : 0} height={data.length > 6 ? 52 : 30} />
          <YAxis {...AXIS} domain={[0, 'auto']} width={48} tickFormatter={(v: number) => `${v}${suffix}`} />
        </>
      )}
      <Tooltip content={<ChartTooltip suffix={suffix} />} cursor={{ fill: 'rgb(var(--line) / 0.35)' }} />
      <Bar dataKey={yKey} name={label ?? yKey} radius={horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]} maxBarSize={horizontal ? 22 : 42}>
        {color
          ? data.map((row, i) => <Cell key={i} fill={color(row, i)} />)
          : null}
      </Bar>
      {referenceLines?.map((line) => (
        <ReferenceLine
          key={line.value}
          {...(horizontal ? { x: line.value } : { y: line.value })}
          stroke="rgb(var(--danger))"
          strokeDasharray="4 4"
          strokeWidth={1.5}
          label={{ value: line.label, position: horizontal ? 'insideBottomRight' : 'insideTopRight', fill: 'rgb(var(--danger-fg))', fontSize: 10 }}
        />
      ))}
    </BarChart>
  );

  return <ChartShell height={height}>{bars}</ChartShell>;
}

export interface GroupedBarsProps {
  data: Record<string, string | number | null>[];
  xKey: string;
  series: Series[];
  height?: number;
  suffix?: string;
  emptyMessage?: string;
}

/** Side-by-side bars for IA-1 vs IA-2 style comparisons. */
export function GroupedBars({ data, xKey, series, height = 260, suffix = '%', emptyMessage }: GroupedBarsProps) {
  if (!data.length) return <NoData height={height} message={emptyMessage} />;
  return (
    <ChartShell height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
        <CartesianGrid stroke="rgb(var(--line))" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey={xKey} {...AXIS} interval={0} />
        <YAxis {...AXIS} domain={[0, 'auto']} width={48} tickFormatter={(v: number) => `${v}${suffix}`} />
        <Tooltip content={<ChartTooltip suffix={suffix} />} cursor={{ fill: 'rgb(var(--line) / 0.35)' }} />
        <Legend verticalAlign="top" height={28} wrapperStyle={{ fontSize: 11, color: 'rgb(var(--muted))' }} />
        {series.map((s, i) => (
          <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color ?? chartColor(i)} radius={[4, 4, 0, 0]} maxBarSize={28} />
        ))}
      </BarChart>
    </ChartShell>
  );
}

export interface Slice {
  label: string;
  value: number;
  color?: string;
}

export function DistributionDonut({
  data,
  height = 240,
  centerLabel,
  centerValue,
  emptyMessage,
}: {
  data: Slice[];
  height?: number;
  centerLabel?: string;
  centerValue?: string | number;
  emptyMessage?: string;
}) {
  const slices = data.filter((d) => d.value > 0);
  if (!slices.length) return <NoData height={height} message={emptyMessage} />;

  return (
    <div className="relative">
      <ChartShell height={height}>
        <PieChart>
          <Tooltip content={<ChartTooltip />} />
          <Legend verticalAlign="bottom" height={32} iconType="circle" wrapperStyle={{ fontSize: 11, color: 'rgb(var(--muted))' }} />
          <Pie data={slices} dataKey="value" nameKey="label" innerRadius="58%" outerRadius="82%" paddingAngle={2} stroke="rgb(var(--surface))" strokeWidth={2}>
            {slices.map((slice, i) => (
              <Cell key={slice.label} fill={slice.color ?? chartColor(i)} />
            ))}
          </Pie>
        </PieChart>
      </ChartShell>
      {centerValue !== undefined ? (
        <div className="pointer-events-none absolute inset-x-0 top-[38%] -translate-y-1/2 text-center">
          <p className="tnum text-xl font-semibold text-ink">{centerValue}</p>
          {centerLabel ? <p className="text-2xs uppercase tracking-[0.1em] text-subtle">{centerLabel}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Weekday × period attendance heatmap. Built by hand (not recharts) because a
 * grid of labelled cells is both cheaper and more accessible.
 */
export function Heatmap({
  days,
  periods,
  value,
  height,
}: {
  days: string[];
  periods: number[];
  value: (day: string, period: number) => number | null;
  height?: number;
}) {
  if (!days.length || !periods.length) return <NoData height={height} />;
  return (
    <div className="overflow-x-auto" style={height ? { minHeight: height } : undefined}>
      <table className="w-full border-separate border-spacing-1 text-xs">
        <caption className="sr-only">Attendance percentage by weekday and period</caption>
        <thead>
          <tr>
            <th className="w-12 text-left text-2xs font-semibold uppercase tracking-wide text-subtle">Day</th>
            {periods.map((p) => (
              <th key={p} className="tnum text-center text-2xs font-semibold text-subtle" scope="col">
                P{p}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {days.map((day) => (
            <tr key={day}>
              <th scope="row" className="whitespace-nowrap pr-1 text-left text-2xs font-semibold uppercase tracking-wide text-subtle">
                {day.slice(0, 3)}
              </th>
              {periods.map((period) => {
                const pct = value(day, period);
                const tone =
                  pct === null
                    ? 'bg-line/40 text-subtle'
                    : pct >= 90
                      ? 'bg-ok/85 text-white'
                      : pct >= 80
                        ? 'bg-ok/55 text-ink'
                        : pct >= 70
                          ? 'bg-warn/55 text-ink'
                          : 'bg-danger/60 text-white';
                return (
                  <td key={period} className={cn('h-8 rounded text-center tnum font-medium transition-colors', tone)} title={`${day} period ${period}: ${pct === null ? 'no data' : `${pct.toFixed(0)}%`}`}>
                    {pct === null ? '·' : pct.toFixed(0)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ChartLegend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5 text-xs text-muted">
          <span className="h-2 w-2 rounded-full" style={{ background: item.color }} aria-hidden />
          {item.label}
        </li>
      ))}
    </ul>
  );
}
