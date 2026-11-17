# voices

The pins for the image's spoken lines (see [ADR 0004](../docs/adr/0004-office-audio.md)). Nothing here is
shipped: the `voices` stage of the `Dockerfile` downloads the Piper binary and the models listed in
`models.json`, checks every SHA-256, renders each line a Voice can say and writes the clips and an
`ATTRIBUTION.txt` into the image.

## Add a model

1. Pick a Piper voice from [rhasspy/piper-voices](https://huggingface.co/rhasspy/piper-voices) and add an entry
   to `models.json`: the `.onnx` and `.onnx.json` URLs (pinned to a Hugging Face revision, never `main`, with
   the file names the model's name gives), their `shasum -a 256` values, the `licence`, `dataset`, `source`,
   `training` and `attribution`.
2. Point a Voice at it with `piper: { model: '<name>' }` (and `speaker` for a multi-speaker model).
3. When Piper's release changes, update `piper.version` and both `piper.sha256` values here and the matching
   `ARG`s in the `Dockerfile` (a test checks they agree).

## Licence rule

The image is public, so a model's dataset licence must allow redistributing what it says. Only these are
accepted: `public domain`, `CC0-1.0` and `CC-BY-4.0`. The weights must also be trained from scratch, or fine-tuned only from a model that itself passes this rule (many
Piper voices are fine-tuned from lessac, whose licence forbids this use). `training` records which: exactly
`trained from scratch`, or `fine-tuned from <another pinned model>`. Record the attribution the licence asks
for; it is written to `ATTRIBUTION.txt` in the image.
