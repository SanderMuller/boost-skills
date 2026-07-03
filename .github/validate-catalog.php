<?php

declare(strict_types=1);

/**
 * Catalog consistency checker — complements validate-skills.php.
 *
 * validate-skills.php validates each SKILL.md's *format* (via
 * stolt/skill-validator) and that each guideline .boost-tags.yaml *parses*.
 * Neither it nor stolt/skill-validator ever inspects `metadata.boost-tags`, the
 * README tables, or the conventions schema — so the tag contract consumers rely
 * on (README ↔ frontmatter ↔ sidecar ↔ schema) can silently drift while CI
 * stays green. This script closes that gap with cross-file invariants:
 *
 *   A. every skill's `name` == its directory name
 *   B. README "## Skills" Tags cell == that skill's `metadata.boost-tags` (set-equal)
 *   C. skill inventory is bijective: skill dir <-> exactly one README Skills row
 *   D. guideline files <-> README "## Guidelines" rows <-> .boost-tags.yaml
 *   E. every tag used (skills + sidecar) is documented in the README "## Tags" table
 *   F. every `boost:conv path="…"` resolves to a slot in conventions-schema.json
 *   G. `metadata.schema-required` present iff the skill body uses a boost:conv token
 *
 * Run in CI by .github/workflows/validate-skills.yml after validate-skills.php.
 * Exits non-zero on any violation.
 */

require __DIR__ . '/../vendor/autoload.php';

use Symfony\Component\Yaml\Yaml;

$root = dirname(__DIR__);
$skillsDir = $root . '/resources/boost/skills';
$guidelinesDir = $root . '/resources/boost/guidelines';
$readmePath = $root . '/README.md';
$schemaPath = $root . '/resources/boost/conventions-schema.json';

/** @var list<string> $violations */
$violations = [];
$fail = static function (string $msg) use (&$violations): void {
    $violations[] = $msg;
};

// ---------------------------------------------------------------------------
// Parsing helpers
// ---------------------------------------------------------------------------

/** Split a markdown table row into trimmed cell strings. */
$splitRow = static function (string $line): array {
    $line = trim($line);
    $line = trim($line, '|');

    return array_map('trim', explode('|', $line));
};

/** All backtick-wrapped tokens in a cell, in order. */
$backtickTokens = static function (string $cell): array {
    preg_match_all('/`([^`]+)`/', $cell, $m);

    return $m[1];
};

/**
 * Return the data rows of the first markdown table appearing under the given
 * `## Heading` / `### Heading` line, each row as a list of trimmed cells.
 * Throws if the heading or a table under it can't be found — a structural
 * README change should fail loud, not silently pass.
 *
 * @return list<list<string>>
 */
$sectionTable = static function (array $lines, string $heading) use ($splitRow): array {
    $n = count($lines);
    $start = null;
    for ($i = 0; $i < $n; $i++) {
        if (trim($lines[$i]) === $heading) {
            $start = $i;
            break;
        }
    }
    if ($start === null) {
        throw new RuntimeException("heading not found: {$heading}");
    }

    for ($i = $start + 1; $i < $n; $i++) {
        $line = $lines[$i];
        // Stop at the next section — no table in this one.
        if (preg_match('/^\s*#{2,3}\s/', $line) === 1) {
            break;
        }
        if (! str_starts_with(ltrim($line), '|')) {
            continue;
        }
        $next = $lines[$i + 1] ?? '';
        // Header row is the one immediately followed by a |---|---| separator.
        if (preg_match('/^\s*\|[\s:\-|]+\|\s*$/', $next) !== 1) {
            continue;
        }
        $rows = [];
        for ($j = $i + 2; $j < $n; $j++) {
            if (! str_starts_with(ltrim($lines[$j]), '|')) {
                break;
            }
            $rows[] = $splitRow($lines[$j]);
        }

        return $rows;
    }

    throw new RuntimeException("no table found under: {$heading}");
};

/** Parse a SKILL.md's YAML frontmatter block into an array. */
$frontmatter = static function (string $file): array {
    $content = (string) file_get_contents($file);
    if (preg_match('/^---\R(.*?)\R---\R/s', $content, $m) !== 1) {
        return [];
    }

    return Yaml::parse($m[1]) ?? [];
};

