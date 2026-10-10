# Deler utklippene i enkeltfigurer (monstre) og lagrer hele utklipp som bosser.
import sys, json
import numpy as np, cv2
from rembg import remove, new_session
from PIL import Image
S = sys.argv[1]; ut = S + "/figurer2"
ses = new_session("isnet-general-use"); data = {}
for mappe, pre in [("bilder", "b"), ("bilder02", "c2b"), ("bilder03", "c3b"), ("bilder04", "c4b")]:
    for n in range(1, 11):
        im = Image.open(f"{S}/puslespill/{mappe}/{n}.jpg").convert("RGB"); im.thumbnail((1200, 1200))
        r = np.array(remove(im, session=ses)); a = r[:, :, 3]
        H, W = a.shape; navn = pre + str(n); info = {"monstre": [], "boss": None}
        fast = (a > 200).sum() / max(1, (a > 40).sum())
        dekn = (a > 128).sum() / a.size
        if fast > .55 and .04 < dekn < .75:
            ys, xs = np.where(a > 40); bb = (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)
            b = Image.fromarray(r).crop(bb); b.thumbnail((320, 320)); b.save(f"{ut}/boss_{navn}.png", optimize=True); info["boss"] = f"boss_{navn}.png"
        k, lab, st, _ = cv2.connectedComponentsWithStats((a > 110).astype(np.uint8), 8)
        deler = sorted([i for i in range(1, k) if st[i, 4] > a.size * .012], key=lambda i: -st[i, 4])[:6]
        for j, i in enumerate(deler):
            x, y, w, h, ar = st[i]
            if max(w, h) / max(1, min(w, h)) > 3.2: continue
            maske = cv2.dilate((lab == i).astype(np.uint8), np.ones((5, 5), np.uint8)) > 0
            rr = r.copy(); rr[:, :, 3] = np.where(maske, a, 0)
            m = Image.fromarray(rr).crop((max(0, x - 3), max(0, y - 3), min(W, x + w + 3), min(H, y + h + 3)))
            m.thumbnail((180, 180)); f = f"m_{navn}_{j}.png"; m.save(f"{ut}/{f}", optimize=True); info["monstre"].append(f)
        data[navn] = info; print(navn, round(fast, 2), round(dekn, 2), len(info["monstre"]), bool(info["boss"]), flush=True)
json.dump(data, open(ut + "/oversikt.json", "w"), indent=1)
