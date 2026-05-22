<?php

declare(strict_types=1);

/**
 * Validates shipped boost content:
 *  - every SKILL.md against the Agent Skills format (stolt/skill-validator);
 *  - every guideline `.boost-tags.yaml` sidecar manifest as well-formed YAML.
 * Run in CI by .github/workflows/validate-skills.yml; exits non-zero if any
 * skill or manifest is invalid.
 */

use Stolt\Ai\Skill\Validator;
use Symfony\Component\Yaml\Exception\ParseException;
use Symfony\Component\Yaml\Yaml;

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

// Guideline tag manifests. boost-skills' guidelines are frontmatter-free (for
// laravel/boost compatibility), so their capability tags live in a sidecar
// `.boost-tags.yaml` per guidelines directory, read by boost-core >= 0.6.0. An
// unparseable manifest fails closed in boost-core — every frontmatter-silent
// guideline in that directory then ships nowhere — so a typo must be caught
// here as a release-blocker, never reach a consumer.
$guidelinesDir = __DIR__ . '/../resources/boost/guidelines';

$manifests = [];
if (is_dir($guidelinesDir)) {
    $entries = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($guidelinesDir, FilesystemIterator::SKIP_DOTS)
    );

    foreach ($entries as $entry) {
        if ($entry->getFilename() === '.boost-tags.yaml') {
            $manifests[] = $entry->getPathname();
        }
    }
}

sort($manifests);

$manifestFailed = 0;

foreach ($manifests as $manifest) {
    $dir = dirname($manifest);
    $rel = str_replace(__DIR__ . '/../', '', $manifest);
    $errors = [];
    $parsed = null;

    try {
        $parsed = Yaml::parseFile($manifest);
    } catch (ParseException $e) {
        $errors[] = 'unparseable YAML: ' . $e->getMessage();
    }

    if ($errors === [] && $parsed !== null && ! is_array($parsed)) {
        $errors[] = 'must be a YAML map of "filename: tags"';
    }

    if ($errors === [] && is_array($parsed)) {
        foreach ($parsed as $key => $value) {
            if (! is_string($key)) {
                $errors[] = "key '{$key}' must be a guideline filename string";

                continue;
            }

            if (! is_string($value)) {
                $errors[] = "{$key}: tag value must be a string";

                continue;
            }

            if (! is_file($dir . '/' . $key)) {
                $errors[] = "{$key}: no such guideline file in this directory";
            }

            foreach (preg_split('/\s+/', trim($value), -1, PREG_SPLIT_NO_EMPTY) as $tag) {
                if (preg_match('/^[a-z0-9-]+$/', $tag) !== 1) {
                    $errors[] = "{$key}: invalid tag '{$tag}' (expected lowercase letters, digits, hyphens)";
                }
            }
        }
    }

    if ($errors === []) {
        echo "PASS  {$rel}\n";

        continue;
    }

    $manifestFailed++;
    echo "FAIL  {$rel}\n";

    foreach ($errors as $error) {
        echo "        {$error}\n";
    }
}

if ($manifests !== []) {
    $manifestTotal = count($manifests);
    echo ($manifestTotal - $manifestFailed) . "/{$manifestTotal} guideline tag manifests valid\n";
}

exit($failed === 0 && $manifestFailed === 0 ? 0 : 1);
