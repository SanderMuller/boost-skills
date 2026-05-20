<?php

declare(strict_types=1);

/**
 * Validates every shipped SKILL.md against the Agent Skills format using
 * stolt/skill-validator. Run in CI by .github/workflows/validate-skills.yml;
 * exits non-zero if any skill is invalid.
 */

require __DIR__ . '/../vendor/autoload.php';

use Stolt\Ai\Skill\Validator;

$skillsDir = __DIR__ . '/../resources/boost/skills';
$files = glob($skillsDir . '/*/SKILL.md');

if ($files === false || $files === []) {
    fwrite(STDERR, "No SKILL.md files found under resources/boost/skills/\n");
    exit(1);
}

sort($files);

$validator = new Validator();
$failed = 0;

foreach ($files as $file) {
    $name = basename(dirname($file));
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
