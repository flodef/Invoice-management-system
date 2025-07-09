import { IconChartLine } from '@tabler/icons-react';
import {
  CategoryScale,
  Chart as ChartJS,
  ChartOptions,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Title,
  Tooltip,
} from 'chart.js';
import { useQuery } from 'convex/react';
import { useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import { api } from '../../convex/_generated/api';
import { formatCurrency, formatMonthYear } from '../utils/formatters';

// Register Chart.js components
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

export function StatisticsPage() {
  const rawInvoices = useQuery(api.invoices.getInvoices);

  // Use memoized empty array as fallback for invoices
  const invoices = useMemo(() => rawInvoices || [], [rawInvoices]);

  // Process invoices to get monthly totals
  const monthlyData = useMemo(() => {
    if (!invoices.length) return [];

    const monthMap = new Map<string, number>();

    // Sort invoices by date (oldest first)
    const sortedInvoices = [...invoices].sort((a, b) => a.invoiceDate - b.invoiceDate);

    // Group by month and sum totals
    sortedInvoices.forEach(invoice => {
      const date = new Date(invoice.invoiceDate);
      const monthKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;

      const currentAmount = monthMap.get(monthKey) || 0;
      monthMap.set(monthKey, currentAmount + invoice.totalAmount);
    });

    // Convert to array and sort chronologically
    return Array.from(monthMap.entries())
      .map(([monthKey, total]) => {
        const [year, month] = monthKey.split('-').map(Number);
        return {
          monthKey,
          month: formatMonthYear(new Date(year, month - 1, 1)),
          total,
        };
      })
      .sort((a, b) => {
        return a.monthKey.localeCompare(b.monthKey);
      });
  }, [invoices]);

  const chartData = {
    labels: monthlyData.map(item => item.month),
    datasets: [
      {
        label: "Chiffre d'affaires",
        data: monthlyData.map(item => item.total),
        fill: false,
        backgroundColor: 'rgb(37, 99, 235)',
        borderColor: 'rgba(37, 99, 235, 0.8)',
        tension: 0.3,
        pointBackgroundColor: 'rgb(37, 99, 235)',
        pointHoverBackgroundColor: 'rgb(30, 64, 175)',
        pointHoverRadius: 6,
        pointRadius: 4,
      },
    ],
  };

  // Memoize chart options with minimal event handling
  const lastQuarterTotal = useMemo(() => {
    if (!monthlyData.length) return 0;

    const now = new Date();
    const currentMonth = now.getMonth(); // 0-indexed
    const currentYear = now.getFullYear();

    let quarterEndMonth: number;
    let quarterStartMonth: number;
    let quarterYear: number;

    // Determine the previous full quarter
    if (currentMonth >= 0 && currentMonth <= 2) {
      // Q1 (Jan-Mar) -> Previous is Q4 of last year
      quarterEndMonth = 11; // December
      quarterStartMonth = 9; // October
      quarterYear = currentYear - 1;
    } else if (currentMonth >= 3 && currentMonth <= 5) {
      // Q2 (Apr-Jun) -> Previous is Q1
      quarterEndMonth = 2; // March
      quarterStartMonth = 0; // January
      quarterYear = currentYear;
    } else if (currentMonth >= 6 && currentMonth <= 8) {
      // Q3 (Jul-Sep) -> Previous is Q2
      quarterEndMonth = 5; // June
      quarterStartMonth = 3; // April
      quarterYear = currentYear;
    } else {
      // Q4 (Oct-Dec) -> Previous is Q3
      quarterEndMonth = 8; // September
      quarterStartMonth = 6; // July
      quarterYear = currentYear;
    }

    const previousQuarterMonths: string[] = [];
    for (let i = quarterStartMonth; i <= quarterEndMonth; i++) {
      previousQuarterMonths.push(`${quarterYear}-${(i + 1).toString().padStart(2, '0')}`);
    }

    const filteredData = monthlyData.filter(item => previousQuarterMonths.includes(item.monthKey));

    return filteredData.reduce((sum, item) => sum + item.total, 0);
  }, [monthlyData]);
  const options = useMemo<ChartOptions<'line'>>(() => {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top' as const,
          labels: {
            font: {
              size: 14,
              family: 'system-ui',
            },
          },
        },
        title: {
          display: false,
        },
        tooltip: {
          // Use the built-in tooltip functionality
          callbacks: {
            label: context => {
              return `${context.dataset.label}: ${formatCurrency(context.parsed.y)}`;
            },
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: value => {
              return formatCurrency(Number(value));
            },
          },
        },
      },
    };
  }, []);

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-2">
          <IconChartLine size={28} stroke={1.5} className="text-blue-600" />
          <h2 className="text-2xl font-bold">Statistiques</h2>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-md">
        <h3 className="text-xl font-semibold mb-6">Chiffre d'affaires mensuel</h3>

        {monthlyData.length > 0 ? (
          <>
            <div className="h-80 mb-4">
              <Line data={chartData} options={options} />
            </div>

            <div className="mt-8">
              <h4 className="font-semibold mb-2">Résumé</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                <div className="bg-gray-50 p-4 rounded-md">
                  <div className="text-sm text-gray-600">Total sur la période</div>
                  <div className="text-xl font-bold text-blue-800">
                    {formatCurrency(monthlyData.reduce((sum, item) => sum + item.total, 0))}
                  </div>
                </div>
                <div className="bg-gray-50 p-4 rounded-md">
                  <div className="text-sm text-gray-600">Moyenne mensuelle</div>
                  <div className="text-xl font-bold text-blue-800">
                    {formatCurrency(monthlyData.reduce((sum, item) => sum + item.total, 0) / monthlyData.length)}
                  </div>
                </div>
                <div className="bg-gray-50 p-4 rounded-md">
                  <div className="text-sm text-gray-600">Dernier trimestre</div>
                  <div className="text-xl font-bold text-blue-800">{formatCurrency(lastQuarterTotal)}</div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-10">
            <div className="text-gray-400 mb-2">
              <IconChartLine size={48} stroke={1} />
            </div>
            <p className="text-gray-500">Pas de données disponibles pour afficher le graphique.</p>
            <p className="text-gray-500 text-sm mt-1">Créez des factures pour voir les statistiques.</p>
          </div>
        )}
      </div>
    </div>
  );
}
