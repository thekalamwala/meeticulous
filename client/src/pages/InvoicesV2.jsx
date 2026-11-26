// Invoices & tax — the Money page's third tab (Kept). See ./money/MoneyV2.jsx.
import MoneyV2 from './money/MoneyV2';
import InvoicesTab from './money/InvoicesTab';

export default function InvoicesV2() {
  return <MoneyV2 tab="invoices">{() => <InvoicesTab />}</MoneyV2>;
}
