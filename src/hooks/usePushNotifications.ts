'use client';

import { useState, useEffect, useCallback } from 'react';

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray.buffer as ArrayBuffer;
}

export function usePushNotifications() {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    setIsSupported(supported);
    if (supported) {
      setPermission(Notification.permission);
      // Check existing subscription
      navigator.serviceWorker.ready.then((reg) => {
        reg.pushManager.getSubscription().then((sub) => {
          setIsSubscribed(!!sub);
        });
      });
    }
  }, []);

  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!isSupported || !VAPID_PUBLIC_KEY) return false;
    setIsLoading(true);
    try {
      const reg = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;

      const result = await Notification.requestPermission();
      setPermission(result);
      if (result !== 'granted') { setIsLoading(false); return false; }

      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      // Send subscription to server
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription.toJSON()),
      });

      if (res.ok) {
        setIsSubscribed(true);
        setIsLoading(false);
        return true;
      }
      setIsLoading(false);
      return false;
    } catch (err) {
      console.error('Push subscribe error:', err);
      setIsLoading(false);
      return false;
    }
  }, [isSupported]);

  const unsubscribe = useCallback(async (): Promise<boolean> => {
    if (!isSupported) return false;
    setIsLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const subscription = await reg.pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();
        await fetch('/api/push/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
      }
      setIsSubscribed(false);
      setIsLoading(false);
      return true;
    } catch (err) {
      console.error('Push unsubscribe error:', err);
      setIsLoading(false);
      return false;
    }
  }, [isSupported]);

  return { isSupported, isSubscribed, isLoading, permission, subscribe, unsubscribe };
}
