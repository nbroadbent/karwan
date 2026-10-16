#!/usr/bin/env python3
"""Build the local photo library for Kurdistan Monopoly.

  python3 images/build.py --theme kurdish            rebuild images/kurdish/manifest.js from the files in that folder
  python3 images/build.py --theme persian --fetch    also download freely licensed photos from Wikimedia Commons

Each theme has its own folder (images/<theme>/) holding its photos, credits.json
and the generated manifest.js.

Photos are named <slug>-<n>.jpg where <slug> is the square name in lower case
with accents removed and spaces as dashes (erbil-1.jpg, dukan-dam-power-2.jpg …).
Drop your own pictures in here with that naming and rerun this script; credits
for downloaded photos live in credits.json, your own files are credited as
"Local photo" unless you add an entry there.
"""
import json, os, re, sys, time, unicodedata, urllib.parse, urllib.request

ROOT = os.path.dirname(os.path.abspath(__file__))
THEME = (sys.argv[sys.argv.index('--theme') + 1] if '--theme' in sys.argv else 'kurdish')
HERE = os.path.join(ROOT, THEME)
os.makedirs(HERE, exist_ok=True)
UA = {'User-Agent': 'KurdistanMonopoly/1.0 (local hobby board game; images/build.py)'}
MAX_PER_PLACE = 3
WIDTH = 900
SKIP = re.compile(r'map|flag|locator|coat|arms|logo|seal|icon|emblem|banner|chart|diagram|graph|wappen|karte|\.svg$|\.gif$|\.png$|\.tif', re.I)

def slug(name):
    s = unicodedata.normalize('NFKD', name).encode('ascii', 'ignore').decode()
    return re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')

def load_titles():
    src = open(os.path.join(ROOT, '..', 'themes', THEME + '.js'), encoding='utf-8').read()
    m = re.search(r'wikiTitles: \{(.*?)\},\n', src, re.S)
    titles = {}
    for a, b, c, d in re.findall(r"""(?:'((?:[^'\\]|\\.)+)'|"([^"]+)"):\s*(?:'((?:[^'\\]|\\.)+)'|"([^"]+)")""", m.group(1)):
        titles[(a or b).replace("\\'", "'")] = (c or d).replace("\\'", "'")
    return titles

def get(url, retries=4):
    for k in range(retries):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=30) as r:
                return r.read(), r.headers
        except urllib.error.HTTPError as e:
            if e.code == 429 and k < retries - 1:
                time.sleep(8 * (k + 1)); continue
            raise
    return None, None

