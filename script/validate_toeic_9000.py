#!/usr/bin/env python3
from pathlib import Path

WORD_FILE = Path(__file__).resolve().parents[1] / "docs" / "toeic_9000_words.txt"

def main() -> int:
    words = [line.strip() for line in WORD_FILE.read_text(encoding="utf-8").splitlines() if line.strip()]
    unique_words = set(words)

    if len(words) != 9000:
        print(f"Expected 9000 words, got {len(words)}")
        return 1
    if len(unique_words) != 9000:
        print(f"Expected 9000 unique words, got {len(unique_words)}")
        return 1
    if any(not word.isalpha() or not word.islower() for word in words):
        print("All words must be lowercase alphabetic entries")
        return 1

    print("Validation passed: 9000 unique lowercase words")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
