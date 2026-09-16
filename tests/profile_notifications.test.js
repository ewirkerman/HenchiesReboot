import { jest } from '@jest/globals';

const mockSubscribeToFCMForeground = jest.fn();

jest.unstable_mockModule('../src/firebase.js', () => ({
  fetchUserProfile: async () => null,
  createUserProfile: async () => true,
  addFCMTokenToProfile: async () => true,
  requestFCMToken: async () => 'token-123',
  subscribeToFCMForeground: mockSubscribeToFCMForeground,
}));

const { resolveNotificationTargetUrl, listenForForegroundNotifications } = await import('../src/profile.js');

describe('Notification URL resolution', () => {
  test('resolves a game route from a relative path under localhost', () => {
    const baseUrl = 'http://localhost:8080/game.html';
    const result = resolveNotificationTargetUrl('game.html#game_abc', baseUrl);

    expect(result).toBe('http://localhost:8080/game.html#game_abc');
  });

  test('normalizes a leading slash path under GitHub Pages', () => {
    const baseUrl = 'https://ewirkerman.github.io/HenchiesReboot/game.html';
    const result = resolveNotificationTargetUrl('/game.html#game_xyz', baseUrl);

    expect(result).toBe('https://ewirkerman.github.io/HenchiesReboot/game.html#game_xyz');
  });

  test('preserves an absolute notification URL when one is supplied', () => {
    const baseUrl = 'https://ewirkerman.github.io/HenchiesReboot/game.html';
    const absoluteUrl = 'https://ewirkerman.github.io/HenchiesReboot/game.html#room_123';
    const result = resolveNotificationTargetUrl(absoluteUrl, baseUrl);

    expect(result).toBe(absoluteUrl);
  });
});

describe('Foreground notification handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.Notification = jest.fn().mockImplementation(() => ({
      close: jest.fn(),
      onclick: null,
    }));
    global.Notification.permission = 'granted';
    global.document = {
      hasFocus: () => false,
    };
    global.window = {
      location: { href: 'https://ewirkerman.github.io/HenchiesReboot/game.html' },
    };
  });

  test('subscribes to foreground messages and creates a browser notification with the exact target URL', () => {
    const handler = jest.fn();
    mockSubscribeToFCMForeground.mockImplementation((cb) => {
      handler.mockImplementation(cb);
    });

    listenForForegroundNotifications({ id: 'messaging-1' }, jest.fn());

    const payload = {
      data: {
        title: 'It\'s your turn!',
        body: 'Turn 7 has begun.',
        url: '/game.html#game_abc',
      },
    };

    handler(payload);

    expect(global.Notification).toHaveBeenCalledTimes(1);
    const notificationOptions = global.Notification.mock.calls[0][1];
    expect(notificationOptions.data.url).toBe('https://ewirkerman.github.io/HenchiesReboot/game.html#game_abc');
  });

  test('does not create a browser notification when the exact target game room is already focused', () => {
    const handler = jest.fn();
    mockSubscribeToFCMForeground.mockImplementation((cb) => {
      handler.mockImplementation(cb);
    });

    global.document = {
      hasFocus: () => true,
    };
    global.window = {
      location: { href: 'https://ewirkerman.github.io/HenchiesReboot/game.html#game_abc' },
    };

    listenForForegroundNotifications({ id: 'messaging-1' }, jest.fn());

    handler({
      data: {
        title: 'It\'s your turn!',
        body: 'Turn 7 has begun.',
        url: '/game.html#game_abc',
      },
    });

    expect(global.Notification).not.toHaveBeenCalled();
  });
});
