// File: src/components/Peminjaman/PendingLoans.tsx
import React from 'react';
import { Loan } from '../../types'; // Unified Loan type

interface PendingLoansProps {
  loans: Loan[];
  userData: any;
}

const PendingLoans: React.FC<PendingLoansProps> = ({ loans, userData }) => {

  const getStatusClass = (status: string) => {
    const s = status.toLowerCase();
    if (s.includes('pending') || s.includes('menunggu')) return 'status-pending';
    if (s.includes('confirmed') || s.includes('terverifikasi')) return 'status-confirmed';
    return 'status-default';
  };
  
  // Filter hanya peminjaman yang relevan untuk user yang sedang login
  const username = userData?.username;
  const userLoans = loans.filter(loan => !username || loan.borrowerName === username);

  return (
    <div className="pending-loans-view">
      
      {userLoans.length === 0 ? (
        <div className="no-loans-message">
          <p>Anda belum memiliki riwayat peminjaman.</p>
        </div>
      ) : (
        <div className="borrowing-list">
          {userLoans.map((loan) => (
            <div key={loan.id} className="borrowing-list-item">
              <div className="item-details">
                <h4 className="item-title">{loan.bookTitle}</h4>
                <p className="item-kode">Kode Buku: {loan.kodeBuku}</p>
                <div className="item-dates">
                    <p>Pinjam: <span>{loan.loanDate}</span></p>
                    <p>Kembali Maks: <span>{loan.returnDate}</span></p>
                </div>
              </div>
              
              <div className="item-status-section">
                <div className={`item-status-badge ${getStatusClass(loan.status)}`}>
                  {loan.status}
                </div>
                
                {loan.status.toLowerCase().includes('pending') && (
                    <div className="pending-info">
                        <p>Tunjukkan kode ini ke petugas:</p>
                        <strong className="pending-kode-value">{loan.kodePinjam}</strong>
                    </div>
                )}

                {loan.status.toLowerCase().includes('confirmed') && (
                    <button className="btn-action btn-return-simulated">
                        Selesaikan Peminjaman
                    </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PendingLoans;