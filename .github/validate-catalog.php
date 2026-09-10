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
 *   I. every `boost-requires` token names a skill or subagent this package ships
 *   H. subagent files <-> README "## Subagents" rows, name == filename stem,
 *      non-empty description, string-valued tags. Prose is NOT compared: the
 *      README "What it does" cell is a summary, exactly as for skills, and the
 *      invariant is inventory + tags, not wording.
 *   J. `.boost-user-scope.yaml` entries name a real guideline that holds no
 *      conventions token — user scope has no boost.php to resolve one against
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
$subagentsDir = $root . '/resources/boost/subagents';
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

// Subagents are optional: a catalog with none is valid, so an empty list is not
// a fail-closed condition the way an empty skill list is.
// Recursive, matching boost-core's loader: it walks subdirectories because a
// subagent's identity is its frontmatter `name`, never its path. A flat glob
// would let `subagents/review/foo.md` ship without a README row.
$subagentFiles = [];
if (is_dir($subagentsDir)) {
    $walk = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($subagentsDir, FilesystemIterator::SKIP_DOTS));
    foreach ($walk as $entry) {
        if ($entry->isFile() && str_ends_with($entry->getFilename(), '.md')) {
            $subagentFiles[] = substr($entry->getPathname(), strlen($subagentsDir) + 1);
        }
    }
}
sort($subagentFiles);

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
// Read the section whenever the heading exists, never gated on the file
// inventory: gating would let a README row outlive the last subagent it
// described. Absent heading with no files is the legitimate empty catalog.
$hasSubagentsHeading = in_array('## Subagents', array_map('trim', $readmeLines), true);
$subagentsRows = $hasSubagentsHeading ? $sectionTable($readmeLines, '## Subagents') : [];
if (! $hasSubagentsHeading && $subagentFiles !== []) {
    $fail('subagent files exist but README has no "## Subagents" section');
}

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
// Invariant J — .boost-user-scope.yaml entries name a real, token-free guideline
// ---------------------------------------------------------------------------

$userScopePath = $guidelinesDir . '/.boost-user-scope.yaml';
if (is_file($userScopePath)) {
    $userScope = Yaml::parseFile($userScopePath) ?? [];
    if (! is_array($userScope) || array_values($userScope) !== $userScope) {
        $fail('.boost-user-scope.yaml must be a YAML list of guideline filenames');
        $userScope = [];
    }

    $seen = [];
    foreach ($userScope as $entry) {
        if (! is_string($entry)) {
            $fail('.boost-user-scope.yaml has a non-string entry');

            continue;
        }
        if (isset($seen[$entry])) {
            $fail(".boost-user-scope.yaml lists '{$entry}' more than once");

            continue;
        }
        $seen[$entry] = true;

        // boost-core keys eligibility on Finder's getRelativePathname(). Only
        // the canonical form of a path matches it on every core version, so
        // require that here rather than relying on the consumer's core to
        // normalize. An absolute or `..` entry is refused outright.
        if (str_contains($entry, '..') || str_starts_with($entry, '/')
            || str_contains($entry, './') || str_contains($entry, '//')
            || str_contains($entry, '\\')) {
            $fail(".boost-user-scope.yaml entry '{$entry}' must be a plain path inside the guidelines directory");

            continue;
        }

        // An existing non-.md file passes the is_file() check below, so only
        // this catches a listed `.boost-tags.yaml`. boost-core refuses a
        // selected file no renderer can read; this fails the build first.
        if (! str_ends_with($entry, '.md')) {
            $fail(".boost-user-scope.yaml lists '{$entry}', which is not a .md file; no renderer can read it");

            continue;
        }

        if (! is_file($guidelinesDir . '/' . $entry)) {
            $fail(".boost-user-scope.yaml lists '{$entry}' but no such guideline file exists");

            continue;
        }

        // boost-core refuses on any `boost:conv` occurrence, not only one
        // carrying a path, so test for the marker and use $convPaths only to
        // name the paths when there are any.
        $body = (string) file_get_contents($guidelinesDir . '/' . $entry);
        if (str_contains($body, 'boost:conv')) {
            $tokens = $convPaths($guidelinesDir . '/' . $entry);
            $fail(sprintf(
                "guideline '%s' is user-scope eligible but holds a conventions token%s; user scope cannot resolve one",
                $entry,
                $tokens === [] ? '' : ' [' . implode(' ', $tokens) . ']',
            ));
        }
    }
}

// ---------------------------------------------------------------------------
// Invariant H — subagents (files <-> README <-> frontmatter)
// ---------------------------------------------------------------------------
//
// A subagent is one flat `<name>.md` whose identity is its frontmatter `name`
// (Claude Code resolves a dispatch by that field, never by path). Tags live in
// the file's own `metadata.boost-tags`, verified to load unchanged, so there is
// no sidecar here — unlike guidelines, which stay frontmatter-free.

