<?php declare(strict_types=1);

// Companion of the prune-tests skill. Usage, from the project root: <runner> --list-tests | php <path-to-this-script>
// Prints each listed case as `tests/Path/FooTest.php::method` plus its row suffix, sorted bytewise.
// A Pest class name (`P\Tests\…`) drops every character but letters and digits from the path, so it cannot be
// turned back into a path: the script maps it through the same strip applied to each file under tests/.
// Prints each class it cannot map to stderr and exits 1 when there are any.

$pestClasses = [];
$ambiguous = [];
$files = new RecursiveIteratorIterator(new RecursiveDirectoryIterator('tests', FilesystemIterator::SKIP_DOTS));
foreach ($files as $file) {
    if ($file->getExtension() !== 'php') {
        continue;
    }
    $path = str_replace(DIRECTORY_SEPARATOR, '/', $file->getPathname());
    $class = pestClass($path);
    if (isset($pestClasses[$class])) {
        $ambiguous[$class] = true;
    }
    $pestClasses[$class] = $path;
}

$cases = [];
$failed = [];
while (($line = fgets(STDIN)) !== false) {
    if (preg_match('/^ - (.+?)::(.+)$/', rtrim($line, "\r\n"), $match) !== 1) {
        continue;
    }
    [, $class, $rest] = $match;
    if (str_starts_with($class, 'P\\')) {
        $key = substr($class, 2);
        $path = isset($ambiguous[$key]) ? null : $pestClasses[$key] ?? null;
    } elseif (str_starts_with($class, 'Tests\\')) {
        $path = 'tests/' . str_replace('\\', '/', substr($class, 6)) . '.php';
        $path = is_file($path) ? $path : null;
    } else {
        $path = null;
    }
    if ($path === null) {
        $failed[$class] = str_starts_with($class, 'P\\') && isset($ambiguous[substr($class, 2)]) ? "{$class} (two files map to this class)" : "{$class} (no file under tests/ maps to this class)";

        continue;
    }
    $cases[] = "{$path}::{$rest}";
}

sort($cases, SORT_STRING);
echo $cases === [] ? '' : implode("\n", $cases) . "\n";

if ($failed !== []) {
    fwrite(STDERR, "UNMAPPED:\n" . implode("\n", $failed) . "\n");
    exit(1);
}

/** Mirrors the class name `Pest\Factories\TestCaseFactory` gives a test file, without the `P\` prefix (its quote-escape step is left out: the final strip drops quotes too). */
function pestClass(string $path): string
{
    $basename = basename($path, '.php');
    $dot = strpos($basename, '.');
    $basename = $dot === false ? $basename : substr($basename, 0, $dot);
    $class = str_replace('/', '\\', dirname(ucfirst($path)) . '/' . $basename);
    $class = (string) preg_replace('|%[a-fA-F0-9][a-fA-F0-9]|', '', $class);

    return (string) preg_replace('/[^\p{L}\p{N}\\\\]/u', '', $class);
}
