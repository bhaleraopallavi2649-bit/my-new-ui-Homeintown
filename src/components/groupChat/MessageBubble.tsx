import React, { useEffect, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, Animated, Image, Linking } from 'react-native';
import {
  Building2, MapPin, BadgeCheck, CheckCircle2, ChevronDown, ChevronUp, FileText,
  ArrowRight, Eye, Users,
} from '../../icons';
import type { GroupMessage, InventoryCard } from '../../lib/api';
import { colors } from '../../theme';
import { useToast } from '../Toast';
import { messageClock, fmtPrice } from '../../lib/groupChat/formatting';
import { cleanAreaText } from '../../lib/displayText';
// Decision 2b: no fake stock photos. The friend's version imported photoFor()
// from lib/propertyPhotos to fill an empty cover with a random bundled photo;
// that is misleading in a real-estate app, so we never port propertyPhotos.ts
// and instead render this neutral peach/cream tile at the photo slot.
import PropertyCoverPlaceholder from '../PropertyCoverPlaceholder';
import BuilderAvatar from '../placeholders/BuilderAvatar';
import PhotoCard from '../PhotoCard';
import { isProjectSummaryMessage } from '../../lib/groupChat/messages';
import { unitStatusMeta } from '../../lib/groupChat/unitSummaries';
import { isSafeHttpUrl } from '../../lib/safeUrl';
import type { UnitDayGroup } from '../../lib/groupChat/unitSummaries';
import Tag from './Tag';
import CardActions from './CardActions';
import GroupMatchCard from './GroupMatchCard';

