import { formatJavaScript } from '../../src/studio/ability/javascript_formatter.js';

describe('formatJavaScript', () => {
    test('indents blocks by two spaces and spaces operators', () => {
        expect(formatJavaScript('if(target.strength>0){state.players[id].health+=params.amount;}'))
            .toBe('if (target.strength > 0) {\n  state.players[id].health += params.amount;\n}');
    });

    test('keeps loop-header semicolons on the same line', () => {
        expect(formatJavaScript('for(let i=0;i<3;i++){total+=i;}'))
            .toBe('for (let i = 0; i < 3; i++) {\n  total += i;\n}');
    });

    test('starts a new line after a closing brace before the next statement', () => {
        expect(formatJavaScript('if(target.strength>0){target.health--;}target.health++;'))
            .toBe('if (target.strength > 0) {\n  target.health--;\n}\ntarget.health++;');
    });

    test('keeps block continuations and expression punctuation with the closing brace', () => {
        expect(formatJavaScript('if(target.strength>0){target.health--;}else{target.health++;}'))
            .toBe('if (target.strength > 0) {\n  target.health--;\n} else {\n  target.health++;\n}');
        expect(formatJavaScript('const actions={run:()=>{doThing();}};'))
            .toBe('const actions = {\n  run: () => {\n    doThing();\n  }\n};');
    });

    test('does not reformat the contents of strings, templates, comments, or regexes', () => {
        const source = 'const text="a;{b}";const template=`x; { y }`; // comment { ;\nconst match=/a;{b}/g;';
        expect(formatJavaScript(source)).toBe(
            'const text = "a;{b}";\n' +
            'const template = `x; { y }`;\n' +
            '// comment { ;\n' +
            'const match = /a;{b}/g;'
        );
    });
});
