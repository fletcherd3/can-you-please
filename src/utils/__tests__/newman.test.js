jest.mock('newman', () => ({
  run: jest.fn(),
}));

jest.mock('../logger', () => ({
  appendLog: jest.fn(),
  resetLog: jest.fn(),
}));

const EventEmitter = require('events');
const newman = require('newman');
const { appendLog, resetLog } = require('../logger');
const { runNewman } = require('../newman');

describe('runNewman', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('ignores late request events after a failed request aborts the flow', async () => {
    const emitter = new EventEmitter();
    newman.run.mockReturnValue(emitter);

    const runPromise = runNewman({
      logPath: '/tmp/cyp.log',
      collection: {
        item: [
          {
            name: 'test-error-flow',
            item: [
              { name: 'successful-request' },
              { name: 'failing-request' },
              { name: 'should-not-run' },
            ],
          },
        ],
      },
      folder: 'test-error-flow',
      abortOnError: true,
    });

    const requestFactory = (name, statusCode, statusText) => ({
      item: { name },
      request: {
        method: 'GET',
        url: { toString: () => `https://example.com/${name}` },
        headers: { members: {}, get: jest.fn() },
      },
      response: {
        code: statusCode,
        status: statusText,
        headers: { members: {}, get: jest.fn() },
        stream: Buffer.from(''),
      },
    });

    emitter.emit('start');
    emitter.emit('beforeRequest', null, requestFactory('successful-request', 200, 'OK'));
    emitter.emit('request', null, requestFactory('successful-request', 200, 'OK'));
    emitter.emit('beforeRequest', null, requestFactory('failing-request', 504, 'Gateway Timeout'));
    emitter.emit('request', null, requestFactory('failing-request', 504, 'Gateway Timeout'));
    emitter.emit('request', null, requestFactory('should-not-run', 200, 'OK'));
    emitter.emit('done', null, {
      run: {
        timings: { started: 0, completed: 1000 },
        stats: { requests: { total: 2, failed: 1 }, tests: { total: 0, failed: 0 } },
      },
    });

    await expect(runPromise).rejects.toThrow('Flow failed due to request error');
    expect(resetLog).toHaveBeenCalled();
    expect(appendLog).toHaveBeenCalledTimes(2);
    expect(
      appendLog.mock.calls.some(([entry]) => entry.includes('Request: should-not-run'))
    ).toBe(false);
  });
});
