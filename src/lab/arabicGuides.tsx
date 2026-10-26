/**
 * arabicGuides.tsx — every Arabic explanation in one place.
 *
 * The owner reads and edits the Arabic copy himself, so it must not be buried
 * inside five screen files. Each guide is a small component with a short,
 * child-level story: what the screen is about, what the numbers mean, and one
 * thing to try. No symbols, no glossary.
 *
 * Keep the copy short on purpose (owner, 2026-10-21): deep explanations made
 * the screens harder to read, not easier.
 */
import { ArabicGuide, ArabicHeading, ArabicText } from './components/ArabicGuide';

/** Denoise Arena: noise and the four filters that fight it. */
export function DenoiseArabicGuide() {
  return (
    <ArabicGuide subtitle="النويز والفلترة — الفكرة قبل الأرقام" title="اشرح لي بالعربية">
      <ArabicHeading>النويز إيه؟</ArabicHeading>
      <ArabicText>
        الصورة الأصلية فيها تفاصيل، والنويز حبيبات عشوائية اتضافت عليها. كل فلتر بيحاول
        يشيل الحبيبات ويرجّع التفاصيل بطريقة مختلفة.
      </ArabicText>
      <ArabicHeading>أنواع النويز</ArabicHeading>
      <ArabicText>
        Gaussian حبيبات ناعمة، Salt &amp; pepper نقط سوداء أو بيضاء، وSpeckle نويز
        مضروب في الصورة فبيبان أكتر في الأماكن الفاتحة.
      </ArabicText>
      <ArabicHeading>الفلاتر الأربعة</ArabicHeading>
      <ArabicText>
        المتوسط بيحسب الوسط، جاوسيان بيعمل blur ناعم، الميديان بياخد وسيط الترتيب (أحسن
        حاجة للنقط السوداء والبيضاء)، والبايليترال بينعّم بس ويحافظ على الحواف.
      </ArabicText>
      <ArabicText>جرّب نوع نويز مختلف وشوف الفلتر اللي بيكسب بيتغير.</ArabicText>
    </ArabicGuide>
  );
}

/** Histogram Surgery: pixels, histograms and the four tone mappings. */
export function HistogramArabicGuide() {
  return (
    <ArabicGuide
      subtitle="الهيستوجرام، الـCDF، وشدّ التباين — من غير رموز"
      title="اشرح لي بالعربية"
    >
      <ArabicHeading>الصورة أرقام</ArabicHeading>
      <ArabicText>
        كل بكسل رقم سطوع من 0 (أسود) لـ255 (أبيض). الهيستوجرام جدول بيقول لكل درجة سطوع
        ظهرت كام مرة.
      </ArabicText>
      <ArabicHeading>إيه اللي بيعمله كل واحد؟</ArabicHeading>
      <ArabicText>
        Equalize بيوزّع الدرجات بالتساوي. CLAHE بيعمل نفس الحاجة في مربعات صغيرة فبيطلع
        التفاصيل المحلية. Stretch بيمدّ المدى المستخدم على 0 و255. والمنحنى خريطة من
        صنعك: نقطة لفوق تفتّح المدى، ونقطة لتحت تغمقه.
      </ArabicText>
      <ArabicText>جرّب Equalize وبعدها CLAHE وقارن.</ArabicText>
    </ArabicGuide>
  );
}

/** Enhance Studio: the four-step pipeline. */
export function EnhanceArabicGuide() {
  return (
    <ArabicGuide subtitle="خط المعالجة بالترتيب — من غير رموز" title="اشرح لي بالعربية">
      <ArabicHeading>الفكرة</ArabicHeading>
      <ArabicText>
        أربع خطوات ورا بعض: نصحّح الألوان، نشيل النويز، نفتح التباين المحلي، وأخيراً نحدّد
        التفاصيل.
      </ArabicText>
      <ArabicText>جرّب تقفل خطوة واحدة في الوقت ده وشوف الصورة بتتأثر إزاي.</ArabicText>
    </ArabicGuide>
  );
}
