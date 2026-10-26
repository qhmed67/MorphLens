/**
 * Root.tsx — the Remotion entries: the Lab reel, the denoise reel and the
 * thumbnails.
 */
import React from 'react';
import { Composition } from 'remotion';
import { Reel } from './Reel';
import { DENOISE_DURATION, DenoiseReel } from './DenoiseReel';
import { SHOWREEL_DURATION, Showreel } from './ShowreelTimeline';
import { DenoiseThumbnail, ShowreelThumbnail, Thumbnail } from './Thumbnail';
import { VIDEO } from './styles/tokens';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="MorphLensReel"
        component={Reel}
        durationInFrames={1828}
        fps={VIDEO.fps}
        width={VIDEO.width}
        height={VIDEO.height}
        defaultProps={{}}
      />
      <Composition
        id="MorphLensDenoiseReel"
        component={DenoiseReel}
        durationInFrames={DENOISE_DURATION}
        fps={VIDEO.fps}
        width={VIDEO.width}
        height={VIDEO.height}
        defaultProps={{}}
      />
      <Composition
        id="MorphLensShowreel"
        component={Showreel}
        durationInFrames={SHOWREEL_DURATION}
        fps={VIDEO.fps}
        width={VIDEO.width}
        height={VIDEO.height}
        defaultProps={{}}
      />
      <Composition
        id="MorphLensThumbnail"
        component={Thumbnail}
        durationInFrames={1}
        fps={VIDEO.fps}
        width={VIDEO.width}
        height={VIDEO.height}
        defaultProps={{}}
      />
      <Composition
        id="MorphLensShowreelThumbnail"
        component={ShowreelThumbnail}
        durationInFrames={1}
        fps={VIDEO.fps}
        width={VIDEO.width}
        height={VIDEO.height}
        defaultProps={{}}
      />
      <Composition
        id="MorphLensDenoiseThumbnail"
        component={DenoiseThumbnail}
        durationInFrames={1}
        fps={VIDEO.fps}
        width={VIDEO.width}
        height={VIDEO.height}
        defaultProps={{}}
      />
    </>
  );
};
