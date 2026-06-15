import { useEffect } from 'react';

export type ToastType = 'success' | 'error' | 'info';

interface ToastProps {
  msg: string;
  type: ToastType;
  onDone: () => void;
}

const COLORS: Record<ToastType, string> = {
  success: 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300',
  error:   'bg-red-500/15 border-red-500/40 text-red-300',
  info:    'bg-cyan/10 border-cyan/30 text-cyan',
};

export default function Toast({ msg, type, onDone }: ToastProps) {
  useEffect(() => {
    const t = setTimeout(onDone, 2800);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl border text-sm font-medium shadow-xl backdrop-blur-md ${COLORS[type]}`}
      style={{ animation: 'fadeSlideUp 0.3s ease' }}
    >
      {msg}
      <style>{`@keyframes fadeSlideUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }`}</style>
    </div>
  );
}
