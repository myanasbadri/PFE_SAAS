"""
Fix the use case diagrams to remove old/new color distinction.
Figure 2.1: Replace green (nouveau) -> blue (existant), fix title and legend.
Figure 2.2: Replace orange (nouveau) -> blue (existant).
"""
from PIL import Image, ImageDraw, ImageFont
import numpy as np
import colorsys

def rgb_to_hsv_array(img_array):
    """Convert RGB array (0-255) to HSV array (H: 0-360, S: 0-1, V: 0-1)."""
    arr = img_array.astype(np.float64) / 255.0
    r, g, b = arr[:,:,0], arr[:,:,1], arr[:,:,2]

    maxc = np.maximum(np.maximum(r, g), b)
    minc = np.minimum(np.minimum(r, g), b)
    v = maxc
    diff = maxc - minc

    s = np.where(maxc != 0, diff / maxc, 0)

    h = np.zeros_like(r)
    mask = diff != 0

    # Red is max
    m = mask & (maxc == r)
    h[m] = 60.0 * ((g[m] - b[m]) / diff[m] % 6)

    # Green is max
    m = mask & (maxc == g)
    h[m] = 60.0 * ((b[m] - r[m]) / diff[m] + 2)

    # Blue is max
    m = mask & (maxc == b)
    h[m] = 60.0 * ((r[m] - g[m]) / diff[m] + 4)

    h = h % 360

    return h, s, v

def hsv_to_rgb_array(h, s, v):
    """Convert HSV arrays back to RGB (0-255)."""
    h = h / 60.0
    i = np.floor(h).astype(int) % 6
    f = h - np.floor(h)
    p = v * (1 - s)
    q = v * (1 - f * s)
    t = v * (1 - (1 - f) * s)

    r = np.zeros_like(h)
    g = np.zeros_like(h)
    b = np.zeros_like(h)

    for idx in range(6):
        m = (i == idx)
        if idx == 0:
            r[m], g[m], b[m] = v[m], t[m], p[m]
        elif idx == 1:
            r[m], g[m], b[m] = q[m], v[m], p[m]
        elif idx == 2:
            r[m], g[m], b[m] = p[m], v[m], t[m]
        elif idx == 3:
            r[m], g[m], b[m] = p[m], q[m], v[m]
        elif idx == 4:
            r[m], g[m], b[m] = t[m], p[m], v[m]
        elif idx == 5:
            r[m], g[m], b[m] = v[m], p[m], q[m]

    rgb = np.stack([r, g, b], axis=-1)
    return (rgb * 255).clip(0, 255).astype(np.uint8)


# =============================================
# FIGURE 2.1 - Global use case diagram
# =============================================
print("Processing Figure 2.1...")
img1 = Image.open(r'C:\Users\MSI\Desktop\PFE\extracted_images\figure_293_rid_rId11.png').convert('RGB')
arr1 = np.array(img1)

h1, s1, v1 = rgb_to_hsv_array(arr1)

# Green fill: hue ~140-150, saturation > 0.05
# Green border: hue ~155-165, saturation > 0.3
# Target blue fill hue: ~198 (from RGB 232,244,248)
# Target blue border hue: ~209 (from RGB 46,117,182)

# Identify green pixels (hue 100-170, saturation > 0.03)
green_mask = (h1 > 100) & (h1 < 175) & (s1 > 0.03)

# Shift green hue to blue hue
# Green fill is around H=140, target blue fill is around H=198 -> shift +58
# Green border is around H=160, target blue border is around H=209 -> shift +49
# Average shift: about +55
h1[green_mask] = h1[green_mask] + 58
h1[green_mask] = h1[green_mask] % 360

# Also slightly reduce saturation for fill areas to match blue fill
green_fill_mask = green_mask & (s1 < 0.2)
s1[green_fill_mask] = s1[green_fill_mask] * 0.7

arr1_fixed = hsv_to_rgb_array(h1, s1, v1)
img1_fixed = Image.fromarray(arr1_fixed)

# Now fix the title: paint over "(avec nouvelles fonctionnalites)"
# The title is at the top of the image. Let me find where the text is.
draw1 = ImageDraw.Draw(img1_fixed)

# Find the title area - scan top area for non-white pixels
# The title "Diagramme de Cas d'Utilisation Global (avec nouvelles fonctionnalites)"
# I need to paint over "(avec nouvelles fonctionnalites)" part
# Looking at the image, title is roughly in the first 40-50 pixels height
# The "(avec nouvelles...)" part starts approximately after "Global"

# Scan to find the approximate text region of the title
# Image width and height
w, h_img = img1_fixed.size
print(f"  Image size: {w}x{h_img}")

