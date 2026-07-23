'use client';

import { FileText, Clock, User, CheckCircle } from 'lucide-react';

export default function MinutesPage() {
  const minutes = [
    {
      id: 1,
      title: 'Cabinet Meeting Minutes',
      event: 'Cabinet Meeting',
      date: 'July 23, 2026',
      author: 'Dr. Sarah Johnson',
      status: 'Published',
    },
    {
      id: 2,
      title: 'Health Ministry Meeting',
      event: 'Ministry Team Meeting',
      date: 'July 20, 2026',
      author: 'John Kamara',
      status: 'Draft',
    },
  ];

  return (
    <div className="space-y-8 p-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-[#003580]">Meeting Minutes</h1>
        <p className="mt-2 text-slate-600">Record and manage meeting minutes and documentation</p>
      </div>

      {/* Minutes List */}
      <div className="rounded-[2rem] border border-[#d3deef] bg-[#fafdff] shadow-[0_24px_70px_rgba(0,53,128,0.08)]">
        <div className="divide-y divide-slate-200">
          {minutes.map((minute) => (
            <div
              key={minute.id}
              className="flex items-center justify-between border-b border-slate-200 px-6 py-4 sm:px-8 hover:bg-[#f8fbff] transition-colors"
            >
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#edf3fd]">
                  <FileText className="h-6 w-6 text-[#003580]" />
                </div>
                <div>
                  <h3 className="font-semibold text-[#003580]">{minute.title}</h3>
                  <p className="mt-1 text-sm text-slate-600">{minute.event}</p>
                  <div className="mt-2 flex gap-4">
                    <div className="flex items-center gap-1 text-xs text-slate-500">
                      <Clock className="h-3 w-3" />
                      {minute.date}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-slate-500">
                      <User className="h-3 w-3" />
                      {minute.author}
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span
                  className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${
                    minute.status === 'Published'
                      ? 'bg-[#edf8f1] text-[#007236]'
                      : 'bg-[#edf3fd] text-[#003580]'
                  }`}
                >
                  {minute.status}
                </span>
                <button className="rounded-lg bg-[#e2ecfa] px-3 py-2 text-sm font-medium text-[#003580] transition-colors hover:bg-[#d0ddf0]">
                  Edit
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
