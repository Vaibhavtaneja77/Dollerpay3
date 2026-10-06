export const REFERRAL_REWARD_INR = 500;
export const REFERRAL_QUALIFY_DEPOSIT_USDT = 500;
export const REFERRAL_MAX_BENEFITS = 5;

export function buildReferralLink(origin: string, referralCode: string) {
  return `${origin}/register?ref=${encodeURIComponent(referralCode)}`;
}
