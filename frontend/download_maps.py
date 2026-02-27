import urllib.request
import os
import ssl
import json

os.makedirs('public/data', exist_ok=True)

# Ignore SSL errors
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

def download_file(url, out_path):
    # Use Mozilla User-Agent to bypass Highcharts 429
    req = urllib.request.Request(
        url, 
        data=None, 
        headers={
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_9_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/35.0.1916.47 Safari/537.36'
        }
    )
    print(f"Downloading {url} to {out_path}...")
    with urllib.request.urlopen(req, context=ctx) as response:
        data = response.read()
        with open(out_path, 'wb') as f:
            f.write(data)
    print("Done.")

download_file('https://unpkg.com/world-atlas@2.0.2/countries-110m.json', 'public/data/world-110m.json')
download_file('https://code.highcharts.com/mapdata/countries/kz/kz-all.topo.json', 'public/data/kz-regions.json')
