"""Build a shared male body and fitted, interchangeable wardrobe."""

import sys
import json
from pathlib import Path
import bpy
import bmesh
from mathutils import Vector
from mathutils.bvhtree import BVHTree

sys.path.insert(0, str(Path(__file__).resolve().parent))
from mpfb_bootstrap import load_mpfb, ROOT, TOOLING
from wardrobe_tools import baked, subset, fabric, spot, aim

load_mpfb()
from mpfb.services.humanservice import HumanService
from mpfb.services.targetservice import TargetService

OUT = ROOT / "assets/humans/prepared/male-wardrobe"
OUT.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
macro = TargetService.get_default_macro_info_dict()
macro.update(gender=1.0, age=0.5, muscle=0.82, weight=0.43, height=0.58)
macro["race"] = dict(caucasian=0.8, asian=0.15, african=0.05)
body = HumanService.create_human(macro_detail_dict=macro)
body.name = "Athletic male / master body"
HumanService.set_character_skin(
    str(TOOLING / "assets/skins/young_caucasian_male2/young_caucasian_male2.mhmat"),
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
    add("hair", "short01", "Hair"),
]
clothes = add("clothes", "male_casualsuit06", "Clothes")
shoes = add("clothes", "shoes05", "Clothes")
# The editable master retains the parametric body, fitted garments and source textures.
for image in bpy.data.images:
    if image.type == "IMAGE":
        image.pack()
bpy.ops.wm.save_as_mainfile(filepath=str(OUT / "male-master.blend"))

# Preserve garment deletion groups when baking the shared body.
for modifier in body.modifiers:
    if modifier.type == "MASK" and modifier.vertex_group != "body":
        modifier.show_viewport = False
        modifier.show_render = False


skin = baked(body, "skin-master")
detail = [
    baked(obj, name)
    for obj, name in zip(features, ["eyes", "eyebrows", "eyelashes", "hair"])
]
casual = baked(clothes, "casual-source")
footwear = baked(shoes, "shoes")
sources = [body, *features, clothes, shoes]
for obj in sources:
    bpy.data.objects.remove(obj, do_unlink=True)

# Normalize all parts together to keep garment transforms aligned.
vertices = [v.co for obj in [skin, *detail, footwear] for v in obj.data.vertices]
lo = Vector(tuple(min(v[i] for v in vertices) for i in range(3)))
hi = Vector(tuple(max(v[i] for v in vertices) for i in range(3)))
scale = 2.8 / (hi.z - lo.z)
origin = Vector(((hi.x + lo.x) / 2, (hi.y + lo.y) / 2, lo.z))
for obj in [skin, *detail, casual, footwear]:
    for vertex in obj.data.vertices:
        vertex.co = (vertex.co - origin) * scale + Vector((0, 0, 0.06))
    obj.data.update()


# Split disconnected garment components without cutting their waistbands.
adj = {v.index: [] for v in casual.data.vertices}
for edge in casual.data.edges:
    a, b = edge.vertices
    adj[a].append(b)
    adj[b].append(a)
shirt_vertices = set()
visited = set()
for start in adj:
    if start in visited:
        continue
    stack = [start]
    component = []
    while stack:
        v = stack.pop()
        if v in visited:
            continue
        visited.add(v)
        component.append(v)
        stack.extend(adj[v])
    # Shirt components reach the shoulders; detached trim sits above the waist.
    upper = max(casual.data.vertices[v].co.z for v in component) > 2.0
    if upper or min(casual.data.vertices[v].co.z for v in component) > 1.60:
        shirt_vertices.update(component)
shirt = subset(
    casual,
    "shirt",
    lambda i: all(v in shirt_vertices for v in casual.data.polygons[i].vertices),
)
jeans = subset(
    casual,
    "jeans",
    lambda i: not all(v in shirt_vertices for v in casual.data.polygons[i].vertices),
)
if not shirt.data.polygons or not jeans.data.polygons:
    raise RuntimeError("Could not separate the shirt and jeans.")

