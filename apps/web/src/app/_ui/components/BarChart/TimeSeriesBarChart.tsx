'use client';

import {
  BarElement,
  CategoryScale,
  ChartData,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Tooltip,
} from 'chart.js';
import { useEffect, useState } from 'react';
import { Bar } from 'react-chartjs-2';

import randomChartColor from '@/app/_ui/utils/randomChartColor';
import formatDate from '@/utils/formatDate';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

export interface DataPoint {
  date: Date;
  count: number;
}

export interface TimeSeriesBarChartProps {
  dates: Date[];
  datasets: {
    label: string;
    data: number[];
  }[];
}

const TimeSeriesBarChart = ({ dates, datasets }: TimeSeriesBarChartProps) => {
  const [borderVar, setBorderVar] = useState('oklch(0.8 0 0)');
  const [textVar, setTextVar] = useState('oklch(0.8 0 0)');

  useEffect(() => {
    const style = getComputedStyle(document.body);
    setBorderVar(style.getPropertyValue('--color-border-primary'));
    setTextVar(style.getPropertyValue('--color-text-muted'));
  }, []);

  const scaleStyling = {
    stacked: true,
    border: {
      color: borderVar,
    },
    grid: {
      color: borderVar,
    },
    ticks: {
      color: textVar,
    },
  } as const;

  const options = {
    responsive: true,
    scales: {
      x: { ...scaleStyling, grid: { ...scaleStyling.grid, display: false } },
      y: scaleStyling,
    },
    plugins: {
      legend: {
        display: false,
      },
    },
  };

  const data = {
    labels: dates.map((date) =>
      formatDate(date, 'nl-NL', { month: 'short', day: 'numeric' }),
    ),
    datasets: [
      ...datasets.map((dataset, i) => ({
        label: dataset.label,
        data: dataset.data,
        backgroundColor: randomChartColor(i),
      })),
    ],
  } satisfies ChartData<'bar'>;

  return <Bar data={data} options={options} height={'124px'} />;
};

export default TimeSeriesBarChart;
