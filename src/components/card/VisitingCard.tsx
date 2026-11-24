// Visiting card renderer used by the My Card screen: the large live preview,
// the three template thumbnails, and the View that shareCardPng() captures.
//
// The artwork itself lives in HitCardArt (shared with the card posted in group
// chat); this file only maps the saved card data onto it. Sizes are designed at
// 320 px wide and scaled to `width`, so the same layout works as a thumbnail.
import React, { forwardRef } from 'react';
import { View } from 'react-native';
import HitCardArt from './HitCardArt';
import type { CardTemplate, VisitingCardData } from '../../lib/api';

export const CARD_TEMPLATES: { key: CardTemplate; label: 'Classic' | 'Dark' | 'Minimal' }[] = [
  { key: 'classic', label: 'Classic' },
  { key: 'dark', label: 'Dark' },
  { key: 'minimal', label: 'Minimal' },
];

const BASE_W = 320;

interface Props {
  card: VisitingCardData;
  template: CardTemplate;
  /** Public card URL. The QR is only drawn when this is set (i.e. published). */
  qrValue?: string;
  width?: number;
}

const clean = (v: string | null | undefined) => String(v ?? '').trim();

const VisitingCard = forwardRef<View, Props>(function VisitingCard({ card, template, qrValue, width = BASE_W }, ref) {
  const a = card.address || ({} as VisitingCardData['address']);
  const address = [a.line, a.city, a.state, a.pinCode].map(clean).filter(Boolean).join(', ');
  // Same image order the card always used: company logo first, then the photo.
  const photoUrl = card.logoUrl || card.photoUrl || null;

  return (
    <HitCardArt
      ref={ref}
      template={template}
      name={clean(card.name)}
      designation={clean(card.designation)}
      company={clean(card.companyName)}
      phone={clean(card.phone)}
      website={clean(card.website)}
      address={address}
      photoUrl={photoUrl}
      qrValue={qrValue}
      width={width}
    />
  );
});

export default VisitingCard;
