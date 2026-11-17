import { describe, it, expect } from 'vitest';
import { paymentFooterActionStateOf } from './paymentFooterActions';

describe('paymentFooterActionStateOf（フッターのボタンの活性）', () => {
  it.each([
    [
      '未申請',
      {
        noPayment: true,
        comment: true,
        sendBack: false,
        approve: false,
        seal: false,
        retrieve: false,
        apply: true,
        save: true,
      },
    ],
    [
      '支払無し',
      {
        noPayment: true,
        comment: false,
        sendBack: false,
        approve: false,
        seal: false,
        retrieve: false,
        apply: false,
        save: false,
      },
    ],
    [
      '承認待ち',
      {
        noPayment: false,
        comment: true,
        sendBack: true,
        approve: true,
        seal: false,
        retrieve: true,
        apply: false,
        save: false,
      },
    ],
    [
      '検印待ち',
      {
        noPayment: false,
        comment: true,
        sendBack: true,
        approve: false,
        seal: true,
        retrieve: true,
        apply: false,
        save: false,
      },
    ],
    [
      '承認差戻し',
      {
        noPayment: false,
        comment: true,
        sendBack: false,
        approve: false,
        seal: false,
        retrieve: false,
        apply: true,
        save: true,
      },
    ],
    // 自販機のステータス（UX-072）
    [
      'EDI登録済み',
      {
        noPayment: true,
        comment: true,
        sendBack: false,
        approve: false,
        seal: false,
        retrieve: false,
        apply: true,
        save: true,
      },
    ],
    [
      'AIC登録済み',
      {
        noPayment: true,
        comment: true,
        sendBack: false,
        approve: false,
        seal: false,
        retrieve: false,
        apply: true,
        save: true,
      },
    ],
    [
      '差戻し',
      {
        noPayment: false,
        comment: true,
        sendBack: false,
        approve: false,
        seal: false,
        retrieve: false,
        apply: true,
        save: true,
      },
    ],
    [
      '検印済',
      {
        noPayment: false,
        comment: false,
        sendBack: false,
        approve: false,
        seal: false,
        retrieve: false,
        apply: false,
        save: false,
      },
    ],
  ])('%s', (status, expected) => {
    expect(paymentFooterActionStateOf(status)).toEqual(expected);
  });
});
