"""Shared local Blender utilities for fixed-pose wardrobe authoring."""

import bpy
import bmesh
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree


def baked(source, name):
    evaluated = source.evaluated_get(bpy.context.evaluated_depsgraph_get())
    result = source.copy()
    result.data = bpy.data.meshes.new_from_object(
        evaluated,
        preserve_all_data_layers=True,
        depsgraph=bpy.context.evaluated_depsgraph_get(),
    )
    result.name = name
    bpy.context.collection.objects.link(result)
    world = source.matrix_world.copy()
    result.parent = None
    result.matrix_world = Matrix.Identity(4)
    for vertex in result.data.vertices:
        vertex.co = world @ vertex.co
    result.modifiers.clear()
    for polygon in result.data.polygons:
        polygon.use_smooth = True
    return result


def subset(source, name, predicate):
    obj = source.copy()
    obj.data = source.data.copy()
    obj.name = name
    bpy.context.collection.objects.link(obj)
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bm.faces.ensure_lookup_table()
    remove = [face for face in bm.faces if not predicate(face.index)]
    bmesh.ops.delete(bm, geom=remove, context="FACES")
    unused = [v for v in bm.verts if not v.link_faces]
    bmesh.ops.delete(bm, geom=unused, context="VERTS")
    bm.to_mesh(obj.data)
    bm.free()
    obj.vertex_groups.clear()
    return obj


def fabric(name, color):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    shader = material.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (*color, 1)
    shader.inputs["Roughness"].default_value = 0.85
    shader.inputs["Sheen Weight"].default_value = 0.2
    return material


def spot(mesh, id, label, z, w, h, price, back=False, x=0, symmetry=False):
    tree = BVHTree.FromObject(mesh, bpy.context.evaluated_depsgraph_get())
    hit, normal, _, _ = tree.ray_cast(
        Vector((x, 5 if back else -5, z)), Vector((0, -1 if back else 1, 0)), 10
    )
    if hit is None:
        raise RuntimeError(f"No surface at {label}")
    if symmetry:
        # The spine is a center seam: opposite triangles have different face
        # normals. Use the local symmetric tangent rather than either side.
        neighbors = [
            tree.ray_cast(
                Vector((dx, 5 if back else -5, z)),
                Vector((0, -1 if back else 1, 0)),
                10,
            )[1]
            for dx in [-0.005, 0.005]
        ]
        if all(n is not None for n in neighbors):
            normal = (neighbors[0] + neighbors[1]).normalized()
    normal = Vector((normal.x, normal.z, -normal.y))
    right = Vector((0, 1, 0)).cross(normal).normalized()
    up = normal.cross(right).normalized()
    rotation = Matrix((right, up, normal)).transposed().to_euler("ZYX")
    return dict(
        id=id,
        name=label,
        position=[hit.x, hit.z, -hit.y],
        rotation=list(rotation),
        width=w,
        height=h,
        price=price,
        meshName=mesh.name,
        projection=True,
    )


def aim(obj, target):
    obj.rotation_euler = (
        (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()
    )
