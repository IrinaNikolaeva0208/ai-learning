import { LookupFunction } from 'node:net';

import { ResolvedAddress } from './types/resolved-address.interface';

export function createPinnedLookup(
  addresses: ResolvedAddress[],
): LookupFunction {
  return (_hostname, options, callback): void => {
    const matching = addresses.filter(
      ({ family }) => !options.family || options.family === family,
    );
    const selected = matching.length > 0 ? matching : addresses;

    if (options.all) {
      callback(null, selected);
      return;
    }

    callback(null, selected[0].address, selected[0].family);
  };
}
