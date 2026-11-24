// Visiting card shown inside a group chat when someone shares their My Card
// (GroupChatEmbedded.sendVisitingCard). It uses the same artwork as the My Card
// preview (card/HitCardArt) in the template the sender picked. The share is an
// ordinary text message with one prefixed line per field, so older clients still
// read it and no backend change is needed; this file builds and parses that text.
//
// Display only: no Call / Chat / Website / Save buttons by design.
import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, LayoutChangeEvent } from 'react-native';
import HitCardArt from '../card/HitCardArt';
import type { CardTemplate } from '../../lib/api';

// Line prefixes (emoji written as escapes so the file stays ASCII-safe).
const P = {
  name: '\uD83D\uDCC7 ',        // card
  designation: '\uD83D\uDCBC ', // briefcase
  company: '\uD83C\uDFE2 ',     // office
  phone: '\uD83D\uDCDE ',       // telephone
  address: '\uD83D\uDCCD ',     // pin
  url: '\uD83C\uDF10 ',         // globe: the public card link (also the QR)
  photo: '\uD83D\uDDBC ',       // framed picture
  website: '\uD83D\uDD17 ',     // link: the user's own website
  template: '\uD83C\uDFA8 ',    // palette: classic | dark | minimal
};

export interface SharedCardData {
  name: string;
  designation?: string;
  company?: string;
  phone?: string;
  address?: string;
  url?: string;
  photoUrl?: string;
  website?: string;
  template?: CardTemplate;
}

/** Builds the chat text for a shared card. Empty fields are left out. */
export function buildVisitingCardText(c: SharedCardData): string {
  const line = (prefix: string, v?: string) => (v && v.trim() ? prefix + v.trim() : '');
  return [
    line(P.name, c.name),
    line(P.designation, c.designation),
    line(P.company, c.company),
    line(P.phone, c.phone),
    line(P.website, c.website),
    line(P.address, c.address),
    line(P.url, c.url),
    line(P.photo, c.photoUrl),
    line(P.template, c.template),
  ].filter(Boolean).join('\n');
}

/** Returns the card when `content` is a shared visiting card, else null. */
export function parseVisitingCardText(content?: string | null): SharedCardData | null {
  if (!content || !content.startsWith(P.name)) return null;
  const out: SharedCardData = { name: '' };
  for (const raw of content.split('\n')) {
    const l = raw.trimEnd();
    if (l.startsWith(P.name)) out.name = l.slice(P.name.length).trim();
    else if (l.startsWith(P.designation)) out.designation = l.slice(P.designation.length).trim();
    else if (l.startsWith(P.company)) out.company = l.slice(P.company.length).trim();
    else if (l.startsWith(P.phone)) out.phone = l.slice(P.phone.length).trim();
    else if (l.startsWith(P.address)) out.address = l.slice(P.address.length).trim();
    else if (l.startsWith(P.url)) out.url = l.slice(P.url.length).trim();
    else if (l.startsWith(P.photo)) out.photoUrl = l.slice(P.photo.length).trim();
    else if (l.startsWith(P.website)) out.website = l.slice(P.website.length).trim();
    else if (l.startsWith(P.template)) {
      const tpl = l.slice(P.template.length).trim();
      if (tpl === 'classic' || tpl === 'dark' || tpl === 'minimal') out.template = tpl;
    }
  }
  // A real share always carries the public link; this keeps ordinary messages
  // that merely begin with the card emoji as plain text.
  if (!out.name || !out.url || !/^https?:\/\/[^\s]+\/card\//.test(out.url)) return null;
  return out;
}

const SharedVisitingCard = React.memo(function SharedVisitingCard({
  card, isMe, onLongPress, hint,
}: {
  card: SharedCardData;
  isMe: boolean;
  onLongPress?: () => void;
  hint?: string;
}) {
  const [w, setW] = useState(300);
  const onLayout = (e: LayoutChangeEvent) => {
    const next = Math.round(e.nativeEvent.layout.width);
    if (next > 0 && next !== w) setW(next);
  };
  return (
    <View style={[{ flexDirection: 'row' }, isMe ? { justifyContent: 'flex-end' } : { justifyContent: 'flex-start' }]}>
      <View style={{ width: '92%', maxWidth: 340 }} onLayout={onLayout}>
        <Pressable onLongPress={onLongPress} delayLongPress={400} accessibilityHint={hint}>
          <HitCardArt
            template={card.template || 'classic'}
            name={card.name}
            designation={card.designation}
            company={card.company}
            phone={card.phone}
            website={card.website}
            address={card.address}
            photoUrl={card.photoUrl}
            qrValue={card.url}
            width={w}
          />
        </Pressable>
        {!!hint && <Text style={s.hint}>Hold to delete</Text>}
      </View>
    </View>
  );
});

export default SharedVisitingCard;

const s = StyleSheet.create({
  hint: { fontSize: 9, color: '#6B8F7B', marginTop: 3, textAlign: 'right' },
});
