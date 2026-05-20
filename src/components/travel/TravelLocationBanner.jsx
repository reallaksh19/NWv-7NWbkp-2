import React from 'react';
import './TravelLocationBanner.css';

export default function TravelLocationBanner({ profile }) {
  if (!profile?.enabled || !profile?.prioritizeStories) return null;

  return (
    <section className="travel-location-banner" data-travel-location-banner="true">
      <div className="travel-location-banner__icon">{profile.icon || '📍'}</div>
      <div className="travel-location-banner__copy">
        <strong>{profile.display}</strong>
        <span>
          Prioritising {profile.countryLabel} local stories · {profile.source}
        </span>
      </div>
    </section>
  );
}