# Give fitted cotton a small clearance around muscular shoulders.
skin_tree = BVHTree.FromObject(skin, bpy.context.evaluated_depsgraph_get())
for vertex in shirt.data.vertices:
    nearest, normal, _, distance = skin_tree.find_nearest(vertex.co)
    if nearest is not None and distance < 0.025:
        clearance = (vertex.co - nearest).dot(normal)
        if clearance < 0.007:
            vertex.co += normal * (0.007 - clearance)
shirt.data.update()

shorts = jeans.copy()
shorts.data = jeans.data.copy()
shorts.name = "shorts"
bpy.context.collection.objects.link(shorts)
HEM = 1.12
bm = bmesh.new()
bm.from_mesh(shorts.data)
cut = bmesh.ops.bisect_plane(
    bm,
    geom=list(bm.verts) + list(bm.edges) + list(bm.faces),
    dist=0.00001,
    plane_co=(0, 0, HEM),
    plane_no=(0, 0, 1),
    clear_inner=True,
    clear_outer=False,
)
bm.to_mesh(shorts.data)
bm.free()
solid = shorts.modifiers.new("Fabric edge", "SOLIDIFY")
solid.thickness = 0.003
solid.offset = 0
bpy.context.view_layer.objects.active = shorts
bpy.ops.object.modifier_apply(modifier=solid.name)
sport_shirt = shirt.copy()
sport_shirt.data = shirt.data.copy()
sport_shirt.name = "sport-shirt"
bpy.context.collection.objects.link(sport_shirt)


def blank_shirt(name, color):
    material = shirt.data.materials[0].copy()
    material.name = name
    shader = material.node_tree.nodes.get("Principled BSDF")
    for key in ["Base Color", "Alpha"]:
        for link in list(shader.inputs[key].links):
            material.node_tree.links.remove(link)
    shader.inputs["Base Color"].default_value = (*color, 1)
    shader.inputs["Alpha"].default_value = 1
    shader.inputs["Roughness"].default_value = 0.85
    return material


cotton = blank_shirt("Blank cotton T-shirt", (0.72, 0.72, 0.69))
jersey = blank_shirt("Midnight technical jersey", (0.027, 0.045, 0.065))
sport_shirt.data.materials.clear()
sport_shirt.data.materials.append(jersey)
shorts.data.materials.clear()
shorts.data.materials.append(fabric("Charcoal running shorts", (0.017, 0.020, 0.024)))
shirt.data.materials.clear()
shirt.data.materials.append(cotton)

# Hide skin only where the selected garment covers it.
delete_clothes = skin.vertex_groups.get("Delete.male_casualsuit06")
delete_shoes = skin.vertex_groups.get("Delete.shoes05")


def in_group(v, group):
    return group and any(g.group == group.index and g.weight > 0.01 for g in v.groups)


categories = []
for face in skin.data.polygons:
    verts = [skin.data.vertices[i] for i in face.vertices]
    if any(in_group(v, delete_shoes) for v in verts):
        category = "body-under-shoes"
    elif any(in_group(v, delete_clothes) for v in verts):
        category = (
            "body-under-jeans"
            if max(v.co.z for v in verts) < HEM + 0.04
            else "body-under-top"
            if max(v.co.z for v in verts)
            > max(v.co.z for v in jeans.data.vertices) - 0.10
            else "body-under-bottom"
        )
    else:
        category = "body-visible"
    categories.append(category)
skin_parts = [
    subset(skin, name, lambda i, n=name: categories[i] == n)
    for name in sorted(set(categories))
]
print("BODY_REGIONS", [(o.name, len(o.data.polygons)) for o in skin_parts])
bpy.data.objects.remove(skin, do_unlink=True)
bpy.data.objects.remove(casual, do_unlink=True)
shared = [*skin_parts, *detail, footwear]