/** `metadata.boost-tags` as a set of tokens (empty if absent). */
$frontmatterTags = static function (array $fm): array {
    $raw = $fm['metadata']['boost-tags'] ?? '';

    return preg_split('/\s+/', trim((string) $raw), -1, PREG_SPLIT_NO_EMPTY) ?: [];
};

/** Distinct `boost:conv path="…"` values referenced in a file body. */
$convPaths = static function (string $file): array {
    $content = (string) file_get_contents($file);
    preg_match_all('/boost:conv\b[^>]*?\bpath="([^"]+)"/', $content, $m);

    return array_values(array_unique($m[1]));
};

/**
 * Does a dotted conv path resolve against the composed conventions schema?
 * Walks `properties` segment by segment. A remaining segment is accepted only
 * at an object that explicitly opens its vocabulary (`additionalProperties` set
 * to a schema, e.g. `mcp`). Array, scalar, and closed-object nodes declare no
 * open `additionalProperties`, so they reject further segments — `pr.gates.foo`
 * fails rather than silently passing.
 */
$slotPathValid = static function (array $schema, string $path): bool {
    $node = $schema;
    foreach (explode('.', $path) as $segment) {
        $props = $node['properties'] ?? [];
        if (array_key_exists($segment, $props)) {
            $node = $props[$segment];

            continue;
        }

        return ($node['additionalProperties'] ?? false) !== false;
    }

    return true;
};

$setsEqual = static function (array $a, array $b): bool {
    sort($a);
    sort($b);

    return $a === $b;
};

// ---------------------------------------------------------------------------
// Load sources
// ---------------------------------------------------------------------------

$readmeLines = explode("\n", (string) file_get_contents($readmePath));
$schema = json_decode((string) file_get_contents($schemaPath), true, 512, JSON_THROW_ON_ERROR);

$skillDirs = array_values(array_filter(
    array_map('basename', (array) glob($skillsDir . '/*', GLOB_ONLYDIR)),
));
sort($skillDirs);

$guidelineFiles = array_values(array_map('basename', (array) glob($guidelinesDir . '/*.md')));
sort($guidelineFiles);

// Fail closed if the catalog looks empty — a moved directory or a glob failure
// must not be reported as "0 drift".
if ($skillDirs === [] || $guidelineFiles === []) {
    fwrite(STDERR, "No skills/guidelines found under resources/boost/ — refusing to pass.\n");
    exit(1);
}

$sidecarPath = $guidelinesDir . '/.boost-tags.yaml';
$sidecar = is_file($sidecarPath) ? (Yaml::parseFile($sidecarPath) ?? []) : [];

$skillsRows = $sectionTable($readmeLines, '## Skills');
$tagsRows = $sectionTable($readmeLines, '## Tags');
$guidelinesRows = $sectionTable($readmeLines, '## Guidelines');

// README Skills table: name => tag set. A repeated name is a bijection
// violation (invariant C), not a last-write-wins overwrite — fail on it.
$readmeSkillTags = [];
foreach ($skillsRows as $row) {
    $name = $backtickTokens($row[0])[0] ?? null;
    if ($name === null) {
        continue;
    }
    if (array_key_exists($name, $readmeSkillTags)) {
        $fail("README ## Skills lists '{$name}' more than once");

        continue;
    }
    $readmeSkillTags[$name] = $backtickTokens($row[count($row) - 1]);
}

// README Guidelines table: name(.md-less) => tag set. Same duplicate guard.
$readmeGuidelineTags = [];
foreach ($guidelinesRows as $row) {
    $name = $backtickTokens($row[0])[0] ?? null;
    if ($name === null) {
        continue;
    }
    if (array_key_exists($name, $readmeGuidelineTags)) {
        $fail("README ## Guidelines lists '{$name}' more than once");

        continue;
    }
    $readmeGuidelineTags[$name] = $backtickTokens($row[count($row) - 1]);
}

// README Tags table: documented tag vocabulary (first column).
$documentedTags = [];
foreach ($tagsRows as $row) {
    foreach ($backtickTokens($row[0]) as $tag) {
        $documentedTags[$tag] = true;
    }
}

// ---------------------------------------------------------------------------
// Invariants A/B/C — skills
// ---------------------------------------------------------------------------

$usedTags = [];

