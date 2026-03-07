import { Mail, MessageCircle } from 'lucide-react';
import { Channel } from '@/types/delegation';
import { cn } from '@/lib/utils';

interface ChannelToggleProps {
  channel: Channel;
  onChange: (channel: Channel) => void;
}

export function ChannelToggle({ channel, onChange }: ChannelToggleProps) {
  return (
    <div className="channel-toggle">
      <button
        type="button"
        onClick={() => onChange('email')}
        className={cn('channel-btn email', channel === 'email' && 'active')}
      >
        <Mail className="w-5 h-5" />
        <span>E-Mail</span>
      </button>
      <button
        type="button"
        onClick={() => onChange('whatsapp')}
        className={cn('channel-btn whatsapp', channel === 'whatsapp' && 'active')}
      >
        <MessageCircle className="w-5 h-5" />
        <span>WhatsApp</span>
      </button>
    </div>
  );
}
