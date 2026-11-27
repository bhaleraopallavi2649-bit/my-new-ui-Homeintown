// AI Guide > Voice Analysis.
//
// Record a client conversation (or upload an audio file), preview it, and have
// the AI turn it into: summary, client requirements, lead analysis, real-estate
// recommendations and a follow-up plan, all saved on this lead and revisitable.
//
// Flow: 1 Record / Upload  ->  2 Preview  ->  3 Analyze  ->  4 Results.
// Everything the AI returns is real: fields it could not hear come back as
// "Not Mentioned" and are shown muted, never filled in.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Alert, Linking } from 'react-native';
import { Audio, AVPlaybackStatus } from 'expo-av';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Clipboard from 'expo-clipboard';
import {
  Mic, Square, Play, Pause, Trash2, Upload, RotateCcw, Copy, Sparkles, ChevronDown, ChevronUp, Check,
} from '../../icons';
import { leadAudioApi, LeadAudioAnalysis } from '../../lib/api';
import type { LeadFacts } from '../../lib/geminiAudio';
import { useToast } from '../Toast';
import { colors } from '../../theme';

const GREEN = '#1F4D3A';
const MINT = '#EEF3E9';
const NOT_MENTIONED = 'Not Mentioned';
/** Server rejects anything above this (the AI request limit is ~20 MB). */
const MAX_BYTES = 15 * 1024 * 1024;
/** 15 MB of 48 kbps AAC is ~40 min, so recording stops itself just before that. */
const MAX_RECORD_SEC = 38 * 60;

/**
 * Android records AAC-in-ADTS (.aac): a format the AI accepts directly. The usual
 * HIGH_QUALITY preset writes .m4a, which the AI may refuse. 16 kHz mono is plenty
 * for speech and keeps a long meeting well under the upload limit.
 */
