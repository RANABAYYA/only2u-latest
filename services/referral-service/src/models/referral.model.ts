export interface ReferralCode {
  id: string;
  user_id: string;
  code: string;
  is_active: boolean;
  usage_count: number;
  created_at: Date;
}

export interface CreateReferralCodeDto {
  user_id: string;
}

export interface RedeemReferralCodeDto {
  code: string;
  user_id: string;
}

