/**
 * ArabicOperationGuide — the per-filter Arabic explanation surface.
 *
 * The owner asked for one idea per filter, not a dictionary of symbols. The
 * content lives in `arabicExplain.ts`; this component provides two shapes:
 *
 *  - `ArabicOperationGuide`: a collapsible card for the Explain sheet / Denoise
 *    Arena, with the operation name in the subtitle.
 *  - `ArabicOperationContent`: bare content for the Arabic tab inside Trace's
 *    Maths/Code panel, where the panel already supplies the scroll container.
 */
import type { ReactNode } from 'react';
import { getOperation } from '@/engine';
import { getArabicExplain } from '../arabicExplain';
import { ArabicBullet, ArabicGuide, ArabicHeading, ArabicText } from './ArabicGuide';

type ContentProps = {
  opId: string;
};

/** Bare Arabic explanation body (no card, no scroll container). */
export function ArabicOperationContent({ opId }: ContentProps) {
  const entry = getArabicExplain(opId);
  if (!entry) {
    return <ArabicText>لسه مفيش شرح عربي للفلتر ده.</ArabicText>;
  }
  return (
    <>
      <ArabicHeading>الفكرة في سطر</ArabicHeading>
      <ArabicText>{entry.idea}</ArabicText>
      <ArabicHeading>بيشتغل إزاي؟</ArabicHeading>
      {entry.points.map((point, index) => (
        <ArabicBullet key={index}>{point}</ArabicBullet>
      ))}
      {entry.tryThis ? (
        <>
          <ArabicHeading>جرّب</ArabicHeading>
          <ArabicText>{entry.tryThis}</ArabicText>
        </>
      ) : null}
    </>
  );
}

type GuideProps = ContentProps & {
  /** Open immediately on a dedicated explanation surface. */
  defaultOpen?: boolean;
  testID?: string;
  children?: ReactNode;
};

/** Collapsible Arabic filter card for Explain sheets and Lab screens. */
export function ArabicOperationGuide({ opId, defaultOpen = false, testID, children }: GuideProps) {
  const entry = getArabicExplain(opId);
  if (!entry) return null;

  let name = opId;
  try {
    name = getOperation(opId).name;
  } catch {
    // A stale deep link can carry an unknown id; keep the Arabic text generic.
  }

  return (
    <ArabicGuide
      defaultOpen={defaultOpen}
      subtitle={`${name} · الفكرة قبل الرموز`}
      testID={testID}
      title="اشرح لي بالعربية"
    >
      <ArabicOperationContent opId={opId} />
      {children}
    </ArabicGuide>
  );
}
