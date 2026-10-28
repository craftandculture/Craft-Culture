import CellarPageHeader from '@/app/_cellar/components/CellarPageHeader';

export interface WhatsNewHeroProps {
  /** Updates published since the member's last visit */
  newCount: number;
  counts: { feature: number; improvement: number; fix: number };
}

/**
 * The heading What's New opens with: the same heading as every cellar page,
 * with what is new since the member's last visit as a quiet second sentence
 */
const WhatsNewHero = ({ newCount }: WhatsNewHeroProps) => {
  return (
    <CellarPageHeader
      title="What’s New"
      description={
        <>
          Every improvement to your Private Cellar, in one place.
          {newCount > 0 && (
            <span className="text-text-primary">
              {' '}
              {newCount} new since your last visit.
            </span>
          )}
        </>
      }
    />
  );
};

export default WhatsNewHero;
