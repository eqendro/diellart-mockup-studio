# Artwork regression fixtures

These files are used to test the real DiellArt artwork-intake pipeline.

## Expected behaviour

| Fixture | Expected result |
|---|---|
| diellart.png | Accepted consistently, transparent background preserved or cleaned, centred, no distortion |
| xhaura.jpg | Accepted consistently, white background removed, no filled letter holes, upright |
| aureva.png | Accepted consistently, light background removed, gold/beige logo preserved, upright |
| raffaello.jpg | Accepted consistently, red lettering isolated, upright, minimal background remnants |
| ristorante-di-mare.jpg | Must not render the full rectangular photograph; should either isolate the logo or route to assisted selection |