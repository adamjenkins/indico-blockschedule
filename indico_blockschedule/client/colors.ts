// This file is part of the Block Schedule plugin for Indico.
// Copyright (C) 2026 Adam Jenkins
//
// The Block Schedule plugin is free software; you can redistribute
// it and/or modify it under the terms of the MIT License;
// see the LICENSE file for more details.

function hexToRgb(hex: string): [number, number, number] {
  const normalized = hex.replace('#', '');
  return [
    parseInt(normalized.slice(0, 2), 16),
    parseInt(normalized.slice(2, 4), 16),
    parseInt(normalized.slice(4, 6), 16),
  ];
}

/** A pale tint of `hex`, suitable as a large background area behind dark text. */
export function paleBackground(hex: string, amount = 0.85): string {
  const [r, g, b] = hexToRgb(hex);
  const mix = (channel: number) => Math.round(channel + (255 - channel) * amount);
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}

/** WCAG relative luminance -- not the same thing as perceived brightness, and the difference
 * matters: the naive `0.299R + 0.587G + 0.114B` average this replaced put saturated blues and
 * reds on the wrong side of the black/white choice. */
function relativeLuminance(hex: string): number {
  const linear = hexToRgb(hex).map(value => {
    const channel = value / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

/** WCAG contrast ratio between two colours, from 1 (identical) to 21 (black on white). */
export function contrastRatio(a: string, b: string): number {
  const [lighter, darker] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x) as [
    number,
    number,
  ];
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Black or white text on `hex`, whichever has the higher contrast ratio.
 *
 * Black and white are the only two candidates on purpose. Taking the better of
 * the two can never do worse than 4.58:1 -- the crossover, where a background is
 * equally bad against both -- so *every* colour a manager can pick clears the
 * WCAG AA threshold of 4.5:1 for normal text. Softening the dark end to, say,
 * `#202020` would drop that guarantee to 4.33:1, which is why it is pure black.
 */
export function readableTextColor(hex: string): string {
  return contrastRatio(hex, '#000000') >= contrastRatio(hex, '#ffffff') ? '#000000' : '#ffffff';
}

/** Track id -> `rrggbb`, for looking up a contribution's badge colour. Tracks left on the
 * default are absent rather than mapped to a colour, so callers can tell "no choice made"
 * from "chosen, and it happens to be the default". */
export function trackColorMap(tracks: {id: number; color: string | null}[]): Map<number, string> {
  return new Map(
    tracks.filter(track => track.color).map(track => [track.id, track.color as string])
  );
}
