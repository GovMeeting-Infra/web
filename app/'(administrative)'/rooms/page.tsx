'use client';

import { Plus, MapPin, Users2, Calendar } from 'lucide-react';
import Link from 'next/link';

export default function RoomsPage() {
  const rooms = [
    {
      id: 1,
      name: 'Main Conference Hall',
      location: 'State House, 1st Floor',
      capacity: 150,
      bookings: 8,
    },
    {
      id: 2,
      name: 'Board Room A',
      location: 'Ministry Headquarters, 2nd Floor',
      capacity: 25,
      bookings: 12,
    },
    {
      id: 3,
      name: 'Training Center',
      location: 'Regional Office',
      capacity: 80,
      bookings: 5,
    },
  ];

  return (
    <div className="space-y-8 p-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[#003580]">Room Bookings</h1>
          <p className="mt-2 text-slate-600">Manage ministry facilities and meeting rooms</p>
        </div>
        <button className="flex items-center gap-2 rounded-[1.25rem] bg-[#003580] px-6 py-3 font-medium text-white shadow-[0_8px_16px_rgba(0,53,128,0.24)] transition-all hover:bg-[#002563] hover:shadow-[0_12px_24px_rgba(0,53,128,0.32)]">
          <Plus className="h-5 w-5" />
          Book Room
        </button>
      </div>

      {/* Rooms Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {rooms.map((room) => (
          <div
            key={room.id}
            className="group rounded-[1.75rem] border border-[#d3deef] bg-[#fafdff] p-6 shadow-[0_8px_24px_rgba(0,53,128,0.06)] transition-all hover:shadow-[0_16px_40px_rgba(0,53,128,0.12)]"
          >
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-[#e2ecfa]">
              <MapPin className="h-6 w-6 text-[#003580]" />
            </div>
            <h3 className="font-semibold text-[#003580]">{room.name}</h3>
            <p className="mt-2 text-sm text-slate-600">{room.location}</p>
            <div className="mt-4 space-y-2 border-t border-slate-200 pt-4">
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Users2 className="h-4 w-4" />
                Capacity: {room.capacity} people
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Calendar className="h-4 w-4" />
                {room.bookings} bookings this month
              </div>
            </div>
            <button className="mt-4 w-full rounded-lg bg-[#e2ecfa] px-3 py-2 text-sm font-medium text-[#003580] transition-colors hover:bg-[#d0ddf0]">
              View Availability
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
