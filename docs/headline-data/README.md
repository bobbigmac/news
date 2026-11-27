# Headline source analysis package

## Contents
- `analyse_headlines.py`: corpus parsing, title detectors, topic modelling, publisher profiles and ranking outputs.
- `make_charts.py`: radar and comparison chart generation.
- `test_detectors.py`, `test_corpus_outputs.py`: detector and corpus-output checks.
- `requirements.txt`: Python dependencies.
- `source-headlines-2026-11-27.zip`: original headline input archive.
- `sources-manifest.md`: source-group manifest snapshot used by this run.
- CSV/JSON files: per-headline signals, publisher rankings, axis profiles, phrase signatures, story distributions, topics and cross-source matches.
- `source_radar.html` and PNGs: interactive and static visualisations.
- `REPORT.md`, `ANALYSIS_README.md`, `run.log`: results, methods, caveats and run output.

## Re-run
Unzip the package, create a virtual environment, install `requirements.txt`, then run:

```bash
python analyse_headlines.py
python make_charts.py
python -m pytest -q
```

The analysis is title-based. Its scores describe headline-language signals and are not factual accuracy or article-body quality judgements.
