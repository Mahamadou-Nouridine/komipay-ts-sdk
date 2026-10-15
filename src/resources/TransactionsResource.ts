import type { Session } from '../auth/AuthSession';
import type { KomipayCredentials } from '../config/KomipayConfig';
import { TransactionStatus } from '../models/enums';
import type { TransactionStatusResult } from './models';

/**
 * Transaction status polling (`/check-transaction-status`). A failed
 * transaction is a legitimate domain result, not an error, so this resource
 * reads the envelope with `allowFailure` and reports it instead of throwing.
 *
 * KomiPay holds this call open until the payer validates (up to 5 minutes per
 * their docs), so it overrides the client-wide 30 s default — otherwise a
 * still-pending transaction would surface as a timeout.
 */
const STATUS_TIMEOUT_MS = 5 * 60 * 1000;

export class TransactionsResource {
  constructor(
    private readonly session: Session,
    private readonly credentials: KomipayCredentials,
  ) {}

  async status(referenceTransaction: string): Promise<TransactionStatusResult> {
    const envelope = await this.session.authorized<{
      transactionStatus?: TransactionStatus;
    }>({
      method: 'POST',
      path: '/check-transaction-status',
      allowFailure: true,
      timeout: STATUS_TIMEOUT_MS,
      body: {
        apikey: this.credentials.apiKey,
        reference_transaction: referenceTransaction,
      },
    });

    const transactionStatus =
      envelope.data?.transactionStatus ??
      (envelope.statut ? TransactionStatus.Success : TransactionStatus.Failed);

    return {
      reference: referenceTransaction,
      transactionStatus,
      success: transactionStatus === TransactionStatus.Success,
      message: envelope.message,
    };
  }
}
