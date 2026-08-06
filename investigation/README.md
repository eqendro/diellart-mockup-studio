# Samsung Physical Device Regression

Device:
Samsung Galaxy

Browser:
Samsung Internet

Server:
192.168.100.31:3000

---

## Google Photos Failure

Expected:
Image should upload.

Actual:
File.arrayBuffer() fails before bytes are copied.

See:
google-photos-failure/

---

## Riviera

Image is correctly selected.

Crop succeeds.

After Continue the workflow requests another tighter crop.

Expected:
Logo should be extracted automatically.

---

## Vodafone

Crop succeeds.

Selection looks correct.

---

## Raffaello

Candidate extraction succeeds.

Transparent candidate is generated.

After pressing "Use this logo"

The photographed wrapper is rendered onto the napkin.

Expected:
Only artwork should be rendered.

Actual:
Entire photographed wrapper appears.

---

## Xh'Aura

Works correctly.