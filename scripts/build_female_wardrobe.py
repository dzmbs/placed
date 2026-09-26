"""Build a shared female body and fitted, interchangeable wardrobe."""

import sys
import json
from pathlib import Path
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

sys.path.insert(0, str(Path(__file__).resolve().parent))
from mpfb_bootstrap import load_mpfb, ROOT, TOOLING
from wardrobe_tools import baked, subset, fabric, spot, aim

load_mpfb()
from mpfb.services.humanservice import HumanService
from mpfb.services.targetservice import TargetService

OUT = ROOT / "assets/humans/prepared/female-wardrobe"
OUT.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
macro = TargetService.get_default_macro_info_dict()
macro.update(
    gender=0.0,
    age=0.5,
    muscle=0.72,
    weight=0.43,
    height=0.52,
    cupsize=0.4,
    firmness=0.7,
)
macro["race"] = dict(caucasian=0.8, asian=0.15, african=0.05)
body = HumanService.create_human(macro_detail_dict=macro)
body.name = "Athletic female / master body"
HumanService.set_character_skin(
    str(TOOLING / "assets/skins/young_caucasian_female2/young_caucasian_female2.mhmat"),
    body,
    skin_type="GAMEENGINE",
)


def add(folder, name, kind):
    return HumanService.add_mhclo_asset(
        str(TOOLING / f"assets/{folder}/{name}/{name}.mhclo"),
        body,
        asset_type=kind,
        material_type="GAMEENGINE",
        subdiv_levels=1,
        set_up_rigging=False,
    )


features = [
    add("eyes", "low-poly", "Eyes"),
    add("eyebrows", "eyebrow001", "Eyebrows"),
    add("eyelashes", "eyelashes01", "Eyelashes"),
    add("hair", "ponytail01", "Hair"),
]


# Capture per-garment body masks before baking.
def garment(name):
    before = {m.name for m in body.modifiers}
    obj = add("clothes", name, "Clothes")
    groups = [
        m.vertex_group
        for m in body.modifiers
        if m.type == "MASK" and m.name not in before
    ]
    if not groups:
        raise RuntimeError(f"{name} needs an occlusion mask")
    return obj, groups


casual, cgroups = garment("female_casualsuit01")
sport, sgroups = garment("female_sportsuit01")
gown, dgroups = garment("toigo_halter_dress_with_fluted_skirt")
shoes, shoe_groups = garment("shoes05")
for image in bpy.data.images:
    if image.type == "IMAGE":
        image.pack()
bpy.ops.wm.save_as_mainfile(filepath=str(OUT / "female-master.blend"))
for modifier in body.modifiers:
    if modifier.type == "MASK" and modifier.vertex_group != "body":
        modifier.show_viewport = False
        modifier.show_render = False
skin = baked(body, "female-skin-master")
details = [
    baked(o, n) for o, n in zip(features, ["eyes", "eyebrows", "eyelashes", "hair"])
]
casual_b = baked(casual, "female-casual-source")
sport_b = baked(sport, "female-sport-source")
dress = baked(gown, "female-dress")
footwear = baked(shoes, "shoes")
for o in [body, *features, casual, sport, gown, shoes]:
    bpy.data.objects.remove(o, do_unlink=True)
verts = [v.co for o in [skin, *details, footwear] for v in o.data.vertices]
lo = Vector(tuple(min(v[i] for v in verts) for i in range(3)))
hi = Vector(tuple(max(v[i] for v in verts) for i in range(3)))
scale = 2.8 / (hi.z - lo.z)
origin = Vector(((hi.x + lo.x) / 2, (hi.y + lo.y) / 2, lo.z))
for o in [skin, *details, casual_b, sport_b, dress, footwear]:
    for v in o.data.vertices:
        v.co = (v.co - origin) * scale + Vector((0, 0, 0.06))
    o.data.update()
# Trim socks that intersect fitted leggings and jeans.
trimmed = subset(
    footwear,
    "female-sneakers",
    lambda i: (
        max(footwear.data.vertices[v].co.z for v in footwear.data.polygons[i].vertices)
        < 0.27
    ),
)
bpy.data.objects.remove(footwear, do_unlink=True)
footwear = trimmed
# Narrow the fluted train to a wearable floor-length silhouette.
for v in dress.data.vertices:
    if v.co.z < 0.68:
        factor = 0.46 + 0.54 * max(0, v.co.z - 0.04) / 0.64
        v.co.x *= factor
        v.co.y *= factor
dress.data.update()


