import { describe, it, expect } from 'vitest';
import {
  Environment,
  Profile,
  Channel,
  ChannelMeta,
  TransactionState,
  TransactionStatus,
  CardBrand,
  ChallengeWindowSize,
  KomipayCode,
  Currency,
  FeeBearer,
} from '../src';

describe('enums', () => {
  it('exposes the two environments', () => {
    expect(Environment.Sandbox).toBe('sandbox');
    expect(Environment.Live).toBe('live');
  });

  it('exposes the two account profiles', () => {
    expect(Profile.Business).toBe('entreprise');
    expect(Profile.Aggregator).toBe('aggregateur');
  });

  it('maps every documented mobile_money channel', () => {
    expect(Channel.BankCard).toBe('bank_card');
    expect(Channel.AirtelMoney).toBe('airtel_money');
    expect(Channel.ZamaniCash).toBe('zamani_cash');
    expect(Channel.MoovFlooz).toBe('moov_flooz');
    expect(Channel.NitaTransfer).toBe('nita_transfert');
    expect(Channel.AmanaTransfer).toBe('amana_transfert');
    expect(Channel.ZeynaTransfer).toBe('zeyna_transfert');
  });

  it('uses the raw server literals for transaction state/status', () => {
    expect(TransactionState.Pending).toBe('ATTENTE');
    expect(TransactionState.Success).toBe('SUCCESS');
    expect(TransactionStatus.Success).toBe('Success');
    expect(TransactionStatus.Failed).toBe('Echec');
  });

  it('exposes card brands and codes', () => {
    expect(CardBrand.Visa).toBe('VISA');
    expect(CardBrand.Mastercard).toBe('MASTERCARD');
    expect(KomipayCode.Success).toBe(200);
    expect(KomipayCode.BadRequest).toBe(400);
    expect(KomipayCode.Unauthorized).toBe(401);
    expect(Currency.XOF).toBe('XOF');
  });

  it('exposes the accepted 3DS challenge window sizes', () => {
    expect(ChallengeWindowSize.W250x400).toBe('01');
    expect(ChallengeWindowSize.W390x400).toBe('02');
    expect(ChallengeWindowSize.W500x600).toBe('03');
    expect(ChallengeWindowSize.W600x400).toBe('04');
    expect(ChallengeWindowSize.Fullscreen).toBe('05');
  });

  it('exposes the fee bearer as the documented 1/0', () => {
    expect(FeeBearer.Payer).toBe(1);
    expect(FeeBearer.Receiver).toBe(0);
  });

  describe('ChannelMeta', () => {
    it('classifies card channels', () => {
      expect(ChannelMeta.isCard(Channel.BankCard)).toBe(true);
      expect(ChannelMeta.isCard(Channel.AirtelMoney)).toBe(false);
    });

    it('classifies operator wallets', () => {
      expect(ChannelMeta.isWallet(Channel.AirtelMoney)).toBe(true);
      expect(ChannelMeta.isWallet(Channel.ZamaniCash)).toBe(true);
      expect(ChannelMeta.isWallet(Channel.MoovFlooz)).toBe(true);
      expect(ChannelMeta.isWallet(Channel.BankCard)).toBe(false);
      expect(ChannelMeta.isWallet(Channel.NitaTransfer)).toBe(false);
    });

    it('classifies STA transfers', () => {
      expect(ChannelMeta.isTransfer(Channel.NitaTransfer)).toBe(true);
      expect(ChannelMeta.isTransfer(Channel.AmanaTransfer)).toBe(true);
      expect(ChannelMeta.isTransfer(Channel.ZeynaTransfer)).toBe(true);
      expect(ChannelMeta.isTransfer(Channel.AirtelMoney)).toBe(false);
    });

    it('flags Zeyna as needing the pre-step security code', () => {
      expect(ChannelMeta.requiresSecurityCode(Channel.ZeynaTransfer)).toBe(true);
      expect(ChannelMeta.requiresSecurityCode(Channel.NitaTransfer)).toBe(false);
    });
  });
});
