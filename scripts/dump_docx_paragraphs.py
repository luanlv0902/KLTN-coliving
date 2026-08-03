import json
import sys


source = sys.argv[1]
start = int(sys.argv[2])
end = int(sys.argv[3])

with open(source, encoding="utf-8") as handle:
    document = json.load(handle)

for paragraph in document["paragraphs"]:
    if start <= paragraph["index"] <= end:
        style = paragraph.get("style", "")
        print(f'{paragraph["index"]}: [{style}] {paragraph["text"]}')
