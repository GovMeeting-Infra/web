'use client';

import { BarChart3, CalendarDays, Users, TrendingUp } from 'lucide-react';

export default function DashboardPage() {
  return (
    <div className="space-y-8 p-8">
      {/* Hero Section */}
      <section className="rounded-[2rem] border border-[#d3deef] bg-[#fafdff] px-6 py-7 shadow-[0_24px_70px_rgba(0,53,128,0.08)] lg:px-8">
        <div className="max-w-4xl">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#007236]">Dashboard</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-[#003580] sm:text-5xl">
            Welcome back
          </h2>
          <p className="mt-4 text-sm leading-7 text-slate-600 sm:text-base">
            Monitor your meetings, track attendance, and manage your ministry's events efficiently.
          </p>
        </div>
      </section>

      {/* Stats Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {/* Events Card */}
        <div className="rounded-[1.75rem] border border-[#d3deef] bg-[#fafdff] p-6 shadow-[0_8px_24px_rgba(0,53,128,0.06)]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600">Total Events</p>
              <p className="mt-2 text-3xl font-bold text-[#003580]">24</p>
              <p className="mt-2 text-xs text-slate-500">↑ 12% from last month</p>
            </div>
            <div className="flex h-14 w-14 items-center justify-center rounded-[1.25rem] bg-[#e2ecfa]">
              <CalendarDays className="h-7 w-7 text-[#003580]" />
            </div>
          </div>
        </div>

        {/* Attendance Card */}
        <div className="rounded-[1.75rem] border border-[#d3deef] bg-[#fafdff] p-6 shadow-[0_8px_24px_rgba(0,53,128,0.06)]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600">Avg Attendance</p>
              <p className="mt-2 text-3xl font-bold text-[#003580]">87%</p>
              <p className="mt-2 text-xs text-slate-500">↑ 5% from last month</p>
            </div>
            <div className="flex h-14 w-14 items-center justify-center rounded-[1.25rem] bg-[#edf8f1]">
              <Users className="h-7 w-7 text-[#007236]" />
            </div>
          </div>
        </div>

        {/* Minutes Card */}
        <div className="rounded-[1.75rem] border border-[#d3deef] bg-[#fafdff] p-6 shadow-[0_8px_24px_rgba(0,53,128,0.06)]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600">Minutes Recorded</p>
              <p className="mt-2 text-3xl font-bold text-[#003580]">18</p>
              <p className="mt-2 text-xs text-slate-500">3 pending review</p>
            </div>
            <div className="flex h-14 w-14 items-center justify-center rounded-[1.25rem] bg-[#fff8e5]">
              <BarChart3 className="h-7 w-7 text-[#8d6400]" />
            </div>
          </div>
        </div>

        {/* Action Items Card */}
        <div className="rounded-[1.75rem] border border-[#d3deef] bg-[#fafdff] p-6 shadow-[0_8px_24px_rgba(0,53,128,0.06)]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600">Action Items</p>
              <p className="mt-2 text-3xl font-bold text-[#003580]">12</p>
              <p className="mt-2 text-xs text-slate-500">4 overdue</p>
            </div>
            <div className="flex h-14 w-14 items-center justify-center rounded-[1.25rem] bg-[#fee2e2]">
              <TrendingUp className="h-7 w-7 text-[#991b1b]" />
            </div>
          </div>
        </div>
      </div>

      {/* Recent Events */}
      <section className="rounded-[2rem] border border-[#d3deef] bg-[#fafdff] shadow-[0_24px_70px_rgba(0,53,128,0.08)]">
        <div className="border-b border-slate-200 px-6 py-5 sm:px-8">
          <h3 className="text-lg font-semibold text-[#003580]">Recent Events</h3>
        </div>
        <div className="divide-y divide-slate-200">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center justify-between px-6 py-4 sm:px-8 hover:bg-[#f8fbff] transition-colors">
              <div>
                <p className="font-medium text-[#11243d]">Cabinet Meeting</p>
                <p className="mt-1 text-sm text-slate-600">July 23, 2026 • 10:00 AM</p>
              </div>
              <div className="inline-block rounded-full bg-[#edf8f1] px-3 py-1">
                <span className="text-xs font-medium text-[#007236]">Completed</span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
