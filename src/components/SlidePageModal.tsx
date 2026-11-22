// Full-screen page shown in a Modal that behaves like a pushed screen:
//   • opens by sliding in from the right (right → left)
//   • closes by sliding out to the right (left → right), then unmounts
//   • a swipe from the left edge drags the page back and closes it
// Bottom sheets should keep using a plain <Modal animationType="slide">; this
// is only for pages that cover the whole screen (details, group info ...).
//
// Animations use the native driver, so JS work on the page can't stutter them.

import React, { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Easing, Modal, PanResponder, StyleSheet, View } from 'react-native';

const EDGE = 24;          // width of the left-edge swipe zone (dp)
const CLOSE_DX = 0.28;    // fraction of the screen width that commits a close
const CLOSE_VX = 0.6;     // or a fling faster than this

export default function SlidePageModal({
  visible,
  onRequestClose,
  children,
  transparent = false,
  statusBarTranslucent = true,
  backgroundColor = '#EAF8EE',
}: {
  visible: boolean;
  onRequestClose: () => void;
  children: React.ReactNode;
  transparent?: boolean;
  statusBarTranslucent?: boolean;
  backgroundColor?: string;
}) {
  const W = Dimensions.get('window').width;
  const x = useRef(new Animated.Value(W)).current;
  const [mounted, setMounted] = useState(visible);
  const closeRef = useRef(onRequestClose);
  closeRef.current = onRequestClose;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      x.setValue(W);
      Animated.timing(x, { toValue: 0, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    } else if (mounted) {
      Animated.timing(x, { toValue: W, duration: 230, easing: Easing.in(Easing.cubic), useNativeDriver: true })
        .start(() => setMounted(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Edge swipe: only claims the gesture when it is clearly horizontal and
  // moving right, so vertical scrolling inside the page is never hijacked.
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => g.dx > 10 && Math.abs(g.dx) > Math.abs(g.dy) * 2,
      onPanResponderMove: (_e, g) => { x.setValue(Math.max(0, g.dx)); },
      onPanResponderRelease: (_e, g) => {
        if (g.dx > W * CLOSE_DX || g.vx > CLOSE_VX) {
          Animated.timing(x, { toValue: W, duration: 180, easing: Easing.out(Easing.quad), useNativeDriver: true })
            // The parent flips `visible` off; the effect above then unmounts.
            .start(() => closeRef.current());
        } else {
          Animated.spring(x, { toValue: 0, useNativeDriver: true, bounciness: 0, speed: 18 }).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(x, { toValue: 0, useNativeDriver: true, bounciness: 0, speed: 18 }).start();
      },
    }),
  ).current;

  if (!mounted) return null;

  return (
    <Modal
      visible
      transparent
      animationType="none"
      statusBarTranslucent={statusBarTranslucent}
      onRequestClose={onRequestClose}
    >
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { transform: [{ translateX: x }] },
          !transparent && { backgroundColor },
        ]}
      >
        {children}
        {/* Left-edge strip that starts the swipe-back gesture. */}
        <View style={st.edge} {...pan.panHandlers} />
      </Animated.View>
    </Modal>
  );
}

const st = StyleSheet.create({
  edge: { position: 'absolute', left: 0, top: 0, bottom: 0, width: EDGE },
});
