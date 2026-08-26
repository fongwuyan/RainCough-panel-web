import json, urllib.request
req = urllib.request.Request("http://127.0.0.1:3900/api/disks", headers={"User-Agent": "check"})
try:
    d = json.load(urllib.request.urlopen(req, timeout=8))
    print("HTTP OK, disks:", len(d.get("disks", [])))
    for x in d.get("disks", []):
        print(x.get("path"), x.get("size"))
        for p in x.get("partitions", []):
            print("  -", p.get("path"), p.get("size"), p.get("percent"))
except Exception as e:
    print("ERR:", e)