const RECORDING_OPTIONS: Audio.RecordingOptions = {
  isMeteringEnabled: false,
  android: {
    extension: '.aac',
    outputFormat: Audio.AndroidOutputFormat.AAC_ADTS,
    audioEncoder: Audio.AndroidAudioEncoder.AAC,
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 48000,
  },
  ios: {
    extension: '.wav',
    outputFormat: Audio.IOSOutputFormat.LINEARPCM,
    audioQuality: Audio.IOSAudioQuality.MEDIUM,
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 256000,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: { mimeType: 'audio/webm', bitsPerSecond: 48000 },
};

const EXT_MIME: Record<string, string> = {
  mp3: 'audio/mpeg', wav: 'audio/wav', aac: 'audio/aac', m4a: 'audio/mp4',
  mp4: 'audio/mp4', ogg: 'audio/ogg', flac: 'audio/flac',
};

/** Picks a mime type the server accepts, from the picker's mime or the extension. */
function resolveMime(name: string, pickerMime?: string | null): string | null {
  const ext = (name.split('.').pop() || '').toLowerCase();
  if (EXT_MIME[ext]) return EXT_MIME[ext];
  if (pickerMime && pickerMime.startsWith('audio/')) return pickerMime;
  return null;
}

const fmt = (sec: number) => {
  const s = Math.max(0, Math.floor(sec));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

type Phase = 'idle' | 'recording' | 'paused' | 'ready' | 'analyzing';
interface PickedAudio { uri: string; name: string; mimeType: string; durationSec: number; source: 'recorded' | 'uploaded' }

// ── Small player used for the preview and for saved recordings ──────────────
function AudioPlayer({ uri, durationSec, onDuration }: {
  uri: string; durationSec?: number; onDuration?: (sec: number) => void;
}) {
  const soundRef = useRef<Audio.Sound | null>(null);
  const [playing, setPlaying] = useState(false);
  const [posMs, setPosMs] = useState(0);
  const [durMs, setDurMs] = useState((durationSec || 0) * 1000);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  const release = useCallback(() => {
    soundRef.current?.unloadAsync().catch(() => {});
    soundRef.current = null;
  }, []);
  useEffect(() => { release(); setPlaying(false); setPosMs(0); setFailed(false); }, [uri, release]);
  useEffect(() => release, [release]);

  const onStatus = useCallback((st: AVPlaybackStatus) => {
    if (!st.isLoaded) return;
    setPosMs(st.positionMillis);
    if (st.durationMillis) setDurMs(st.durationMillis);
    setPlaying(st.isPlaying);
    if (st.didJustFinish) {
      setPlaying(false);
      setPosMs(0);
      soundRef.current?.setPositionAsync(0).catch(() => {});
    }
  }, []);

  const toggle = async () => {
    try {
      if (!soundRef.current) {
        setLoading(true);
        await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
        const { sound, status } = await Audio.Sound.createAsync({ uri }, { shouldPlay: true }, onStatus);
        soundRef.current = sound;
        if (status.isLoaded && status.durationMillis) onDuration?.(Math.round(status.durationMillis / 1000));
        return;
      }
      const st = await soundRef.current.getStatusAsync();
      if (st.isLoaded && st.isPlaying) await soundRef.current.pauseAsync();
      else await soundRef.current.playAsync();
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  };

  const pct = durMs > 0 ? Math.min(100, (posMs / durMs) * 100) : 0;
  return (
    <View style={s.player}>
      <Pressable onPress={toggle} style={s.playBtn} hitSlop={6} accessibilityRole="button" accessibilityLabel={playing ? 'Pause' : 'Play'}>
        {loading ? <ActivityIndicator size="small" color="#fff" />
          : playing ? <Pause size={15} color="#fff" /> : <Play size={15} color="#fff" />}
      </Pressable>
      <View style={{ flex: 1 }}>
        <View style={s.track}><View style={[s.trackFill, { width: `${pct}%` }]} /></View>
        <Text style={s.playerTime}>
          {failed ? 'Could not play this audio' : `${fmt(posMs / 1000)} / ${fmt(durMs / 1000)}`}
        </Text>
      </View>
    </View>
  );
}

// ── Result building blocks ───────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  const missing = !value || value === NOT_MENTIONED;
  return (
    <View style={s.row}>
      <Text style={s.rowLabel}>{label}</Text>
      <Text style={[s.rowValue, missing && s.muted]}>{value || NOT_MENTIONED}</Text>
    </View>
  );
}

function Bullets({ items }: { items: string[] }) {
  if (!items?.length) return <Text style={[s.body, s.muted]}>{NOT_MENTIONED}</Text>;
  return (
    <View style={{ gap: 3 }}>
      {items.map((t, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: 6 }}>
          <Text style={s.body}>•</Text>
          <Text style={[s.body, { flex: 1 }]}>{t}</Text>
        </View>
      ))}
    </View>
  );
}

function CopyBlock({ label, text }: { label: string; text: string }) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  if (!text) return null;
  const copy = async () => {
    try {
      await Clipboard.setStringAsync(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('Could not copy');
    }
  };
  return (
    <View style={s.copyBlock}>
      <View style={s.copyHead}>
        <Text style={s.copyLabel}>{label}</Text>
        <Pressable onPress={copy} style={s.copyBtn} hitSlop={6} accessibilityRole="button" accessibilityLabel={`Copy ${label}`}>
          {copied ? <Check size={12} color={GREEN} /> : <Copy size={12} color={GREEN} />}
          <Text style={s.copyBtnTxt}>{copied ? 'Copied' : 'Copy'}</Text>
        </Pressable>
      </View>
      <Text style={s.body} selectable>{text}</Text>
    </View>
  );
}

const interestColor = (v: string) =>
  /high/i.test(v) ? '#15803D' : /medium/i.test(v) ? '#B45309' : /low/i.test(v) ? '#B91C1C' : '#6B7280';

