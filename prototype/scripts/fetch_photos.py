#!/usr/bin/env python3
"""下载 photo_assignments.json 中逐菜审核过的图片，不自动搜索或随机配图。

用法：python3 prototype/scripts/fetch_photos.py data/what-to-eat-data
需要 requests、Pillow。已有文件按 SHA-256 校验；源站内容改变时停止并要求重新审核。
原始搜索候选不作为构建输入，清单中保留每张采用图片的来源、标题与配图范围。
"""
from __future__ import annotations

import hashlib
import io
import json
import sys
from pathlib import Path

import requests
from PIL import Image, ImageOps


def normalize(content: bytes, white_background: bool, crop: list[int] | None = None) -> bytes:
    with Image.open(io.BytesIO(content)) as im:
        im.load()
        if crop:
            im = im.crop(tuple(crop))
        if white_background:
            background = Image.new('RGBA', im.size, 'white')
            background.alpha_composite(im.convert('RGBA'))
            im = background
        out = io.BytesIO()
        im.convert('RGB').save(out, format='JPEG', quality=95)
        return out.getvalue()


def assemble(parts: list[Path], columns: int | None = None) -> bytes:
    canvas = Image.new('RGB', (1200, 720), 'white')
    columns = columns or len(parts)
    rows = (len(parts) + columns - 1) // columns
    tile = 1200 // columns
    height = 720 // rows
    for i, path in enumerate(parts):
        with Image.open(path) as im:
            background = Image.new('RGBA', im.size, 'white')
            background.alpha_composite(im.convert('RGBA'))
            im = ImageOps.contain(background.convert('RGB'), (tile - 16, height - 32))
            canvas.paste(im, (i % columns * tile + (tile - im.width) // 2,
                             i // columns * height + (height - im.height) // 2))
    out = io.BytesIO()
    canvas.save(out, format='JPEG', quality=95)
    return out.getvalue()


def fetch(data: Path, catalog: dict) -> None:
    assets = catalog['assets']
    done: set[str] = set()
    visiting: set[str] = set()

    def ensure(key: str) -> Path:
        entry = assets[key]
        path = data / entry['file']
        if key in done:
            return path
        if key in visiting:
            raise ValueError(f'图片组成循环引用：{key}')
        visiting.add(key)
        if path.exists():
            content = path.read_bytes()
        elif entry.get('components'):
            content = assemble([ensure(k) for k in entry['components']], entry.get('columns'))
        else:
            headers = {'User-Agent': 'Mozilla/5.0', 'Referer': entry['page']}
            response = requests.get(entry['url'], headers=headers, timeout=30)
            response.raise_for_status()
            content = response.content
            if entry.get('normalization') == 'jpeg95':
                content = normalize(content, entry.get('white_background', False), entry.get('crop'))
            with Image.open(io.BytesIO(content)) as im:
                im.verify()
        digest = hashlib.sha256(content).hexdigest()
        if digest != entry['sha256']:
            raise ValueError(f'图片与审核版本不一致：{entry["title"]} ({entry["file"]})；请重新核对来源，未覆盖文件')
        if not path.exists():
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(content)
            print(f'下载：{entry["title"]}')
        visiting.remove(key)
        done.add(key)
        return path

    for key in assets:
        ensure(key)
    print(f'{len(done)} 张图片校验通过')


if __name__ == '__main__':
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    catalog = json.loads(Path(__file__).with_name('photo_assignments.json').read_text(encoding='utf-8'))
    fetch(Path(sys.argv[1]), catalog)
