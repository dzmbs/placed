"""Render the actual Three.js decal geometry over the prepared Blender model.
Run verify_models.ts --prepared male|female first.
"""

import bpy
import json
import sys
from pathlib import Path

from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
id = sys.argv[sys.argv.index("--") + 1]
if id not in [
    "male-casual",
    "male-athletic",
    "male-casual-shorts",
    "male-athletic-jeans",
    "male-shirtless",
    "male-shirtless-jeans",
    "female-gown",
    "female-athletic",
    "female-casual",
    "female-ivory",
]:
    raise RuntimeError("Unknown preset")
male = id.startswith("male-")
modular = male or id in ["female-casual", "female-athletic", "female-gown"]
folder = (
    ROOT
    / "assets/humans/prepared"
    / ("male-wardrobe" if male else "female-wardrobe" if modular else id)
)
bpy.ops.wm.open_mainfile(filepath=str(folder / f"{id}.blend"))
if modular:
    # Check the exported materials/coordinates, not just the authoring scene.
    for obj in list(bpy.context.scene.objects):
        if obj.type == "MESH":
            bpy.data.objects.remove(obj, do_unlink=True)
    manifest = json.loads((folder / f"{id}.json").read_text())
    for part in [manifest["body"], *manifest["outfits"]]:
        bpy.ops.import_scene.gltf(filepath=str(folder / part))
    for obj in bpy.context.scene.objects:
        if obj.name in manifest["hiddenBodyMeshes"] + manifest["hiddenOutfitMeshes"]:
            obj.hide_render = True
            obj.hide_set(True)
image = bpy.data.images.load(str(ROOT / "assets/humans/test-logo.png"))
mat = bpy.data.materials.new("Logo placement check")
mat.use_nodes = True
shader = mat.node_tree.nodes.get("Principled BSDF")
texture = mat.node_tree.nodes.new("ShaderNodeTexImage")
texture.image = image
mat.node_tree.links.new(texture.outputs["Color"], shader.inputs["Base Color"])
shader.inputs["Roughness"].default_value = 0.65
for decal in json.loads(
    (folder / (f"{id}-decals-qa.json" if modular else "decals-qa.json")).read_text()
):
    p = decal["positions"]
    points = [(p[i], -p[i + 2], p[i + 1]) for i in range(0, len(p), 3)]
    mesh = bpy.data.meshes.new(decal["id"])
    mesh.from_pydata(points, [], [(i, i + 1, i + 2) for i in range(0, len(points), 3)])
    mesh.update()
    normals = decal.get("normals")
    if normals:
        normals = [
            (normals[i], -normals[i + 2], normals[i + 1])
            for i in range(0, len(normals), 3)
        ]
        for polygon in mesh.polygons:
            polygon.use_smooth = True
        mesh.normals_split_custom_set_from_vertices(normals)
    # Lift the printed patch slightly to avoid depth conflict with the fabric.
    for vertex in mesh.vertices:
        vertex.co += (
            Vector(normals[vertex.index]) if normals else vertex.normal
        ) * 0.0015
    uv = mesh.uv_layers.new()
    for loop in mesh.loops:
        i = loop.vertex_index * 2
        uv.data[loop.index].uv = decal["uv"][i : i + 2]
    obj = bpy.data.objects.new(decal["id"], mesh)
    bpy.context.collection.objects.link(obj)
    mesh.materials.append(mat)
scene = bpy.context.scene
for view, position in [("front", (0, -7, 1.5)), ("back", (0, 7, 1.5))]:
    camera = scene.camera
    camera.location = position
    camera.rotation_euler = (
        (Vector((0, 0, 1.46)) - camera.location).to_track_quat("-Z", "Y").to_euler()
    )
    scene.render.filepath = str(folder / f"{id}-placements-{view}.png")
    bpy.ops.render.render(write_still=True)
