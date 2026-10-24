"""dashboard.html が読み込む css/ と js/ に、中身のハッシュを ?v= として付け直す。
ファイルを変更したら、コミットの前に必ず実行する:  python tools/bump_assets.py
（GitHub Pages はファイルを約10分キャッシュするので、HTML と JS の版が食い違わないようにするため）"""
import hashlib, io, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
html_path = os.path.join(ROOT, "dashboard.html")
html = io.open(html_path, encoding="utf-8", newline="").read()

def repl(m):
    attr, path = m.group(1), m.group(2)
    with open(os.path.join(ROOT, path.replace("/", os.sep)), "rb") as f:
        h = hashlib.sha1(f.read()).hexdigest()[:8]
    return f'{attr}="{path}?v={h}"'

new = re.sub(r'(href|src)="((?:css|js)/[^"?]+)(?:\?v=[^"]*)?"', repl, html)
if new != html:
    io.open(html_path, "w", encoding="utf-8", newline="").write(new)
    print("updated")
else:
    print("no change")
