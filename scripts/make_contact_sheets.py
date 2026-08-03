from pathlib import Path
import math
import sys

from PIL import Image, ImageDraw, ImageFont


source = Path(sys.argv[1])
output = Path(sys.argv[2])
start = int(sys.argv[3])
end = int(sys.argv[4])
columns = int(sys.argv[5])
rows = int(sys.argv[6])
thumb_width = int(sys.argv[7])

files = sorted(
    source.glob("page-*.png"),
    key=lambda path: int(path.stem.split("-")[-1]),
)
files = [
    path
    for path in files
    if start <= int(path.stem.split("-")[-1]) <= end
]
output.mkdir(parents=True, exist_ok=True)

per_sheet = columns * rows
for sheet_index in range(math.ceil(len(files) / per_sheet)):
    batch = files[sheet_index * per_sheet : (sheet_index + 1) * per_sheet]
    thumbs = []
    for path in batch:
        image = Image.open(path).convert("RGB")
        height = round(image.height * thumb_width / image.width)
        image = image.resize((thumb_width, height), Image.Resampling.LANCZOS)
        thumbs.append((path, image))

    label_height = 28
    cell_height = max(image.height for _, image in thumbs) + label_height
    canvas = Image.new(
        "RGB",
        (columns * thumb_width, rows * cell_height),
        "white",
    )
    draw = ImageDraw.Draw(canvas)
    for position, (path, image) in enumerate(thumbs):
        row = position // columns
        column = position % columns
        x = column * thumb_width
        y = row * cell_height
        canvas.paste(image, (x, y + label_height))
        page_number = int(path.stem.split("-")[-1])
        draw.text((x + 8, y + 5), f"PDF page {page_number}", fill="black")

    canvas.save(output / f"sheet-{sheet_index + 1:02d}.jpg", quality=88)
