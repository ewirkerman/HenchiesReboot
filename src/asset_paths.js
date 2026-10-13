const currentPath = typeof window !== 'undefined' ? window.location?.pathname || '/' : '/';

export const ASSET_ROOT = currentPath.includes('/HenchiesReboot/') ? '/HenchiesReboot/' : '/';

export function resolveAssetUrl(assetPath, assetRoot = ASSET_ROOT) {
    if (typeof assetPath !== 'string' || !assetPath) return assetPath;
    if (/^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(assetPath)) return assetPath;

    const normalizedPath = assetPath.replace(/^\.\/+/, '').replace(/^\/+/, '');
    const rootPrefix = assetRoot.replace(/^\/+|\/+$/g, '');
    if (rootPrefix && normalizedPath.startsWith(`${rootPrefix}/`)) return `/${normalizedPath}`;

    return `${assetRoot}${normalizedPath}`;
}