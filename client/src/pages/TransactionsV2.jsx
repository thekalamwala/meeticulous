// Transactions — dashboard_v2 graduation. The existing Transactions page is
// already a modern, real-data view (filters, search, pagination, detail modal,
// CSV export). Rather than rebuild its money logic, we reuse it verbatim with
// `embedded` — that swaps only the hero for the shared Money SubNav + v2 heading.
import Transactions from './Transactions';

const TransactionsV2 = () => <Transactions embedded />;

export default TransactionsV2;
