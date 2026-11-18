export function getEditorDisplayName(entity) {
    const name = entity?.name || '';
    const suffix = typeof entity?.editorNameSuffix === 'string' ? entity.editorNameSuffix.trim() : '';
    return suffix ? `${name} ${suffix}` : name;
}

export function escapeEditorHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    })[char]);
}
