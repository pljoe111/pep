export type NotificationType =
  | 'campaign_funded'
  | 'campaign_locked'
  | 'samples_shipped'
  | 'coa_uploaded'
  | 'campaign_resolved'
  | 'campaign_refunded'
  | 'deposit_confirmed'
  | 'withdrawal_sent'
  | 'withdrawal_failed';

// ─── Response DTOs ────────────────────────────────────────────────────────────

export interface NotificationDto {
  id: string;
  user_id: string;
  notification_type: NotificationType;
  campaign_id: string;
  title: string;
  message: string;
  is_read: boolean;
  sent_email: boolean;
  created_at: string;
  read_at: string | null;
}

export interface UnreadCountDto {
  count: number;
}

export interface MarkAllReadResponseDto {
  marked_count: number;
}
