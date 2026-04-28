import { useState } from 'react';
import { AppShell } from '../../components/layout/AppShell';
import { PageContainer } from '../../components/layout/PageContainer';
import { Tabs } from '../../components/ui/Tabs';
import { BalanceCard } from './components/BalanceCard';
import { DepositSheet } from './components/DepositSheet';
import { WithdrawSheet } from './components/WithdrawSheet';
import { TransactionList } from './components/TransactionList';
import { ContributionList } from './components/ContributionList';

export default function WalletPage() {
  const [openSheet, setOpenSheet] = useState<'deposit' | 'withdraw' | null>(null);
  const [txPage, setTxPage] = useState(1);

  const TABS = [
    {
      id: 'transactions',
      label: 'Transactions',
      content: (
        <TransactionList
          page={txPage}
          onPageChange={setTxPage}
          onDepositClick={() => setOpenSheet('deposit')}
        />
      ),
    },
    {
      id: 'contributions',
      label: 'My Contributions',
      content: <ContributionList />,
    },
  ];

  return (
    <AppShell>
      <PageContainer>
        <h1 className="text-3xl font-bold text-text mb-4">My Wallet</h1>

        <BalanceCard
          onDepositClick={() => setOpenSheet('deposit')}
          onWithdrawClick={() => setOpenSheet('withdraw')}
        />

        <Tabs tabs={TABS} defaultTab="transactions" />

        <DepositSheet isOpen={openSheet === 'deposit'} onClose={() => setOpenSheet(null)} />
        <WithdrawSheet isOpen={openSheet === 'withdraw'} onClose={() => setOpenSheet(null)} />
      </PageContainer>
    </AppShell>
  );
}