function AnalysisView({ item }: { item: LeadAudioAnalysis }) {
  const [showTranscript, setShowTranscript] = useState(false);
  const a = item.analysis;
  const r = a.requirements;
  const l = a.leadAnalysis;
  const rec = a.recommendations;
  const plan = a.actionPlan;
  return (
    <View style={{ gap: 8 }}>
      {item.audio.available && item.audio.url && (
        <AudioPlayer uri={item.audio.url} durationSec={item.audio.durationSec} />
      )}

      <Section title="AI Summary">
        <Text style={s.body}>{a.summary}</Text>
      </Section>

      <Section title="Client Requirements">
        <Row label="Property type" value={r.propertyType} />
        <Row label="Intent" value={r.intent} />
        <Row label="Location" value={r.location} />
        <Row label="Budget" value={r.budget} />
        <Row label="BHK" value={r.bhk} />
        <Row label="Area / size" value={r.area} />
        <Row label="Possession" value={r.possession} />
        {r.otherPreferences.length > 0 && (<><Text style={s.subTitle}>Other preferences</Text><Bullets items={r.otherPreferences} /></>)}
        {r.unclear.length > 0 && (<><Text style={s.subTitle}>Still unclear</Text><Bullets items={r.unclear} /></>)}
      </Section>

      <Section title="Lead Analysis">
        <View style={s.row}>
          <Text style={s.rowLabel}>Interest</Text>
          <View style={[s.pill, { backgroundColor: interestColor(l.interestLevel) + '1A' }]}>
            <Text style={[s.pillTxt, { color: interestColor(l.interestLevel) }]}>{l.interestLevel}</Text>
          </View>
        </View>
        <Row label="Seriousness" value={l.seriousness} />
        <Row label="Budget clarity" value={l.budgetClarity} />
        <Row label="Requirement clarity" value={l.requirementClarity} />
        <Row label="Buying timeline" value={l.buyingTimeline} />
        {l.objections.length > 0 && (<><Text style={s.subTitle}>Objections</Text><Bullets items={l.objections} /></>)}
        {l.concerns.length > 0 && (<><Text style={s.subTitle}>Concerns</Text><Bullets items={l.concerns} /></>)}
      </Section>

      <Section title="AI Solutions & Recommendations">
        {rec.suitableProperties.length > 0 && (
          <>
            <Text style={s.subTitle}>Suitable properties</Text>
            {rec.suitableProperties.map((p, i) => (
              <View key={i} style={{ marginBottom: 4 }}>
                <Text style={[s.body, { fontWeight: '800' }]}>{p.name}</Text>
                {!!p.reason && <Text style={s.body}>{p.reason}</Text>}
              </View>
            ))}
          </>
        )}
        {rec.suitableConfigurations.length > 0 && (<><Text style={s.subTitle}>Suitable configurations</Text><Bullets items={rec.suitableConfigurations} /></>)}
        {rec.objectionHandling.length > 0 && (<><Text style={s.subTitle}>Handling objections</Text><Bullets items={rec.objectionHandling} /></>)}
        {rec.nextQuestions.length > 0 && (<><Text style={s.subTitle}>Ask the client next</Text><Bullets items={rec.nextQuestions} /></>)}
        <Row label="Follow-up strategy" value={rec.followUpStrategy} />
        {!!rec.suggestedStage && <Row label="Suggested stage" value={rec.suggestedStage} />}
      </Section>

      <Section title="Follow-up Plan">
        <Row label="Next action" value={plan.nextAction} />
        <Row label="When" value={plan.followUpWhen} />
        <CopyBlock label="WhatsApp message" text={plan.whatsappMessage} />
        <CopyBlock label="Follow-up message" text={plan.followUpMessage} />
        <CopyBlock label="Call script" text={plan.callScript} />
        {plan.questionsForNextCall.length > 0 && (<><Text style={s.subTitle}>Questions for the next call</Text><Bullets items={plan.questionsForNextCall} /></>)}
      </Section>

      {!!item.transcript && (
        <Pressable onPress={() => setShowTranscript((v) => !v)} style={s.section} accessibilityRole="button">
          <View style={s.copyHead}>
            <Text style={s.sectionTitle}>Transcript{item.language ? ` (${item.language})` : ''}</Text>
            {showTranscript ? <ChevronUp size={16} color={GREEN} /> : <ChevronDown size={16} color={GREEN} />}
          </View>
          {showTranscript && <Text style={[s.body, { marginTop: 6 }]} selectable>{item.transcript}</Text>}
        </Pressable>
      )}
    </View>
  );
}