def split(source, topname, bottomname):
    adjacency = {v.index: [] for v in source.data.vertices}
    for edge in source.data.edges:
        a, b = edge.vertices
        adjacency[a].append(b)
        adjacency[b].append(a)
    upper = set()
    seen = set()
    for start in adjacency:
        if start in seen:
            continue
        stack = [start]
        component = []
        while stack:
            v = stack.pop()
            if v in seen:
                continue
            seen.add(v)
            component.append(v)
            stack.extend(adjacency[v])
        if (
            max(source.data.vertices[v].co.z for v in component) > 2.0
            or min(source.data.vertices[v].co.z for v in component) > 1.65
        ):
            upper.update(component)
    top = subset(
        source,
        topname,
        lambda i: all(v in upper for v in source.data.polygons[i].vertices),
    )
    bottom = subset(
        source,
        bottomname,
        lambda i: not all(v in upper for v in source.data.polygons[i].vertices),
    )
    if not top.data.polygons or not bottom.data.polygons:
        raise RuntimeError("Clothing separation failed")
    return top, bottom


shirt, jeans = split(casual_b, "female-shirt", "female-jeans")
sport_top, leggings = split(sport_b, "female-sport-top", "female-leggings")
# Positive clearance avoids shoulders/thighs intersecting the fitted shell.
tree = BVHTree.FromObject(skin, bpy.context.evaluated_depsgraph_get())
for o in [shirt, jeans, sport_top, leggings, dress]:
    for v in o.data.vertices:
        nearest, normal, _, distance = tree.find_nearest(v.co)
        if nearest is not None and distance < 0.025:
            clearance = (v.co - nearest).dot(normal)
            if clearance < 0.006:
                v.co += normal * (0.006 - clearance)
    o.data.update()
for o, name, color in [
    (shirt, "Blank ivory cotton", (0.72, 0.72, 0.69)),
    (sport_top, "Moss technical jersey", (0.075, 0.12, 0.09)),
    (leggings, "Graphite athletic leggings", (0.025, 0.029, 0.028)),
    (dress, "Ivory silk gown", (0.76, 0.73, 0.67)),
]:
    o.data.materials.clear()
    o.data.materials.append(fabric(name, color))
    if o == dress:
        shader = o.data.materials[0].node_tree.nodes.get("Principled BSDF")
        shader.inputs["Roughness"].default_value = 0.52
        shader.inputs["Sheen Weight"].default_value = 0.32


# Coverage bitset: casual=1, athletic=2, gown=4.
def covered(face, groups):
    indices = {skin.vertex_groups[n].index for n in groups}
    return any(
        g.group in indices and g.weight > 0.01
        for i in face.vertices
        for g in skin.data.vertices[i].groups
    )


regions = []
for face in skin.data.polygons:
    if covered(face, shoe_groups):
        regions.append("female-under-shoes")
        continue
    bits = sum(
        bit
        for bit, groups in [(1, cgroups), (2, sgroups), (4, dgroups)]
        if covered(face, groups)
    )
    regions.append(f"female-skin-{bits}")
parts = [
    subset(skin, n, lambda i, name=n: regions[i] == name) for n in sorted(set(regions))
]
print("FEMALE_BODY_REGIONS", [(o.name, len(o.data.polygons)) for o in parts])
for o in [skin, casual_b, sport_b]:
    bpy.data.objects.remove(o, do_unlink=True)
shared = [*parts, *details, footwear]
clothing = [shirt, jeans, sport_top, leggings, dress]
for o in [*shared, *clothing]:
    for mat in o.data.materials:
        if not mat or not mat.use_nodes:
            continue
        alpha = mat.node_tree.nodes.get("Principled BSDF").inputs["Alpha"]
        links = list(alpha.links)
        if o.name in ["hair", "eyebrows", "eyelashes"] and links:
            src = links[0].from_socket
            for link in links:
                mat.node_tree.links.remove(link)
            cutoff = mat.node_tree.nodes.new("ShaderNodeMath")
            cutoff.operation = "GREATER_THAN"
            cutoff.inputs[1].default_value = 0.5
            mat.node_tree.links.new(src, cutoff.inputs[0])
            mat.node_tree.links.new(cutoff.outputs[0], alpha)
        else:
            for link in links:
                mat.node_tree.links.remove(link)
            alpha.default_value = 1.0
for image in bpy.data.images:
    if image.type == "IMAGE" and max(image.size) > 2048:
        factor = 2048 / max(image.size)
        image.scale(int(image.size[0] * factor), int(image.size[1] * factor))
    if image.type == "IMAGE":
        image.pack()


