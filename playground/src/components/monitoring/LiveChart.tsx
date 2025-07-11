import { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { MetricData } from '../../services/monitoringService';

interface LiveChartProps {
  data: MetricData[];
  title: string;
  color?: string;
  type?: 'line' | 'area';
  height?: number;
  showGrid?: boolean;
  formatValue?: (value: number) => string;
  unit?: string;
}

export default function LiveChart({
  data,
  title,
  color = '#6366f1',
  type = 'area',
  height = 200,
  showGrid = true,
  formatValue,
  unit = '',
}: LiveChartProps) {
  const chartData = useMemo(() => {
    return data.map(point => ({
      ...point,
      time: new Date(point.timestamp).toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
      }),
    }));
  }, [data]);

  const formatTooltipValue = (value: number) => {
    if (formatValue) {
      return formatValue(value);
    }
    return `${value}${unit}`;
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
            {label}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            <span className="font-medium" style={{ color: payload[0].color }}>
              {title}: {formatTooltipValue(payload[0].value)}
            </span>
          </p>
        </div>
      );
    }
    return null;
  };

  const commonProps = {
    data: chartData,
    margin: { top: 5, right: 5, left: 5, bottom: 5 },
  };

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={height}>
        {type === 'area' ? (
          <AreaChart {...commonProps}>
            {showGrid && (
              <CartesianGrid 
                strokeDasharray="3 3" 
                stroke="#e5e7eb" 
                className="dark:stroke-gray-700"
              />
            )}
            <XAxis 
              dataKey="time" 
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: '#6b7280' }}
              interval="preserveStartEnd"
            />
            <YAxis 
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: '#6b7280' }}
              width={40}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={2}
              fill={color}
              fillOpacity={0.1}
              dot={false}
              activeDot={{ 
                r: 4, 
                stroke: color, 
                strokeWidth: 2, 
                fill: '#ffffff' 
              }}
            />
          </AreaChart>
        ) : (
          <LineChart {...commonProps}>
            {showGrid && (
              <CartesianGrid 
                strokeDasharray="3 3" 
                stroke="#e5e7eb" 
                className="dark:stroke-gray-700"
              />
            )}
            <XAxis 
              dataKey="time" 
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: '#6b7280' }}
              interval="preserveStartEnd"
            />
            <YAxis 
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: '#6b7280' }}
              width={40}
            />
            <Tooltip content={<CustomTooltip />} />
            <Line
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={2}
              dot={false}
              activeDot={{ 
                r: 4, 
                stroke: color, 
                strokeWidth: 2, 
                fill: '#ffffff' 
              }}
            />
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
