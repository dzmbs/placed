"""Load the pinned workspace copy of MPFB without changing Blender preferences."""

from pathlib import Path
import sys
import bpy

ROOT = Path(__file__).resolve().parents[1]
TOOLING = ROOT / "data/tooling/mpfb"


def load_mpfb():
    sys.path.insert(0, str(TOOLING / "mpfb2-2.0.17/src"))
    extension_path = bpy.utils.extension_path_user

    def workspace_path(package, *args, **kwargs):
        if package == "mpfb":
            return str(TOOLING / "user")
        return extension_path(package, *args, **kwargs)

    bpy.utils.extension_path_user = workspace_path
    import mpfb

    preference = mpfb.get_preference

    def workspace_preference(name):
        if name == "mpfb_user_data":
            return str(TOOLING / "user")
        return preference(name)

    mpfb.get_preference = workspace_preference
    mpfb.bl_info = mpfb.fake_bl_info
    bpy.context.preferences.addons.new().module = "mpfb"
    mpfb.register()
    from mpfb.services.locationservice import LocationService

    LocationService._second_root = str(TOOLING / "assets")
    return mpfb
