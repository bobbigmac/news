"""Title-case normalisation for headline parsing.

US-style headlines capitalise almost every content word, which puts the text outside
the training distribution of spaCy's case-sensitive tagger/lemmatizer: verbs such as
"Fell" or "Has Passed Away" are misread as proper nouns, so verbal evidence and correct
lemmatisation are systematically lost for title-case publishers. The fix is statistical
truecasing (Lita et al., tRuEcasIng) before parsing: restore natural sentence casing,
then let the tagger work on text that looks like its training data. The original string
is always kept for surface matching and casing diagnostics; the truecased variant is
only ever a parse input.
"""
import re

try:
    import truecase as _truecase
except Exception:  # pragma: no cover - dependency guard
    _truecase = None

WORD_RE = re.compile(r"\b[A-Za-z][A-Za-z'’\-]*\b")


def alpha_words(text):
    return WORD_RE.findall(str(text))


def is_title_case(text):
    """Majority-capitalised headline detection.

    Counts words after the first that start with an uppercase letter but are not
    all-caps acronyms. Sentence-case headlines (BBC/Guardian/Eurogamer style) sit
    far below 0.5; AP/NYT-style headlines sit near 1.0.
    """
    words = alpha_words(text)
    if len(words) < 4:
        return False
    later = words[1:]
    capitalised = sum(1 for w in later if w[:1].isupper() and not w.isupper())
    return capitalised / len(later) > 0.5


def truecase_headline(text):
    """Statistical sentence-casing for use as a parse input.

    Returns the original string unchanged when the truecaser is unavailable or
    the headline is not title case, so callers can compare and skip redundant parses.
    """
    text = str(text)
    if _truecase is None or not is_title_case(text):
        return text
    try:
        return _truecase.get_true_case(text)
    except Exception:
        return text


def parse_inputs(title):
    """Parse-input variants for one headline: original first, truecased second when different."""
    title = str(title)
    variants = [title]
    recased = truecase_headline(title)
    if recased != title:
        variants.append(recased)
    return variants
