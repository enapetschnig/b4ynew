export type Channel = 'email' | 'whatsapp';

export type AddressForm = 'du' | 'sie';

export type DelegationStatus = 
  | 'idle'
  | 'recording'
  | 'paused'
  | 'transcribing'
  | 'drafting'
  | 'ready'
  | 'sending'
  | 'sent'
  | 'error';

export interface Contact {
  id: string;
  user_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  tags: string[] | null;
  notes: string | null;
  address_form: AddressForm | null;
  created_at: string;
  updated_at: string;
}

export interface MediaFile {
  id: string;
  file: File;
  previewUrl: string;
  type: 'image' | 'video';
}

export interface Draft {
  id?: string;
  channel: Channel;
  recipient: Contact | null;
  recipientName: string;
  recipientAddress: string;
  subject: string;
  body: string;
  summary: string;
  originalTranscript: string;
  detectedRecipient?: string;
  addressForm: AddressForm;
  mediaFiles?: MediaFile[];
}

export interface ParsedMessage {
  recipient_name_raw: string;
  message_intent: string;
  key_points: string[];
  missing_fields: string[];
}

export interface GeneratedDraft {
  subject: string;
  body: string;
  summary: string;
  can_send: boolean;
  clarification_question?: string;
}

export interface Prompt {
  id: string;
  user_id: string;
  name: string;
  content: string;
  version: number;
  is_active: boolean;
  created_at: string;
}
