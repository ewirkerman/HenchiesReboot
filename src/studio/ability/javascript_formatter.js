const OPERATORS = [
    '>>>=', '===', '!==', '**=', '>>>', '<<=', '>>=', '...', '=>', '==', '!=',
    '<=', '>=', '&&', '||', '??', '?.', '++', '--', '+=', '-=', '*=', '/=',
    '%=', '&=', '|=', '^=', '<<', '>>', '**'
];

const REGEX_PREFIX_KEYWORDS = new Set([
    'await', 'case', 'delete', 'do', 'else', 'in', 'instanceof', 'new', 'of',
    'return', 'throw', 'typeof', 'void', 'yield'
]);
const CONTROL_PAREN_KEYWORDS = new Set(['catch', 'for', 'if', 'switch', 'while', 'with']);
const EXPRESSION_CONTINUATIONS = new Set([
    '(', '[', '.', '?.', ',', ':', '?', '+', '-', '*', '/', '%', '**', '&&',
    '||', '??', '=', '+=', '-=', '*=', '/=', '%=', '==', '===', '!=', '!==',
    '<', '>', '<=', '>=', '=>', '&', '|', '^', '<<', '>>', '>>>'
]);
const OPERATORS_WITH_SPACES = new Set([
    '=', '+=', '-=', '*=', '/=', '%=', '==', '===', '!=', '!==', '<', '>',
    '<=', '>=', '&&', '||', '??', '?', '=>', '&', '|', '^', '<<', '>>',
    '>>>', '**', '+', '-', '*', '/', '%', 'in', 'instanceof', 'of'
]);

function readQuoted(source, start, quote) {
    let index = start + 1;
    while (index < source.length) {
        if (source[index] === '\\') {
            index += 2;
        } else if (source[index] === quote) {
            return index + 1;
        } else {
            index++;
        }
    }
    return source.length;
}

function readTemplate(source, start) {
    let index = start + 1;
    while (index < source.length) {
        if (source[index] === '\\') {
            index += 2;
        } else if (source[index] === '`') {
            return index + 1;
        } else {
            index++;
        }
    }
    return source.length;
}

function readRegex(source, start) {
    let index = start + 1;
    let inCharacterClass = false;
    while (index < source.length) {
        const char = source[index];
        if (char === '\\') {
            index += 2;
        } else if (char === '[') {
            inCharacterClass = true;
            index++;
        } else if (char === ']') {
            inCharacterClass = false;
            index++;
        } else if (char === '/' && !inCharacterClass) {
            index++;
            while (/[A-Za-z]/.test(source[index] || '')) index++;
            return index;
        } else if (char === '\n' || char === '\r') {
            return start + 1;
        } else {
            index++;
        }
    }
    return start + 1;
}

