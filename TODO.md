# TODO

## Future features

- [ ] Source/category roundups: after the normal run has finished batch/solo cluster summaries, consider a second pass that identifies recurring low-value story patterns by source or category (for example, repeated outrage framing) and uses one consolidated OpenRouter call to flag or resummarise those groups. Needs design before implementation.
- [ ] Keep `src/trees/` JSON datasets maintained: add newly-seen hosts/subjects to curated branches and deepen any allocated branch that grows well past its target group size. Revisit `src/trees/profiles/` research notes as sources accumulate.

## Paused: taxonomy research

- [ ] Identify established/mainstream/widely-known reference taxonomies for better grouping support — candidates to evaluate: IPTC NewsCodes/MediaTopics (the news-industry standard subject taxonomy, ~1,400 terms in 17 top-level concepts, used by AP/Reuters/AFP/BBC-class wire orgs), Wikidata entity relations, Schema.org types, GDELT themes, simple.wikipedia categories. Goal: align our `src/trees/story/*.json` branches with a portable external vocabulary so the dataset transfers beyond today's news, rather than being a bespoke list matched to the current digest. Resume after the UI/masonry work (quota pressure — do NOT spend OpenRouter calls on this; use free taxonomy downloads + LLM judgement).
- [ ] Tree-expansion continuation: the escape-driven pass on the ungrouped corpus was mid-flight (was at ~4,762/5,557 grouped, 230 groups; remaining ungrouped included foreign-language items, junk headlines, and several one-offs). Resume with escape analysis after taxonomy alignment.
