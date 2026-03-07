import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

export interface QueuedMessage {
  id: string;
  channel: 'email' | 'whatsapp';
  payload: {
    to: string;
    subject?: string;
    body: string;
    html?: string;
    recipientName: string;
    senderName?: string;
    replyTo?: string;
    fromEmail?: string;
    n8nWebhookUrl?: string;
    contactId?: string;
    userId: string;
  };
  attempts: number;
  createdAt: string;
  lastAttempt?: string;
}

const STORAGE_KEY = 'delegation_offline_queue';
const MAX_ATTEMPTS = 3;

export function useOfflineQueue() {
  const [queue, setQueue] = useState<QueuedMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // Load queue from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setQueue(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Failed to load offline queue:', e);
    }
  }, []);

  // Persist queue to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
    } catch (e) {
      console.error('Failed to save offline queue:', e);
    }
  }, [queue]);

  // Add message to queue
  const addToQueue = useCallback((channel: 'email' | 'whatsapp', payload: QueuedMessage['payload']) => {
    const message: QueuedMessage = {
      id: crypto.randomUUID(),
      channel,
      payload,
      attempts: 0,
      createdAt: new Date().toISOString(),
    };
    setQueue(prev => [...prev, message]);
    return message.id;
  }, []);

  // Remove message from queue
  const removeFromQueue = useCallback((id: string) => {
    setQueue(prev => prev.filter(m => m.id !== id));
  }, []);

  // Clear entire queue
  const clearQueue = useCallback(() => {
    setQueue([]);
  }, []);

  // Process a single message
  const processMessage = async (message: QueuedMessage): Promise<boolean> => {
    try {
      if (message.channel === 'email') {
        const webhookUrl = message.payload.n8nWebhookUrl;
        if (!webhookUrl) {
          throw new Error('n8n Webhook-URL fehlt');
        }

        const response = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: message.payload.to,
            from: message.payload.fromEmail || undefined,
            subject: message.payload.subject,
            html: message.payload.html,
            recipient_name: message.payload.recipientName,
            reply_to: message.payload.replyTo || undefined,
          }),
        });

        if (!response.ok) {
          throw new Error(`Email-Versand fehlgeschlagen: ${response.status}`);
        }

        await supabase.from('messages').insert({
          user_id: message.payload.userId,
          contact_id: message.payload.contactId || null,
          channel: 'email',
          recipient_name: message.payload.recipientName,
          recipient_address: message.payload.to,
          subject: message.payload.subject,
          body: message.payload.body,
          status: 'sent',
        });

        return true;
      } else {
        // WhatsApp (text only, no media for offline queue)
        const response = await supabase.functions.invoke('send-whatsapp', {
          body: {
            to: message.payload.to,
            body: message.payload.body,
            recipientName: message.payload.recipientName,
            contactId: message.payload.contactId,
          },
        });

        if (response.error || response.data?.error) {
          throw new Error(response.error?.message || response.data?.error);
        }

        return true;
      }
    } catch (e) {
      console.error('Failed to process queued message:', e);
      return false;
    }
  };

  // Process entire queue
  const processQueue = useCallback(async () => {
    if (isProcessing || queue.length === 0 || !navigator.onLine) return;
    
    setIsProcessing(true);
    let successCount = 0;
    let failCount = 0;

    for (const message of queue) {
      if (message.attempts >= MAX_ATTEMPTS) {
        failCount++;
        continue;
      }

      // Update attempt count
      setQueue(prev => prev.map(m => 
        m.id === message.id 
          ? { ...m, attempts: m.attempts + 1, lastAttempt: new Date().toISOString() }
          : m
      ));

      const success = await processMessage(message);
      
      if (success) {
        removeFromQueue(message.id);
        successCount++;
      } else {
        failCount++;
      }
    }

    setIsProcessing(false);

    if (successCount > 0) {
      toast.success(`${successCount} Nachricht${successCount > 1 ? 'en' : ''} erfolgreich gesendet`);
    }
    
    if (failCount > 0) {
      toast.error(`${failCount} Nachricht${failCount > 1 ? 'en' : ''} konnten nicht gesendet werden`);
    }
  }, [isProcessing, queue, removeFromQueue]);

  // Get messages that have exceeded max attempts
  const failedMessages = queue.filter(m => m.attempts >= MAX_ATTEMPTS);

  return {
    queue,
    queueLength: queue.length,
    failedCount: failedMessages.length,
    addToQueue,
    removeFromQueue,
    clearQueue,
    processQueue,
    isProcessing,
  };
}
