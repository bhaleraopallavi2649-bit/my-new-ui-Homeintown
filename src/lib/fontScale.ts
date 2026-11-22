// App-wide font sizing that follows the phone's screen.
//
// 1. Every <Text> font size (and its line height) is multiplied by FONT_SCALE,
//    which is the screen width relative to the 392dp width the screens were
//    designed on, kept between 0.9x and 1.1x so a small phone never gets tiny text
//    and a big one never overflows the cards.
// 2. The phone's own "font size" setting is capped at 1.15x, so a very large
//    system font cannot break the layouts.
//
// Call applyFontScaling() once, before anything renders (see app/_layout.tsx).
// To make all text a little bigger / smaller, change BASE_WIDTH (smaller number =
// bigger text) or the clamp below.

import { Dimensions, StyleSheet, Text, TextInput } from 'react-native';

const BASE_WIDTH = 392;
const MIN_SCALE = 0.9;
const MAX_SCALE = 1.1;

export const FONT_SCALE = Math.min(
  MAX_SCALE,
  Math.max(MIN_SCALE, Dimensions.get('window').width / BASE_WIDTH),
);

const MAX_OS_FONT_MULTIPLIER = 1.15;

let applied = false;

export function applyFontScaling(): void {
  if (applied) return;
  applied = true;

  // Cap the OS font-size setting for text and inputs.
  const T: any = Text;
  const TI: any = TextInput;
  T.defaultProps = { ...(T.defaultProps || {}), maxFontSizeMultiplier: MAX_OS_FONT_MULTIPLIER };
  TI.defaultProps = { ...(TI.defaultProps || {}), maxFontSizeMultiplier: MAX_OS_FONT_MULTIPLIER };

  if (Math.abs(FONT_SCALE - 1) < 0.01) return; // nothing to scale

  // Scale font sizes. Text is a forwardRef component, so wrap its render function.
  const originalRender = T.render;
  if (typeof originalRender !== 'function') return;
  T.render = function scaledTextRender(this: unknown, props: any, ref: any) {
    const flat: any = props?.style ? StyleSheet.flatten(props.style) : null;
    if (flat && typeof flat.fontSize === 'number') {
      const override: any = { fontSize: Math.round(flat.fontSize * FONT_SCALE * 10) / 10 };
      if (typeof flat.lineHeight === 'number') {
        override.lineHeight = Math.round(flat.lineHeight * FONT_SCALE * 10) / 10;
      }
      return originalRender.call(this, { ...props, style: [props.style, override] }, ref);
    }
    return originalRender.call(this, props, ref);
  };
}
