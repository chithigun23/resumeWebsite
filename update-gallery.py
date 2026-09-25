"""
Builds the gallery.

  python update-gallery.py "C:\\path\\to\\new\\photos"   import photos, then rebuild
  python update-gallery.py                              just rebuild (after editing stories)

Import: each photo is oriented, stripped of all metadata (GPS included), resized and
saved as gallery/<id>.jpg plus a thumbnail in gallery/thumbs/. HEIC is supported
(pip install pillow-heif). The <id> is normally the capture date, e.g.
2025-02-21_151649. Date-only names such as 2025-08-07 are also supported.

Stories: gallery/stories.md holds one section per photo. Edit it, then rebuild.

    ## 2025-02-21_151649 | Optional title
    The story behind the photo. Blank lines start a new paragraph.

Rebuild: reads gallery/*.jpg + stories.md and writes gallery/images.json, oldest first.
Existing stories are never overwritten; new photos get an empty section appended.
"""
import datetime as dt
import json
import re
import sys
from pathlib import Path

from PIL import Image, ImageOps

try:
    import pillow_heif
    pillow_heif.register_heif_opener()
except ImportError:
    pillow_heif = None

ROOT = Path(__file__).parent
GALLERY = ROOT / "gallery"
THUMBS = GALLERY / "thumbs"
STORIES = GALLERY / "stories.md"
EXTS = {".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"}
FULL_EDGE, THUMB_EDGE = 1800, 720


def capture_date(path, im):
    """Filename first (phones name files by date), then EXIF. None if unknown."""
    m = re.search(r"(20\d{2})(\d{2})(\d{2})[_-](\d{2})(\d{2})(\d{2})", path.stem)
    if m:
        return dt.datetime(*map(int, m.groups()))
    m = re.search(r"FB_IMG_(\d{13})", path.stem)
    if m:
        return dt.datetime.fromtimestamp(int(m.group(1)) / 1000, dt.timezone.utc).replace(tzinfo=None)
    ex = im.getexif()
    raw = ex.get_ifd(0x8769).get(36867) or ex.get(306)
    if raw:
        try:
            return dt.datetime.strptime(raw, "%Y:%m:%d %H:%M:%S")
        except ValueError:
            pass
    return None


def photo_id(path, when):
    if when:
        return when.strftime("%Y-%m-%d_%H%M%S")
    return "undated-" + re.sub(r"[^a-z0-9]+", "-", path.stem.lower()).strip("-")[:40]


def save(im, out, edge, quality):
    im = im.copy()
    im.thumbnail((edge, edge), Image.LANCZOS)
    out.parent.mkdir(parents=True, exist_ok=True)
    im.convert("RGB").save(out, "JPEG", quality=quality, optimize=True, progressive=True)  # no exif passed = stripped


def import_photos(src):
    n = 0
    for path in sorted(Path(src).iterdir()):
        if path.suffix.lower() not in EXTS:
            continue
        if path.suffix.lower() in {".heic", ".heif"} and not pillow_heif:
            print("skip (needs pillow-heif):", path.name)
            continue
        im = Image.open(path)
        when = capture_date(path, im)
        pid = photo_id(path, when)
        out = GALLERY / f"{pid}.jpg"
        if out.exists():
            continue
        im = ImageOps.exif_transpose(im)
        save(im, out, FULL_EDGE, 80)
        save(im, THUMBS / f"{pid}.jpg", THUMB_EDGE, 74)
        n += 1
        print("imported", path.name, "->", out.name)
    print(f"{n} new photo(s)")


def parse_stories():
    data, cur = {}, None
    if not STORIES.exists():
        return data
    for line in STORIES.read_text(encoding="utf-8").splitlines():
        m = re.match(r"##\s+(\S+)\s*(?:\|\s*(.*))?$", line)
        if m:
            cur = data[m.group(1)] = {"title": (m.group(2) or "").strip(), "lines": []}
        elif cur is not None:
            cur["lines"].append(line)
    for v in data.values():
        v["story"] = "\n".join(v.pop("lines")).strip()
    return data


def rebuild():
    ids = sorted(
        (p.stem for p in GALLERY.glob("*.jpg")),
        key=lambda s: (s.startswith("undated-"), s),
    )
    stories = parse_stories()

    with STORIES.open("a", encoding="utf-8") as f:
        if not STORIES.stat().st_size:
            f.write("<!-- One section per photo: '## id | optional title', then the story. -->\n")
        for pid in ids:
            if pid not in stories:
                f.write(f"\n## {pid} |\n")
                stories[pid] = {"title": "", "story": ""}

    items = []
    for pid in ids:
        with Image.open(GALLERY / f"{pid}.jpg") as im:
            w, h = im.size
        s = stories[pid]
        date = None
        if re.fullmatch(r"\d{4}-\d{2}-\d{2}(?:_\d{6})?", pid):
            date = dt.date.fromisoformat(pid[:10]).isoformat()
        items.append({
            "id": pid,
            "src": f"gallery/{pid}.jpg",
            "thumb": f"gallery/thumbs/{pid}.jpg",
            "w": w, "h": h,
            "date": date,
            "title": s["title"],
            "story": s["story"],
        })
    (GALLERY / "images.json").write_text(json.dumps(items, indent=1, ensure_ascii=False), encoding="utf-8")
    print(f"Wrote gallery/images.json ({len(items)} photos, {sum(1 for i in items if i['story'])} with stories)")


if __name__ == "__main__":
    GALLERY.mkdir(exist_ok=True)
    if len(sys.argv) > 1:
        import_photos(sys.argv[1])
    STORIES.touch()
    rebuild()
