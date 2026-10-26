/**
 * Thumbnail.tsx — the platform thumbnail.
 *
 * Designed separately from the reel, in the house style: the photo in a card,
 * one keyword in the accent, and the app's mark.
 */
import React from 'react';
import { AbsoluteFill, Img, staticFile } from 'remotion';
import { color, font, radius, space } from './styles/tokens';

export const Thumbnail: React.FC = () => (
  <AbsoluteFill style={{ background: color.paper }}>
    <AbsoluteFill
      style={{
        backgroundImage: `radial-gradient(rgba(20,20,18,0.055) 1.4px, transparent 1.4px)`,
        backgroundSize: '34px 34px',
      }}
    />

    <div
      style={{
        position: 'absolute',
        top: 120,
        left: 72,
        right: 72,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 34, color: color.ink }}>
        MorphLens
      </div>
      <div
        style={{
          fontFamily: 'Rubik',
          fontWeight: 700,
          fontSize: 26,
          color: color.sub,
          direction: 'rtl',
        }}
      >
        مختبر الصور
      </div>
    </div>

    <div
      style={{
        position: 'absolute',
        left: 120,
        top: 300,
        width: 840,
        height: 1060,
        borderRadius: radius.lg,
        background: color.card,
        border: `1px solid ${color.hairline}`,
        boxShadow: '0 30px 70px rgba(60,50,40,0.16)',
        overflow: 'hidden',
        transform: 'rotate(-2deg)',
      }}
    >
      <Img
        src={staticFile('frames/hero.png')}
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
      />
    </div>

    <div
      style={{
        position: 'absolute',
        left: 72,
        right: 72,
        top: 1470,
        direction: 'rtl',
        textAlign: 'center',
        fontFamily: font.display,
        fontWeight: 800,
        fontSize: 72,
        lineHeight: '92px',
        color: color.ink,
      }}
    >
      كل صورة هي
      <br />
      <span style={{ color: color.good }}>أرقام</span>
    </div>
    <div
      style={{
        position: 'absolute',
        left: 72,
        right: 72,
        top: 1700,
        textAlign: 'center',
        fontFamily: font.body,
        fontSize: 30,
        color: color.sub,
      }}
    >
      سطوع · تباين · حدّة — بالأرقام الحقيقية
    </div>
  </AbsoluteFill>
);

/**
 * DenoiseThumbnail — the platform thumbnail for the median-filter reel.
 */
export const DenoiseThumbnail: React.FC = () => (
  <AbsoluteFill style={{ background: color.paper }}>
    <AbsoluteFill
      style={{
        backgroundImage: `radial-gradient(rgba(20,20,18,0.055) 1.4px, transparent 1.4px)`,
        backgroundSize: '34px 34px',
      }}
    />

    <div
      style={{
        position: 'absolute',
        top: 120,
        left: 72,
        right: 72,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 34, color: color.ink }}>
        MorphLens
      </div>
      <div style={{ fontFamily: 'Rubik', fontWeight: 700, fontSize: 26, color: color.sub, direction: 'rtl' }}>
        مختبر الصور
      </div>
    </div>

    <div
      style={{
        position: 'absolute',
        left: 120,
        top: 300,
        width: 840,
        height: 1060,
        borderRadius: radius.lg,
        background: color.card,
        border: `1px solid ${color.hairline}`,
        boxShadow: '0 30px 70px rgba(60,50,40,0.16)',
        overflow: 'hidden',
        transform: 'rotate(-2deg)',
      }}
    >
      <Img
        src={staticFile('frames/denoise/median.png')}
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
      />
    </div>

    <div
      style={{
        position: 'absolute',
        left: 72,
        right: 72,
        top: 1470,
        direction: 'rtl',
        textAlign: 'center',
        fontFamily: font.display,
        fontWeight: 800,
        fontSize: 66,
        lineHeight: '88px',
        color: color.ink,
      }}
    >
      التشويش راح
      <br />
      <span style={{ color: color.good }}>والحدة بقيت</span>
    </div>
    <div
      style={{
        position: 'absolute',
        left: 72,
        right: 72,
        top: 1690,
        textAlign: 'center',
        fontFamily: font.mono,
        fontSize: 28,
        color: color.sub,
      }}
    >
      PSNR 17.3 → 38.0 dB · SSIM 0.976
    </div>
  </AbsoluteFill>
);

/**
 * ShowreelThumbnail — the modern showreel's thumbnail: the neon shot, dark,
 * with the hot accent headline.
 */
export const ShowreelThumbnail: React.FC = () => (
  <AbsoluteFill style={{ background: '#EFEDE4' }}>
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      <Img
        src={staticFile('frames/showreel/neon.png')}
        style={{
          position: 'absolute',
          left: -60,
          top: 0,
          width: 1200,
          height: 1000,
          objectFit: 'cover',
        }}
      />
      <AbsoluteFill
        style={{
          background:
            'linear-gradient(180deg, rgba(239,237,228,0.22) 0%, rgba(239,237,228,0.05) 30%, rgba(239,237,228,0.88) 62%, #EFEDE4 100%)',
        }}
      />
    </AbsoluteFill>

    <div
      style={{
        position: 'absolute',
        top: 90,
        left: 64,
        right: 64,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}
    >
      <div
        style={{
          fontFamily: 'Space Grotesk',
          fontWeight: 700,
          fontSize: 32,
          color: 'rgba(244,245,247,0.95)',
          textShadow: '0 2px 14px rgba(0,0,0,0.35)',
        }}
      >
        MorphLens
      </div>
      <div
        style={{
          fontFamily: 'JetBrains Mono',
          fontSize: 22,
          color: 'rgba(244,245,247,0.72)',
          letterSpacing: 1,
          textShadow: '0 2px 14px rgba(0,0,0,0.35)',
        }}
      >
        3 FILTERS
      </div>
    </div>

    <div
      style={{
        position: 'absolute',
        left: 64,
        right: 64,
        top: 1140,
        direction: 'rtl',
        fontFamily: 'Rubik',
        fontWeight: 800,
        fontSize: 92,
        lineHeight: '104px',
        color: '#141412',
      }}
    >
      تلات صور.
      <br />
      <span style={{ color: color.good }}>وتلات فلاتر.</span>
    </div>
    <div
      style={{
        position: 'absolute',
        left: 64,
        right: 64,
        top: 1380,
        direction: 'rtl',
        fontFamily: 'Rubik',
        fontSize: 30,
        lineHeight: '42px',
        color: 'rgba(20,20,18,0.62)',
      }}
    >
      كل صورة بتتحوّل لأرقام… وبترجع أرقام تانية.
    </div>
    <div
      style={{
        position: 'absolute',
        left: 64,
        right: 64,
        top: 1620,
        display: 'flex',
        gap: 40,
      }}
    >
      {[
        { v: '20→90', l: 'سطوع' },
        { v: '17→38', l: 'ميديان' },
        { v: '190→219', l: 'حدّة' },
      ].map((s) => (
        <div
          key={s.l}
          style={{
            fontFamily: 'JetBrains Mono',
            fontSize: 26,
            color: color.ink,
          }}
        >
          {s.v}
          <div style={{ fontFamily: 'Rubik', fontSize: 20, color: color.sub }}>{s.l}</div>
        </div>
      ))}
    </div>
  </AbsoluteFill>
);
