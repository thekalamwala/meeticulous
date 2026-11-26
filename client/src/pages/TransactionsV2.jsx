// Transactions — the Money page's second tab (Kept). See ./money/MoneyV2.jsx.
import MoneyV2 from './money/MoneyV2';
import TransactionsTab from './money/TransactionsTab';

export default function TransactionsV2() {
  return <MoneyV2 tab="transactions">{({ verified }) => <TransactionsTab verified={verified} />}</MoneyV2>;
}
