import React from 'react';
import type { EventSession, CarSession, SnapMerchStyle } from '../types';

interface EventDashboardProps {
  session: EventSession;
  onSelectCar: (carId: string) => void;
  onShareCar: (carId: string) => void;
  onNewSession: () => void;
}

export default function EventDashboard({ session, onSelectCar, onShareCar, onNewSession }: EventDashboardProps) {
  const carsToday = session.cars.length;
  const ordersToday = session.cars.reduce((sum, car) => sum + car.orders.length, 0);

  return (
    <div className="px-4 py-3 space-y-4">
      {/* Stats header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-white font-bold text-xl">{session.name}</h2>
          <p className="text-neutral-400 text-sm">{new Date(session.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
        </div>
        <button
          onClick={onNewSession}
          className="text-xs text-neutral-500 hover:text-brand transition-colors"
        >
          Reset
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-surface-card border border-surface-border rounded-xl p-3 text-center">
          <div className="text-brand text-2xl font-black">{carsToday}</div>
          <div className="text-neutral-400 text-xs">Cars</div>
        </div>
        <div className="bg-surface-card border border-surface-border rounded-xl p-3 text-center">
          <div className="text-electric text-2xl font-black">
            {session.cars.filter(c => c.styles.some(s => s.status === 'done')).length}
          </div>
          <div className="text-neutral-400 text-xs">Designs</div>
        </div>
        <div className="bg-surface-card border border-surface-border rounded-xl p-3 text-center">
          <div className="text-green-400 text-2xl font-black">{ordersToday}</div>
          <div className="text-neutral-400 text-xs">Orders</div>
        </div>
      </div>

      {/* Car list */}
      {carsToday === 0 ? (
        <div className="text-center py-12 space-y-3">
          <div className="text-5xl">📸</div>
          <p className="text-neutral-400">No cars yet today</p>
          <p className="text-neutral-500 text-sm">Snap your first car to get started!</p>
        </div>
      ) : (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider">
            Today's Cars
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {session.cars.map(car => (
              <CarCard
                key={car.id}
                car={car}
                onSelect={() => onSelectCar(car.id)}
                onShare={() => onShareCar(car.id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CarCard({ car, onSelect, onShare }: { car: CarSession; onSelect: () => void; onShare: () => void }) {
  const title = car.identity
    ? `${car.identity.year} ${car.identity.make} ${car.identity.model}`
    : 'Identifying...';
  const stylesReady = car.styles.filter(s => s.status === 'done').length;
  const thumbnail = car.photoThumbnail || car.photoBase64;
  const firstStyleImage = car.styles.find(s => s.status === 'done')?.imageUrl;

  return (
    <div className="bg-surface-card border border-surface-border rounded-xl overflow-hidden">
      {/* Thumbnail */}
      <div className="h-24 overflow-hidden cursor-pointer" onClick={onSelect}>
        <img
          src={firstStyleImage || thumbnail}
          alt={title}
          className="w-full h-full object-cover"
        />
      </div>

      <div className="p-2">
        <p className="text-white text-xs font-semibold truncate">{title}</p>
        <div className="flex items-center justify-between mt-1">
          <span className="text-neutral-500 text-[10px]">
            {stylesReady}/4 styles · {car.orders.length} orders
          </span>
          <button
            onClick={onShare}
            className="text-brand text-xs font-semibold hover:text-brand-light"
          >
            QR
          </button>
        </div>
      </div>
    </div>
  );
}
