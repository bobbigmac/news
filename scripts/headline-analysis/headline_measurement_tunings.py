"""Name- and source-specific measurement corrections.

These entries are deliberately separated from the general measurement logic. They
are precision corrections for known headline-case named entities and publisher
boilerplate, not source-quality judgements. Keys are compact lowercase brand text
because matching happens after punctuation and whitespace are removed.
"""
import re

# spaCy's small NER model often labels games, teams, products, people and brands as
# places when headlines use title case. These exact normalised entity strings are
# corpus-audited false positives. This list is intentionally explicit: do not turn
# it into a broad dictionary or substring matcher.
PLACE_FALSE_POSITIVE_ENTITIES = {
    'ai', 'man city', 'manchester city', 'man united', 'nvidia', 'poundland', 'netflix',
    'f1', 'badenoch', 'duran', 'infantino', 'burnham', 'isak', 'tributes', 'steam',
    'pochettino', 'ebola', 'liv golf', 'kompany', 'haaland', 'titan', 'ubisoft', 'us',
    'osimhen', 'grand slam', 'game pass', 'bungie', 'atlus', 'the ocarina of time',
    'toy story', 'infinity ward', 'night city', 'zombies', 'navi', 'dungeon', 'south park',
    'alien', 'ninja gaiden', 'lost ark', 'the game awards', 'grand theft auto', 'grey cup',
    'uconn', 'magician', 'g20', 'bundesliga', 'carney', 'prabowo', 'clavius', 'audi korea',
    'premium bonds', 'fedex', 'wawa', 'royal', 'ea', 'lammens', 'mississippi senate', 'qa',
}

# These can be genuine places, but in this corpus they are often clubs, people or
# organisations. Count them only when local syntax or a geographic suffix supports
# a place reading (for example "in Liverpool" or "Liverpool City Council").
PLACE_CONTEXT_REQUIRED_ENTITIES = {
    'liverpool', 'newcastle', 'sunderland', 'brighton', 'ipswich', 'leeds', 'barcelona',
    'madrid', 'milan', 'brugge', 'sporting', 'washington', 'warren', 'hollywood', 'delta',
    'belmont', 'lexington', 'west', 'hamilton', 'reading', 'victoria', 'chelsea', 'arsenal',
    'portland', 'oakland', 'memphis', 'st. thomas', 'le havre', 'rome', 'jerusalem',
}

PLACE_GEO_SUFFIX_RE = re.compile(r"^(?:city|county|province|state|island|islands|coast|airport|hospital|prison|school|university|council|police|border|harbour|harbor|beach|port|region|district|highway|runway)\b", re.I)
LOCATIVE_PREFIX_RE = re.compile(r"\b(?:in|at|near|across|around|throughout|inside|outside|off|from|to|into|towards?|on)\s+(?:the\s+)?$", re.I)

# Publisher boilerplate suffixes sometimes differ from the measured source key.
# Aliases let exact suffixes such as "- Nature Medicine" be stripped without
# touching editorial subtitles. This is a normalisation map only; it must not be
# used for ownership, grouping or quality judgements.
SOURCE_SUFFIX_ALIASES = {
    'fox59indianapolis': {'fox59'},
    'kait8': {'kait'},
    'ghacks': {'ghackstechnews'},
    'vnexpress': {'vnexpressinternational'},
    'nature': {'natureimmunology', 'naturemedicine'},
    'oregonliveobituaries': {'legacy'},
}