$readmeSubagentTags = [];
foreach ($subagentsRows as $row) {
    // A data row with no backticked name is malformed, never something to skip:
    // this table claims a bijection with the files, and a row nobody can parse
    // would sit beside a valid one unnoticed.
    $name = $backtickTokens($row[0])[0] ?? null;
    if ($name === null) {
        $fail('README ## Subagents has a row whose first cell names no subagent: ' . trim($row[0]));

        continue;
    }
    if (array_key_exists($name, $readmeSubagentTags)) {
        $fail("README ## Subagents lists '{$name}' more than once");

        continue;
    }
    $readmeSubagentTags[$name] = $backtickTokens($row[count($row) - 1]);
}

$subagentNames = [];
foreach ($subagentFiles as $file) {
    $stem = basename($file, '.md');
    $frontmatterData = $frontmatter($subagentsDir . '/' . $file);

    // A missing or non-string name fails this compare too — and it must fail:
    // boost-core skips a nameless subagent with a warning rather than emitting
    // it, so shipping one means shipping a file no consumer ever loads.
    $declaredName = $frontmatterData['name'] ?? null;
    if ($declaredName !== $stem) {
        $fail("subagent '{$file}': frontmatter name '" . var_export($declaredName, true) . "' != filename stem '{$stem}'");
    }
    $declaredDescription = $frontmatterData['description'] ?? null;
    if (! is_string($declaredDescription) || trim($declaredDescription) === '') {
        $fail("subagent '{$file}' has no non-empty 'description' — nothing tells a caller when to dispatch it");
    }

    if (in_array($stem, $subagentNames, true)) {
        $fail("subagent '{$file}': a second file already declares the name '{$stem}' — boost-core rejects two files from one package sharing a name");

        continue;
    }

    $subagentNames[] = $stem;

    // Match BoostTags::parse(): a non-string value is invalid, not coerced. A
    // YAML list would stringify to "Array" here and could match a README cell,
    // while boost-core reads it as malformed and ships the subagent nowhere.
    $tags = [];
    if (array_key_exists('boost-tags', $frontmatterData['metadata'] ?? [])) {
        $rawTags = $frontmatterData['metadata']['boost-tags'];
        if (! is_string($rawTags)) {
            $fail("subagent '{$file}': metadata.boost-tags must be a space-delimited string");
        } else {
            $tags = preg_split('/\s+/', trim($rawTags), -1, PREG_SPLIT_NO_EMPTY) ?: [];
        }
    }
    foreach ($tags as $t) {
        $usedTags[$t] = true;
    }

    if (! array_key_exists($stem, $readmeSubagentTags)) {
        $fail("subagent '{$file}' has no row in README ## Subagents table");

        continue;
    }
    if (! $setsEqual($tags, $readmeSubagentTags[$stem])) {
        $fail(sprintf(
            "subagent '%s': README tags [%s] != frontmatter metadata.boost-tags [%s]",
            $stem,
            implode(' ', $readmeSubagentTags[$stem]),
            implode(' ', $tags),
        ));
    }
}

foreach (array_keys($readmeSubagentTags) as $name) {
    if (! in_array($name, $subagentNames, true)) {
        $fail("README ## Subagents lists '{$name}' but no such subagent file exists");
    }
}

// ---------------------------------------------------------------------------
// Invariant I — a skill's boost-requires resolves
// ---------------------------------------------------------------------------
//
// boost-core reports an unresolvable dependency as a warning on the CONSUMER's
// sync, where nobody in this repo sees it. A typo like `subagent:test-coverge-auditor`
// would otherwise pass every check here and surface only downstream.

foreach ($skillDirs as $dir) {
    $skillMetadata = $frontmatter($skillsDir . '/' . $dir . '/SKILL.md')['metadata'] ?? null;
    if (! is_array($skillMetadata) || ! array_key_exists('boost-requires', $skillMetadata)) {
        continue;
    }

    // boost-core reads a non-string value as malformed and drops the whole
    // declaration, so the skill would ship with no dependencies at all.
    $requires = $skillMetadata['boost-requires'];
    if (! is_string($requires)) {
        $fail("skill '{$dir}': metadata.boost-requires must be a space-delimited string");

        continue;
    }
    foreach (preg_split('/\s+/', trim($requires), -1, PREG_SPLIT_NO_EMPTY) ?: [] as $token) {
        if (str_starts_with($token, 'subagent:')) {
            $required = substr($token, strlen('subagent:'));
            if (! in_array($required, $subagentNames, true)) {
                $fail("skill '{$dir}' requires subagent '{$required}', which this package does not ship");
            }

            continue;
        }
        if (! in_array($token, $skillDirs, true)) {
            $fail("skill '{$dir}' requires skill '{$token}', which this package does not ship");
        }
    }
}

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
$subagentCount = count($subagentNames);

if ($violations === []) {
    echo "PASS  catalog consistency\n";
    echo "        {$skillCount} skills, {$guidelineCount} guidelines, {$subagentCount} subagents\n";
    echo "        checks: name↔dir, README↔frontmatter tags, inventory, guideline sidecar, user-scope sidecar, subagent name↔file↔README, boost-requires resolvable, tag vocabulary, conv-slot, schema-required\n";
    exit(0);
}

echo 'FAIL  catalog consistency — ' . count($violations) . " violation(s)\n";
foreach ($violations as $v) {
    echo "        {$v}\n";
}
exit(1);