# Paint over the subtitle "(avec nouvelles fonctionnalites)"
# Based on the image, the title is centered at the top
# The problematic text is the second part. Let me paint it white.
# Looking at the image, the title area is roughly y=10 to y=40
# The "(avec...)" text starts around x=380 and goes to about x=750

# Let me find the exact region by scanning
title_arr = np.array(img1_fixed)

# Find the horizontal extent of dark text in the title area (y=15 to y=35)
title_region = title_arr[15:35, :, :]
is_dark = np.all(title_region < 100, axis=2)
dark_cols = np.where(np.any(is_dark, axis=0))[0]
if len(dark_cols) > 0:
    title_start = dark_cols[0]
    title_end = dark_cols[-1]
    print(f"  Title text spans x={title_start} to x={title_end}")

# Find where "(avec" starts - look for a gap or the opening parenthesis
# Scan each column in the title for dark pixels
col_has_text = np.any(is_dark, axis=0)
# Find the position of "(" by looking for the text after "Global"
# Look for gap between "Global" and "(avec"
# Actually, let me find the center of the title text and compute where to start whiting out

# More reliable: find the position of "(" in the title
# Scan from left to right, find where "Global" ends (gap) then "(avec" starts
# Find gaps in text
in_text = False
segments = []
seg_start = 0
for x in range(title_start, title_end + 2):
    if x <= title_end and col_has_text[x]:
        if not in_text:
            seg_start = x
            in_text = True
    else:
        if in_text:
            segments.append((seg_start, x - 1))
            in_text = False

print(f"  Title segments: {segments}")

# The title has the main text and then "(avec nouvelles fonctionnalites)"
# If there are distinct word segments, the "(avec..." part starts after "Global"
# Let me find a gap that's > 3 pixels wide (space between words)
# and where after the gap, "(avec" text begins

# Simpler approach: just paint over the right portion of the title
# that contains "(avec nouvelles fonctionnalites)"
# Looking at proportions, "Global" is about 60% of the way through the title
# The "(avec...)" is the remaining 40%

# Let me find text in a wider area (y=5 to y=45)
title_region2 = title_arr[5:45, :, :]
is_dark2 = np.all(title_region2 < 80, axis=2)
col_has_text2 = np.any(is_dark2, axis=0)

# Find the rightmost extent of significant text before "(avec"
# The word "Global" should end with some space, then "(avec" begins
# Let me find all gaps > 5 pixels wide
gaps = []
in_gap = True
gap_start = 0
for x in range(w):
    if col_has_text2[x]:
        if in_gap and gap_start > 0:
            gap_len = x - gap_start
            if gap_len > 3:
                gaps.append((gap_start, x, gap_len))
        in_gap = False
    else:
        if not in_gap:
            gap_start = x
        in_gap = True

print(f"  Gaps > 3px in title area: {[(s, e, l) for s, e, l in gaps if s > 100 and s < w-100]}")

# Now fix the legend area
# The legend is typically at the top right or top left
# Looking at the image, the legend has colored rectangles with labels
# Let me scan for the legend rectangles

# For the legend, I'll look for the colored rectangles in the top portion
# The legend items "Existant", "Nouveau", "Automatique" with colored boxes
# After color replacement, the green box is now blue, so "Existant" and "Nouveau"
# both show blue - I need to paint over those two and replace with just one label

# Actually, since the green is now blue, the legend shows:
# [blue box] Existant  [blue box] Nouveau  [yellow box] Automatique
# I need to: remove "Existant" and "Nouveau" entries, keep "Automatique"
# Or replace with: [blue box] Cas d'utilisation  [yellow box] Automatique

# Let me find the legend area
# The legend is in the area roughly y=42 to y=62 based on visual inspection
legend_region = title_arr[38:65, :, :]
is_dark_legend = np.all(legend_region < 80, axis=2)
legend_cols = np.where(np.any(is_dark_legend, axis=0))[0]
if len(legend_cols) > 0:
    print(f"  Legend text spans x={legend_cols[0]} to x={legend_cols[-1]} (y=38-65)")

print()

# =============================================
# Let me take a simpler approach: just paint over specific regions with white
# and redraw the needed text
# =============================================

# For Figure 2.1:
# 1. The title "(avec nouvelles fonctionnalites)" needs to be removed
# 2. The legend "Existant" and "Nouveau" need to be replaced

# Step 1: Find and remove "(avec nouvelles fonctionnalites)" from title
# Based on the image structure, I'll paint a white rectangle over the part
# The title seems to span roughly y=7 to y=30

# Let me detect the title more precisely
for y in range(0, 60):
    row = title_arr[y, :, :]
    dark_px = np.sum(np.all(row < 80, axis=1))
    if dark_px > 20:
        print(f"  Row y={y}: {dark_px} dark pixels")

print("\nDone analyzing. Will apply fixes now...")

# =============================================
# APPLY FIXES TO FIGURE 2.1
# =============================================

