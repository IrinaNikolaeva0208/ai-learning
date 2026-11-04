import { validateEnvironment } from './validate-environment';

describe('validateEnvironment', () => {
  const valid = { DATABASE_URL: 'file:../data/dev.db' };

  it('returns the full config, including unrelated variables', () => {
    const config = {
      ...valid,
      PORT: '3000',
      METADATA_WORKER_ENABLED: 'false',
      NODE_ENV: 'test',
    };

    expect(validateEnvironment(config)).toBe(config);
  });

  it('allows PORT and METADATA_WORKER_ENABLED to be unset', () => {
    expect(validateEnvironment(valid)).toBe(valid);
  });

  it.each(['1', '80', '65535'])('accepts PORT %s', (PORT) => {
    expect(() => validateEnvironment({ ...valid, PORT })).not.toThrow();
  });

  it.each(['true', 'false'])(
    'accepts METADATA_WORKER_ENABLED %s',
    (METADATA_WORKER_ENABLED) => {
      expect(() =>
        validateEnvironment({ ...valid, METADATA_WORKER_ENABLED }),
      ).not.toThrow();
    },
  );

  it.each([
    ['missing', {}],
    ['empty', { DATABASE_URL: '' }],
  ])('rejects a %s DATABASE_URL', (_name, config) => {
    expect(() => validateEnvironment(config)).toThrow(
      'Invalid environment: DATABASE_URL is required',
    );
  });

  it.each(['', 'abc', '0', '65536', '+80', '-1', '3e3', '0x50', '80.5', ' 80'])(
    'rejects PORT %p',
    (PORT) => {
      expect(() => validateEnvironment({ ...valid, PORT })).toThrow(
        'Invalid environment: PORT must be an integer between 1 and 65535',
      );
    },
  );

  it.each(['', 'FALSE', 'True', 'yes', '0', '1'])(
    'rejects METADATA_WORKER_ENABLED %p',
    (METADATA_WORKER_ENABLED) => {
      expect(() =>
        validateEnvironment({ ...valid, METADATA_WORKER_ENABLED }),
      ).toThrow(
        'Invalid environment: METADATA_WORKER_ENABLED must be true or false',
      );
    },
  );

  it('reports every invalid variable without echoing any value', () => {
    const secret = 'postgres://user:hunter2@host/db';
    let message = '';

    try {
      validateEnvironment({
        PORT: secret,
        METADATA_WORKER_ENABLED: secret,
      });
    } catch (error) {
      message = (error as Error).message;
    }

    expect(message).toContain('DATABASE_URL');
    expect(message).toContain('PORT');
    expect(message).toContain('METADATA_WORKER_ENABLED');
    expect(message).not.toContain('hunter2');
  });
});
