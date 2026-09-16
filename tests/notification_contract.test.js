import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { jest } from '@jest/globals';

const mockOnDocumentUpdated = jest.fn(() => () => null);
const mockAdmin = {
  initializeApp: jest.fn(),
  firestore: jest.fn(() => ({
    collection: () => ({
      doc: () => ({
        get: async () => ({ exists: false }),
      }),
    }),
  })),
  messaging: jest.fn(() => ({
    sendEachForMulticast: async () => ({ responses: [] }),
  })),
  FieldValue: {
    arrayRemove: jest.fn(),
  },
};

jest.unstable_mockModule('firebase-functions/v2/firestore', () => ({
  onDocumentUpdated: mockOnDocumentUpdated,
}), { virtual: true });

jest.unstable_mockModule('firebase-admin', () => mockAdmin, { virtual: true });

const functionModule = await import('../functions/index.js');

function loadServiceWorkerModule(scope) {
  const scriptPath = fileURLToPath(new URL('../firebase-messaging-sw.js', import.meta.url));
  const source = readFileSync(scriptPath, 'utf8');

  const context = {
    console,
    URL,
    module: { exports: {} },
    self: {
      registration: {
        scope,
        showNotification: jest.fn(),
      },
      addEventListener: jest.fn(),
    },
    clients: {
      matchAll: async () => [],
      openWindow: jest.fn(),
    },
    importScripts: () => {},
    firebase: {
      initializeApp: jest.fn(),
      messaging: () => ({
        onBackgroundMessage: jest.fn(),
      }),
    },
  };

  vm.runInNewContext(source, context, { filename: scriptPath });
  return context.module.exports;
}

describe('Notification contract', () => {
  test('cloud function payload includes the game hash URL for the targeted room', () => {
    const payload = functionModule.buildTurnNotificationPayload('room_abc', 12);

    expect(payload).toEqual({
      data: {
        title: "It's your turn! ⚔️",
        body: 'Turn 12 has begun. Make your move!',
        url: 'game.html#room_abc',
      },
    });
  });

  test('service worker resolves localhost room links to the exact page and hash', () => {
    const serviceWorkerExports = loadServiceWorkerModule('http://localhost:8080/');
    const target = serviceWorkerExports.normalizeNotificationTargetUrl('game.html#room_abc', 'http://localhost:8080/');

    expect(target).toBe('http://localhost:8080/game.html#room_abc');
  });

  test('service worker resolves GitHub Pages room links to the repo path and hash', () => {
    const serviceWorkerExports = loadServiceWorkerModule('https://ewirkerman.github.io/HenchiesReboot/');
    const target = serviceWorkerExports.normalizeNotificationTargetUrl('/game.html#room_abc', 'https://ewirkerman.github.io/HenchiesReboot/');

    expect(target).toBe('https://ewirkerman.github.io/HenchiesReboot/game.html#room_abc');
  });
});
