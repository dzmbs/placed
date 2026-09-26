"""Build the original carry-on template. Run with Blender --background --python.
No third-party assets or addons are required. Blender exports Z-up to glTF Y-up.
"""

import bpy
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)


def material(name, color, metallic=0, roughness=0.5):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1)
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    return mat


shell = material("Shell", (0.455, 0.48, 0.407), 0.72, 0.34)
trim = material("Corner trim", (0.185, 0.207, 0.17), 0.7, 0.34)
rubber = material("Rubber", (0.022, 0.028, 0.019), 0, 0.72)
steel = material("Brushed aluminum", (0.32, 0.36, 0.29), 0.85, 0.26)


def vec(p):
    # Coordinates match the web template: X right, Y up, Z towards the viewer.
    return Vector((p[0], -p[2], p[1]))


def box(name, position, size, mat, radius=0.03):
    bpy.ops.mesh.primitive_cube_add(size=1, location=vec(position))
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = (size[0], size[2], size[1])
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    bevel = obj.modifiers.new("Rounded edges", "BEVEL")
    bevel.width = radius
    bevel.segments = 4
    obj.modifiers.new("Weighted normals", "WEIGHTED_NORMAL")
    obj.data.materials.append(mat)
    for poly in obj.data.polygons:
        poly.use_smooth = True
    return obj


def tube(name, a, b, radius, mat):
    a, b = vec(a), vec(b)
    direction = b - a
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=32, radius=radius, depth=direction.length, location=(a + b) / 2
    )
    obj = bpy.context.object
    obj.name = name
    obj.rotation_euler = direction.to_track_quat("Z", "Y").to_euler()
    obj.data.materials.append(mat)
    bevel = obj.modifiers.new("Machined edges", "BEVEL")
    bevel.width = 0.008
    bevel.segments = 3
    obj.modifiers.new("Weighted normals", "WEIGHTED_NORMAL")
    for poly in obj.data.polygons:
        poly.use_smooth = True
    return obj


box("shell", (0, 1.35, 0), (1.62, 2.16, 0.8), shell, 0.16)
for side in [-1, 1]:
    for i in range(11):
        box(
            f"rib-{side}-{i}",
            (-0.67 + i * 0.134, 1.34, side * 0.401),
            (0.057, 1.91, 0.044),
            shell,
            0.022,
        )
    for x in [-0.69, 0.69]:
        box(
            f"corner-{side}-{x}", (x, 2.22, side * 0.36), (0.2, 0.26, 0.075), trim, 0.04
        )
box("zipper", (0, 1.36, 0), (1.64, 2.06, 0.017), rubber, 0.007)
for x in [-0.31, 0.31]:
    tube(f"handle-pole-{x}", (x, 2.34, -0.12), (x, 3.02, -0.12), 0.037, steel)
box("pull-handle", (0, 3.04, -0.12), (0.77, 0.12, 0.16), rubber, 0.05)
box("top-handle", (0, 2.45, 0.02), (0.45, 0.09, 0.18), rubber, 0.035)
box("side-handle", (0.84, 1.65, 0), (0.09, 0.36, 0.2), rubber, 0.03)
for x in [-0.57, 0.57]:
    for z in [-0.25, 0.25]:
        box(f"wheel-fork-{x}-{z}", (x, 0.215, z), (0.16, 0.21, 0.14), trim, 0.04)
        tube(
            f"wheel-{x}-{z}", (x - 0.055, 0.17, z), (x + 0.055, 0.17, z), 0.135, rubber
        )
        tube(
            f"wheel-cap-{x}-{z}",
            (x + 0.055, 0.17, z),
            (x + 0.061, 0.17, z),
            0.065,
            steel,
        )

bpy.context.scene.unit_settings.system = "METRIC"
bpy.context.scene.world.color = (0.06, 0.06, 0.06)
(ROOT / "assets/editable").mkdir(parents=True, exist_ok=True)
(ROOT / "public/models").mkdir(parents=True, exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / "assets/editable/carry-on.blend"))
bpy.ops.export_scene.gltf(
    filepath=str(ROOT / "public/models/carry-on.glb"),
    export_format="GLB",
    export_apply=True,
    export_yup=True,
)
print("Created editable carry-on.blend and browser-ready carry-on.glb")
