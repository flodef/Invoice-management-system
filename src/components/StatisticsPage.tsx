import { IconChartLine, IconInfoCircle } from '@tabler/icons-react';
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
import { formatCurrency, formatMonthYear, formatMonthLabel } from '../utils/formatters';

// Register Chart.js components
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

export function StatisticsPage() {
  const rawInvoices = useQuery(api.invoices.getInvoices);

  // Use memoized empty array as fallback for invoices
  const invoices = useMemo(() => rawInvoices || [], [rawInvoices]);

  // Process invoices to get monthly totals (only paid invoices)
  const monthlyData = useMemo(() => {
    if (!invoices.length) return [];

    // Filter only paid invoices
    const paidInvoices = invoices.filter(invoice => invoice.status === 'paid');

    if (!paidInvoices.length) return [];

    const monthMap = new Map<string, number>();

    // Sort invoices by payment date (oldest first) - use paymentDate for paid invoices
    const sortedInvoices = [...paidInvoices].sort((a, b) => {
      const aDate = a.paymentDate || a.invoiceDate;
      const bDate = b.paymentDate || b.invoiceDate;
      return aDate - bDate;
    });

    // Group by month and sum totals based on payment date
    sortedInvoices.forEach(invoice => {
      const date = new Date(invoice.paymentDate || invoice.invoiceDate);
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
  const lastQuarterData = useMemo(() => {
    if (!monthlyData.length) return { total: 0, months: [] };

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
    const total = filteredData.reduce((sum, item) => sum + item.total, 0);

    // Generate month labels for display
    const monthLabels = previousQuarterMonths.map(monthKey => formatMonthLabel(monthKey, 'short', 'none'));

    return { total, months: monthLabels };
  }, [monthlyData]);

  const lastQuarterTotal = lastQuarterData.total;
  const options = useMemo<ChartOptions<'line'>>(() => {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        title: { display: false },
        tooltip: {
          callbacks: {
            label: context => {
              return `${context.dataset.label}: ${formatCurrency(context.parsed.y || 0)}`;
            },
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: value => {
              return formatCurrency(Number(value), 0);
            },
          },
        },
      },
    };
  }, []);

  return (
    <div className="p-4 sm:p-6">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-2">
          <h2 className="text-2xl font-bold">Statistiques</h2>
        </div>
      </div>

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
                <div className="text-sm text-gray-600 flex items-center gap-1">
                  Dernier trimestre {lastQuarterData.months.length > 0 && `(${lastQuarterData.months.join(', ')})`}
                  <div className="relative group inline-block">
                    <IconInfoCircle size={16} className="text-gray-400 cursor-help" />
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                      A déclarer en BIC
                    </div>
                  </div>
                </div>
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
  );
}
