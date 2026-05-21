<?php

declare(strict_types=1);

/**
 * Validates every shipped SKILL.md against the Agent Skills format using
 * stolt/skill-validator. Run in CI by .github/workflows/validate-skills.yml;
 * exits non-zero if any skill is invalid.
 */

use Stolt\Ai\Skill\Validator;

require __DIR__ . '/../vendor/autoload.php';

$skillsDir = __DIR__ . '/../resources/boost/skills';

// Recursive — mirrors boost-core's SkillLoader, which discovers SKILL.md at any
// depth. A one-level glob would let a nested skill sync but escape this gate.
$files = [];
if (is_dir($skillsDir)) {
    $entries = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($skillsDir, FilesystemIterator::SKIP_DOTS)
    );

    foreach ($entries as $entry) {
        if ($entry->getFilename() === 'SKILL.md') {
            $files[] = $entry->getPathname();
        }
    }
}

if ($files === []) {
    fwrite(STDERR, "No SKILL.md files found under resources/boost/skills/\n");
    exit(1);
}

sort($files);

$validator = new Validator();
$failed = 0;

foreach ($files as $file) {
    $name = str_replace($skillsDir . '/', '', dirname($file));
    $result = $validator->validateFile($file);

    if ($result->isValid()) {
        echo "PASS  {$name}\n";

        continue;
    }

    $failed++;
    echo "FAIL  {$name}\n";

    foreach ($result->errors() as $error) {
        echo "        {$error}\n";
    }
}

$total = count($files);
echo "\n" . ($total - $failed) . "/{$total} skills valid\n";

exit($failed === 0 ? 0 : 1);
