export interface FlourReceipt {
  id: number;
  receipt_number: string;
  issue_date: string;
  bag_count: number;
  driver_name: string;
  truck_number: string;
  driver_national_id: string;
  destination: string;
  description: string;
  created_at: string;
}

export type ActiveTab = 'paper' | 'list' | 'django-code' | 'about';