// ── Main panel ───────────────────────────────────────────────────────────────
export default function LeadAudioGuide({ leadId, leadName, lead }: {
  leadId: string; leadName: string;
  /** Lead facts for the AI prompt (never the phone number). */
  lead?: LeadFacts;
}) {
  const toast = useToast();
  const [phase, setPhase] = useState<Phase>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [audio, setAudio] = useState<PickedAudio | null>(null);
  const [active, setActive] = useState<LeadAudioAnalysis | null>(null);
  const [history, setHistory] = useState<LeadAudioAnalysis[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const recRef = useRef<Audio.Recording | null>(null);
  const lastMsRef = useRef(0);
  const mountedRef = useRef(true);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      setHistory(await leadAudioApi.list(leadId));
    } catch (e: any) {
      setHistoryError(e?.message || 'Could not load previous analyses');
    } finally {
      if (mountedRef.current) setHistoryLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    mountedRef.current = true;
    loadHistory();
    return () => {
      mountedRef.current = false;
      // Leaving the screen mid-recording must release the microphone.
      recRef.current?.stopAndUnloadAsync().catch(() => {});
      recRef.current = null;
    };
  }, [loadHistory]);

  const resetAll = () => { setAudio(null); setActive(null); setElapsed(0); lastMsRef.current = 0; setPhase('idle'); };

  // ── Recording ──
  const startRecording = async () => {
    try {
      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          'Microphone permission needed',
          'Allow microphone access to record the conversation.',
          [{ text: 'Cancel', style: 'cancel' }, { text: 'Open Settings', onPress: () => Linking.openSettings().catch(() => {}) }],
        );
        return;
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const rec = new Audio.Recording();
      await rec.prepareToRecordAsync(RECORDING_OPTIONS);
      rec.setProgressUpdateInterval(500);
      rec.setOnRecordingStatusUpdate((st) => {
        lastMsRef.current = st.durationMillis || 0;
        if (mountedRef.current) setElapsed(Math.floor((st.durationMillis || 0) / 1000));
      });
      await rec.startAsync();
      recRef.current = rec;
      setActive(null);
      setAudio(null);
      setElapsed(0);
      lastMsRef.current = 0;
      setPhase('recording');
    } catch {
      toast.error('Could not start recording. Is another app using the microphone?');
    }
  };

  const pauseResume = async () => {
    const rec = recRef.current;
    if (!rec) return;
    try {
      if (phase === 'recording') { await rec.pauseAsync(); setPhase('paused'); }
      else if (phase === 'paused') { await rec.startAsync(); setPhase('recording'); }
    } catch {
      toast.error('Could not pause / resume');
    }
  };

  const stopRecording = useCallback(async () => {
    const rec = recRef.current;
    if (!rec) return;
    recRef.current = null;
    try {
      await rec.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false }).catch(() => {});
      const uri = rec.getURI();
      if (!uri) throw new Error('no file');
      const seconds = Math.max(1, Math.round(lastMsRef.current / 1000));
      const ext = uri.split('.').pop() || 'aac';
      setAudio({
        uri, name: `conversation-${Date.now()}.${ext}`,
        mimeType: resolveMime(`x.${ext}`) || 'audio/aac', durationSec: seconds, source: 'recorded',
      });
      setPhase('ready');
    } catch {
      toast.error('Recording could not be saved');
      setPhase('idle');
    }
  }, [toast]);

  // Auto-stop just under the upload limit.
  useEffect(() => {
    if ((phase === 'recording') && elapsed >= MAX_RECORD_SEC) {
      toast.show('Maximum recording length reached', 'info');
      stopRecording();
    }
  }, [elapsed, phase, stopRecording, toast]);

  // ── Upload ──
  const pickFile = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: ['audio/*'], copyToCacheDirectory: true });
      if (res.canceled || !res.assets?.[0]) return;
      const a = res.assets[0];
      const mime = resolveMime(a.name, a.mimeType);
      if (!mime) { toast.error('Unsupported file. Use MP3, WAV, M4A or AAC.'); return; }
      const size = a.size ?? ((await FileSystem.getInfoAsync(a.uri)) as any).size ?? 0;
      if (size > MAX_BYTES) { toast.error('Audio must be 15 MB or smaller.'); return; }
      setActive(null);
      setAudio({ uri: a.uri, name: a.name, mimeType: mime, durationSec: 0, source: 'uploaded' });
      setPhase('ready');
    } catch {
      toast.error('Could not open that file');
    }
  };

  // ── Analyze ──
  const analyze = async () => {
    if (!audio) return;
    try {
      const info = await FileSystem.getInfoAsync(audio.uri);
      if (info.exists && typeof (info as any).size === 'number' && (info as any).size > MAX_BYTES) {
        toast.error('Audio must be 15 MB or smaller.');
        return;
      }
    } catch { /* the server enforces the limit too */ }
    setPhase('analyzing');
    try {
      const { analysis } = await leadAudioApi.analyze({
        leadId, uri: audio.uri, name: audio.name, mimeType: audio.mimeType,
        durationSec: audio.durationSec, source: audio.source,
        lead: lead || { name: leadName },
      });
      if (!mountedRef.current) return;
      setHistory((prev) => [analysis, ...prev]);
      setActive(analysis);
      setAudio(null);
      setPhase('idle');
      toast.success('Analysis ready');
    } catch (e: any) {
      if (!mountedRef.current) return;
      // Keep the audio so the user can simply press Analyze again.
      setPhase('ready');
      toast.error(e?.message || 'AI analysis failed. Please try again.');
    }
  };

  const busy = phase === 'analyzing';
  const recording = phase === 'recording' || phase === 'paused';

  return (
    <View style={s.panel}>
      <View style={s.head}>
        <Sparkles size={15} color={GREEN} />
        <Text style={s.headTitle}>Voice Analysis</Text>
        <Text style={s.headSub} numberOfLines={1}>{leadName}</Text>
      </View>
      <Text style={s.hint}>
        Record or upload a conversation. AI turns it into a summary, requirements and a follow-up plan.
      </Text>

      {/* 1. Record / Upload */}
      {phase === 'idle' && !audio && (
        <View style={s.actions}>
          <Pressable onPress={startRecording} style={[s.bigBtn, s.bigBtnPrimary]} accessibilityRole="button" accessibilityLabel="Record voice">
            <Mic size={16} color="#fff" />
            <Text style={s.bigBtnPrimaryTxt}>Record Voice</Text>
          </Pressable>
          <Pressable onPress={pickFile} style={s.bigBtn} accessibilityRole="button" accessibilityLabel="Upload audio">
            <Upload size={16} color={GREEN} />
            <Text style={s.bigBtnTxt}>Upload Audio</Text>
          </Pressable>
        </View>
      )}

      {/* Live recording controls */}
      {recording && (
        <View style={s.recBox}>
          <View style={s.recTop}>
            <View style={[s.recDot, phase === 'paused' && { backgroundColor: '#9CA3AF' }]} />
            <Text style={s.recTime}>{fmt(elapsed)}</Text>
            <Text style={s.recState}>{phase === 'paused' ? 'Paused' : 'Recording…'}</Text>
          </View>
          <View style={s.recControls}>
            <Pressable onPress={pauseResume} style={s.ctrlBtn} accessibilityRole="button" accessibilityLabel={phase === 'paused' ? 'Resume' : 'Pause'}>
              {phase === 'paused' ? <Play size={16} color={GREEN} /> : <Pause size={16} color={GREEN} />}
              <Text style={s.ctrlTxt}>{phase === 'paused' ? 'Resume' : 'Pause'}</Text>
            </Pressable>
            <Pressable onPress={stopRecording} style={[s.ctrlBtn, s.ctrlStop]} accessibilityRole="button" accessibilityLabel="Stop recording">
              <Square size={14} color="#fff" />
              <Text style={[s.ctrlTxt, { color: '#fff' }]}>Stop</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* 2. Preview + 3. Analyze */}
      {(phase === 'ready' || busy) && audio && (
        <View style={s.previewBox}>
          <Text style={s.previewName} numberOfLines={1}>
            {audio.source === 'recorded' ? 'Recorded conversation' : audio.name}
            {audio.durationSec > 0 ? `  ·  ${fmt(audio.durationSec)}` : ''}
          </Text>
          <AudioPlayer
            uri={audio.uri}
            durationSec={audio.durationSec}
            onDuration={(sec) => setAudio((a) => (a && a.durationSec === 0 ? { ...a, durationSec: sec } : a))}
          />
          {busy ? (
            <View style={s.analyzing}>
              <ActivityIndicator color={GREEN} />
              <Text style={s.analyzingTxt}>AI is listening and analysing… this can take up to a minute.</Text>
            </View>
          ) : (
            <View style={s.previewActions}>
              <Pressable onPress={analyze} style={[s.bigBtn, s.bigBtnPrimary, { flex: 1 }]} accessibilityRole="button" accessibilityLabel="Analyze conversation">
                <Sparkles size={15} color="#fff" />
                <Text style={s.bigBtnPrimaryTxt}>Analyze Conversation</Text>
              </Pressable>
              <Pressable onPress={startRecording} style={s.iconBtn} hitSlop={6} accessibilityRole="button" accessibilityLabel="Re-record">
                <RotateCcw size={16} color={GREEN} />
              </Pressable>
              <Pressable onPress={resetAll} style={s.iconBtn} hitSlop={6} accessibilityRole="button" accessibilityLabel="Delete audio">
                <Trash2 size={16} color="#B91C1C" />
              </Pressable>
            </View>
          )}
        </View>
      )}

      {/* 4. Results */}
      {active && !busy && (
        <View style={{ gap: 8 }}>
          <View style={s.resultHead}>
            <Text style={s.resultTitle}>Analysis · {new Date(active.analyzedAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</Text>
            <Pressable onPress={resetAll} hitSlop={6} accessibilityRole="button" accessibilityLabel="Close analysis">
              <Text style={s.linkTxt}>New recording</Text>
            </Pressable>
          </View>
          <AnalysisView item={active} />
        </View>
      )}

      {/* Previous analyses for this lead */}
      {!recording && !busy && (
        <View style={s.historyBox}>
          <Text style={s.sectionTitle}>Previous analyses</Text>
          {historyLoading ? (
            <ActivityIndicator color={GREEN} style={{ marginVertical: 8 }} />
          ) : historyError ? (
            <Pressable onPress={loadHistory} accessibilityRole="button">
              <Text style={[s.body, { color: '#B91C1C' }]}>{historyError}  ·  Tap to retry</Text>
            </Pressable>
          ) : history.length === 0 ? (
            <Text style={[s.body, s.muted]}>No recordings analysed for this lead yet.</Text>
          ) : (
            history.map((h) => {
              const open = active?.id === h.id;
              return (
                <Pressable key={h.id} onPress={() => setActive(open ? null : h)} style={[s.historyRow, open && { backgroundColor: MINT }]} accessibilityRole="button">
                  <View style={{ flex: 1 }}>
                    <Text style={s.historyDate}>
                      {new Date(h.analyzedAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      {h.audio.durationSec > 0 ? `  ·  ${fmt(h.audio.durationSec)}` : ''}
                    </Text>
                    <Text style={s.body} numberOfLines={2}>{h.analysis.summary}</Text>
                  </View>
                  {open ? <ChevronUp size={16} color={GREEN} /> : <ChevronDown size={16} color={GREEN} />}
                </Pressable>
              );
            })
          )}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  panel: { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(31,77,58,0.25)', padding: 12, gap: 10, marginBottom: 10 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headTitle: { fontSize: 14, fontWeight: '800', color: GREEN },
  headSub: { flex: 1, fontSize: 11, color: colors.muted, textAlign: 'right' },
  hint: { fontSize: 11.5, color: colors.muted2, lineHeight: 16 },

  actions: { flexDirection: 'row', gap: 8 },
  bigBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingVertical: 11, borderRadius: 12, borderWidth: 1, borderColor: GREEN, backgroundColor: '#fff' },
  bigBtnPrimary: { backgroundColor: GREEN },
  bigBtnTxt: { fontSize: 13, fontWeight: '700', color: GREEN },
  bigBtnPrimaryTxt: { fontSize: 13, fontWeight: '700', color: '#fff' },
  iconBtn: { width: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(31,77,58,0.3)' },

  recBox: { backgroundColor: MINT, borderRadius: 12, padding: 12, gap: 10 },
  recTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  recDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#DC2626' },
  recTime: { fontSize: 22, fontWeight: '800', color: GREEN, fontVariant: ['tabular-nums'] },
  recState: { fontSize: 12, color: colors.muted2 },
  recControls: { flexDirection: 'row', gap: 8 },
  ctrlBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: GREEN, backgroundColor: '#fff' },
  ctrlStop: { backgroundColor: '#B91C1C', borderColor: '#B91C1C' },
  ctrlTxt: { fontSize: 13, fontWeight: '700', color: GREEN },

  previewBox: { backgroundColor: MINT, borderRadius: 12, padding: 10, gap: 8 },
  previewName: { fontSize: 12, fontWeight: '700', color: GREEN },
  previewActions: { flexDirection: 'row', gap: 8, alignItems: 'stretch' },
  analyzing: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  analyzingTxt: { flex: 1, fontSize: 12, color: GREEN, fontWeight: '600' },

  player: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', borderRadius: 10, padding: 8, borderWidth: 1, borderColor: 'rgba(31,77,58,0.15)' },
  playBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: GREEN, alignItems: 'center', justifyContent: 'center' },
  track: { height: 4, borderRadius: 2, backgroundColor: 'rgba(31,77,58,0.15)', overflow: 'hidden' },
  trackFill: { height: 4, backgroundColor: GREEN },
  playerTime: { fontSize: 10.5, color: colors.muted2, marginTop: 4 },

  resultHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  resultTitle: { fontSize: 12.5, fontWeight: '800', color: GREEN },
  linkTxt: { fontSize: 12, fontWeight: '700', color: GREEN, textDecorationLine: 'underline' },

  section: { backgroundColor: MINT, borderRadius: 12, padding: 10, gap: 5 },
  sectionTitle: { fontSize: 10.5, fontWeight: '800', color: GREEN, textTransform: 'uppercase', letterSpacing: 0.7 },
  subTitle: { fontSize: 11, fontWeight: '800', color: colors.muted2, marginTop: 4 },
  row: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  rowLabel: { fontSize: 11.5, color: colors.muted2, width: 110 },
  rowValue: { flex: 1, fontSize: 12.5, fontWeight: '600', color: colors.ink, textAlign: 'right' },
  body: { fontSize: 12.5, color: colors.ink, lineHeight: 18 },
  muted: { color: colors.muted, fontStyle: 'italic', fontWeight: '400' },
  pill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 2 },
  pillTxt: { fontSize: 11.5, fontWeight: '800' },

  copyBlock: { backgroundColor: '#fff', borderRadius: 10, padding: 8, gap: 5, borderWidth: 1, borderColor: 'rgba(31,77,58,0.15)' },
  copyHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  copyLabel: { fontSize: 11, fontWeight: '800', color: GREEN },
  copyBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, borderWidth: 1, borderColor: GREEN },
  copyBtnTxt: { fontSize: 10.5, fontWeight: '700', color: GREEN },

  historyBox: { gap: 6 },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 8, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(31,77,58,0.12)' },
  historyDate: { fontSize: 10.5, fontWeight: '700', color: GREEN, marginBottom: 2 },
});
