import React, { useState, useEffect } from 'react';
import VendorMode from './components/VendorMode';
import CustomerView from './components/CustomerView';

type Route =
  | { type: 'vendor' }
  | { type: 'customer'; carId: string }
  | { type: 'home' };

function parseHash(): Route {
  const hash = window.location.hash;
  if (hash.startsWith('#/car/')) {
    const carId = hash.replace('#/car/', '');
    if (carId) return { type: 'customer', carId };
  }
  if (hash === '#/vendor' || hash === '#/') {
    return { type: 'vendor' };
  }
  // Default: show home/landing that redirects to vendor
  return { type: 'home' };
}

export default function App() {
  const [route, setRoute] = useState<Route>(parseHash());

  useEffect(() => {
    const handler = () => setRoute(parseHash());
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, []);

  // Home page — auto redirect to vendor
  if (route.type === 'home') {
    return (
      <div className="min-h-screen bg-surface flex flex-col items-center justify-center p-6 text-center">
        <div className="space-y-6 max-w-sm">
          {/* Logo */}
          <div>
            <h1 className="text-5xl font-black tracking-tight">
              <span className="text-brand">Snap</span>
              <span className="text-white">Merch</span>
            </h1>
            <p className="text-neutral-400 mt-2 text-lg">Instant Custom Car Merch</p>
          </div>

          {/* Tagline */}
          <div className="space-y-2">
            <p className="text-neutral-300 text-sm leading-relaxed">
              Snap a photo of any car → AI creates stunning art in 4 styles → 
              Customer picks products → Ships to their door.
            </p>
            <p className="text-brand text-sm font-semibold">
              Built for Cars & Coffee events ☕🏎️
            </p>
          </div>

          {/* CTA */}
          <div className="space-y-3 pt-4">
            <a
              href="#/vendor"
              className="block w-full py-4 rounded-2xl bg-gradient-to-r from-brand to-brand-dark text-white font-bold text-lg 
                shadow-lg shadow-brand/30 active:scale-[0.98] transition-all text-center"
            >
              📸 Start Vendor Mode
            </a>
          </div>

          {/* Branding */}
          <p className="text-neutral-600 text-xs pt-4">
            Powered by MyRestoMod · AI-generated car art
          </p>
        </div>
      </div>
    );
  }

  if (route.type === 'customer') {
    return <CustomerView carSessionId={route.carId} />;
  }

  return <VendorMode />;
}