def fetch_place(name, title, credits):
    """Download up to MAX_PER_PLACE photos for one place. Returns list of filenames."""
    files = []
    t = urllib.parse.quote(title.replace(' ', '_'))
    body, _ = get(f'https://en.wikipedia.org/api/rest_v1/page/summary/{t}')
    summary = json.loads(body)
    time.sleep(1.2)
    candidates = []
    if summary.get('originalimage'):
        fn = urllib.parse.unquote(summary['originalimage']['source'].rsplit('/', 1)[-1])
        candidates.append(('File:' + re.sub(r'^\d+px-', '', fn)).replace('_', ' '))
    try:
        body, _ = get(f'https://en.wikipedia.org/api/rest_v1/page/media-list/{t}')
        for item in json.loads(body).get('items', []):
            if item.get('type') != 'image' or not item.get('title'):
                continue
            title_ = item['title'].replace('_', ' ')
            if SKIP.search(title_) or title_ in candidates:
                continue
            candidates.append(title_)
    except Exception as e:
        print('   media-list failed:', e)
    time.sleep(1.2)
    candidates = candidates[:MAX_PER_PLACE + 3]
    if not candidates:
        return files
    q = urllib.parse.urlencode({'action': 'query', 'format': 'json', 'prop': 'imageinfo', 'iiprop': 'url|extmetadata|mime',
                                'iiurlwidth': WIDTH, 'titles': '|'.join(candidates)})
    body, _ = get('https://commons.wikimedia.org/w/api.php?' + q)
    pages = json.loads(body).get('query', {}).get('pages', {})
    time.sleep(1.2)
    infos = {}
    for p in pages.values():
        ii = (p.get('imageinfo') or [None])[0]
        if ii: infos[p['title'].replace('_', ' ')] = ii
    n = 0
    for c in candidates:
        ii = infos.get(c)
        if not ii or not ii.get('thumburl') or not str(ii.get('mime', '')).startswith('image/'):
            continue
        meta = ii.get('extmetadata', {})
        lic = meta.get('LicenseShortName', {}).get('value', '')
        if lic and re.search(r'non-free|fair use|all rights', lic, re.I):
            continue
        n += 1
        fname = f'{slug(name)}-{n}.jpg'
        try:
            data, _ = get(ii['thumburl'])
            open(os.path.join(HERE, fname), 'wb').write(data)
        except Exception as e:
            print('   download failed:', c, e); n -= 1; continue
        artist = re.sub(r'<[^>]+>', '', meta.get('Artist', {}).get('value', '')).strip()
        credits[fname] = {
            'title': c.replace('File:', '').rsplit('.', 1)[0].replace('_', ' '),
            'author': artist[:80] or 'Wikimedia Commons',
            'license': lic or 'see source',
            'source': ii.get('descriptionurl') or ii.get('url'),
        }
        files.append(fname)
        print(f'   saved {fname}  ({lic or "?"}; {artist[:40]})')
        time.sleep(0.8)
        if n >= MAX_PER_PLACE:
            break
    return files

def build_manifest(credits):
    files = sorted(f for f in os.listdir(HERE) if re.search(r'\.(jpe?g|png|webp)$', f, re.I))
    manifest = {}
    titles = load_titles()
    slugs = {slug(n): n for n in titles}
    for f in files:
        m = re.match(r'(.+?)(?:-(\d+))?\.(jpe?g|png|webp)$', f, re.I)
        if not m: continue
        name = slugs.get(m.group(1))
        if not name:
            print('  (skipping', f, '- no square with that slug)'); continue
        c = credits.get(f, {'title': name, 'author': 'Local photo', 'license': '', 'source': ''})
        manifest.setdefault(name, []).append({'file': f'images/{THEME}/' + f, **c})
    out = ('// Generated by images/build.py — local photos for the place panel.\n'
           f'window.LOCAL_IMAGES = window.LOCAL_IMAGES || {{}};\nLOCAL_IMAGES[{json.dumps(THEME)}] = ' + json.dumps(manifest, ensure_ascii=False, indent=1) + ';\n')
    open(os.path.join(HERE, 'manifest.js'), 'w', encoding='utf-8').write(out)
    print(f'manifest.js: {sum(len(v) for v in manifest.values())} photo(s) for {len(manifest)} square(s)')

def main():
    cpath = os.path.join(HERE, 'credits.json')
    credits = json.load(open(cpath, encoding='utf-8')) if os.path.exists(cpath) else {}
    if '--fetch' in sys.argv:
        titles = load_titles()
        skip_next = False; only = []
        for a in sys.argv[1:]:
            if skip_next: skip_next = False; continue
            if a == '--theme': skip_next = True; continue
            if not a.startswith('--'): only.append(a)
        for name, title in titles.items():
            if only and name not in only: continue
            if any(f.startswith(slug(name) + '-') for f in os.listdir(HERE)) and '--refresh' not in sys.argv:
                print(f'{name}: already have photos, skipping'); continue
            print(f'{name}  ←  {title}')
            try:
                fetch_place(name, title, credits)
            except Exception as e:
                print('   failed:', e)
            json.dump(credits, open(cpath, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
            time.sleep(1.5)
    build_manifest(credits)

if __name__ == '__main__':
    main()
