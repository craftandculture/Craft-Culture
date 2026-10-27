import { adminProcedure } from '@/lib/trpc/procedures';

import getUaeArrivalRateCard from '../data/getUaeArrivalRateCard';

/** The UAE arrival rate card added to every freight quote into the UAE */
const adminGetUaeArrivalRateCard = adminProcedure.query(async () => getUaeArrivalRateCard());

export default adminGetUaeArrivalRateCard;