// ── Message bubble ──
// Memoised: without this, every keystroke in the composer (whose state lives in
// GroupChatEmbedded) re-rendered every visible bubble in the thread.
const MessageBubble = React.memo(function MessageBubble({ 
  msg, meId, onInterested, onPropertyViewDetails, onPropertyCall, onJoinPropertyGroup, onArrowPress, onViewGroupInfo, onViewProperty, joinedProjectIds, groupProjectIds, onPreviewMatch, onDeleteMessage, canModerate, projectId, highlighted, readOnly, onInventoryCardChat,
  unitDay, unitDayExpanded, setExpandedUnitDates
}: {
  readOnly?: boolean;
  /** Chat button on Lead Match inventory cards. */
  onInventoryCardChat?: () => void;
  msg: GroupMessage; 
  meId: string; 
  onInterested: (projectId: string, messageId: string) => void;
  onPropertyViewDetails: (projectId: string, fallback?: InventoryCard, sourceMessageId?: string) => void;
  onPropertyCall: (projectId: string, fallbackNumber?: string, posterPhone?: string) => void;
  onJoinPropertyGroup: (projectId: string) => void;
  onArrowPress: (projectId: string, inv: InventoryCard, msgId: string) => void;
  onViewGroupInfo: (projectId: string, inv: InventoryCard, joined: boolean) => void;
  /** "View Property" — opens the Project map section for this property. */
  onViewProperty: (projectId: string, inv: InventoryCard) => void;
  /** Set of projectIds whose groups the current user has already joined. */
  joinedProjectIds: Set<string>;
  /** projectIds that have their own (individual) group, joined or not. */
  groupProjectIds?: Set<string>;
  onPreviewMatch: (match: any) => void;
  onDeleteMessage: (msg: GroupMessage) => void;
  /** True when this user may remove other people's media in this room. */
  canModerate: boolean;
  projectId: string;
  highlighted: boolean;
  /**
   * This message's day group, present ONLY on the first unit_update of a local
   * day; every later one gets undefined and renders nothing. Built once by the
   * parent (buildUnitDayGroups), never derived here — see the parent's memo.
   */
  unitDay?: UnitDayGroup;
  /** Whether this bubble's own day is expanded. A boolean, not the whole Set. */
  unitDayExpanded: boolean;
  /** Toggle a date's expanded state (a useState setter, so already stable). */
  setExpandedUnitDates: React.Dispatch<React.SetStateAction<Set<string>>>;
}) {
  // Toast context moved inside MessageBubble to avoid breaking memo on every
  // parent render. The ToastProvider returns { show, success, error } where
  // each method is stable (useCallback), but the wrapper object is created
  // fresh each render, so passing it as a prop broke memoization.
  const toast = useToast();
  const isMe = msg.sender.id === meId;

  if (msg.messageType === 'system') {
    // Was `msg.content?.startsWith('📋 Project:')`, which matched nothing — the
    // server's first line is `📋 <projectName>`. See isProjectSummaryMessage for
    // why BOTH the flag and the `^📋` fallback are needed, and for the list of
    // system messages that deliberately keep rendering.
    if (isProjectSummaryMessage(msg)) return null;
    return <Text style={mbs.system}>{msg.content}</Text>;
  }

  // Unit status auto-message (server posts it on every PATCH that changes a
  // status). Without this branch it fell through to a plain text bubble that
  // One compact summary pill per local day of unit updates, tap to expand.
  //
  // Previous behaviour, in two layers of wrong:
  //  1. Before the summaries, EVERY unit_update drew its own pill — 20 updates
  //     meant 20 pills ("A101 · Booked", "A102 · Vacant", …) flooding the thread.
  //  2. The first summary attempt then computed the grouping HERE: each bubble
  //     filtered the whole `messages` array to find its day-mates and to decide
  //     whether it was that day's first. That is O(n²) over the thread, redone on
  //     every render of every memoised bubble, so one composer keystroke re-ran
  //     the lot. It also keyed on UTC dates — see localDateKey.
  // The grouping now arrives as a prop from one memo in the parent.
  //
  // The `&& msg.unitUpdate` conjunct stays (design review #3): a malformed
  // unit_update with no payload must keep falling through to a plain text bubble
  // rather than being swallowed here.
  if (msg.messageType === 'unit_update' && msg.unitUpdate) {
    // No group means this is not the day's first update; it is already counted in
    // that day's pill. Same visible result as the old `isFirst` check, without
    // the scan.
    if (!unitDay) return null;

    return (
      <View style={mbs.unitDaySummary}>
        {/* Summary pill */}
        <Pressable
          onPress={() => {
            setExpandedUnitDates(prev => {
              const next = new Set(prev);
              if (next.has(unitDay.dateKey)) next.delete(unitDay.dateKey);
              else next.add(unitDay.dateKey);
              return next;
            });
          }}
          style={mbs.unitDayPill}
          accessibilityRole="button"
          accessibilityLabel={`Unit updates for ${unitDay.dateLabel}. Tap to ${unitDayExpanded ? 'collapse' : 'expand'}`}
        >
          <Text style={mbs.unitDayLabel}>{unitDay.dateLabel}:</Text>
          <View style={mbs.unitDayStats}>
            {unitDay.segments.map(p => (
              <View key={p.key} style={mbs.unitDaySeg}>
                <View style={[mbs.unitDot, { backgroundColor: p.color, marginRight: 4 }]} />
                <Text style={mbs.unitDayStatText}>
                  <Text style={{ fontWeight: '700' }}>{p.count}</Text> {p.label}
                </Text>
              </View>
            ))}
          </View>
          {/* marginLeft here, not a `gap` on the pill — see mbs.unitDayPill. */}
          {unitDayExpanded
            ? <ChevronUp size={16} color={colors.muted} style={{ marginLeft: 6 }} />
            : <ChevronDown size={16} color={colors.muted} style={{ marginLeft: 6 }} />}
        </Pressable>
        
        {/* Expanded list */}
        {unitDayExpanded && (
          <View style={mbs.unitDayExpanded}>
            {unitDay.items.map((m, i) => {
              const u = m.unitUpdate!;
              // unitStatusMeta, not statusMeta: an unknown status key must show
              // its own name, not be relabelled "Vacant" (design review #8).
              const meta = unitStatusMeta(u.toStatus);
              return (
                <Pressable
                  key={`${m.id}-${i}`}
                  onPress={() => u.project && onPropertyViewDetails(u.project)}
                  style={mbs.unitExpandedItem}
                  accessibilityRole="button"
                >
                  <View style={[mbs.unitDot, { backgroundColor: meta.color }]} />
                  <Text style={mbs.unitExpandedText} numberOfLines={1}>
                    <Text style={{ fontWeight: '700' }}>{u.label}</Text>
                    {' · '}
                    <Text style={{ fontWeight: '700', color: meta.color }}>{meta.label}</Text>
                    {u.updatedByName ? ` · by ${u.updatedByName}` : ''}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </View>
    );
  }

  // Site visit arrival / completion, posted BY THE SERVER when an agent's phone
  // crosses the project geofence and again once they have dwelled there.
  //
  // Previous behaviour: the collaborator's build had the CLIENT post this as
  // `messageType: 'text'` with an emoji blob in `content`. That could not be
  // styled, filtered or counted, and any client could forge it. The snapshot now
  // comes from the server (GroupMessage.siteVisit), so the card cannot be faked
  // and stays readable after the lead is renamed or the project edited.
  //
  // Same `&& msg.siteVisit` conjunct as unit_update above: a malformed payload
  // must keep falling through to a plain text bubble rather than vanishing here.
  if (msg.messageType === 'site_visit' && msg.siteVisit) {
    const sv = msg.siteVisit;
    const done = sv.kind === 'completed';
    // Palette per the established card spec: white card on colors.line with
    // brand-orange accents. Completion keeps the green tick because, like the
    // status pills, it carries meaning — the visit actually happened.
    const accent = done ? colors.greenText : colors.brand;
    const when = messageClock(done ? (sv.completedAt || msg.createdAt) : (sv.arrivedAt || msg.createdAt));

    return (
      <View style={[mbs.cardWrap, { alignSelf: 'center' }]}>
        <Pressable
          onPress={() => sv.project && onPropertyViewDetails(sv.project)}
          style={mbs.visitCard}
          accessibilityRole="button"
          accessibilityLabel={`${done ? 'Site visit completed' : 'Arrived'} at ${sv.projectName || 'the site'}. Tap to open the project.`}
        >
          <View style={mbs.visitHeaderRow}>
            {done
              ? <CheckCircle2 size={15} color={accent} />
              : <MapPin size={15} color={accent} />}
            <Text style={[mbs.visitTag, { color: accent }]} numberOfLines={1}>
              {done ? 'Site visit completed' : 'Arrived on site'}
            </Text>
            {when ? <Text style={mbs.visitClock}>{when}</Text> : null}
          </View>

          <Text style={mbs.visitProject} numberOfLines={1}>{sv.projectName || 'the site'}</Text>
          <Text style={mbs.visitSub} numberOfLines={2}>
            {`with ${sv.leadName || 'a client'}`}
            {sv.performedByName ? ` · by ${sv.performedByName}` : ''}
          </Text>

          {/* `dwellMinutes` is undefined when the server never measured a dwell,
              which is NOT the same as a 0-minute visit — so the line is omitted
              rather than printing "0 min on site". */}
          {done && typeof sv.dwellMinutes === 'number' ? (
            <Text style={[mbs.visitDwell, { color: accent }]}>{`${sv.dwellMinutes} min on site`}</Text>
          ) : null}
        </Pressable>
      </View>
    );
  }

  // Project announcement. GroupMessage has supported this type on the server for
  // a while, but MessageBubble had NO branch, so an announcement rendered as a
  // stray grey text bubble. site_visit is deliberately not being left in the same
  // state, so the gap is closed in the same change.
  //
  // Minimal and honest: the snapshot carries far more (cover image, price, BHK,
  // RERA, builder identity) but only the title, location and a tap-through are
  // drawn, rather than inventing a richer card than anyone asked for.
  if (msg.messageType === 'project_announcement' && msg.projectAnnouncement) {
    const pa = msg.projectAnnouncement;
    const where = [pa.location, pa.city].filter(Boolean).join(', ');

    return (
      <View style={[mbs.cardWrap, { alignSelf: 'center' }]}>
        <Pressable
          onPress={() => pa.project && onPropertyViewDetails(pa.project)}
          style={mbs.visitCard}
          accessibilityRole="button"
          accessibilityLabel={`Project ${pa.projectName || 'announcement'}. Tap to open the project.`}
        >
          <View style={mbs.visitHeaderRow}>
            <Building2 size={15} color={colors.brand} />
            <Text style={[mbs.visitTag, { color: colors.brand }]} numberOfLines={1}>New project</Text>
            <Text style={mbs.visitClock}>{messageClock(msg.createdAt)}</Text>
          </View>
          <Text style={mbs.visitProject} numberOfLines={1}>{pa.projectName || 'Project'}</Text>
          {where ? <Text style={mbs.visitSub} numberOfLines={1}>{where}</Text> : null}
        </Pressable>
      </View>
    );
  }

  if (msg.messageType === 'inventory_card' && msg.inventoryCard) {
    const inv = msg.inventoryCard;
    // AI Match Found card — posted from the private AI Assist for the whole group.
    // This is a matching RESULT, so it carries the same two actions as a match
    // row. It previously returned with no actions at all, which meant a shared
    // match could be seen but not opened or joined. No Call: these cards are
    // posted by the sharer, not the property owner, so there is no poster phone.
    if (inv.aiMatch) {
      const matchRef = inv.project;
      const matchProjectId = typeof matchRef === 'string'
        ? matchRef
        : String(matchRef?._id || matchRef?.id || projectId || '');

      return (
        <View style={[mbs.cardWrap, { alignSelf: 'flex-start' }]}>
          {/* Warm-port (decision 1a): was a solid brandTint card. The reference
              reskins match cards to a warm cream surface on a soft beige border;
              the brand-orange accent stays on the label, and the Join Group /
              View Details actions are unchanged. */}
          <View style={[mbs.card, { backgroundColor: '#FFFFFF', borderColor: '#F6ECDD' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={[mbs.cardTag, { color: colors.brand }]}>🎯 AI Match Found · {msg.sender.name}</Text>
              {inv.score ? <Text style={[mbs.cardTag, { color: colors.brand }]}>{Math.round(inv.score)}%</Text> : null}
            </View>
            <Text style={mbs.cardMain}>{inv.projectName || 'Project'}</Text>
            {(inv.area || inv.city) ? <Text style={mbs.cardSub}>📍 {[inv.area, inv.city].filter(Boolean).join(', ')}</Text> : null}

            <CardActions
              tone="brand"
              actions={[
                // Lead Match feed (readOnly): no Join Group; just View Details.
                { key: 'details', label: 'View Details', icon: 'details', ghost: true, onPress: () => onPropertyViewDetails(matchProjectId, inv) },
                ...(!readOnly ? [{ key: 'join' as const, label: 'Join Group', icon: 'join' as const, onPress: () => onJoinPropertyGroup(matchProjectId) }] : []),
              ]}
            />
          </View>
        </View>
      );
    }

    
    // Compact universal-group inventory card. All values below come from the
    // stored card/project — no raw AI questionnaire and no role-based guesses.
    const senderName = msg.sender.name || 'Unknown';
    const isVerified = msg.sender.isVerified === true ||
      msg.sender.verificationStatus?.builder === 'verified';

    // Highlight animation for auto-scroll-to-message
    // Lazy initialization ensures Animated.Value is created only once, not on
    // every render. The previous pattern (useRef(new Animated.Value(0)).current)
    // ran the initializer every time the component rendered.
    const highlightAnimRef = useRef<Animated.Value | null>(null);
    if (!highlightAnimRef.current) {
      highlightAnimRef.current = new Animated.Value(0);
    }
    const highlightAnim = highlightAnimRef.current;

    useEffect(() => {
      // Only animate when highlighted becomes true. Without this guard, the
      // animation would restart whenever highlighted changed (even false→false),
      // or if a different message was highlighted mid-animation, causing a flash.
      if (highlighted) {
        Animated.sequence([
          Animated.timing(highlightAnim, { toValue: 1, duration: 300, useNativeDriver: false }),
          Animated.timing(highlightAnim, { toValue: 1, duration: 1900, useNativeDriver: false }),
          Animated.timing(highlightAnim, { toValue: 0, duration: 300, useNativeDriver: false }),
        ]).start();
      }
    }, [highlighted, highlightAnim]);

    const bgColor = highlightAnim.interpolate({
      inputRange: [0, 1],
      // Warm-port: resting colour is the card's own cream (opaque) instead of a
      // transparent amber, so the reskinned card always reads as a filled cream
      // surface; the amber highlight fades in on top for the scroll-to animation.
      outputRange: ['rgba(255, 255, 255, 0.78)', 'rgba(231, 240, 234, 0.95)'],
    });

    // Actions must use the card's stable project id. Falling back to the active
    // room project made every universal-room card use an empty id, and made every
    // project-room card act on the room project even when it represented
    // something else.
    const projectRef = inv.project;
    const cardProjectId = typeof projectRef === 'string'
      ? projectRef
      : String(projectRef?._id || projectRef?.id || projectId || '');

    // Populated project (present on cards that reference a real project) gives
    // the card a cover image and a reliable name.
    const projObj = typeof projectRef === 'object' && projectRef ? projectRef : undefined;
    const coverUrl = projObj?.media?.coverImage?.url || '';
    const title = inv.projectName || projObj?.projectName || 'Property';

    const price = inv.priceRange?.min ? fmtPrice(inv.priceRange.min * 100000) : '';
    const priceMax = inv.priceRange?.max ? fmtPrice(inv.priceRange.max * 100000) : '';
    const priceText = price && priceMax && priceMax !== price ? `${price} – ${priceMax}` : price;

    // Older cards sometimes stored "1000 sqft" in `area` even though the schema
    // called that field a locality. Detect it so the UI puts it on the details
    // line instead of rendering "📍 1000 sqft, Nagpur".
    const areaLooksLikeSize = !!inv.area && /\d[\d,.]*\s*(?:sq\.?\s*ft|sqft|acre)/i.test(inv.area);
    const locality = areaLooksLikeSize ? '' : (inv.area || '');
    const location = [locality, inv.city].filter(Boolean).join(', ');
    // Previous behaviour: `inv.carpetAreaRange || ...` kept a literal "undefined"
    // string (it is non-empty, so `||` did not fall through), and the `!!areaText`
    // guards in the JSX below passed on it — so the peach info pill read
    // "undefined". cleanAreaText collapses those placeholders to '' so the pill is
    // omitted. The size-in-locality fallback (inv.area) is sanitised the same way.
    const areaText = cleanAreaText(inv.carpetAreaRange) || (areaLooksLikeSize ? cleanAreaText(inv.area) : '');
    const bhk = inv.bhkOptions?.filter(Boolean).join(' / ') || '';
    const propertyType = inv.propertyType || '';

    // Reference card title: "<BHK> Available" (e.g. "2 BHK Available"). Falls back
    // to the property type, then the project name, then a generic label — so a
    // card with no BHK still reads sensibly.
    const headline = bhk ? `${bhk} Available`
      : propertyType ? `${propertyType} Available`
      : (inv.projectName || title);

    // One-line sentence under the title, e.g.
    // "2 BHK flat available for sale in Nagpur". Uses the poster's free-text
    // description when present (trimmed to one line); otherwise it is built from
    // the structured fields so every card has a readable summary.
    const saleWord = rentedOrSale();
    function rentedOrSale() {
      return /\b(rent|rental|lease|kiraya|किराया)\b/i.test(inv.description || '') ? 'for rent' : 'for sale';
    }
    const kind = (propertyType || 'property').toLowerCase();
    const cityWord = inv.city || '';
    const autoDesc = [
      [bhk, kind].filter(Boolean).join(' '),
      'available',
      saleWord,
      cityWord ? `in ${cityWord}` : '',
    ].filter(Boolean).join(' ');
    const descLine = (inv.description || '').trim().split(/\n/)[0] || autoDesc;

    // Location line now also carries the carpet area, reference style:
    // "Nagpur · 500 sqft".
    const locAreaText = cleanAreaText(inv.carpetAreaRange) || (areaLooksLikeSize ? cleanAreaText(inv.area) : '');
    const locationLine = [location, locAreaText].filter(Boolean).join(' · ');

    // Warm-port: the old single "💰 price | area | type" money line is gone. The
    // reference shows the price large on its own (propertyPrice) and the area in
    // the peach info pill, so priceText and areaText are consumed directly in the
    // JSX below. propertyType / bhk are no longer drawn on the compact card; they
    // stay computed above for the detail sheet / future use.

    const possessionLabel = inv.possessionStatus === 'ready' ? 'Ready' :
      inv.possessionStatus === '6months' ? '6 Months' :
      inv.possessionStatus === '1year' ? '1 Year' :
      inv.possessionStatus === '2year+' ? '2+ Years' :
      inv.possessionStatus ? String(inv.possessionStatus).replace(/[-_]/g, ' ') : '';

    // Urgency pill is shown ONLY for urgent / very-urgent listings now; a
    // "Normal Urgency" badge carried no information and cluttered the card, so
    // normal urgency renders no pill at all (user request).
    const urgencyLabel = inv.urgency === 'urgent' ? 'Urgent' :
      inv.urgency === 'very_urgent' ? 'Very Urgent' : '';

    // Listing-type label on the card (was the generic "Inventory"). The inventory
    // card schema has no explicit sale/rent flag, so we infer "For Rent" from a
    // rent hint in the free-text description and default everything else to
    // "For Sale" — which is what a posted inventory listing is.
    const rentHinted = /\b(rent|rental|lease|kiraya|किराया)\b/i.test(inv.description || '');
    const listingLabel = rentHinted ? 'For Rent' : 'For Sale';

    const extraTags = [
      inv.bankLoanAvailable ? '🏦 Loan' : '',
      inv.commissionPercent ? `💼 ${inv.commissionPercent}%` : '',
    ].filter(Boolean);

    // Photo-count badge ("1/N") shown on the thumbnail. N is the real gallery
    // size (+ cover) when the populated project carried its gallery. If the card
    // has no populated project or no gallery, no badge is drawn rather than
    // printing "1/1" for a project that actually has many photos. This never
    // invents a photo — the badge only appears when a real cover exists.
    // `galleryImages` is one of the optional wire fields the project type does
    // not always declare (inv.project is a union whose lighter arm only carries
    // media.coverImage), so it is read through a cast — the same pattern the rest
    // of the file uses for such fields. Never fabricates: no cover → no badge.
    const galleryArr = (projObj?.media as any)?.galleryImages;
    const galleryCount = Array.isArray(galleryArr) ? galleryArr.length : 0;
    const photoCount = coverUrl ? (galleryCount > 0 ? galleryCount + 1 : 1) : 0;

    // Membership check — used for the View Group / Join Group CTA row on the card.
    const isJoined = !!cardProjectId && joinedProjectIds.has(cardProjectId);

    // Card tap: check membership first.
    // • cardProjectId present + already joined → open the group thread directly.
    // • cardProjectId present + not joined     → show property details + "Join Group" sheet.
    // • cardProjectId missing                  → show property details + "Join Group" sheet
    //   (onArrowPress handles the empty-id case by showing the sheet without a join action).
    const openCard = () => {
      onArrowPress(cardProjectId, inv, msg.id);
    };

    // Shared reference-style photo card (same as Projects / Marketplace).
    // Tap → Property Details (with Join Group / Group Chat inside).
    const bedsChip = (() => {
      const n = (inv.bhkOptions || []).map(o => parseInt(String(o), 10)).filter(x => !isNaN(x)).sort((a, b) => a - b);
      if (!n.length) return '';
      return n.length === 1 ? `${n[0]} Beds` : `${n[0]}-${n[n.length - 1]} Beds`;
    })();
    const typeWord = (propertyType || (projObj as any)?.propertyType || 'Property').toUpperCase();
    const cardTag = ['HOME IN TOWN', typeWord, rentHinted ? 'RENT' : ''].filter(Boolean).join(' · ');
    const cardTitle = [inv.projectName || projObj?.projectName, bhk].filter(Boolean).join(' ') || headline;
    const usePhotoCard = true; // legacy layout below kept for reference only
    if (usePhotoCard) {
      // Everything the card knows. Each field falls back from the posted card, to
      // the linked project, to the poster's own description text — never invented.
      const po: any = projObj || {};
      const desc = (inv.description || '').replace(/\s+/g, ' ').trim();
      const firstLine = (inv.description || '').trim().split(/\n/)[0] || '';

      // Type: Flat / Apartment / Plot … (this is the card heading).
      const rawType = String(
        propertyType || po.propertyType || po.category ||
        (desc.match(/\b(flat|apartment|plot|land|villa|bungalow|row ?house|shop|office|commercial|penthouse|studio)\b/i)?.[1] || '')
      );
      const typeLabel = (() => {
        const t = rawType.toLowerCase();
        if (!t) return '';
        if (/flat/.test(t)) return 'Flat';
        if (/apart/.test(t)) return 'Apartment';
        if (/plot|land/.test(t)) return 'Plot';
        if (/villa|bungalow|row/.test(t)) return 'Villa';
        if (/shop|office|commercial/.test(t)) return 'Commercial';
        return rawType.charAt(0).toUpperCase() + rawType.slice(1).toLowerCase();
      })();
      // Builder / uploaded property = it has its own group. Those show just their
      // name (Godrej, Skyline …); posted ones with no group show the type.
      const hasGroup = !!cardProjectId && !!groupProjectIds?.has(cardProjectId);
      const projectLabel = String(inv.projectName || po.projectName || '').trim();
      const heading = (hasGroup && projectLabel) ? projectLabel : (typeLabel || projectLabel || 'Property');

      // BHK
      const bhkText = (inv.bhkOptions || []).filter(Boolean).join(', ')
        || (po.configuration?.bhkOptions || []).filter(Boolean).join(', ')
        || (() => { const m = desc.match(/(\d(?:\.\d)?)\s*bhk/i); return m ? `${m[1]} BHK` : ''; })();

      // Area
      const areaShown = areaText
        || cleanAreaText(po.configuration?.carpetAreaRange)
        || (() => { const m = desc.match(/(\d[\d,.]*)\s*(?:sq\.?\s*ft|sqft|sq\.?\s*feet)/i); return m ? `${m[1]} sq.ft` : ''; })();

      // Location
      const locShown = location || [po.location, po.city].filter(Boolean).join(', ');

      // Price (rupees), then per sq.ft
      const priceRupees = (() => {
        if (inv.priceRange?.min) return inv.priceRange.min * 100000;
        if (po.pricing?.startingPrice) return Number(po.pricing.startingPrice) || 0;
        const m = desc.match(/(\d+(?:\.\d+)?)\s*(cr|crore|crores|l|lac|lacs|lakh|lakhs)\b/i);
        if (!m) return 0;
        return parseFloat(m[1]) * (/^c/i.test(m[2]) ? 10000000 : 100000);
      })();
      const priceShown = priceText || (priceRupees ? fmtPrice(priceRupees) : '');
      const perSqft = (() => {
        if (!priceRupees || !areaShown) return '';
        const nums = areaShown.replace(/,/g, '').match(/\d+(?:\.\d+)?/g)?.map(Number).filter(n => n > 0) || [];
        if (!nums.length) return '';
        const avg = nums.reduce((sum, n) => sum + n, 0) / nums.length;
        if (avg < 50) return '';
        const psf = Math.round(priceRupees / avg);
        return psf >= 50 ? `₹${psf.toLocaleString('en-IN')}/sq.ft` : '';
      })();

      // Status: possession on the card, else the project's own status
      const statusShown = possessionLabel === 'Ready' ? 'Ready to Move'
        : possessionLabel ? `${possessionLabel} Possession`
        : (() => {
            const st = String(po.projectStatus || '').toLowerCase();
            if (/ready|move/.test(st)) return 'Ready to Move';
            if (/construct/.test(st)) return 'Under Construction';
            if (/launch/.test(st)) return 'Pre Launch';
            return '';
          })();

      // Extra details under the price: broker, loan, commission, urgency, note.
      const extras = [
        inv.bankLoanAvailable ? 'Bank Loan' : '',
        inv.commissionPercent ? `${inv.commissionPercent}% Commission` : '',
        urgencyLabel,
      ].filter(Boolean).join(' · ');
      const hasBroker = senderName !== 'Unknown';
      const extraNode = (extras || firstLine) ? (
        <View style={{ gap: 2 }}>
          {!!extras && <Text style={{ fontSize: 10.5, color: '#1F4D3A', fontWeight: '600' }} numberOfLines={1}>{extras}</Text>}
          {!!firstLine && <Text style={{ fontSize: 10.5, color: '#6B7280', lineHeight: 14 }} numberOfLines={2}>{firstLine}</Text>}
        </View>
      ) : undefined;

      return (
        <Animated.View style={[mbs.cardWrap, mbs.inventoryWrap, { borderRadius: 22, backgroundColor: bgColor }]}>
          <PhotoCard
            image={coverUrl || null}
            seed={msg.id + (cardProjectId || title || '')}
            price={priceShown || undefined}
            pricePerSqft={perSqft || undefined}
            // Positional on purpose: [BHK, area, type] — empty ones stay empty.
            chips={[bhkText, areaShown, typeLabel]}
            title={heading}
            location={locShown || undefined}
            status={statusShown || undefined}
            listingLabel={rentHinted ? 'For Rent' : 'For Sale'}
            broker={hasBroker ? senderName : undefined}
            footer={extraNode}
            onPress={openCard}
            // View Project → map landing page; without a linked project, the details screen.
            // View Project only where the property has its own group; it opens that
            // property's landing page on the map.
            onViewProperty={hasGroup ? () => onViewProperty(cardProjectId, inv) : undefined}
            // No Chat button on Lead Match cards (removed on request).
            accessibilityLabel={`${heading}. View details`}
          />
        </Animated.View>
      );
    }

    return (
      <Pressable
        onPress={openCard}
        style={({ pressed }) => [mbs.cardWrap, mbs.inventoryWrap, pressed && { opacity: 0.85 }]}
        accessibilityRole="button"
        accessibilityLabel={cardProjectId ? `${title}. Open property group` : `${title}. View details`}
      >
        <Animated.View style={[mbs.vCard, { backgroundColor: bgColor }]}>
          {/* All-Properties-style card: photo on top (badge + photo count),
              details below (title, location · area, description, status pills,
              price), then the View Property / Join Group actions. Same data and
              same handlers as before — only the layout changed. */}
          <View style={mbs.vImgWrap}>
            {coverUrl ? (
              <Image source={{ uri: coverUrl }} style={mbs.vImg} resizeMode="cover" />
            ) : (
              <PropertyCoverPlaceholder style={mbs.vImg} seed={msg.id + (cardProjectId || title || '')} />
            )}
            <View style={mbs.vBadge}><Text style={mbs.vBadgeText}>{listingLabel}</Text></View>
            {/* Price on the photo's bottom-right corner. */}
            {!!priceText && (
              <View style={mbs.vPriceTag}><Text style={mbs.vPriceTagText} numberOfLines={1}>{priceText}</Text></View>
            )}
          </View>
          {/* Compact card: just the property (e.g. "2 BHK"), then location ·
              sqft. Everything else is on the Property Details screen. */}
          <View style={mbs.vBody}>
            <Text style={mbs.vTitle} numberOfLines={1}>{bhk || propertyType || title}</Text>
            {!!locationLine && (
              <View style={mbs.propertyLine}>
                <MapPin size={12} color={colors.muted2} />
                <Text style={mbs.propertyLocation} numberOfLines={1}>{locationLine}</Text>
              </View>
            )}
          </View>
          {false && (
            <View style={mbs.vFooter}>
              <View style={[mbs.propertyTagsRow, { flex: 1 }]}>
                {!!possessionLabel && (
                  <View style={[mbs.propertyTag, mbs.propertyTagPossession]}>
                    <Text style={[mbs.propertyTagText, { color: colors.greenText }]}>{possessionLabel}</Text>
                  </View>
                )}
                {!!urgencyLabel && (
                  <View style={[mbs.propertyTag, mbs.propertyTagUrgency]}>
                    <Text style={[mbs.propertyTagText, { color: '#92400E' }]}>{urgencyLabel}</Text>
                  </View>
                )}
                {extraTags.map(t => (
                  <View key={t} style={[mbs.propertyTag, mbs.propertyTagPlain]}>
                    <Text style={[mbs.propertyTagText, { color: colors.slateText }]}>{t}</Text>
                  </View>
                ))}
              </View>
              {!!priceText && <Text style={mbs.vPrice} numberOfLines={1}>{priceText}</Text>}
            </View>
          )}
          {false && (
          <View style={mbs.propertyRow}>
            <View style={mbs.propertyPhotoWrap}>
              {coverUrl ? (
                <Image source={{ uri: coverUrl }} style={mbs.propertyThumb} resizeMode="cover" />
              ) : (
                <PropertyCoverPlaceholder style={mbs.propertyThumb} borderRadius={12} seed={msg.id + (cardProjectId || title || '')} />
              )}
              {photoCount > 0 && (
                <View style={mbs.photoBadge}>
                  <Text style={mbs.photoBadgeText}>1/{photoCount}</Text>
                </View>
              )}
            </View>

            <View style={mbs.propertyInfo}>
              {/* Label pill + who posted it. The verified tick stays GREEN — it
                  carries meaning (builder verification), per decision 1a. */}
              <View style={mbs.propertyHeaderRow}>
                <View style={mbs.propertyLabelPill}>
                  <Building2 size={11} color={colors.brand} />
                  <Text style={mbs.propertyLabel}>{listingLabel}</Text>
                </View>
                {/* Poster profile: a small monogram logo + name + verified tick.
                    The inventory card's sender carries no avatar URL, so the
                    BuilderAvatar placeholder gives the profile section a proper
                    face instead of a bare name (requirement 1 + 3). */}
                <View style={mbs.propertySenderWrap}>
                  <BuilderAvatar name={senderName} seed={msg.sender.id || senderName} size={18} style={mbs.propertySenderAvatar} />
                  <Text style={mbs.propertySender} numberOfLines={1}>{senderName}</Text>
                  {isVerified && <BadgeCheck size={17} color="#1F8A4C" />}
                </View>
              </View>

              <Text style={mbs.propertyTitle} numberOfLines={1}>{headline}</Text>

              {!!locationLine && (
                <View style={mbs.propertyLine}>
                  <MapPin size={11} color={colors.muted2} />
                  <Text style={mbs.propertyLocation} numberOfLines={1}>{locationLine}</Text>
                </View>
              )}

              {/* One-line description, reference style. */}
              {!!descLine && (
                <View style={mbs.descPill}>
                  <Text style={mbs.descText} numberOfLines={2}>{descLine}</Text>
                </View>
              )}

              {/* Bottom band: a peach info pill (area | possession) and the
                  urgency/loan pills on the left; price + an orange circular arrow
                  on the right. The single "💰 price | area | type" money line was
                  split so the price can be shown large on its own, matching the
                  reference. `!!areaText` guards keep a missing area omitted
                  (the FEAT-005 goal) without a new helper. */}
              <View style={mbs.propertyBottomBlock}>
                <View style={mbs.propertyLeftCol}>
                  {/* Area moved up to the location line ("Nagpur · 500 sqft"),
                      so the info pill is gone — only the status pills remain. */}

                  {/* [Ready] [Urgent?] [Loan] [Commission] — status pills KEEP
                      their meaning colours. The urgency pill is omitted for normal
                      urgency (urgencyLabel is '' then). */}
                  <View style={mbs.propertyTagsRow}>
                    {!!possessionLabel && (
                      <View style={[mbs.propertyTag, mbs.propertyTagPossession]}>
                        <Text style={[mbs.propertyTagText, { color: colors.greenText }]}>{possessionLabel}</Text>
                      </View>
                    )}
                    {!!urgencyLabel && (
                      <View style={[mbs.propertyTag, mbs.propertyTagUrgency]}>
                        <Text style={[mbs.propertyTagText, { color: '#92400E' }]}>{urgencyLabel}</Text>
                      </View>
                    )}
                    {extraTags.map(t => (
                      <View key={t} style={[mbs.propertyTag, mbs.propertyTagPlain]}>
                        <Text style={[mbs.propertyTagText, { color: colors.slateText }]}>{t}</Text>
                      </View>
                    ))}
                  </View>
                </View>

                <View style={mbs.propertyPriceRow}>
                  {!!priceText && <Text style={mbs.propertyPrice} numberOfLines={1}>{priceText}</Text>}
                  <Pressable
                    onPress={() => onArrowPress(cardProjectId, inv, msg.id)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={cardProjectId ? 'Open property group' : 'View details'}
                  >
                    <View style={mbs.propertyArrow}>
                      <ArrowRight size={15} color="#fff" strokeWidth={2.5} />
                    </View>
                  </Pressable>
                </View>
              </View>
            </View>
          </View>
          )}

          {/* Group CTAs. Joined users only get "View Group"; others get both
              "View Group" (opens the Group Info screen) and "Join Group". */}
          {/* View Property / Join Group buttons removed from the card: tapping
              the card opens Property Details, which has Join Group / Open Group Chat. */}
          {false && (
          <View style={mbs.ctaRow}>
            <Pressable
              onPress={() => onViewProperty(cardProjectId, inv)}
              hitSlop={6}
              style={mbs.ctaMini}
              accessibilityRole="button"
              accessibilityLabel="View Property"
            >
              <Eye size={12} color="#17233A" />
              <Text style={mbs.ctaMiniText} numberOfLines={1}>View Property</Text>
            </Pressable>
            {!isJoined && (
              <Pressable
                onPress={() => onArrowPress(cardProjectId, inv, msg.id)}
                hitSlop={6}
                style={mbs.ctaMini}
                accessibilityRole="button"
                accessibilityLabel="Join Group"
              >
                <Users size={12} color={colors.brand} />
                <Text style={mbs.ctaMiniText} numberOfLines={1}>Join Group</Text>
              </Pressable>
            )}
          </View>
          )}
        </Animated.View>
      </Pressable>
    );
  }

  if (msg.messageType === 'requirement_card' && msg.requirementCard) {
    const req = msg.requirementCard;
    const matches = msg.matchResults || [];
    return (
      <View style={[mbs.cardWrap, { alignSelf: 'flex-start', gap: 6 }]}>
        <View style={[mbs.card, { backgroundColor: '#FFF8F0', borderColor: `${colors.brand}44` }]}>
          <Text style={[mbs.cardTag, { color: colors.brand }]}>🔍 Requirement · {msg.sender.name}
            {req.urgency === 'urgent' ? '  ⚡ URGENT' : req.urgency === 'very_urgent' ? '  🔥 VERY URGENT' : ''}
          </Text>
          <Text style={mbs.cardMain}>{req.bhkType} · ₹{req.budget}L · {req.area}</Text>
          <View style={mbs.tagRow}>
            {req.city ? <Tag text={req.city} /> : null}
            <Tag text={`🕐 ${req.possessionNeeded}`} />
            {req.loanRequired && <Tag text="🏦 Loan" />}
          </View>
          {req.clientNotes ? <Text style={mbs.cardNote}>📝 {req.clientNotes}</Text> : null}
        </View>

        {matches.length > 0 && (
          <View style={mbs.matchBox}>
            <Text style={mbs.matchTitle}>⚡ {matches.length} Matches Found</Text>
            {matches.map((m: any, i: number) => (
              <GroupMatchCard
                key={String(m?.project?._id || m?.project || i)}
                match={m}
                requirement={req}
                messageId={msg.id}
                onJoin={onJoinPropertyGroup}
                onPreview={onPreviewMatch}
                onInterested={onInterested}
              />
            ))}
          </View>
        )}
      </View>
    );
  }

  // Own media can always be removed; other people's only by a room owner or an
  // admin/captain. Matches the server, so a long-press never leads to a 403.
  const canDelete = isMe || canModerate;

  // image attachment
  if (msg.messageType === 'image' && msg.content) {
    return (
      <View style={[{ flexDirection: 'row' }, isMe ? { justifyContent: 'flex-end' } : { justifyContent: 'flex-start' }]}>
        <View style={[mbs.textBubble, isMe ? mbs.textMe : mbs.textThem, { padding: 4 }]}>
          {!isMe && <Text style={[mbs.textSender, { marginHorizontal: 6, marginTop: 4 }]}>{msg.sender.name} · {msg.sender.role}</Text>}
          <Pressable
            // P6-04: content is whatever the sender wrote (the socket path does
            // not validate it as a URL) and used to go straight to openURL, so a
            // tap could launch any app's custom scheme. Web links only; anything
            // else is a no-op, and a failed open no longer rejects unhandled.
            onPress={() => { if (isSafeHttpUrl(msg.content)) Linking.openURL(msg.content.trim()).catch(() => {}); }}
            onLongPress={canDelete ? () => onDeleteMessage(msg) : undefined}
            delayLongPress={400}
            accessibilityHint={canDelete ? 'Long press to delete' : undefined}
          >
            <Image source={{ uri: msg.content }} style={mbs.attachImage} resizeMode="cover" />
          </Pressable>
          {canDelete && <Text style={mbs.deleteHint}>Hold to delete</Text>}
        </View>
      </View>
    );
  }

  // file attachment
  if (msg.messageType === 'file' && msg.content) {
    const urlName = decodeURIComponent(String(msg.content).split('/').pop() || 'File').split('?')[0];
    const fileName = msg.attachment?.name || urlName;
    return (
      <View style={[{ flexDirection: 'row' }, isMe ? { justifyContent: 'flex-end' } : { justifyContent: 'flex-start' }]}>
        <View style={[mbs.textBubble, isMe ? mbs.textMe : mbs.textThem]}>
          {!isMe && <Text style={mbs.textSender}>{msg.sender.name} · {msg.sender.role}</Text>}
          <Pressable
            // P6-04: same scheme allow-list as the image bubble above.
            onPress={() => { if (isSafeHttpUrl(msg.content)) Linking.openURL(msg.content.trim()).catch(() => {}); }}
            onLongPress={canDelete ? () => onDeleteMessage(msg) : undefined}
            delayLongPress={400}
            style={mbs.fileRow}
            accessibilityHint={canDelete ? 'Long press to delete' : undefined}
          >
            <FileText size={18} color={isMe ? '#fff' : colors.brand} />
            <Text style={[mbs.fileName, { color: isMe ? '#fff' : colors.ink }]} numberOfLines={1}>{fileName}</Text>
          </Pressable>
          {canDelete && (
            <Text style={[mbs.deleteHint, { color: isMe ? 'rgba(255,255,255,0.7)' : colors.muted }]}>
              Hold to delete
            </Text>
          )}
        </View>
      </View>
    );
  }

  // text — long-press to delete, matching the image/file pattern already above.
  // Previously text messages had NO delete option, which meant only media could
  // be removed. This unifies the interaction: any message type can now be
  // long-pressed by its sender or a moderator.
  return (
    <View style={[{ flexDirection: 'row' }, isMe ? { justifyContent: 'flex-end' } : { justifyContent: 'flex-start' }]}>
      <Pressable
        onLongPress={canDelete ? () => onDeleteMessage(msg) : undefined}
        delayLongPress={400}
        style={[mbs.textBubble, isMe ? mbs.textMe : mbs.textThem]}
        accessibilityHint={canDelete ? 'Long press to delete' : undefined}
      >
        {!isMe && <Text style={mbs.textSender}>{msg.sender.name} · {msg.sender.role}</Text>}
        <Text style={[mbs.textContent, { color: isMe ? '#fff' : colors.ink }]}>{msg.content}</Text>
        {canDelete && (
          <Text style={[mbs.deleteHint, { color: isMe ? 'rgba(255,255,255,0.7)' : colors.muted }]}>
            Hold to delete
          </Text>
        )}
      </Pressable>
    </View>
  );
});

// Kept the object name `mbs` so none of the 100+ style sites in the body
// above changed when this moved out of GroupChatEmbedded.tsx. Every key here
// has its only readers inside MessageBubble, so the block is module-local
// rather than shared.
const mbs = StyleSheet.create({
  system: { textAlign: 'center', fontSize: 10, color: colors.muted2, backgroundColor: colors.slateBg, alignSelf: 'center', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 12, overflow: 'hidden' },
  // `unitPill` / `unitPillText` used to sit here. They styled the ONE pill per
  // unit_update message; those became one summary pill per day, which left both
  // keys unused. `unitDot` stays — it is shared by the summary segments AND the
  // expanded rows, so it must not be resized for one of them.
  unitDot: { width: 10, height: 10, borderRadius: 5 },
  cardWrap: { width: '92%', maxWidth: 380, minWidth: 0 },
  // Warm-port: inventory cards run the full list width in the reference.
  inventoryWrap: { width: '100%', maxWidth: '100%', alignSelf: 'stretch' },
  card: { borderWidth: 1, borderRadius: 16, padding: 12, gap: 4 },
  cardTag: { fontSize: 10, fontWeight: '800' },
  cardMain: { fontSize: 13, fontWeight: '800', color: colors.ink },
  cardSub: { fontSize: 11, color: colors.muted2 },
  cardNote: { fontSize: 10.5, color: colors.muted, marginTop: 2 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 3 },
  // All-Properties-style vertical card (photo top, details below).
  // Soft transparent card box (same look as the Projects / Marketplace cards).
  vCard: {
    width: '100%', borderRadius: 20, overflow: 'hidden', paddingBottom: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.95)',
    shadowColor: '#1F4D3A', shadowOpacity: 0.02, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 0,
  },
  vImgWrap: { position: 'relative' },
  vImg: { width: '100%', height: 130, backgroundColor: colors.line },
  vPriceTag: { position: 'absolute', right: 10, bottom: 10, backgroundColor: 'rgba(255,255,255,0.94)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  vPriceTagText: { fontSize: 14, fontWeight: '800', color: colors.brand },
  vBadge: { position: 'absolute', top: 10, left: 10, backgroundColor: colors.brand, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  vBadgeText: { color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 0.3 },
  vCount: { position: 'absolute', bottom: 10, right: 10, backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 9 },
  vBody: { paddingHorizontal: 12, paddingTop: 8, gap: 3 },
  vTitle: { fontSize: 15, fontWeight: '800', color: colors.brand },
  vDesc: { fontSize: 12.5, color: colors.muted2, lineHeight: 17 },
  vFooter: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.line },
  vPrice: { fontSize: 16, fontWeight: '800', color: colors.brand },
  // Compact universal-group inventory card styles
  // Same surface as the AI Assist match card: a white card on a neutral border,
  // with brand accents. The card used to be green end to end, which read as a
  // status colour on a card that carries no status.
  // Warm-port (decision 1a): was a plain white card on colors.line. The
  // reference reskins it to a warm cream surface (#FFFFFF, set via the
  // Animated bgColor interpolation) on a soft beige border, no shadow — the
  // soft halo in earlier drafts is deliberately removed.
  propertyCard: {
    width: '100%',
    minWidth: 0,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: '#F6ECDD',
    borderRadius: 16,
    paddingHorizontal: 8,
    paddingVertical: 8,
    gap: 6,
    elevation: 0,
    shadowOpacity: 0,
  },
  propertyHeaderRow: {
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  propertyLabelPill: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.brandTint,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  propertyLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.brand,
    letterSpacing: 0.2,
  },
  propertySenderWrap: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 3,
  },
  propertySender: {
    flexShrink: 1,
    fontSize: 10.5,
    fontWeight: '700',
    color: colors.muted2,
  },
  // Small monogram logo shown before the poster's name on the inventory card.
  propertySenderAvatar: { marginRight: 1 },
  // One-line description pill under the location line (reference card).
  descPill: { marginTop: 6, backgroundColor: '#FFF3E6', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  descText: { fontSize: 11.5, color: colors.muted2, lineHeight: 16 },
  // View Group / Join Group row under the card body.
  // Same look as the "View Project" / "Share" mini pills on the Project cards
  // (ListingCard: miniBtn / miniText).
  ctaRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 6, marginTop: 8, paddingHorizontal: 12 },
  ctaMini: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, height: 26, borderRadius: 9, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#EFE3D1', shadowColor: '#2B4A3C', shadowOpacity: 0.1, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  ctaMiniText: { fontSize: 9.5, fontWeight: '700', color: '#17233A' },
  // Warm-port row: a fixed-size photo on the left, the info column on the right.
  // Fixed sizes on purpose — sizing the photo and the card off each other (with
  // '100%' + alignSelf:'stretch') blew the card up to ~450dp tall on device.
  propertyRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, minWidth: 0 },
  propertyPhotoWrap: { width: 90, height: 90, borderRadius: 14, overflow: 'hidden', backgroundColor: colors.brandTint, flexShrink: 0 },
  // The thumb (real cover Image OR the PropertyCoverPlaceholder tile) fills the
  // photo slot so the "1/N" badge can sit over its bottom-left corner.
  propertyThumb: {
    position: 'absolute', left: 0, top: 0, right: 0, bottom: 0,
    width: undefined, height: undefined,
    borderRadius: 12,
    backgroundColor: colors.brandTint,
  },
  // "1/N" photo-count pill, bottom-left of the photo.
  photoBadge: {
    position: 'absolute', left: 6, bottom: 6,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(23,35,58,0.72)', borderRadius: 8,
    paddingHorizontal: 7, paddingVertical: 3,
  },
  photoBadgeText: { color: '#fff', fontSize: 9.5, fontWeight: '700' },
  propertyInfo: {
    flex: 1,
    minWidth: 0,
    minHeight: 90,
    gap: 3,
  },
  // Bottom band of the info column: info pill + status tags (left), price +
  // arrow (right). `marginTop:'auto'` pins it to the bottom of the 104dp column.
  propertyBottomBlock: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 6, minWidth: 0, marginTop: 'auto' },
  propertyLeftCol: { flex: 1, minWidth: 0, gap: 4 },
  propertyPriceRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0 },
  propertyPrice: { fontSize: 15, fontWeight: '800', color: colors.ink, letterSpacing: -0.3 },
  propertyArrow: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: colors.brand,
    alignItems: 'center', justifyContent: 'center',
  },
  // Peach info pill (area | possession) under the location line.
  infoPill: {
    alignSelf: 'flex-start', maxWidth: '100%', flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#E7F0EA', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4,
  },
  infoPillText: { fontSize: 10, fontWeight: '600', color: '#3B2F20', flexShrink: 1 },
  infoPillDivider: { width: 1, height: 12, backgroundColor: '#9FC3AE', marginHorizontal: 3 },
  propertyTitle: {
    fontSize: 14.5,
    fontWeight: '800',
    color: colors.ink,
    letterSpacing: -0.2,
  },
  propertyLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    minWidth: 0,
  },
  propertyLocation: {
    flexShrink: 1,
    fontSize: 11,
    fontWeight: '600',
    color: colors.muted2,
  },
  // Single "💰 price | area | type" line, per the agreed card spec.
  propertyMoney: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.greenText,
    marginTop: 2,
  },
  propertyDesc: {
    fontSize: 10.5,
    color: colors.muted2,
    lineHeight: 15,
  },
  propertyTagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
  },
  propertyTag: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  // Status pills stay coloured — they carry meaning. Softened to a tinted pill
  // so they read as a badge on the white card instead of a solid block.
  propertyTagPossession: {
    backgroundColor: colors.greenBg,
    borderWidth: 1,
    borderColor: colors.greenBorder,
  },
  propertyTagUrgency: {
    backgroundColor: '#FEF3C7',
  },
  propertyTagPlain: {
    backgroundColor: colors.slateBg,
  },
  propertyTagText: {
    fontSize: 8.5,
    fontWeight: '800',
    color: colors.white,
  },
  // `propertyActions` / `propertyActionBtn` lived here and styled the icon-only
  // second action row on the inventory card. That row is gone (see the comment in
  // the inventory_card branch), so the styles went with it rather than being left
  // behind for someone to re-render the duplicate row from.
  propertyTime: {
    alignSelf: 'flex-end',
    fontSize: 8.5,
    color: colors.muted,
    marginTop: -1,
  },
  matchBox: { backgroundColor: colors.white, borderWidth: 1, borderColor: `${colors.brand}33`, borderRadius: 16, padding: 10, gap: 8 },
  matchTitle: { fontSize: 11, fontWeight: '800', color: colors.brand },
  textBubble: { maxWidth: '75%', paddingHorizontal: 12, paddingVertical: 9, borderRadius: 16 },
  textMe: { backgroundColor: colors.brand, borderBottomRightRadius: 4 },
  textThem: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderBottomLeftRadius: 4 },
  textSender: { fontSize: 9, fontWeight: '800', color: colors.brand, marginBottom: 2 },
  textContent: { fontSize: 13, lineHeight: 20 },
  attachImage: { width: 200, height: 200, borderRadius: 12 },
  // Long-press is invisible without a hint, so the affordance is spelled out.
  deleteHint: { fontSize: 8, color: colors.muted, textAlign: 'center', marginTop: 3, marginBottom: 1 },
  fileRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 2 },
  fileName: { fontSize: 12.5, fontWeight: '600', maxWidth: 180 },
  // Unit update daily summary pills — one collapsible pill per local day
  // ("Aaj: 3 Booked · 2 Vacant"), replacing one pill per unit_update message.
  //
  // DEFECT FIX, and the reason the counts text was INVISIBLE: `unitDayStats` had
  // `flex: 1`. In Yoga `flex: 1` implies `flexBasis: 0%`, and this row sits
  // inside the auto-width `unitDayPill`, under the width-`auto` `unitDaySummary`
  // — a content-sized subtree with no free space to distribute. So the row was
  // laid out at WIDTH 0: the text collapsed to nothing (hence no "3 Booked ·
  // 2 Vacant" on screen) while the fixed-size `unitDot`s kept painting and spilled
  // outside the pill. It is now content-sized with `flexShrink: 1`.
  //
  // Every `gap` in this subtree is also gone, replaced by explicit margins: `gap`
  // has produced exactly this class of layout bug on this RN version, twice in
  // this file.
  //
  // Compacted per the user's "chhota karo": smaller padding and radius, one step
  // down in font size, and no elevation — a drop shadow on a wrapping row is part
  // of what made it read as a floating box rather than a chat pill. Palette is
  // unchanged: white pill on colors.line, with status colour carried only by the
  // dots.
  unitDaySummary: { 
    alignSelf: 'center', 
    maxWidth: '90%', 
    marginVertical: 6 
  },
  unitDayPill: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 10, 
    paddingVertical: 6, 
    backgroundColor: colors.white, 
    borderWidth: 1, 
    borderColor: colors.line, 
    borderRadius: 14,
  },
  unitDayLabel: { 
    fontSize: 11, 
    fontWeight: '800', 
    color: colors.ink,
    marginRight: 6,
  },
  unitDayStats: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    alignItems: 'center', 
    flexShrink: 1,
  },
  unitDaySeg: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
    marginVertical: 1,
  },
  unitDayStatText: { 
    // Lets a long segment wrap instead of pushing the chevron out of the pill.
    flexShrink: 1,
    fontSize: 10.5, 
    color: colors.muted2 
  },
  unitDayExpanded: { 
    marginTop: 6, 
    paddingLeft: 8 
  },
  unitExpandedItem: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 8, 
    paddingHorizontal: 12, 
    paddingVertical: 8, 
    backgroundColor: colors.cream, 
    borderRadius: 12,
    // Was `gap: 4` on the parent `unitDayExpanded`; moved here as a margin for
    // the same reason the pill dropped its gaps.
    marginBottom: 4,
  },
  unitExpandedText: { 
    flex: 1, 
    fontSize: 11, 
    color: colors.ink 
  },
  // Site visit + project announcement cards. One surface for both: a compact
  // white card on colors.line, centred like the unit-day pill because both are
  // SERVER events about the room, not something a member said. Colour comes only
  // from the leading icon and the accent text.
  //
  // Explicit margins, no `gap`: `gap` inside a centred content-sized subtree has
  // produced a layout bug twice in this file (see unitDayPill).
  visitCard: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  visitHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
  },
  visitTag: {
    flexShrink: 1,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.2,
    marginLeft: 5,
  },
  visitClock: {
    // Pushed to the right edge without flex on the text itself, so a long tag
    // wraps/truncates instead of squeezing the clock to zero width.
    marginLeft: 'auto',
    paddingLeft: 8,
    fontSize: 9.5,
    color: colors.muted,
  },
  visitProject: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.ink,
    marginTop: 4,
  },
  visitSub: {
    fontSize: 11,
    color: colors.muted2,
    marginTop: 1,
  },
  visitDwell: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 3,
  },
});

export default MessageBubble;
