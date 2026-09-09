"""Build the 1024-square exterior paste-up atlas. Pillow + Node sharp (SVG intake).

Usage: python tools/exterior_atlas.py --sharp-module /path/to/node_modules/sharp
The two official source SVGs remain unmodified; only their ink is remapped here.
"""
import argparse
import io
import re
import subprocess
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets/exterior'
PAPER = '#eee1c7'
INK = '#343e42'
ACCENT = '#b8644e'


def build(sharp):
    atlas = Image.new('RGB', (1024, 1024), '#d5c6a9')
    d = ImageDraw.Draw(atlas)
    font_path = str(ROOT / 'assets/fonts/Inter.ttf')

    def text(x, y, value, size, fill=INK):
        font = ImageFont.truetype(font_path, size)
        font.set_variation_by_name('Bold')
        d.text((x, y), value, font=font, fill=fill, anchor='lt')

    for top in (0, 512):
        # Ragged paper silhouette, offset underprint and tape, all baked into one surface.
        d.polygon([(23, top+30), (980, top+17), (1002, top+68),
                   (984, top+476), (750, top+485), (742, top+476),
                   (38, top+491), (17, top+440)], fill=INK)
        d.polygon([(18, top+17), (976, top+27), (990, top+62),
                   (976, top+468), (760, top+480), (750, top+469),
                   (29, top+478), (34, top+300)], fill=PAPER)
        d.polygon([(42,top+8),(174,top+14),(165,top+43),(37,top+36)], fill='#bcab7e')
        d.polygon([(856,top+465),(982,top+451),(984,top+488),(862,top+502)], fill='#bcab7e')
        # Sparse scuffs stay out of letterforms.
        for x in range(55, 970, 37):
            d.line((x,top+448,x+12,top+447), fill='#c9b995', width=2)

    text(68, 66, 'MADE AROUND HERE', 24, ACCENT)
    text(65, 122, '@JaCoderX', 112)
    # Two little registration cuts make the handle read as soft stencil lettering.
    d.rectangle((70, 164, 922, 167), fill=PAPER)
    d.line((70, 264, 942, 251), fill=ACCENT, width=13)
    # Original pictograms: code brackets, paper plane, and the X letter.
    # Platform names remove any ambiguity; these are not downloaded platform logos.
    for x in (81, 378, 690):
        d.rounded_rectangle((x, 300, x+70, 378), radius=9, fill=INK)
    text(85, 316, '<>', 40, PAPER)
    d.polygon([(390,324),(438,310),(426,359),(414,342),(401,349),(403,334)], fill=PAPER)
    d.line((402, 334, 432, 317), fill=INK, width=3)
    text(708, 312, 'X', 48, PAPER)
    text(165, 322, 'GitHub', 39)
    text(460, 322, 'Telegram', 35)
    text(778, 322, 'X', 39)

    def mark(name, pos, size):
        source = (OUT / (name+'-source.svg')).read_text(encoding='utf-8')
        # Particle's public icon comment contains CSS `--tokens`, which is not
        # legal XML comment content for SVG rasterizers.
        source = re.sub(r'<!--.*?-->', '', source, flags=re.S)
        source = source.replace('#0a0a0a', PAPER).replace('#14161A', PAPER)
        source = source.replace('fill="white"', 'fill="'+INK+'"').replace('#FAFAFA', ACCENT)
        code = 'const sharp=require(process.argv[1]);let b="";process.stdin.on("data",c=>b+=c);process.stdin.on("end",async()=>process.stdout.write(await sharp(Buffer.from(b)).resize('+str(size)+','+str(size)+').png().toBuffer()));'
        result = subprocess.run(['node', '-e', code, sharp], input=source.encode(), stdout=subprocess.PIPE, check=True)
        atlas.paste(Image.open(io.BytesIO(result.stdout)).convert('RGB'), pos)

    text(68, 566, 'BUILT WITH', 24, ACCENT)
    mark('bloxchain', (56, 618), 170)
    text(248, 651, 'Bloxchain', 100)
    d.line((68, 806, 944, 806), fill=ACCENT, width=5)
    mark('particlecs', (70, 832), 106)
    text(198, 856, 'by ParticleCS', 57)
    atlas.save(OUT / 'south_pasteups.png', optimize=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--sharp-module', default='sharp')
    build(parser.parse_args().sharp_module)
