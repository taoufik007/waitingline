import test from 'node:test';
import assert from 'node:assert/strict';

import { getPrintFailureMessage } from './printTicket.js';

test('printer errors return a clear user-facing message', () => {
  assert.equal(
    getPrintFailureMessage(new Error('Paper out')),
    'L’impression n’a pas été faite correctement. Vérifiez le papier thermique et l’état de l’imprimante.'
  );

  assert.equal(
    getPrintFailureMessage(new Error('Printer offline')),
    'L’impression n’a pas été faite correctement. Vérifiez le papier thermique et l’état de l’imprimante.'
  );

  assert.equal(
    getPrintFailureMessage(new Error('Délai d’impression dépassé.')),
    'L’impression n’a pas été faite correctement. Vérifiez le papier thermique et l’état de l’imprimante.'
  );
});
