import monthlyMembershipCharge, {
  type MembershipTermsCard,
} from '@/app/_cellar/utils/monthlyMembershipCharge';

export interface MembershipExampleProps {
  terms: MembershipTermsCard;
}

const aed = (value: number) => `AED ${value.toLocaleString('en-GB', { maximumFractionDigits: 2 })}`;

/** A worked month at these terms, six cases over the allowance */
const MembershipExample = ({ terms }: MembershipExampleProps) => {
  const cases = Math.round(terms.includedCases) + 6;
  const { extraCases, totalAed } = monthlyMembershipCharge(cases, terms);

  return (
    <p className="text-text-muted mt-2 text-xs tabular-nums">
      e.g. {cases} cases → {aed(terms.membershipFeeAed)} + {extraCases} × {aed(terms.extraCaseMonthlyAed)} ={' '}
      <span className="text-text-primary font-semibold">{aed(totalAed)}</span> a month
    </p>
  );
};

export default MembershipExample;
