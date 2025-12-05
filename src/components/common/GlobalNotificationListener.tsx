import React, { useEffect, useRef, useState } from 'react';
import { loanApi } from '../../services/api';
import NotificationToast from './NotificationToast';

interface LoanSnapshot {
  id: number;
  status?: string;
  finePaymentStatus?: string;
  bookTitle?: string;
}

const GlobalNotificationListener: React.FC = () => {
  const prevLoansRef = useRef<Record<number, LoanSnapshot>>({});
  const [toast, setToast] = useState<{ message: string; type: 'success'|'error'|'info' }|null>(null);

  useEffect(() => {
    const tick = async () => {
      try {
        // Loan approvals (poll every tick, dedupe by id)
        try {
          const data = await loanApi.notifications();
          if (data.success && data.notifications.length) {
            const newIds: number[] = [];
            for (const n of data.notifications) {
              const key = `approval_notif_${n.id}`;
              if (!sessionStorage.getItem(key)) {
                setToast({ message: 'Pinjaman disetujui. Kode pinjam tersedia.', type: 'success' });
                sessionStorage.setItem(key, '1');
                newIds.push(n.id);
              }
            }
            if (newIds.length) {
              try { await loanApi.ackNotifications(newIds); } catch {}
            }
          }
        } catch {}

        // Return decisions (approved/rejected)
        try {
          const ret = await loanApi.returnNotifications();
          if (ret.success && ret.notifications.length) {
            const ackIds: number[] = [];
            for (const n of ret.notifications) {
              const key = `return_notif_${n.id}`;
              if (!sessionStorage.getItem(key)) {
                const formatCurrency = (v:number)=> new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',minimumFractionDigits:0}).format(Number(v||0));
                const msg = n.returnDecision === 'approved'
                  ? (n.fineAmount && n.fineAmount > 0
                      ? `Pengembalian buku "${n.bookTitle}" disetujui. Denda: ${formatCurrency(n.fineAmount)}.`
                      : `Pengembalian buku "${n.bookTitle}" disetujui.`)
                  : `Bukti pengembalian untuk "${n.bookTitle}" ditolak. Unggah ulang bukti yang lebih jelas.`;
                setToast({ message: msg, type: n.returnDecision === 'approved' ? 'success' : 'error' });
                sessionStorage.setItem(key, '1');
                ackIds.push(n.id);
              }
            }
            if (ackIds.length) {
              try { await loanApi.ackReturnNotifications(ackIds); } catch {}
            }
          }
        } catch {}

        // Loan request rejections
        try {
          const rej = await loanApi.rejectionNotifications();
          if (rej.success && rej.notifications.length) {
            const ackIds: number[] = [];
            for (const n of rej.notifications) {
              const key = `reject_notif_${n.id}`;
              if (!sessionStorage.getItem(key)) {
                setToast({ message: `Pengajuan pinjaman untuk "${n.bookTitle}" ditolak.`, type: 'error' });
                sessionStorage.setItem(key, '1');
                ackIds.push(n.id);
              }
            }
            if (ackIds.length) {
              try { await loanApi.ackRejectionNotifications(ackIds); } catch {}
            }
          }
        } catch {}

        // Fine payment approval/rejection detection via status transitions
        try {
          const loans = await loanApi.userLoans();
          const prev = prevLoansRef.current;
          const next: Record<number, LoanSnapshot> = {};
          const formatCurrency = (n: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(Number(n||0));
          for (const l of loans) {
            next[l.id] = { id: l.id, status: l.status, finePaymentStatus: (l as any).finePaymentStatus, bookTitle: l.bookTitle };
            const p = prev[l.id];
            useEffect(() => {
              const token = localStorage.getItem('token');
              if (!token) return; // jangan polling jika belum login
              let cancelled = false;
              const tick = async () => {
                try {
                  const data = await loanApi.notifications();
                  if (!cancelled && data?.success && data.notifications?.length) {
                    const newIds = data.notifications.map((n: any) => n.id);
                    onApprove?.(data.notifications);
                    try { await loanApi.ackNotifications(newIds); } catch {}
                  }
                } catch {}
                try {
                  const ret = await loanApi.returnNotifications();
                  if (!cancelled && ret?.success && ret.notifications?.length) {
                    onReturnDecision?.(ret.notifications);
                    const ackIds = ret.notifications.map((n: any) => n.id);
                    try { await loanApi.ackReturnNotifications(ackIds); } catch {}
                  }
                } catch {}
                try {
                  const rej = await loanApi.rejectionNotifications();
                  if (!cancelled && rej?.success && rej.notifications?.length) {
                    onReject?.(rej.notifications);
                    const ackIds = rej.notifications.map((n: any) => n.id);
                    try { await loanApi.ackRejectionNotifications(ackIds); } catch {}
                  }
                } catch {}
                try {
                  const loans = await loanApi.userLoans();
                  if (!cancelled && loans?.success) {
                    onLoansUpdate?.(loans.loans || []);
                  }
                } catch {}
              };
              const interval = setInterval(tick, 5000);
              return () => { cancelled = true; clearInterval(interval); };
            }, [onApprove, onReject, onReturnDecision, onLoansUpdate]);
                  sessionStorage.setItem(key, '1');
                }
              }
            } else {
              // First observation: if already awaiting_proof, inform once per session
              if ((l as any).finePaymentStatus === 'awaiting_proof') {
                const amount = (l as any).fineAmount ?? (l as any).penaltyAmount ?? 0;
                const key = `fine_imposed_${l.id}`;
                if (!sessionStorage.getItem(key)) {
                  setToast({ message: `Anda menerima denda sebesar ${formatCurrency(amount)} untuk "${l.bookTitle}".`, type: 'info' });
                  sessionStorage.setItem(key, '1');
                }
              }
            }
          }
          prevLoansRef.current = next;
        } catch {}
      } catch {}
    };

    const interval = setInterval(tick, 3000);
    tick();
    return () => clearInterval(interval);
  }, []);

  return (
    <>
      {toast && (
        <NotificationToast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </>
  );
};

export default GlobalNotificationListener;
