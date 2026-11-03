<?php declare(strict_types=1);

// Companion of the prune-tests skill. Usage, from the project root: php <path-to-this-script> <list-file>
// Each line of the list file is a bare `tests/Path/FooTest.php::method`, with the method name as `--list-tests` prints it.
// Removes each method of the file's class with its modifiers, attributes and docblock.
// A `__pest_evaluable_…` name removes the Pest `test()`, `it()`, `todo()` or `arch()` call, inside `describe()` too, with its chained calls and docblock.
// Rejects the whole list, writing nothing, when a line is malformed or names a missing file.
// Otherwise removes what it can, and writes a file only when the result parses.
// Prints the lines it could not handle to stderr and exits 1 when there are any. A NOTE line on stderr does not fail the run.

const PEST_PREFIX = '__pest_evaluable_';

$listFile = $argv[1] ?? null;
if ($listFile === null || ! is_file($listFile)) {
    fwrite(STDERR, "Pass a list file.\n");
    exit(1);
}

$byFile = [];
$invalid = [];
foreach (file($listFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [] as $line) {
    $line = trim($line);
    if (preg_match('/^(tests\/\S+\.php)::([A-Za-z_\x80-\xff][\w\x80-\xff]*)$/', $line, $match) !== 1 || ! is_file($match[1])) {
        $invalid[] = $line;

        continue;
    }
    $byFile[$match[1]][] = $match[2];
}

if ($invalid !== []) {
    fwrite(STDERR, "INVALID (expected an existing tests/…Test.php::method):\n" . implode("\n", $invalid) . "\n");
    exit(1);
}

$failed = [];
foreach ($byFile as $file => $methods) {
    $original = (string) file_get_contents($file);
    $src = $original;
    foreach ($methods as $method) {
        $removed = removeMethod($src, $method);
        if (is_string($removed)) {
            $src = $removed;

            continue;
        }
        $failed[] = $removed === 0
            ? "{$file}::{$method} (not in this file: a typo, an inherited test, a description that is not a plain string, or already removed)"
            : "{$file}::{$method} (declared more than once, or has no body)";
    }
    if ($src === $original) {
        continue;
    }
    $src = rtrim((string) preg_replace('/\n\n(\s*)\}\s*$/', "\n$1}\n", $src)) . "\n";
    $parseError = parseError($src);
    if ($parseError !== null) {
        $failed[] = "{$file} (result does not parse, file left unchanged: {$parseError})";

        continue;
    }
    file_put_contents($file, $src);
    $tokens = token_get_all($src);
    $pest = array_filter($methods, static fn (string $method): bool => str_starts_with($method, PEST_PREFIX));
    if ($pest !== [] && ! hasTestCall($tokens)) {
        fwrite(STDERR, "NOTE: {$file} has no test(), it(), todo(), describe() or arch() call left; delete it when nothing else in it is needed.\n");
    }
}

if ($failed !== []) {
    fwrite(STDERR, "FAILED:\n" . implode("\n", $failed) . "\n");
    exit(1);
}

function parseError(string $src): ?string
{
    try {
        return token_get_all($src, TOKEN_PARSE) === [] ? 'empty file' : null;
    } catch (ParseError $error) {
        return $error->getMessage();
    }
}

/** @return string|int the new source, or the number of matches when it cannot remove exactly one */
function removeMethod(string $src, string $method): string|int
{
    $tokens = token_get_all($src);
    $positions = [];
    $offset = 0;
    foreach ($tokens as $token) {
        $positions[] = $offset;
        $offset += strlen(is_array($token) ? $token[1] : $token);
    }

    if (str_starts_with($method, PEST_PREFIX)) {
        $calls = array_values(array_filter(pestCalls($tokens, 0, count($tokens), []), static fn (array $call): bool => $call['name'] === $method));
        if (count($calls) !== 1) {
            return count($calls);
        }
        $matches = [$calls[0]['start']];
        $end = $positions[$calls[0]['end']] + 1;
    } else {
        $matches = classLevelFunctions($tokens, $method);
        if (count($matches) !== 1) {
            return count($matches);
        }

        $end = bodyEnd($tokens, $positions, $matches[0]);
        if ($end === null) {
            return 1;
        }
    }

    $first = leadingToken($tokens, $matches[0]);
    $lineStart = (int) strrpos(substr($src, 0, $positions[$first]), "\n") + 1;
    $start = trim(substr($src, $lineStart, $positions[$first] - $lineStart)) === '' ? $lineStart : $positions[$first];

    $after = $end;
    for ($i = 0; $start === $lineStart && $i < 2 && substr($src, $after, 1) === "\n"; $i++) {
        $after++;
    }

    $before = substr($src, 0, $start);
    $rest = substr($src, $after);
    if (str_ends_with($before, "\n\n") && str_starts_with(ltrim($rest, " \t"), '}')) {
        $before = substr($before, 0, -1);
    }

    return $before . $rest;
}

/**
 * Every `test()`, `it()`, `todo()` and `arch()` statement with a literal description, recursing into `describe()` closures that have one too.
 * The name is the method name Pest gives the test (`Pest\Support\Str::evaluable()` of its full description).
 *
 * @param  array<int, array{0: int, 1: string, 2: int}|string>  $tokens
 * @param  list<string>  $describing
 * @return list<array{start: int, end: int, name: string}>
 */
function pestCalls(array $tokens, int $from, int $to, array $describing): array
{
    $calls = [];
    $depth = 0;
    for ($k = $from; $k < $to; $k++) {
        $token = $tokens[$k];
        if (isOpeningBracket($token)) {
            $depth++;

            continue;
        }
        if ($token === '}' || $token === ')' || $token === ']') {
            $depth--;

            continue;
        }
        if ($depth !== 0 || ! is_array($token) || $token[0] !== T_STRING || ! in_array($token[1], ['test', 'it', 'todo', 'arch', 'describe'], strict: true)) {
            continue;
        }
        $previous = significant($tokens, $k, -1);
        if ($previous !== null && ! in_array($tokens[$previous], [';', '{', '}'], strict: true) && ! (is_array($tokens[$previous]) && $tokens[$previous][0] === T_OPEN_TAG)) {
            continue;
        }
        $open = significant($tokens, $k, 1);
        $end = $open !== null && $tokens[$open] === '(' ? statementEnd($tokens, $open, $to) : null;
        if ($end === null) {
            continue;
        }
        $description = chainOnly($tokens, $open, $end) ? literalArgument($tokens, $open) : null;
        if ($description !== null && $token[1] === 'describe') {
            $body = closureBody($tokens, $open, $end);
            if ($body !== null) {
                array_push($calls, ...pestCalls($tokens, $body[0] + 1, $body[1], [...$describing, $description]));
            }
        } elseif ($description !== null) {
            $description = $token[1] === 'it' ? "it {$description}" : $description;
            $full = implode('', array_map(static fn (string $describe): string => "`{$describe}` → ", $describing)) . $description;
            $calls[] = ['start' => $k, 'end' => $end, 'name' => evaluable($full)];
        }
        $k = $end;
    }

    return $calls;
}

/**
 * True when the statement is the call opening at `$open` plus `->method(...)` calls and `->property` steps, so removing it removes one test only.
 *
 * @param  array<int, array{0: int, 1: string, 2: int}|string>  $tokens
 */
function chainOnly(array $tokens, int $open, int $end): bool
{
    $close = matchingClose($tokens, $open);
    while ($close !== null) {
        $next = significant($tokens, $close, 1);
        if ($next === $end) {
            return true;
        }
        $name = $next === null || ! is_array($tokens[$next]) || ! in_array($tokens[$next][0], [T_OBJECT_OPERATOR, T_NULLSAFE_OBJECT_OPERATOR], strict: true) ? null : significant($tokens, $next, 1);
        $call = $name === null || ! is_array($tokens[$name]) || $tokens[$name][0] !== T_STRING ? null : significant($tokens, $name, 1);
        $close = match (true) {
            $call === null => null,
            $tokens[$call] === '(' => matchingClose($tokens, $call),
            default => $name,
        };
    }

    return false;
}

/** @param array<int, array{0: int, 1: string, 2: int}|string> $tokens */
function matchingClose(array $tokens, int $open): ?int
{
    $depth = 0;
    for ($k = $open; isset($tokens[$k]); $k++) {
        if (isOpeningBracket($tokens[$k])) {
            $depth++;
        } elseif (in_array($tokens[$k], ['}', ')', ']'], strict: true) && --$depth === 0) {
            return $k;
        }
    }

    return null;
}

/**
 * Any call of a Pest test function with an argument, whatever its description, so a file is never reported empty while a test remains.
 * A bare `test()` is the helper that returns the current test case, not a test.
 *
 * @param  array<int, array{0: int, 1: string, 2: int}|string>  $tokens
 */
function hasTestCall(array $tokens): bool
{
    foreach ($tokens as $k => $token) {
        if (! is_array($token) || ! in_array($token[0], [T_STRING, T_NAME_FULLY_QUALIFIED], strict: true) || ! in_array(ltrim(strtolower($token[1]), '\\'), ['test', 'it', 'todo', 'describe', 'arch'], strict: true)) {
            continue;
        }
        $previous = significant($tokens, $k, -1);
        $next = significant($tokens, $k, 1);
        if ($next !== null && $tokens[$next] === '(' && $tokens[significant($tokens, $next, 1) ?? $next] !== ')' && ! ($previous !== null && is_array($tokens[$previous]) && in_array($tokens[$previous][0], [T_OBJECT_OPERATOR, T_NULLSAFE_OBJECT_OPERATOR, T_DOUBLE_COLON, T_FUNCTION, T_NEW], strict: true))) {
            return true;
        }
    }

    return false;
}

/** Mirrors `Pest\Support\Str::evaluable()`. */
function evaluable(string $description): string
{
    $name = PEST_PREFIX . str_replace(' ', '_', str_replace('_', '__', $description));

    return (string) preg_replace('/[^a-zA-Z0-9_\x80-\xff]/', '_', $name);
}

/** @param array<int, array{0: int, 1: string, 2: int}|string> $tokens */
function significant(array $tokens, int $index, int $step): ?int
{
    for ($k = $index + $step; isset($tokens[$k]); $k += $step) {
        if (! is_array($tokens[$k]) || ! in_array($tokens[$k][0], [T_WHITESPACE, T_COMMENT, T_DOC_COMMENT], strict: true)) {
            return $k;
        }
    }

    return null;
}

/**
 * Index of the `;` that ends the statement whose call opens at `$open`, or null when none does before `$to`.
 *
 * @param  array<int, array{0: int, 1: string, 2: int}|string>  $tokens
 */
function statementEnd(array $tokens, int $open, int $to): ?int
{
    $depth = 0;
    for ($k = $open; $k < $to; $k++) {
        $token = $tokens[$k];
        if (isOpeningBracket($token)) {
            $depth++;
        } elseif ($token === '}' || $token === ')' || $token === ']') {
            $depth--;
        } elseif ($token === ';' && $depth === 0) {
            return $k;
        }
    }

    return null;
}

/**
 * The first argument when it is a plain string literal, else null.
 *
 * @param  array<int, array{0: int, 1: string, 2: int}|string>  $tokens
 */
function literalArgument(array $tokens, int $open): ?string
{
    $argument = significant($tokens, $open, 1);
    if ($argument === null || ! is_array($tokens[$argument]) || $tokens[$argument][0] !== T_CONSTANT_ENCAPSED_STRING) {
        return null;
    }
    $after = significant($tokens, $argument, 1);
    if ($after === null || ! in_array($tokens[$after], [',', ')'], strict: true)) {
        return null;
    }
    $literal = $tokens[$argument][1];
    $inner = substr($literal, 1, -1);

    return $literal[0] === "'" ? str_replace(['\\\\', "\\'"], ['\\', "'"], $inner) : doubleQuoted($inner);
}

function utf8(int $codePoint): string
{
    return match (true) {
        $codePoint < 0x80 => chr($codePoint),
        $codePoint < 0x800 => chr(0xC0 | $codePoint >> 6) . chr(0x80 | $codePoint & 0x3F),
        $codePoint < 0x10000 => chr(0xE0 | $codePoint >> 12) . chr(0x80 | $codePoint >> 6 & 0x3F) . chr(0x80 | $codePoint & 0x3F),
        default => chr(0xF0 | $codePoint >> 18) . chr(0x80 | $codePoint >> 12 & 0x3F) . chr(0x80 | $codePoint >> 6 & 0x3F) . chr(0x80 | $codePoint & 0x3F),
    };
}

/** Decodes the escapes of a double-quoted PHP string the way PHP does, keeping unknown escapes as written. */
function doubleQuoted(string $inner): string
{
    $simple = ['n' => "\n", 't' => "\t", 'r' => "\r", 'v' => "\v", 'e' => "\e", 'f' => "\f", '\\' => '\\', '$' => '$', '"' => '"'];

    return (string) preg_replace_callback(
        '/\\\\(?:u\{([0-9a-fA-F]+)\}|[xX]([0-9a-fA-F]{1,2})|([0-7]{1,3})|(.))/s',
        static fn (array $m): string => match (true) {
            ($m[1] ?? '') !== '' => utf8((int) hexdec($m[1])),
            ($m[2] ?? '') !== '' => chr((int) hexdec($m[2])),
            ($m[3] ?? '') !== '' => chr((int) octdec($m[3]) & 0xFF),
            default => $simple[$m[4]] ?? $m[0],
        },
        $inner,
    );
}

/**
 * Token indexes of the `{` and `}` of the closure passed to the call that opens at `$open`.
 *
 * @param  array<int, array{0: int, 1: string, 2: int}|string>  $tokens
 * @return array{0: int, 1: int}|null
 */
function closureBody(array $tokens, int $open, int $end): ?array
{
    for ($k = $open; $k < $end; $k++) {
        if (is_array($tokens[$k]) && $tokens[$k][0] === T_FN) {
            return null;
        }
        if (is_array($tokens[$k]) && $tokens[$k][0] === T_FUNCTION) {
            break;
        }
    }
    for (; $k < $end && $tokens[$k] !== '{'; $k++);
    if ($k >= $end) {
        return null;
    }
    $depth = 0;
    for ($close = $k; $close < $end; $close++) {
        if (isOpeningBrace($tokens[$close])) {
            $depth++;
        } elseif ($tokens[$close] === '}' && --$depth === 0) {
            return [$k, $close];
        }
    }

    return null;
}

/**
 * Depth 1 only, so a method of a nested anonymous class never matches.
 *
 * @param  array<int, array{0: int, 1: string, 2: int}|string>  $tokens
 * @return list<int>
 */
function classLevelFunctions(array $tokens, string $method): array
{
    $matches = [];
    $depth = 0;
    foreach ($tokens as $i => $token) {
        if (isOpeningBrace($token)) {
            $depth++;
        } elseif ($token === '}') {
            $depth--;
        } elseif ($depth === 1 && is_array($token) && $token[0] === T_FUNCTION && nameAfter($tokens, $i) === $method) {
            $matches[] = $i;
        }
    }

    return $matches;
}

/** @param array<int, array{0: int, 1: string, 2: int}|string> $tokens */
function nameAfter(array $tokens, int $functionIndex): ?string
{
    $j = $functionIndex + 1;
    while (is_array($tokens[$j]) && $tokens[$j][0] === T_WHITESPACE) {
        $j++;
    }

    return is_array($tokens[$j]) && $tokens[$j][0] === T_STRING ? $tokens[$j][1] : null;
}

/**
 * @param  array<int, array{0: int, 1: string, 2: int}|string>  $tokens
 * @param  list<int>  $positions
 */
function bodyEnd(array $tokens, array $positions, int $functionIndex): ?int
{
    $depth = 0;
    $counter = count($tokens);
    for ($k = $functionIndex; $k < $counter; $k++) {
        $token = $tokens[$k];
        if ($depth === 0 && $token === ';') {
            return null;
        }
        if (isOpeningBrace($token)) {
            $depth++;
        } elseif ($token === '}' && --$depth === 0) {
            return $positions[$k] + 1;
        }
    }

    return null;
}

/**
 * A plain comment above the method stops the walk and stays.
 *
 * @param  array<int, array{0: int, 1: string, 2: int}|string>  $tokens
 */
function leadingToken(array $tokens, int $functionIndex): int
{
    $modifiers = [T_PUBLIC, T_PROTECTED, T_PRIVATE, T_STATIC, T_FINAL, T_ABSTRACT, T_DOC_COMMENT];
    $first = $functionIndex;
    $k = $functionIndex - 1;
    while ($k >= 0) {
        $token = $tokens[$k];
        if (is_array($token) && $token[0] === T_WHITESPACE) {
            $k--;

            continue;
        }
        if (is_array($token) && in_array($token[0], $modifiers, strict: true)) {
            $first = $k--;

            continue;
        }
        if ($token !== ']') {
            break;
        }
        $attributeStart = attributeStart($tokens, $k);
        if ($attributeStart === null) {
            break;
        }
        $first = $attributeStart;
        $k = $attributeStart - 1;
    }

    return $first;
}

/** @param array<int, array{0: int, 1: string, 2: int}|string> $tokens */
function attributeStart(array $tokens, int $closingIndex): ?int
{
    $depth = 0;
    for ($k = $closingIndex; $k >= 0; $k--) {
        $token = $tokens[$k];
        if ($token === ']') {
            $depth++;
        } elseif ($token === '[' || (is_array($token) && $token[0] === T_ATTRIBUTE)) {
            $depth--;
        }
        if ($depth === 0) {
            return is_array($token) && $token[0] === T_ATTRIBUTE ? $k : null;
        }
    }

    return null;
}

/** A brace, parenthesis or bracket, including the `#[` that opens an attribute. */
function isOpeningBracket(array|string $token): bool
{
    return isOpeningBrace($token) || $token === '(' || $token === '[' || (is_array($token) && $token[0] === T_ATTRIBUTE);
}

/** @param array{0: int, 1: string, 2: int}|string $token */
function isOpeningBrace(array|string $token): bool
{
    return $token === '{' || (is_array($token) && in_array($token[0], [T_CURLY_OPEN, T_DOLLAR_OPEN_CURLY_BRACES], strict: true));
}
