import { plainToClass } from 'class-transformer';
import { Wallet } from 'ethers';
import { Service, SynchronizedSubject } from '../common';
import { Account } from './classes';
import { AccountTypes } from './constants';

export class AccountService extends Service {
  readonly account$ = new SynchronizedSubject<Account>();

  get account(): Account {
    return this.account$.value;
  }

  get accountAddress(): string {
    return this.account ? this.account.address : null;
  }

  createAccountFromWallet(wallet: Wallet): void {
    const { address } = wallet;

    this.account$.next(
      plainToClass(Account, {
        address,
        type: AccountTypes.Key,
      }),
    );
  }
}