# Load fresh copy with colors already fixed
img1_out = img1_fixed.copy()
draw1 = ImageDraw.Draw(img1_out)

# Try to get a font
try:
    font_title = ImageFont.truetype("arial.ttf", 14)
    font_legend = ImageFont.truetype("arial.ttf", 11)
    font_available = True
except:
    try:
        font_title = ImageFont.truetype("C:/Windows/Fonts/arial.ttf", 14)
        font_legend = ImageFont.truetype("C:/Windows/Fonts/arial.ttf", 11)
        font_available = True
    except:
        font_title = ImageFont.load_default()
        font_legend = ImageFont.load_default()
        font_available = False

print(f"Font available: {font_available}")

# Paint over the entire title area and redraw
# Title area: find the bounding box
# Based on analysis, paint over y=5 to y=30 for the title text
title_y_start = 5
title_y_end = 32
# Paint over center of the title
center_x = w // 2
# Paint from reasonable margins
draw1.rectangle([50, title_y_start, w - 50, title_y_end], fill='white')

# Redraw title without "(avec nouvelles fonctionnalites)"
new_title = "Diagramme de Cas d\u2019Utilisation Global"
if font_available:
    bbox = draw1.textbbox((0, 0), new_title, font=font_title)
    text_w = bbox[2] - bbox[0]
else:
    text_w = len(new_title) * 8
title_x = (w - text_w) // 2
draw1.text((title_x, title_y_start + 2), new_title, fill=(10, 37, 64), font=font_title)

# Now fix the legend
# Paint over the legend area (y=38 to y=62) and redraw
# Keep the gray border of the legend box if present
legend_y_start = 37
legend_y_end = 62

# Find the legend box boundaries more precisely
# Look for a thin rectangle of gray lines
# Paint over just the inner content of the legend
draw1.rectangle([80, legend_y_start + 1, w - 80, legend_y_end - 1], fill='white')

# Redraw legend with just two items: "Cas d'utilisation" (blue) and "Automatique" (yellow)
legend_x_start = 120
legend_y_mid = legend_y_start + 8

# Blue box for "Cas d'utilisation"
draw1.rectangle([legend_x_start, legend_y_mid, legend_x_start + 20, legend_y_mid + 12],
                fill=(232, 244, 248), outline=(46, 117, 182), width=1)
draw1.text((legend_x_start + 25, legend_y_mid - 1), "Cas d\u2019utilisation",
           fill=(10, 37, 64), font=font_legend)

# Yellow box for "Automatique"
auto_x = legend_x_start + 180
draw1.rectangle([auto_x, legend_y_mid, auto_x + 20, legend_y_mid + 12],
                fill=(254, 243, 199), outline=(245, 158, 11), width=1)
draw1.text((auto_x + 25, legend_y_mid - 1), "Automatique",
           fill=(10, 37, 64), font=font_legend)

img1_out.save(r'C:\Users\MSI\Desktop\PFE\extracted_images\figure_2_1_fixed.png')
print("Saved Figure 2.1 fixed")


# =============================================
# FIGURE 2.2 - Extraction and Conformity diagram
# =============================================
print("\nProcessing Figure 2.2...")
img2 = Image.open(r'C:\Users\MSI\Desktop\PFE\extracted_images\figure_296_rid_rId12.png').convert('RGB')
arr2 = np.array(img2)

h2, s2, v2 = rgb_to_hsv_array(arr2)

# Orange fill: hue ~20-45, saturation > 0.02
# Orange border: hue ~30-40, saturation > 0.3
# Target: blue fill hue ~198, blue border hue ~209

# Identify orange pixels
orange_mask = (h2 > 10) & (h2 < 50) & (s2 > 0.02)

# Shift orange hue to blue hue
# Orange is around H=30, blue is around H=200 -> shift +170
h2[orange_mask] = h2[orange_mask] + 170
h2[orange_mask] = h2[orange_mask] % 360

# Reduce saturation for fill areas to better match the blue fill
orange_fill_mask = orange_mask & (s2 < 0.15)
s2[orange_fill_mask] = s2[orange_fill_mask] * 0.5

arr2_fixed = hsv_to_rgb_array(h2, s2, v2)
img2_fixed = Image.fromarray(arr2_fixed)

# The title is "Cas d'Utilisation - Extraction et Conformite (raffine)"
# This title doesn't mention old/new, so it should be fine
# But let me check if it needs any changes
# Actually looking at the image title: "Cas d'Utilisation — Extraction et Conformité (raffiné)"
# This is fine, no old/new reference

img2_fixed.save(r'C:\Users\MSI\Desktop\PFE\extracted_images\figure_2_2_fixed.png')
print("Saved Figure 2.2 fixed")

print("\nDone! Both diagrams fixed.")
