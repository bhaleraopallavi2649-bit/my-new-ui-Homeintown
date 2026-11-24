// My Card — the user's digital visiting card: edit the details, pick one of
// three templates, publish it to homeintown.in/card/<code>, and share it as a
// link, a PNG snapshot or a vCard contact file.
//
// Name, phone and email are not editable here: the backend reads them from the
// user's profile (cardController), so editing them would silently do nothing.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, ScrollView, TextInput, Pressable, StyleSheet,
  ActivityIndicator, Switch, Alert, Share, useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import QRCode from 'react-native-qrcode-svg';
import { CreditCard, Save, Link2, Share2, Download, Image as ImageIcon } from '../../src/icons';
import { cardApi, ApiError, CardTemplate, VisitingCardData, VisitingCardPatch } from '../../src/lib/api';
import { publicCardUrl, shareCardPng, shareVCard } from '../../src/lib/cardImage';
import VisitingCard, { CARD_TEMPLATES } from '../../src/components/card/VisitingCard';
import EmptyState from '../../src/components/EmptyState';
import MenuButton from '../../src/components/MenuButton';
import { useToast } from '../../src/components/Toast';
import { colors, radius, spacing } from '../../src/theme';

type TopKey = 'designation' | 'companyName' | 'reraAgentNo' | 'website';
type SocialKey = 'instagram' | 'facebook' | 'youtube';
type AddressKey = 'line' | 'city' | 'state' | 'pinCode';
type FieldKey = TopKey | SocialKey | AddressKey;
type Draft = Record<FieldKey, string> & { template: CardTemplate };

const TOP_KEYS: TopKey[] = ['designation', 'companyName', 'reraAgentNo', 'website'];
const SOCIAL_KEYS: SocialKey[] = ['instagram', 'facebook', 'youtube'];
const ADDRESS_KEYS: AddressKey[] = ['line', 'city', 'state', 'pinCode'];

const FIELDS: { key: FieldKey; label: string; placeholder: string; keyboard?: 'url' | 'number-pad'; maxLength?: number }[] = [
  { key: 'designation', label: 'Designation', placeholder: 'e.g. Sales Manager' },
  { key: 'companyName', label: 'Company', placeholder: 'Company name' },
  { key: 'reraAgentNo', label: 'RERA Agent No.', placeholder: 'Optional' },
  { key: 'website', label: 'Website', placeholder: 'https://…', keyboard: 'url' },
  { key: 'instagram', label: 'Instagram', placeholder: 'https://instagram.com/…', keyboard: 'url' },
  { key: 'facebook', label: 'Facebook', placeholder: 'https://facebook.com/…', keyboard: 'url' },
  { key: 'youtube', label: 'YouTube', placeholder: 'https://youtube.com/…', keyboard: 'url' },
  { key: 'line', label: 'Address', placeholder: 'Office / street' },
  { key: 'city', label: 'City', placeholder: 'City' },
  { key: 'state', label: 'State', placeholder: 'State' },
  { key: 'pinCode', label: 'PIN code', placeholder: '6 digits', keyboard: 'number-pad', maxLength: 6 },
];

const UNPUBLISHED_HINT = 'Pehle card Publish karo — tabhi link khulega';

function draftFrom(card: VisitingCardData): Draft {
  const v = (x: string | null | undefined) => x ?? '';
  return {
    designation: v(card.designation), companyName: v(card.companyName),
    reraAgentNo: v(card.reraAgentNo), website: v(card.website),
    instagram: v(card.social?.instagram), facebook: v(card.social?.facebook), youtube: v(card.social?.youtube),
    line: v(card.address?.line), city: v(card.address?.city), state: v(card.address?.state), pinCode: v(card.address?.pinCode),
    template: card.template || 'classic',
  };
}

/** Only the keys whose trimmed value changed; a cleared field is sent as null. */
function buildPatch(card: VisitingCardData, draft: Draft): VisitingCardPatch {
  const base = draftFrom(card);
  const val = (k: FieldKey) => draft[k].trim() || null;
  const changed = (k: FieldKey) => draft[k].trim() !== base[k].trim();
  const patch: VisitingCardPatch = {};
  for (const k of TOP_KEYS) if (changed(k)) patch[k] = val(k);
  const social: NonNullable<VisitingCardPatch['social']> = {};
  for (const k of SOCIAL_KEYS) if (changed(k)) social[k] = val(k);
  if (Object.keys(social).length) patch.social = social;
  const address: NonNullable<VisitingCardPatch['address']> = {};
  for (const k of ADDRESS_KEYS) if (changed(k)) address[k] = val(k);
  if (Object.keys(address).length) patch.address = address;
  if (draft.template !== base.template) patch.template = draft.template;
  return patch;
}

