import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';

interface LegalModalFrameProps {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  widthClassName?: string;
  className?: string;
  contentClassName?: string;
  headerAccent?: 'blue' | 'green' | 'violet';
}

const headerAccentMap: Record<NonNullable<LegalModalFrameProps['headerAccent']>, string> = {
  blue: 'bg-gradient-to-b from-blue-600/15 via-slate-950/95 to-slate-950/90 border-blue-500/25',
  green: 'bg-gradient-to-b from-emerald-500/15 via-slate-950/95 to-slate-950/90 border-emerald-500/25',
  violet: 'bg-gradient-to-b from-violet-500/15 via-slate-950/95 to-slate-950/90 border-violet-500/25',
};

export function LegalModalFrame({
  icon,
  title,
  subtitle,
  onClose,
  children,
  footer,
  widthClassName = 'max-w-2xl',
  className,
  contentClassName,
  headerAccent = 'blue',
}: LegalModalFrameProps) {
  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/75 p-4 backdrop-blur-xl">
      <Card
        variant="premium"
        className={`flex w-full ${widthClassName} max-h-[85vh] flex-col overflow-hidden rounded-2xl border border-primary/30 bg-slate-950/85 shadow-[0_35px_70px_-25px_rgba(37,99,235,0.45)] backdrop-blur-xl transition-shadow duration-300 hover:shadow-[0_40px_80px_-20px_rgba(79,70,229,0.55)] ${className ?? ''}`}
      >
        <div
          className={`sticky top-0 z-10 flex items-center justify-between border-b px-6 pb-5 pt-6 backdrop-blur-xl ${
            headerAccentMap[headerAccent] ?? headerAccentMap.blue
          }`}
        >
          <div className="flex items-center space-x-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500/20 via-blue-500/10 to-blue-400/20 ring-1 ring-inset ring-blue-500/40 shadow-[0_0_32px_rgba(59,130,246,0.35)]">
              {icon}
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white tracking-tight">{title}</h2>
              {subtitle && <p className="text-sm text-slate-300/80">{subtitle}</p>}
            </div>
          </div>
          <Button
            onClick={onClose}
            variant="ghost"
            size="icon"
            className="text-slate-400 hover:bg-white/5 hover:text-white"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
        <div className={`flex-1 overflow-y-auto px-6 pb-7 ${contentClassName ?? ''}`}>{children}</div>
        {footer && (
          <div className="sticky bottom-0 z-10 flex items-center justify-end gap-3 border-t border-slate-800/80 bg-slate-950/90 px-6 py-5 backdrop-blur-xl">
            {footer}
          </div>
        )}
      </Card>
    </div>
  );
}


