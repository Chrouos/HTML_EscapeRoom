function normalizeAnswer(value) {
  return String(value)
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('en-US');
}

function answersMatch(value, answer) {
  return normalizeAnswer(value) === normalizeAnswer(answer);
}

module.exports = { normalizeAnswer, answersMatch };