# Solid surfaces are opaque; hair, brows and lashes use alpha cutouts.
cutouts = {"hair", "eyebrows", "eyelashes"}
for obj in [*shared, shirt, jeans, sport_shirt, shorts]:
    for material in obj.data.materials:
        if not material or not material.use_nodes:
            continue
        shader = material.node_tree.nodes.get("Principled BSDF")
        alpha = shader.inputs["Alpha"]
        links = list(alpha.links)
        if obj.name in cutouts and links:
            source = links[0].from_socket
            for link in links:
                material.node_tree.links.remove(link)
            cutoff = material.node_tree.nodes.new("ShaderNodeMath")
            cutoff.operation = "GREATER_THAN"
            cutoff.inputs[1].default_value = 0.5
            material.node_tree.links.new(source, cutoff.inputs[0])
            material.node_tree.links.new(cutoff.outputs[0], alpha)
        else:
            for link in links:
                material.node_tree.links.remove(link)
            alpha.default_value = 1.0


def export(objects, filename):
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.hide_set(False)
        obj.hide_render = False
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.export_scene.gltf(
        filepath=str(OUT / filename),
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_yup=True,
    )


for image in bpy.data.images:
    if image.type == "IMAGE" and max(image.size) > 2048:
        factor = 2048 / max(image.size)
        image.scale(int(image.size[0] * factor), int(image.size[1] * factor))
    if image.type == "IMAGE":
        image.pack()
export(shared, "male-athletic-body.glb")
export([shirt, jeans], "male-casual-outfit.glb")
export([sport_shirt, shorts], "male-athletic-outfit.glb")


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
    light = bpy.context.object
    light.name = name
    light.data.energy = power
    light.data.size = size
    aim(light, (0, 0, 1.5))
bpy.ops.object.camera_add(location=(0, -7, 1.5))
camera = bpy.context.object
camera.data.type = "ORTHO"
camera.data.ortho_scale = 3.2
scene.camera = camera

for id, garments in [
    ("male-casual", [shirt, jeans]),
    ("male-athletic", [sport_shirt, shorts]),
    ("male-casual-shorts", [shirt, shorts]),
    ("male-athletic-jeans", [sport_shirt, jeans]),
    ("male-shirtless", [None, shorts]),
    ("male-shirtless-jeans", [None, jeans]),
]:
    hidden = (
        ["body-under-bottom", "body-under-shoes"]
        + (["body-under-top"] if garments[0] else [])
        + (["body-under-jeans"] if jeans in garments else [])
    )
    for obj in [*shared, shirt, jeans, sport_shirt, shorts]:
        obj.hide_render = obj.name in hidden or (
            obj not in shared and obj not in garments
        )
        obj.hide_set(obj.hide_render)
    top, bottom = garments
    if top is None:
        top = next(o for o in skin_parts if o.name == "body-under-top")
    spots = [
        spot(top, "shirt-front", "Shirt / front", 2.03, 0.46, 0.36, 450),
        spot(top, "shirt-back", "Shirt / back", 2.03, 0.46, 0.36, 350, True),
        spot(bottom, "leg-front", "Left leg / front", 1.30, 0.21, 0.23, 200, x=0.20),
    ]
    if garments[0] is None:
        spots = [
            spot(top, "chest-left", "Left chest", 2.08, 0.23, 0.23, 450, x=0.16),
            spot(top, "chest-right", "Right chest", 2.08, 0.23, 0.23, 450, x=-0.16),
            spot(
                top,
                "upper-back",
                "Upper back",
                2.12,
                0.45,
                0.32,
                350,
                True,
                symmetry=True,
            ),
            spots[-1],
        ]
    manifest = dict(
        reviewed=False,
        source="MakeHuman CC0 / local Blender",
        body="male-athletic-body.glb",
        outfits=["male-casual-outfit.glb", "male-athletic-outfit.glb"],
        hiddenOutfitMeshes=[
            o.name for o in [shirt, jeans, sport_shirt, shorts] if o not in garments
        ],
        hiddenBodyMeshes=hidden,
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
print("WARDROBE_PREPARED", OUT)
