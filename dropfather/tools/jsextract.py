"""Copy top-level JavaScript functions and statements verbatim out of a source file (string-aware brace matching)."""
import re

def skip_string(s, i):
    q = s[i]; i += 1
    while s[i] != q:
        if s[i] == '\\': i += 1
        elif q == '`' and s.startswith('${', i):
            i = match(s, i + 1, '{', '}')
        i += 1
    return i

def match(s, i, open_, close):
    depth = 0
    while True:
        c = s[i]
        if c in '\'"`': i = skip_string(s, i)
        elif c == open_: depth += 1
        elif c == close:
            depth -= 1
            if depth == 0: return i
        i += 1

def function(js, name):
    m = re.search(r'(?:async )?function ' + name + r'\(', js)
    if not m: raise SystemExit('missing function ' + name)
    p = match(js, m.end() - 1, '(', ')')
    b = js.index('{', p)
    return js[m.start():match(js, b, '{', '}') + 1]

def statement(js, prefix):
    i = js.index(prefix); j = i
    # a statement ends at the first top-level ';' followed by a newline
    while True:
        c = js[j]
        if c in '\'"`': j = skip_string(js, j)
        elif c in '([{': j = match(js, j, c, {'(': ')', '[': ']', '{': '}'}[c])
        elif c == ';' and js[j + 1] == '\n': return js[i:j + 1]
        j += 1
