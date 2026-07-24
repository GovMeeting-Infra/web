'use client';

import { Plus, CalendarDays, MapPin, Users } from 'lucide-react';
import Link from 'next/link';

export default function EventsPage() {
  const events = [
    {
      id: 1,
      title: 'Cabinet Meeting',
      date: 'July 25, 2026',
      time: '10:00 AM - 12:00 PM',
      location: 'State House',
      attendees: 24,
      status: 'Published',
    },
    {
      id: 2,
      title: 'Health Ministry Workshop',
      date: 'July 28, 2026',
      time: '2:00 PM - 4:30 PM',
      location: 'Ministry Headquarters',
      attendees: 45,
      status: 'Draft',
    },
    {
      id: 3,
      title: 'Community Health Forum',
      date: 'August 1, 2026',
      time: '9:00 AM - 11:30 AM',
      location: 'Regional Office',
      attendees: 60,
      status: 'Scheduled',
    },
  ];

  return (
    <div className="space-y-8 p-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[#003580]">Events</h1>
          <p className="mt-2 text-slate-600">Manage your ministry's meetings and public events</p>
        </div>
        <Link
          href="/administrative/events/new"
          className="flex items-center gap-2 rounded-[1.25rem] bg-[#003580] px-6 py-3 font-medium text-white shadow-[0_8px_16px_rgba(0,53,128,0.24)] transition-all hover:bg-[#002563] hover:shadow-[0_12px_24px_rgba(0,53,128,0.32)]"
        >
          <Plus className="h-5 w-5" />
          Create Event
        </Link>
      </div>

      {/* Events Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {events.map((event) => (
          <div
            key={event.id}
            className="group rounded-[1.75rem] border border-[#d3deef] bg-[#fafdff] p-6 shadow-[0_8px_24px_rgba(0,53,128,0.06)] transition-all hover:shadow-[0_16px_40px_rgba(0,53,128,0.12)] hover:border-[#003580]/30"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="font-semibold text-[#003580]">{event.title}</h3>
                <div className="mt-4 space-y-2">
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <CalendarDays className="h-4 w-4" />
                    {event.date}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <MapPin className="h-4 w-4" />
                    {event.location}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Users className="h-4 w-4" />
                    {event.attendees} attendees
                  </div>
                </div>
              </div>
              <div>
                <span
                  className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${
                    event.status === 'Published'
                      ? 'bg-[#edf8f1] text-[#007236]'
                      : event.status === 'Draft'
                        ? 'bg-[#edf3fd] text-[#003580]'
                        : 'bg-[#fff8e5] text-[#8d6400]'
                  }`}
                >
                  {event.status}
                </span>
              </div>
            </div>
            <div className="mt-6 flex gap-3 border-t border-slate-200 pt-4">
              <button className="flex-1 rounded-lg bg-[#e2ecfa] px-3 py-2 text-sm font-medium text-[#003580] transition-colors hover:bg-[#d0ddf0]">
                Edit
              </button>
              <button className="flex-1 rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-200">
                View
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
