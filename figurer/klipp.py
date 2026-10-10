# Klipper hovedfiguren ut av hvert bilde med gjennomsiktig bakgrunn.
import sys, os
from rembg import remove, new_session
from PIL import Image
S = sys.argv[1]; ut = S + "/figurer"
sesjon = new_session(sys.argv[2] if len(sys.argv) > 2 else "isnet-general-use")
for mappe, pre in [("bilder", "b"), ("bilder02", "c2b"), ("bilder03", "c3b"), ("bilder04", "c4b")]:
    for n in range(1, 11):
        im = Image.open(f"{S}/puslespill/{mappe}/{n}.jpg").convert("RGB"); im.thumbnail((1024, 1024))
        r = remove(im, session=sesjon)
        a = r.getchannel("A"); bb = a.point(lambda v: 255 if v > 40 else 0).getbbox()
        dekning = sum(1 for v in a.resize((64, 64)).getdata() if v > 128) / 4096
        if bb: r = r.crop(bb)
        r.thumbnail((256, 256)); r.save(f"{ut}/{pre}{n}.png")
        print(pre + str(n), round(dekning, 2), r.size, flush=True)
