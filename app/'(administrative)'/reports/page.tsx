'use client';

import { BarChart3, Download, TrendingUp, Calendar } from 'lucide-react';

export default function ReportsPage() {
  const reports = [
    {
      title: 'Attendance Summary',
      description: 'Overview of attendance across all events',
      period: 'July 2026',
      metrics: { attendance: '87%', events: '24', participants: '1,245' },
    },
    {
      title: 'Event Performance',
      description: 'Analysis of event participation and engagement',
      period: 'July 2026',
      metrics: { avgAttendance: '35', totalEvents: '24', engagement: '92%' },
    },
    {
      title: 'Action Items Progress',
      description: 'Status of action items from meetings',
      period: 'July 2026',
      metrics: { completed: '18', inProgress: '7', overdue: '2' },
    },
  ];

  return (
    <div className="space-y-8 p-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-[#003580]">Reports & Analytics</h1>
        <p className="mt-2 text-slate-600">Generate and download detailed reports on meetings and activities</p>
      </div>

      {/* Reports Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {reports.map((report, idx) => (
          <div
            key={idx}
            className="group rounded-[1.75rem] border border-[#d3deef] bg-[#fafdff] p-6 shadow-[0_8px_24px_rgba(0,53,128,0.06)] transition-all hover:shadow-[0_16px_40px_rgba(0,53,128,0.12)]"
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-[#003580]">{report.title}</h3>
                <p className="mt-2 text-sm text-slate-600">{report.description}</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#e2ecfa]">
                <BarChart3 className="h-6 w-6 text-[#003580]" />
              </div>
            </div>

            {/* Metrics */}
            <div className="mt-6 grid grid-cols-3 gap-4 border-t border-slate-200 pt-4">
              {Object.entries(report.metrics).map(([key, value]) => (
                <div key={key}>
                  <p className="text-xs uppercase tracking-wider text-slate-500">
                    {key.replace(/([A-Z])/g, ' $1').trim()}
                  </p>
                  <p className="mt-1 text-lg font-bold text-[#003580]">{value}</p>
                </div>
              ))}
            </div>

            {/* Period & Action */}
            <div className="mt-6 flex items-center justify-between border-t border-slate-200 pt-4">
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Calendar className="h-4 w-4" />
                {report.period}
              </div>
              <button className="flex items-center gap-2 rounded-lg bg-[#e2ecfa] px-3 py-2 text-sm font-medium text-[#003580] transition-colors hover:bg-[#d0ddf0]">
                <Download className="h-4 w-4" />
                Export
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Export Section */}
      <section className="rounded-[2rem] border border-[#d3deef] bg-[#fafdff] p-8 shadow-[0_24px_70px_rgba(0,53,128,0.08)]">
        <h2 className="text-2xl font-bold text-[#003580]">Quick Export</h2>
        <p className="mt-2 text-slate-600">Download reports in various formats</p>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <button className="rounded-lg border border-[#d3deef] bg-white px-4 py-3 font-medium text-[#003580] transition-all hover:border-[#003580] hover:bg-[#e2ecfa]">
            Export as PDF
          </button>
          <button className="rounded-lg border border-[#d3deef] bg-white px-4 py-3 font-medium text-[#003580] transition-all hover:border-[#003580] hover:bg-[#e2ecfa]">
            Export as Excel
          </button>
          <button className="rounded-lg border border-[#d3deef] bg-white px-4 py-3 font-medium text-[#003580] transition-all hover:border-[#003580] hover:bg-[#e2ecfa]">
            Export as CSV
          </button>
        </div>
      </section>
    </div>
  );
}
