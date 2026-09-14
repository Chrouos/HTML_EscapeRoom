#!/usr/bin/env node
const { content } = require('../game/content/contentSchema');
const { assertValidContent } = require('../game/content/validateContent');

try {
  assertValidContent(content);
  process.stdout.write('Narrative content valid.\n');
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}
