'use client';

import { CheckCircle2, Clock, User, AlertCircle } from 'lucide-react';

export default function ActionItemsPage() {
  const actionItems = [
    {
      id: 1,
      title: 'Prepare quarterly health report',
      owner: 'Dr. Sarah Johnson',
      dueDate: 'July 31, 2026',
      status: 'In Progress',
      priority: 'High',
    },
    {
      id: 2,
      title: 'Schedule follow-up meeting',
      owner: 'John Kamara',
      dueDate: 'August 5, 2026',
      status: 'Todo',
      priority: 'Medium',
    },
    {
      id: 3,
      title: 'Distribute meeting minutes',
      owner: 'Mary Sesay',
      dueDate: 'July 24, 2026',
      status: 'Completed',
      priority: 'Low',
    },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Completed':
        return 'bg-[#edf8f1] text-[#007236]';
      case 'In Progress':
        return 'bg-[#fff8e5] text-[#8d6400]';
      default:
        return 'bg-[#edf3fd] text-[#003580]';
    }
  };

  return (
    <div className="space-y-8 p-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-[#003580]">Action Items</h1>
        <p className="mt-2 text-slate-600">Track and manage tasks assigned from meetings</p>
      </div>

      {/* Action Items Table */}
      <div className="rounded-[2rem] border border-[#d3deef] bg-[#fafdff] shadow-[0_24px_70px_rgba(0,53,128,0.08)]">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-[#003580] sm:px-8">Task</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-[#003580] sm:px-8">Owner</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-[#003580] sm:px-8">Due Date</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-[#003580] sm:px-8">Status</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-[#003580] sm:px-8">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {actionItems.map((item) => (
                <tr key={item.id} className="hover:bg-[#f8fbff] transition-colors">
                  <td className="px-6 py-4 sm:px-8">
                    <p className="font-medium text-[#11243d]">{item.title}</p>
                  </td>
                  <td className="px-6 py-4 sm:px-8">
                    <p className="text-sm text-slate-600">{item.owner}</p>
                  </td>
                  <td className="px-6 py-4 sm:px-8">
                    <p className="text-sm text-slate-600">{item.dueDate}</p>
                  </td>
                  <td className="px-6 py-4 sm:px-8">
                    <span className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${getStatusColor(item.status)}`}>
                      {item.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 sm:px-8">
                    <button className="text-sm font-medium text-[#003580] hover:text-[#002563]">
                      Update
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
