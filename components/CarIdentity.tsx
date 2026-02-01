import React, { useState } from 'react';
import type { CarIdentity as CarIdentityType } from '../types';
import { identifyColor } from '../services/api';

interface CarIdentityProps {
  identity: CarIdentityType;
  photoBase64?: string;
  onUpdate?: (updated: CarIdentityType) => void;
  locked?: boolean; // Hide edit button (e.g. during/after generation)
}

export default function CarIdentityCard({ identity, photoBase64, onUpdate, locked }: CarIdentityProps) {
  const [editing, setEditing] = useState(false);
  const [identifying, setIdentifying] = useState(false);
  const [year, setYear] = useState(identity.year);
  const [make, setMake] = useState(identity.make);
  const [model, setModel] = useState(identity.model);
  const [trim, setTrim] = useState(identity.trim || '');

  const title = `${identity.year} ${identity.make} ${identity.model}`;

  const handleSave = async () => {
    if (!onUpdate) return;

    // If year/make/model changed AND we have a photo, re-identify the paint color
    const identityChanged = year !== identity.year || make !== identity.make || model !== identity.model;
    let updatedColor = identity.color;

    if (identityChanged && photoBase64) {
      setIdentifying(true);
      try {
        updatedColor = await identifyColor(photoBase64, year, make, model);
      } catch {
        // Keep existing color if re-ID fails
      }
      setIdentifying(false);
    }

    onUpdate({ ...identity, year, make, model, trim, color: updatedColor });
    setEditing(false);
  };

  const handleCancel = () => {
    setYear(identity.year);
    setMake(identity.make);
    setModel(identity.model);
    setTrim(identity.trim || '');
    setEditing(false);
  };

  return (
    <div className="animate-slide-up bg-surface-card border border-surface-border rounded-2xl overflow-hidden">
      {/* Photo strip */}
      {photoBase64 && (
        <div className="h-24 overflow-hidden">
          <img
            src={photoBase64}
            alt={title}
            className="w-full h-full object-cover object-center"
          />
        </div>
      )}
      
      {editing ? (
        /* Edit mode */
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-4 gap-2">
            <div>
              <label className="text-[10px] text-neutral-500 uppercase tracking-wider font-semibold">Year</label>
              <input
                type="text"
                value={year}
                onChange={e => setYear(e.target.value)}
                className="w-full bg-surface-elevated border border-surface-border rounded-lg px-2 py-1.5 text-white text-sm focus:border-brand focus:outline-none"
                inputMode="numeric"
                maxLength={4}
              />
            </div>
            <div className="col-span-1">
              <label className="text-[10px] text-neutral-500 uppercase tracking-wider font-semibold">Make</label>
              <input
                type="text"
                value={make}
                onChange={e => setMake(e.target.value)}
                className="w-full bg-surface-elevated border border-surface-border rounded-lg px-2 py-1.5 text-white text-sm focus:border-brand focus:outline-none"
              />
            </div>
            <div className="col-span-2">
              <label className="text-[10px] text-neutral-500 uppercase tracking-wider font-semibold">Model</label>
              <input
                type="text"
                value={model}
                onChange={e => setModel(e.target.value)}
                className="w-full bg-surface-elevated border border-surface-border rounded-lg px-2 py-1.5 text-white text-sm focus:border-brand focus:outline-none"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={identifying}
              className="flex-1 py-2 rounded-xl bg-brand text-white text-sm font-bold active:scale-95 transition-transform disabled:opacity-60"
            >
              {identifying ? '🎨 Matching color...' : '✓ Save'}
            </button>
            <button
              onClick={handleCancel}
              className="px-4 py-2 rounded-xl bg-surface-elevated text-neutral-400 text-sm font-medium active:scale-95 transition-transform"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        /* Display mode */
        <div className="p-4 flex items-center gap-3">
          {/* Color swatch */}
          <div
            className="w-10 h-10 rounded-full border-2 border-white/20 shadow-md flex-shrink-0"
            style={{ backgroundColor: identity.color?.hex || '#666' }}
            title={identity.color?.name || 'Unknown'}
          />
          
          <div className="flex-1 min-w-0">
            <h2 className="text-white font-bold text-lg truncate">{title}</h2>
            <p className="text-neutral-400 text-sm">
              {identity.trim && identity.trim !== 'Standard' && identity.trim !== 'N/A' 
                ? `${identity.trim} · ` : ''}
              {identity.color?.name || 'Unknown Color'}
            </p>
          </div>

          {/* Edit button — hidden once generation starts */}
          {onUpdate && !locked && (
            <button
              onClick={() => setEditing(true)}
              className="flex-shrink-0 bg-surface-elevated text-neutral-400 hover:text-white px-2.5 py-1.5 rounded-full text-xs font-medium transition-colors active:scale-95"
            >
              ✏️ Edit
            </button>
          )}

          {/* Verified badge */}
          <div className="flex-shrink-0 bg-brand/20 text-brand px-2 py-1 rounded-full text-xs font-semibold">
            ✓ ID'd
          </div>
        </div>
      )}
    </div>
  );
}
