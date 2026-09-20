import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  LayoutAnimation,
  PixelRatio,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  UIManager,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { MAX_PHOTOS, createPlan, getQuality, getRatio } from '@collage/core';
import { useActiveLayout, useStudio } from '../state/store';
import { pickPhotos } from '../lib/picker';
import { renderCollage, saveToLibrary, shareCollage } from '../lib/export';
import { CollageStage } from '../components/CollageStage';
import { CellInspector } from '../components/CellInspector';
import { PhotosPanel } from '../components/PhotosPanel';
import { FormatPanel } from '../components/FormatPanel';
import { LayoutPanel } from '../components/LayoutPanel';
import { StylePanel } from '../components/StylePanel';
import { ActionButton } from '../components/ui';
import { colors, radius, spacing } from '../theme';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const TABS = [
  { id: 'photos', label: 'Photos' },
  { id: 'format', label: 'Format' },
  { id: 'layout', label: 'Layout' },
  { id: 'style', label: 'Style' },
] as const;

type TabId = (typeof TABS)[number]['id'];

type Busy = 'pick' | 'save' | 'share' | null;

export function EditorScreen() {
  const insets = useSafeAreaInsets();
  const canvasRef = useRef<View | null>(null);

  const [tab, setTab] = useState<TabId>('photos');
  const [box, setBox] = useState({ width: 0, height: 0 });
  const [busy, setBusy] = useState<Busy>(null);
  const [toast, setToast] = useState<string | null>(null);

  const photos = useStudio((state) => state.photos);
  const ratioId = useStudio((state) => state.ratioId);
  const style = useStudio((state) => state.style);
  const qualityId = useStudio((state) => state.qualityId);
  const format = useStudio((state) => state.format);
  const selected = useStudio((state) => state.selected);
  const error = useStudio((state) => state.error);
  const setError = useStudio((state) => state.setError);
  const addAssets = useStudio((state) => state.addAssets);
  const template = useActiveLayout();

  const ratio = getRatio(ratioId);
  const pixelRatio = PixelRatio.get();

  // The plan is laid out in points at `target pixels / pixel ratio`, so the
  // native capture lands exactly on the requested export resolution.
  const plan = useMemo(
    () =>
      createPlan({
        ratio,
        template,
        style,
        longEdge: getQuality(qualityId).longEdge / pixelRatio,
      }),
    [ratio, template, style, qualityId, pixelRatio],
  );

  const output = {
    width: Math.round(plan.canvas.width * pixelRatio),
    height: Math.round(plan.canvas.height * pixelRatio),
  };

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(timer);
  }, [toast]);

  const onStageLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setBox({ width, height });
  }, []);

  const handleAdd = useCallback(async () => {
    setBusy('pick');
    setError(null);
    try {
      const assets = await pickPhotos(MAX_PHOTOS - useStudio.getState().photos.length);
      if (assets.length > 0) {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        addAssets(assets);
        void Haptics.selectionAsync();
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(null);
    }
  }, [addAssets, setError]);

  const runExport = useCallback(
    async (mode: 'save' | 'share') => {
      if (useStudio.getState().photos.length === 0) {
        setError('Add at least one photo before exporting.');
        return;
      }
      setBusy(mode);
      setError(null);
      try {
        const uri = await renderCollage(canvasRef, format, format === 'jpeg' ? 0.92 : 1);
        if (mode === 'save') {
          await saveToLibrary(uri);
          setToast(`Saved to your photo library · ${output.width}×${output.height}px`);
        } else {
          await shareCollage(uri, format);
        }
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : String(cause));
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } finally {
        setBusy(null);
      }
    },
    [format, output.height, output.width, setError],
  );

  const ready = box.width > 0 && box.height > 0;

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.sm }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Collage Studio</Text>
          <Text style={styles.subtitle}>
            {ratio.shortLabel} · {template.name} · {output.width}×{output.height}px
          </Text>
        </View>
        <View style={styles.counter}>
          <Text style={styles.counterText}>
            {photos.length}/{MAX_PHOTOS}
          </Text>
        </View>
      </View>

      <View style={styles.stage} onLayout={onStageLayout}>
        {ready ? (
          <CollageStage
            plan={plan}
            photos={photos}
            box={box}
            canvasRef={canvasRef}
            selected={selected}
          />
        ) : null}
      </View>

      {error ? (
        <Pressable style={styles.banner} onPress={() => setError(null)}>
          <Text style={styles.bannerText}>{error}</Text>
        </Pressable>
      ) : null}
      {toast && !error ? (
        <View style={[styles.banner, styles.bannerSuccess]}>
          <Text style={styles.bannerText}>{toast}</Text>
        </View>
      ) : null}

      <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
        <CellInspector />

        <View style={styles.tabs}>
          {TABS.map((item) => (
            <Pressable
              key={item.id}
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === item.id }}
              onPress={() => setTab(item.id)}
              style={[styles.tab, tab === item.id && styles.tabActive]}
            >
              <Text style={[styles.tabLabel, tab === item.id && styles.tabLabelActive]}>
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <ScrollView
          style={styles.panel}
          contentContainerStyle={styles.panelContent}
          keyboardShouldPersistTaps="handled"
        >
          {tab === 'photos' ? <PhotosPanel onAdd={handleAdd} busy={busy === 'pick'} /> : null}
          {tab === 'format' ? <FormatPanel /> : null}
          {tab === 'layout' ? <LayoutPanel /> : null}
          {tab === 'style' ? <StylePanel /> : null}
        </ScrollView>

        <View style={styles.actions}>
          <ActionButton
            label="Save"
            variant="primary"
            busy={busy === 'save'}
            disabled={photos.length === 0 || busy !== null}
            onPress={() => void runExport('save')}
          />
          <ActionButton
            label="Share"
            busy={busy === 'share'}
            disabled={photos.length === 0 || busy !== null}
            onPress={() => void runExport('share')}
            style={styles.actionSpacing}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  title: { color: colors.text, fontSize: 20, fontWeight: '700' },
  subtitle: { color: colors.muted, fontSize: 12, marginTop: 2, fontVariant: ['tabular-nums'] },
  counter: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  counterText: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  stage: {
    flex: 1,
    minHeight: 160,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  banner: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,107,107,0.14)',
    borderWidth: 1,
    borderColor: colors.danger,
  },
  bannerSuccess: {
    backgroundColor: 'rgba(61,220,151,0.12)',
    borderColor: colors.success,
  },
  bannerText: { color: colors.text, fontSize: 12, lineHeight: 17 },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderTopWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    padding: 3,
    marginBottom: spacing.md,
  },
  tab: { flex: 1, paddingVertical: spacing.sm, borderRadius: radius.sm, alignItems: 'center' },
  tabActive: { backgroundColor: colors.surfaceAlt },
  tabLabel: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  tabLabelActive: { color: colors.text },
  panel: { maxHeight: 252 },
  panelContent: { paddingBottom: spacing.md },
  actions: { flexDirection: 'row', marginTop: spacing.sm },
  actionSpacing: { marginLeft: spacing.sm },
});
