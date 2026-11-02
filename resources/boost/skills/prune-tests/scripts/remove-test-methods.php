<?php declare(strict_types=1);

// Companion of the prune-tests skill. Usage, from the project root: php <path-to-this-script> <list-file>
// Each line of the list file is a bare `tests/Path/FooTest.php::method`.
// Removes each method of the file's class with its modifiers, attributes and docblock.
// Rejects the whole list, writing nothing, when a line is malformed or names a missing file.
// Otherwise removes what it can, and writes a file only when the result parses.
// Prints the lines it could not handle to stderr and exits 1 when there are any.

$listFile = $argv[1] ?? null;
if ($listFile === null || ! is_file($listFile)) {
    fwrite(STDERR, "Pass a list file.\n");
    exit(1);
}

$byFile = [];
$invalid = [];
foreach (file($listFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [] as $line) {
    $line = trim($line);
    if (preg_match('/^(tests\/\S+\.php)::([A-Za-z_]\w*)$/', $line, $match) !== 1 || ! is_file($match[1])) {
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
            ? "{$file}::{$method} (not in this file: a typo, an inherited test, or already removed)"
            : "{$file}::{$method} (declared more than once, or has no body)";
    }
    if ($src === $original) {
        continue;
    }
    $src = (string) preg_replace('/\n\n(\s*)\}\s*$/', "\n$1}\n", $src);
    $parseError = parseError($src);
    if ($parseError !== null) {
        $failed[] = "{$file} (result does not parse, file left unchanged: {$parseError})";

        continue;
    }
    file_put_contents($file, $src);
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

/** @return string|int the new source, or the number of class-level matches when it cannot remove exactly one */
function removeMethod(string $src, string $method): string|int
{
    $tokens = token_get_all($src);
    $positions = [];
    $offset = 0;
    foreach ($tokens as $token) {
        $positions[] = $offset;
        $offset += strlen(is_array($token) ? $token[1] : $token);
    }

    $matches = classLevelFunctions($tokens, $method);
    if (count($matches) !== 1) {
        return count($matches);
    }

    $end = bodyEnd($tokens, $positions, $matches[0]);
    if ($end === null) {
        return 1;
    }

    $first = leadingToken($tokens, $matches[0]);
    $start = (int) strrpos(substr($src, 0, $positions[$first]), "\n") + 1;

    $after = $end;
    for ($i = 0; $i < 2 && substr($src, $after, 1) === "\n"; $i++) {
        $after++;
    }

    return substr($src, 0, $start) . substr($src, $after);
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

/** @param array{0: int, 1: string, 2: int}|string $token */
function isOpeningBrace(array|string $token): bool
{
    return $token === '{' || (is_array($token) && in_array($token[0], [T_CURLY_OPEN, T_DOLLAR_OPEN_CURLY_BRACES], strict: true));
}