foreach ($skillDirs as $dir) {
    $skillFile = "{$skillsDir}/{$dir}/SKILL.md";
    if (! is_file($skillFile)) {
        $fail("skill '{$dir}' has no SKILL.md");

        continue;
    }
    $fm = $frontmatter($skillFile);

    // A: name == dir
    $name = $fm['name'] ?? null;
    if ($name !== $dir) {
        $fail("skill '{$dir}': frontmatter name '" . var_export($name, true) . "' != directory name");
    }

    $tags = $frontmatterTags($fm);
    foreach ($tags as $t) {
        $usedTags[$t] = true;
    }

    // B: README Skills tags == frontmatter tags
    if (! array_key_exists($dir, $readmeSkillTags)) {
        $fail("skill '{$dir}': no row in README ## Skills table");
    } elseif (! $setsEqual($tags, $readmeSkillTags[$dir])) {
        $fail(sprintf(
            "skill '%s': README tags [%s] != frontmatter boost-tags [%s]",
            $dir,
            implode(' ', $readmeSkillTags[$dir]),
            implode(' ', $tags),
        ));
    }

    // G: schema-required present iff conv tokens used
    $usesConv = $convPaths($skillFile) !== [];
    $hasSchemaReq = isset($fm['metadata']['schema-required']);
    if ($usesConv !== $hasSchemaReq) {
        $fail(sprintf(
            "skill '%s': uses boost:conv=%s but metadata.schema-required present=%s (must match)",
            $dir,
            $usesConv ? 'yes' : 'no',
            $hasSchemaReq ? 'yes' : 'no',
        ));
    }

    // F: every conv path resolves to a schema slot
    foreach ($convPaths($skillFile) as $path) {
        if (! $slotPathValid($schema, $path)) {
            $fail("skill '{$dir}': boost:conv path=\"{$path}\" does not resolve to a conventions-schema.json slot");
        }
    }
}

// C: no phantom README Skills rows
foreach (array_keys($readmeSkillTags) as $name) {
    if (! in_array($name, $skillDirs, true)) {
        $fail("README ## Skills lists '{$name}' but no such skill directory exists");
    }
}

// ---------------------------------------------------------------------------
// Invariant D — guidelines (files <-> README <-> sidecar)
// ---------------------------------------------------------------------------

$guidelineNames = array_map(static fn (string $f): string => substr($f, 0, -3), $guidelineFiles); // strip .md

foreach ($guidelineNames as $name) {
    if (! array_key_exists($name, $readmeGuidelineTags)) {
        $fail("guideline '{$name}.md' has no row in README ## Guidelines table");

        continue;
    }
    // Expected tags: sidecar entry if present, else none (untagged -> "—").
    $sidecarTags = [];
    if (isset($sidecar["{$name}.md"])) {
        $sidecarTags = preg_split('/\s+/', trim((string) $sidecar["{$name}.md"]), -1, PREG_SPLIT_NO_EMPTY) ?: [];
    }
    foreach ($sidecarTags as $t) {
        $usedTags[$t] = true;
    }
    if (! $setsEqual($sidecarTags, $readmeGuidelineTags[$name])) {
        $fail(sprintf(
            "guideline '%s': README tags [%s] != .boost-tags.yaml tags [%s]",
            $name,
            implode(' ', $readmeGuidelineTags[$name]),
            implode(' ', $sidecarTags),
        ));
    }
}

foreach (array_keys($readmeGuidelineTags) as $name) {
    if (! in_array($name, $guidelineNames, true)) {
        $fail("README ## Guidelines lists '{$name}' but no such guideline file exists");
    }
}
// (A .boost-tags.yaml key referencing a nonexistent guideline file is caught by
// validate-skills.php's manifest validation, which runs first — not repeated here.)

// ---------------------------------------------------------------------------
// Invariant E — tag vocabulary documented in README ## Tags
// ---------------------------------------------------------------------------

foreach (array_keys($usedTags) as $tag) {
    if (! isset($documentedTags[$tag])) {
        $fail("tag '{$tag}' is used by a skill/guideline but not documented in the README ## Tags table");
    }
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

$skillCount = count($skillDirs);
$guidelineCount = count($guidelineNames);

if ($violations === []) {
    echo "PASS  catalog consistency\n";
    echo "        {$skillCount} skills, {$guidelineCount} guidelines\n";
    echo "        checks: name↔dir, README↔frontmatter tags, inventory, guideline sidecar, tag vocabulary, conv-slot, schema-required\n";
    exit(0);
}

echo 'FAIL  catalog consistency — ' . count($violations) . " violation(s)\n";
foreach ($violations as $v) {
    echo "        {$v}\n";
}
exit(1);