function errorText(e: any, fallback: string): string {
  // The card controller answers 400 with { error: '<sentence>' }.
  return (typeof e?.data?.error === 'string' && e.data.error) || e?.message || fallback;
}

type Busy = null | 'save' | 'publish' | 'link' | 'copy' | 'png' | 'vcf';

export default function MyCardScreen() {
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { width: winW } = useWindowDimensions();
  const cardRef = useRef<View>(null);

  const [card, setCard] = useState<VisitingCardData | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Busy>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const c = await cardApi.getMine();
      setCard(c);
      setDraft(draftFrom(c));
    } catch (e: any) {
      // The backend with /users/me/card is not deployed yet; prod answers 404.
      setLoadError(e instanceof ApiError && e.status === 404
        ? 'Card feature abhi server pe live nahi hai'
        : errorText(e, 'Card load nahi hua'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // The preview, PNG and vCard all use the unsaved form values, so what the
  // user sees is what gets shared.
  const merged = useMemo<VisitingCardData | null>(() => {
    if (!card || !draft) return null;
    const v = (k: FieldKey) => draft[k].trim() || null;
    return {
      ...card,
      template: draft.template,
      designation: v('designation'), companyName: v('companyName'),
      reraAgentNo: v('reraAgentNo'), website: v('website'),
      social: { instagram: v('instagram'), facebook: v('facebook'), youtube: v('youtube') },
      address: { line: v('line'), city: v('city'), state: v('state'), pinCode: v('pinCode') },
    };
  }, [card, draft]);

  const patch = useMemo(() => (card && draft ? buildPatch(card, draft) : {}), [card, draft]);
  const dirty = Object.keys(patch).length > 0;
  const pin = draft?.pinCode.trim() ?? '';
  const pinError = pin && !/^\d{6}$/.test(pin) ? 'PIN code 6 digits ka hona chahiye' : null;

  const published = !!card?.published;
  const url = card?.code ? publicCardUrl(card.code) : null;

  const setField = (k: FieldKey, text: string) => setDraft(d => (d ? { ...d, [k]: text } : d));

  const handleSave = async () => {
    if (!dirty || pinError || busy) return;
    setBusy('save');
    try {
      const updated = await cardApi.update(patch);
      setCard(updated);
      setDraft(draftFrom(updated));
      toast.show('Card save ho gaya ✓', 'success');
    } catch (e: any) {
      toast.show(errorText(e, 'Save nahi hua'), 'error');
    } finally {
      setBusy(null);
    }
  };

  const setPublished = async (next: boolean) => {
    setBusy('publish');
    try {
      const updated = await cardApi.update({ published: next });
      // Keep unsaved edits in the form; only the saved card is replaced.
      setCard(updated);
      toast.show(next ? 'Card publish ho gaya ✓' : 'Card unpublish ho gaya', 'success');
    } catch (e: any) {
      toast.show(errorText(e, 'Publish nahi hua'), 'error');
    } finally {
      setBusy(null);
    }
  };

  const onTogglePublish = (next: boolean) => {
    if (busy) return;
    if (!next) { setPublished(false); return; }
    // Publishing exposes the phone number on a public page, so it is confirmed.
    Alert.alert(
      'Card publish karein?',
      `Publish karne par aapka naam, phone number aur baaki card details homeintown.in/card/${card?.code ?? ''} par sabko dikhenge.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Publish', onPress: () => setPublished(true) },
      ],
    );
  };

  const run = async (kind: Exclude<Busy, null>, fn: () => Promise<unknown>, fallback: string) => {
    if (busy) return;
    setBusy(kind);
    try { await fn(); } catch (e: any) { toast.show(errorText(e, fallback), 'error'); } finally { setBusy(null); }
  };

  const onShareLink = () => run('link', async () => {
    if (!url) return;
    await Share.share({ message: `${card?.name ?? ''} — mera digital visiting card: ${url}` });
  }, 'Share nahi hua');

  const onCopyLink = () => run('copy', async () => {
    if (!url) return;
    await Clipboard.setStringAsync(url);
    toast.show('Link copy ho gaya ✓', 'success');
  }, 'Copy nahi hua');

  const onSharePng = () => run('png', () => shareCardPng(cardRef), 'Image share nahi hui');
  // shareVCard adds the public link itself, and only when the card is published.
  const onShareVcf = () => run('vcf', () => shareVCard(merged as VisitingCardData), 'vCard share nahi hua');

  const header = (
    <View style={s.header}>
      <MenuButton />
      <Text style={s.title}>My Card</Text>
    </View>
  );

  if (loading || loadError || !card || !draft || !merged) {
    return (
      <View style={[s.root, { paddingTop: insets.top }]}>
        {header}
        {loading ? (
          <View style={s.center}><ActivityIndicator color={colors.brand} /></View>
        ) : (
          <EmptyState
            icon={<CreditCard size={28} color={colors.brand} />}
            title={loadError || 'Card load nahi hua'}
            subtitle="Thodi der baad dobara try karo."
            actionLabel="Retry"
            onAction={load}
          />
        )}
      </View>
    );
  }

  const previewW = winW - spacing.lg * 2;
  // Three thumbnails inside a padded white card, with two gaps between them.
  const miniW = Math.floor((previewW - spacing.md * 2 - spacing.sm * 2) / 3);
  const linkDisabled = !published || !url;

  // A render helper, not a component: defined inside the screen, a component
  // would get a new identity on every render and remount its Pressable.
  const actionBtn = (kind: Exclude<Busy, null>, label: string, Icon: typeof Share2, onPress: () => void, disabled?: boolean) => (
    <Pressable
      key={kind}
      onPress={onPress}
      disabled={disabled || !!busy}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || !!busy }}
      style={[s.actionBtn, (disabled || (!!busy && busy !== kind)) && s.dim]}
    >
      {busy === kind ? <ActivityIndicator size="small" color={colors.brand} /> : <Icon size={15} color={colors.brand} />}
      <Text style={s.actionText}>{label}</Text>
    </Pressable>
  );

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      {header}
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <VisitingCard
          ref={cardRef}
          card={merged}
          template={draft.template}
          // The QR only goes on the card once published, so a shared PNG never
          // points at a page that answers 404.
          qrValue={published && url ? url : undefined}
          width={previewW}
        />

        {/* Template picker */}
        <View style={s.box}>
          <Text style={s.sectionLabel}>Template</Text>
          <View style={s.templates}>
            {CARD_TEMPLATES.map(t => {
              const selected = draft.template === t.key;
              return (
                <Pressable
                  key={t.key}
                  onPress={() => setDraft(d => (d ? { ...d, template: t.key } : d))}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  style={{ alignItems: 'center', gap: spacing.xs }}
                >
                  <View style={[s.miniWrap, selected && s.miniWrapSelected]}>
                    <VisitingCard card={merged} template={t.key} qrValue={published && url ? url : undefined} width={miniW - 4} />
                  </View>
                  <Text style={[s.miniLabel, selected && { color: colors.brand }]}>{t.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Publish + link */}
        <View style={s.box}>
          <View style={s.publishRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.publishTitle}>Publish card</Text>
              <Text style={s.hint}>{published ? 'Card sabke liye live hai' : 'Abhi sirf aap dekh sakte ho'}</Text>
            </View>
            {busy === 'publish' && <ActivityIndicator size="small" color={colors.brand} style={{ marginRight: spacing.sm }} />}
            <Switch
              value={published}
              onValueChange={onTogglePublish}
              disabled={!!busy || !card.code}
              trackColor={{ false: colors.line, true: colors.brand }}
              thumbColor={colors.white}
            />
          </View>

          {!!url && (
            <View style={s.linkBlock}>
              <View style={[s.qrBox, !published && { opacity: 0.35 }]}>
                <QRCode value={url} size={160} />
              </View>
              <Text style={s.url} selectable>{url}</Text>
              {!published && <Text style={s.hintCenter}>{UNPUBLISHED_HINT}</Text>}
            </View>
          )}

          <View style={s.actions}>
            {actionBtn('link', 'Share link', Share2, onShareLink, linkDisabled)}
            {actionBtn('copy', 'Copy link', Link2, onCopyLink, linkDisabled)}
            {actionBtn('png', 'Share PNG', ImageIcon, onSharePng)}
            {actionBtn('vcf', 'Save / share vCard', Download, onShareVcf)}
          </View>
        </View>

        {/* Form */}
        <View style={s.box}>
          <Text style={s.sectionLabel}>Card details</Text>

          {[
            { label: 'Name', value: card.name },
            { label: 'Phone', value: card.phone },
            { label: 'Email', value: card.email },
          ].map(r => (
            <View key={r.label} style={s.readRow}>
              <Text style={s.readLabel}>{r.label}</Text>
              <Text style={s.readValue} numberOfLines={1}>{r.value || '—'}</Text>
            </View>
          ))}
          <Text style={s.hint}>Ye Profile se aate hain</Text>

          {FIELDS.map(f => (
            <View key={f.key} style={s.fieldWrap}>
              <Text style={s.fieldLabel}>{f.label}</Text>
              <TextInput
                value={draft[f.key]}
                onChangeText={t => setField(f.key, t)}
                placeholder={f.placeholder}
                placeholderTextColor={colors.muted}
                keyboardType={f.keyboard === 'url' ? 'url' : f.keyboard === 'number-pad' ? 'number-pad' : 'default'}
                autoCapitalize={f.keyboard ? 'none' : 'words'}
                autoCorrect={!f.keyboard}
                maxLength={f.maxLength}
                style={[s.input, f.key === 'pinCode' && !!pinError && s.inputError]}
              />
              {f.key === 'pinCode' && !!pinError && <Text style={s.errorText}>{pinError}</Text>}
            </View>
          ))}

          <Pressable
            onPress={handleSave}
            disabled={!dirty || !!pinError || !!busy}
            accessibilityRole="button"
            style={[s.saveBtn, (!dirty || !!pinError || !!busy) && { opacity: 0.5 }]}
          >
            {busy === 'save' ? <ActivityIndicator color={colors.white} size="small" /> : (
              <>
                <Save size={15} color={colors.white} />
                <Text style={s.saveText}>Save</Text>
              </>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.cream },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: 14, backgroundColor: 'transparent', borderBottomWidth: 1, borderBottomColor: colors.line },
  title: { fontSize: 21, fontWeight: '800', color: colors.ink },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: spacing.lg, paddingBottom: 40, gap: spacing.lg },

  box: { backgroundColor: colors.white, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, padding: spacing.md, gap: spacing.md },
  sectionLabel: { fontSize: 10, fontWeight: '800', color: colors.muted2, textTransform: 'uppercase', letterSpacing: 0.8 },

  templates: { flexDirection: 'row', justifyContent: 'space-between' },
  miniWrap: { padding: 1, borderRadius: radius.md, borderWidth: 1, borderColor: 'transparent' },
  miniWrapSelected: { borderColor: colors.brand },
  miniLabel: { fontSize: 11, fontWeight: '700', color: colors.muted2 },

  publishRow: { flexDirection: 'row', alignItems: 'center' },
  publishTitle: { fontSize: 14, fontWeight: '700', color: colors.ink },
  hint: { fontSize: 11, color: colors.muted, marginTop: 2 },
  hintCenter: { fontSize: 11, color: colors.muted2, textAlign: 'center' },
  linkBlock: { alignItems: 'center', gap: spacing.sm },
  qrBox: { padding: spacing.sm, backgroundColor: colors.white, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line },
  url: { fontSize: 12, fontWeight: '600', color: colors.ink, textAlign: 'center' },

  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  actionBtn: { flexGrow: 1, flexBasis: '45%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11, borderRadius: radius.md, borderWidth: 1, borderColor: colors.brand, backgroundColor: colors.white },
  actionText: { fontSize: 12, fontWeight: '700', color: colors.brand },
  dim: { opacity: 0.4 },

  readRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.line },
  readLabel: { fontSize: 12, color: colors.muted, fontWeight: '600' },
  readValue: { fontSize: 12, fontWeight: '700', color: colors.ink, maxWidth: '65%' },

  fieldWrap: { gap: 5 },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: colors.ink },
  input: { borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 11, fontSize: 13, color: colors.ink, backgroundColor: colors.cream },
  inputError: { borderColor: colors.red },
  errorText: { fontSize: 11, color: colors.redText },

  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: colors.brand, paddingVertical: 14, borderRadius: radius.md },
  saveText: { color: colors.white, fontSize: 13, fontWeight: '800' },
});
