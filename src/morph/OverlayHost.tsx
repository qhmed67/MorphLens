/**
 * OverlayHost — a single root-level absolute layer for container-transform
 * panels, so `measureInWindow` coordinates match the screen (SKILL §5.2).
 *
 * Overlays are discrete events (open/close), never per-frame state.
 * No dev build required.
 */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { z } from '@/core/tokens';

type OverlayApi = {
  show: (node: ReactNode) => void;
  hide: () => void;
};

const OverlayContext = createContext<OverlayApi | null>(null);

/** Wrap the app once (root layout). */
export function OverlayProvider({ children }: { children: ReactNode }) {
  const [node, setNode] = useState<ReactNode>(null);
  const show = useCallback((next: ReactNode) => setNode(next), []);
  const hide = useCallback(() => setNode(null), []);
  const api = useMemo(() => ({ show, hide }), [show, hide]);

  return (
    <OverlayContext.Provider value={api}>
      <View style={styles.root}>
        {children}
        <View pointerEvents={node ? 'box-none' : 'none'} style={styles.host}>
          {node}
        </View>
      </View>
    </OverlayContext.Provider>
  );
}

/** Access the root overlay host from any screen/component. */
export function useOverlay(): OverlayApi {
  const api = useContext(OverlayContext);
  if (!api) throw new Error('useOverlay must be used inside OverlayProvider');
  return api;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  host: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: z.overlay,
  },
});