def export(objects, file):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objects:
        o.hide_set(False)
        o.hide_render = False
        o.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.export_scene.gltf(
        filepath=str(OUT / file),
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_yup=True,
    )


export(shared, "female-shared-body.glb")
export([shirt, jeans], "female-casual-outfit.glb")
export([sport_top, leggings], "female-athletic-outfit.glb")
export([dress], "female-gown-outfit.glb")
scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.samples = 32
scene.render.resolution_x = 650
scene.render.resolution_y = 900
scene.render.resolution_percentage = 100
scene.world.use_nodes = True
scene.world.node_tree.nodes["Background"].inputs[0].default_value = (
    0.15,
    0.18,
    0.16,
    1,
)
scene.world.node_tree.nodes["Background"].inputs[1].default_value = 0.6
scene.view_settings.view_transform = "AgX"
for name, pos, power, size in [
    ("Key", (-3, -4, 4.8), 500, 4),
    ("Fill", (3, -2, 3), 250, 3),
    ("Rim", (1, 3, 4), 450, 3),
]:
    bpy.ops.object.light_add(type="AREA", location=pos)
    o = bpy.context.object
    o.name = name
    o.data.energy = power
    o.data.size = size
    aim(o, (0, 0, 1.5))
bpy.ops.object.camera_add(location=(0, -7, 1.5))
camera = bpy.context.object
camera.data.type = "ORTHO"
camera.data.ortho_scale = 3.2
scene.camera = camera
for id, bit, garments in [
    ("female-casual", 1, [shirt, jeans]),
    ("female-athletic", 2, [sport_top, leggings]),
    ("female-gown", 4, [dress]),
]:
    hidden = [
        o.name
        for o in parts
        if o.name == "female-under-shoes" or int(o.name.rsplit("-", 1)[-1]) & bit
    ]
    if bit == 4:
        hidden.append("female-sneakers")
    for o in [*shared, *clothing]:
        o.hide_render = o.name in hidden or (o in clothing and o not in garments)
        o.hide_set(o.hide_render)
    top = garments[0]
    if bit == 4:
        spots = [
            spot(top, "gown-front", "Gown / front", 1.80, 0.36, 0.26, 450),
            spot(top, "gown-back", "Gown / back", 1.82, 0.32, 0.23, 400, True),
            spot(top, "skirt-upper", "Upper skirt", 1.28, 0.45, 0.35, 350),
            spot(top, "skirt-lower", "Lower skirt", 0.69, 0.47, 0.35, 300),
        ]
    else:
        spots = [
            spot(
                top,
                "shirt-front",
                "Shirt / front",
                2.15 if bit == 2 else 2.01,
                0.34 if bit == 2 else 0.38,
                0.20 if bit == 2 else 0.28,
                450,
            ),
            spot(
                top,
                "shirt-back",
                "Shirt / back",
                2.18 if bit == 2 else 2.06,
                0.34 if bit == 2 else 0.38,
                0.20 if bit == 2 else 0.28,
                350,
                True,
            ),
            spot(
                garments[1],
                "leg-front",
                "Left leg / front",
                1.28,
                0.20,
                0.23,
                200,
                x=0.19,
            ),
        ]
    manifest = dict(
        reviewed=False,
        source="MakeHuman CC0 / local Blender",
        body="female-shared-body.glb",
        outfits=[
            "female-casual-outfit.glb",
            "female-athletic-outfit.glb",
            "female-gown-outfit.glb",
        ],
        hiddenBodyMeshes=hidden,
        hiddenOutfitMeshes=[o.name for o in clothing if o not in garments],
        spots=spots,
    )
    (OUT / f"{id}.json").write_text(json.dumps(manifest, indent=2))
    camera.location = (0, -7, 1.5)
    aim(camera, (0, 0, 1.46))
    scene.render.filepath = str(OUT / f"{id}.png")
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT / f"{id}.blend"))
    bpy.ops.render.render(write_still=True)
    for view, pos in [
        ("back", (0, 7, 1.5)),
        ("side", (7, 0, 1.5)),
        ("three-quarter", (3, -7, 1.5)),
    ]:
        camera.location = pos
        aim(camera, (0, 0, 1.46))
        scene.render.filepath = str(OUT / f"{id}-{view}.png")
        bpy.ops.render.render(write_still=True)
print("FEMALE_WARDROBE_PREPARED", OUT)