function tokenize(source) {
    const tokens = [];
    let index = 0;
    let newlineBefore = false;

    while (index < source.length) {
        const char = source[index];
        if (/\s/.test(char)) {
            if (char === '\n' || char === '\r') newlineBefore = true;
            index++;
            continue;
        }

        const start = index;
        let type = 'punctuation';
        let previous = tokens[tokens.length - 1];

        if (char === '/' && source[index + 1] === '/') {
            index += 2;
            while (index < source.length && source[index] !== '\n' && source[index] !== '\r') index++;
            type = 'lineComment';
        } else if (char === '/' && source[index + 1] === '*') {
            index += 2;
            while (index < source.length && !(source[index] === '*' && source[index + 1] === '/')) index++;
            index = Math.min(source.length, index + 2);
            type = 'blockComment';
        } else if (char === '"' || char === "'") {
            index = readQuoted(source, index, char);
            type = 'literal';
        } else if (char === '`') {
            index = readTemplate(source, index);
            type = 'literal';
        } else if (char === '/' && (
            !previous ||
            (previous.type === 'word' && REGEX_PREFIX_KEYWORDS.has(previous.value)) ||
            (previous.type === 'punctuation' && /^(?:\(|\[|\{|,|;|:|=|!|\?|&|\||\+|-|\*|%|\^|~|<|>)$/.test(previous.value))
        )) {
            const regexEnd = readRegex(source, index);
            if (regexEnd > index + 1) {
                index = regexEnd;
                type = 'literal';
            }
        }

        if (index === start) {
            if (/[A-Za-z_$]/.test(char)) {
                index++;
                while (index < source.length && /[\w$]/.test(source[index])) index++;
                type = 'word';
            } else if (/\d/.test(char)) {
                index++;
                while (index < source.length && /[\w.]/.test(source[index])) index++;
                type = 'literal';
            } else {
                const operator = OPERATORS.find(candidate => source.startsWith(candidate, index));
                index += operator ? operator.length : 1;
            }
        }

        const value = source.slice(start, index);
        tokens.push({ value, type, newlineBefore });
        newlineBefore = false;
    }

    return tokens;
}

function isWordLike(token) {
    return token && (token.type === 'word' || token.type === 'literal' || token.type.endsWith('Comment'));
}

export function formatJavaScript(source, indentSize = 2) {
    const tokens = tokenize(String(source));
    const indent = ' '.repeat(indentSize);
    const lines = [];
    let line = '';
    let level = 0;
    let parenDepth = 0;
    let previous = null;

    const flushLine = () => {
        lines.push(line.trimEnd());
        line = '';
    };
    const append = (value) => {
        if (!line) line = indent.repeat(level);
        line += value;
    };
    const addSpace = () => {
        if (line && !line.endsWith(' ')) line += ' ';
    };

    for (const token of tokens) {
        const { value } = token;

        if (token.type === 'lineComment' || token.type === 'blockComment') {
            if (line && !line.endsWith(' ')) addSpace();
            append(value);
            if (token.type === 'lineComment') flushLine();
            previous = token;
            continue;
        }

        if (previous?.value === '}' &&
            !EXPRESSION_CONTINUATIONS.has(value) &&
            ![';', ')', ']', 'else', 'catch', 'finally', 'while'].includes(value)) {
            if (line.trim()) flushLine();
        }

        if (value === '}') {
            if (line.trim()) flushLine();
            level = Math.max(0, level - 1);
            append(value);
            previous = token;
            continue;
        }

        if (token.newlineBefore && parenDepth === 0 && previous &&
            !EXPRESSION_CONTINUATIONS.has(previous.value) &&
            !EXPRESSION_CONTINUATIONS.has(value) &&
            !['else', 'catch', 'finally'].includes(value) &&
            previous.value !== '{' && previous.value !== ';') {
            if (line.trim()) flushLine();
        }

        if (value === '{') {
            if (line.trim()) addSpace();
            append(value);
            flushLine();
            level++;
        } else if (value === ';') {
            append(value);
            if (parenDepth === 0) flushLine();
            else addSpace();
        } else if (value === ',') {
            append(value);
            addSpace();
        } else if (value === ':') {
            append(value);
            addSpace();
        } else if (value === '(') {
            if (previous?.type === 'word' && CONTROL_PAREN_KEYWORDS.has(previous.value)) addSpace();
            append(value);
            parenDepth++;
        } else if (value === ')') {
            append(value);
            parenDepth = Math.max(0, parenDepth - 1);
        } else if (value === '[' || value === ']' || value === '.' || value === '?.') {
            append(value);
        } else if (value === '++' || value === '--') {
            if (previous && ['word', 'literal'].includes(previous.type)) append(value);
            else {
                if (line.trim()) addSpace();
                append(value);
            }
        } else if (OPERATORS_WITH_SPACES.has(value)) {
            if (line.trim()) addSpace();
            append(value);
            addSpace();
        } else {
            const closesBlock = previous?.value === '}';
            const needsSpace = line.trim() && (
                isWordLike(previous) ||
                (closesBlock && ![';', ',', ')', ']', '.', '?.'].includes(value)) ||
                (previous?.value === ')' && value !== ';' && value !== ',' && value !== '.' && value !== '?.') ||
                (previous?.value === ']' && isWordLike(token))
            );
            if (needsSpace) addSpace();
            append(value);
        }

        previous = token;
    }

    if (line.trim()) flushLine();
    return lines.join('\n');
}
