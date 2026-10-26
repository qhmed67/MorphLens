/**
 * SceneFrame.tsx — the camera and the photo.
 *
 * The photo is never full-bleed in the house style: it lives *inside a card*
 * and the camera moves inside that card. `pointOn()` tells a scene where a
 * source pixel lands on screen, so overlays stay glued to the picture.
 */
import React, { type ReactNode } from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { color } from '../styles/tokens';
import { Page } from '../components/Chrome';

/** The photo's base space: the 960×1200 source rendered at 1280×1600. */
const PHOTO_W = 1280;
const PHOTO_H = 1600;

/** The lens. `origin` is the point of the frame the camera is anchored on. */
export type Camera = {
  /** 1 = the whole photo, 2.5 = a macro on the anchored point. */
  scale: number;
  /** Pan in frame pixels (the photo is 1280×1920 at scale 1). */
  x?: number;
  y?: number;
  /** Where the zoom is anchored, in % of the photo (47 %, 22 % = the ant). */
  originX?: number;
  originY?: number;
  /** How much of the photo's base space it occupies (the card's cover). */
  fit?: number;
  /** Where the card sits on the frame — the overlays are placed in frame space. */
  cardLeft?: number;
  cardTop?: number;
};

/**
 * A camera that frames the photo inside a card: the picture covers the card
 * exactly, and the zoom anchor sits at the card's centre.
 */
export function cameraForCard(
  cardLeft: number,
  cardTop: number,
  cardW: number,
  cardH: number,
  cam: Camera,
): Camera {
  const ox = ((cam.originX ?? 50) / 100) * PHOTO_W;
  const oy = ((cam.originY ?? 50) / 100) * PHOTO_H;
  // The anchor sits at the card's centre and the picture is scaled so that it
  // always *covers* the card from that point — a card must never show a strip
  // of bare background because the subject sat near the photo's edge.
  //   origin 50/50 → the whole photo covers the card (the wide framing)
  //   origin on the subject → a macro framing, always fully covered
  // 1.16 leaves a little slack, so the camera can also drift (pan) inside
  // the card without ever uncovering an edge of the picture.
  const fit =
    1.16 *
    Math.max(
      cardW / 2 / Math.min(ox, PHOTO_W - ox),
      cardH / 2 / Math.min(oy, PHOTO_H - oy),
    );
  return {
    ...cam,
    fit,
    // The photo is rendered *inside* the card, so these are card-local.
    x: cardW / 2 - ox + 100,
    y: cardH / 2 - oy,
    cardLeft,
    cardTop,
  };
}

export const SceneFrame: React.FC<{
  children: ReactNode;
  duration: number;
  fade?: number;
  /** The first scene fades in from nothing — set 0 to start on frame 0. */
  fadeIn?: number;
  motif?: boolean;
  /**
   * Frames, local to the scene, where the backdrop changes. Hand one to every
   * pop so the page under it moves too.
   */
  beats?: number[];
}> = ({ children, duration, fade = 14, fadeIn, motif = true, beats }) => {
  const frame = useCurrentFrame();
  const inFade = fadeIn ?? fade;
  const opacity =
    inFade <= 0
      ? interpolate(frame, [Math.max(0, duration - fade), duration], [1, 0], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        })
      : interpolate(
          frame,
          [0, inFade, Math.max(inFade + 1, duration - fade), duration],
          [0, 1, 1, 0],
          { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
        );
  return (
    <AbsoluteFill style={{ opacity }}>
      <Page motif={motif} beats={beats}>
        {children}
      </Page>
    </AbsoluteFill>
  );
};

/**
 * Where a source pixel lands on screen under a camera.
 */
export function pointOn(srcX: number, srcY: number, cam: Camera): { x: number; y: number } {
  const scale = (cam.scale ?? 1) * (cam.fit ?? 1);
  const ox = ((cam.originX ?? 50) / 100) * PHOTO_W;
  const oy = ((cam.originY ?? 50) / 100) * PHOTO_H;
  const ax = -100 + (cam.x ?? 0) + ox;
  const ay = (cam.y ?? 0) + oy;
  // The camera works in card-local space; the overlays live in frame space.
  return {
    x: ax + (srcX * (PHOTO_W / 960) - ox) * scale + (cam.cardLeft ?? 0),
    y: ay + (srcY * (PHOTO_H / 1200) - oy) * scale + (cam.cardTop ?? 0),
  };
}

/**
 * The photo, driven by the scene's camera. It is always placed inside a card
 * by the scene, so this is just the picture layer.
 */
export const PhotoLayer: React.FC<{
  src: string;
  camera?: Camera;
  /** 0 = photo untouched, 1 = photo fully veiled by the paper tone. */
  veil?: number;
}> = ({ src, camera, veil = 0 }) => {
  const { scale = 1, x = 0, y = 0, originX = 50, originY = 50, fit = 1 } = camera ?? {};
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      <img
        src={src}
        style={{
          position: 'absolute',
          left: -100 + x,
          top: y,
          width: PHOTO_W,
          height: PHOTO_H,
          objectFit: 'cover',
          transform: `scale(${fit * scale})`,
          transformOrigin: `${originX}% ${originY}%`,
        }}
      />
      {veil > 0 ? (
        <div style={{ position: 'absolute', inset: 0, background: `rgba(239,237,228,${veil})` }} />
      ) : null}
    </div>
  );
};

/** The small brand mark the references keep in the corner. */
export const BrandMark: React.FC<{ delay?: number }> = ({ delay = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfigSafe();
  const enter = interpolate(frame - delay, [0, 14], [0, 1], { extrapolateLeft: 'clamp' });
  return (
    <div
      style={{
        position: 'absolute',
        top: 96,
        left: 72,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        opacity: enter,
      }}
    >
      <div
        style={{
          width: 10,
          height: 10,
          borderRadius: 3,
          background: color.accent,
        }}
      />
      <span
        style={{
          fontFamily: 'Space Grotesk',
          fontWeight: 700,
          fontSize: 24,
          letterSpacing: 0.4,
          color: color.ink,
        }}
      >
        MorphLens
      </span>
    </div>
  );
};

/** A tiny local helper so BrandMark does not need the whole video config. */
function useVideoConfigSafe() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { useVideoConfig } = require('remotion') as typeof import('remotion');
  return useVideoConfig();
}
