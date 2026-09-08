"""Bank staff rig — Kenney Animated Characters (CC0) → one .glb with the five bank verbs.

    blender -b -P apps/game/tools/bank_staff_rig.py -- <extracted-pack-dir> <out.glb> [--probe]
    blender -b -P apps/game/tools/bank_staff_rig.py -- --existing <derived.glb> <out.glb> [--probe]

`<extracted-pack-dir>` is an unzipped Kenney "Animated Characters" pack. All three of them ship the same
`Model/characterMedium.fbx` (804 verts · 1,604 tris · one UV map · one material · 32 deform bones) and the same
`Animations/{idle,run,jump}.fbx`; only the skins differ. CC0 — see CREDITS.md.

`--existing` is the charm-pass recovery path for a cold checkout: it reopens the already-derived GLB, applies only
the new head/neck/torso/leg proportion and greet clip, and does not touch any unredistributed source pack.

Two things the pack does not give us:

**A matching rest pose.** `characterMedium.fbx` is bound in a T-pose; the animation files carry the *same*
skeleton in an arms-down rest and store their keys relative to that. Dropping those actions onto the model's
armature leaves the arms in the T (the action's arm channels are near-identity). So every clip here is
retargeted through **world bone rotations**: read `pb.matrix` on the animation armature, then write it onto the
model armature parent-first as `Translation(head) @ rotation`. Bone positions keep coming from the model's own
rest hierarchy; only the hips take a translation, as the rest-relative offset of the animation's hips.

**A comic silhouette.** `_exaggerate` widens the shoulders and enlarges the hands and shoes by skin weight,
so the cast reads as drawn rather than as stock kit bodies with a black fringe.

**The bank verbs.** The pack has idle / run / jump only, so `walk`, `work` and `refuse` are authored here on
Kenney's rig, in the same world-rotation space (rotating a bone's world quaternion also carries its chain,
because children are written after their parents). Blender space is Z-up with the toes pointing −Y, so
**forward = −Y, up = +Z**. About world X, then, the sign flips with which way the bone points: a **negative**
angle swings a *hanging* limb (arms, −Z) forward, and a **positive** angle tips an *upright* bone (spine, neck,
head, +Z) forward. That is the derivation behind every angle below; world Z is yaw for all of them.

Clips written (30 fps):

  idle    Kenney `Idle`, retargeted (33 f)
  walk    Kenney `Run` slerped 45 % toward the idle stance and stretched to 26 f — a lobby walk, in place
  sprint  Kenney `Run`, retargeted (17 f) — the player's jog
  work    idle stance leaning over a counter, right hand stamping twice (28 f)
  refuse  idle stance, two-beat head shake, right palm raised (34 f)
  greet   idle stance, one nod and a small palm lift (24 f, one-shot)

`--probe` prints hand / toe / head positions per clip instead of exporting — the numeric check that stands in
for a viewport in headless Blender.
"""

import math
import os
import sys

import bpy
from mathutils import Matrix, Quaternion, Vector

FPS = 30
WALK_FRAMES = 24
WALK_AMOUNT = 0.55      # 0 = the idle stance, 1 = Kenney's full run cycle
WORK_FRAMES = 28
REFUSE_FRAMES = 34
GREET_FRAMES = 24

X, Z = Vector((1.0, 0.0, 0.0)), Vector((0.0, 0.0, 1.0))

# Deform bones, parents before children: `pb.matrix` writes must go down the chain, and the pack's rig also
# ships IK / Ctrl helpers that carry no vertex weights and are left alone.
CHAIN = [
    "Hips", "Spine", "Chest", "UpperChest", "Neck", "Head",
    "LeftShoulder", "LeftArm", "LeftForeArm", "LeftHand",
    "LeftHandIndex1", "LeftHandIndex2", "LeftHandIndex3", "LeftHandThumb1", "LeftHandThumb2",
    "RightShoulder", "RightArm", "RightForeArm", "RightHand",
    "RightHandIndex1", "RightHandIndex2", "RightHandIndex3", "RightHandThumb1", "RightHandThumb2",
    "LeftUpLeg", "LeftLeg", "LeftFoot", "LeftToes",
    "RightUpLeg", "RightLeg", "RightFoot", "RightToes",
]

ARM_CHAINS = {
    "LeftArm": ["LeftArm", "LeftForeArm", "LeftHand", "LeftHandIndex1", "LeftHandIndex2", "LeftHandIndex3",
                "LeftHandThumb1", "LeftHandThumb2"],
    "RightArm": ["RightArm", "RightForeArm", "RightHand", "RightHandIndex1", "RightHandIndex2",
                 "RightHandIndex3", "RightHandThumb1", "RightHandThumb2"],
}
for _side in ("Left", "Right"):
    ARM_CHAINS[_side + "ForeArm"] = ARM_CHAINS[_side + "Arm"][1:]
    ARM_CHAINS[_side + "Hand"] = ARM_CHAINS[_side + "Arm"][2:]
ARM_CHAINS["Spine"] = CHAIN[1:24]
ARM_CHAINS["Neck"] = ["Neck", "Head"]
ARM_CHAINS["Head"] = ["Head"]
ARM_CHAINS["LeftShoulder"] = ["LeftShoulder"] + ARM_CHAINS["LeftArm"]
ARM_CHAINS["RightShoulder"] = ["RightShoulder"] + ARM_CHAINS["RightArm"]


# ----------------------------------------------------------------------------- source pack

def _bind(ob, action):
    if ob.animation_data is None:
        ob.animation_data_create()
    ob.animation_data.action = action
    if action is not None and hasattr(ob.animation_data, "action_slot"):   # 4.4+ slotted actions
        for slot in action.slots:
            ob.animation_data.action_slot = slot
            break


def _rest_heads(arm) -> dict:
    return {b.name: b.head_local.copy() for b in arm.data.bones}


def _sample(arm, action, frames) -> list:
    """World rotation per deform bone (+ the hips' rest-relative offset) at each frame of `action`."""
    _bind(arm, action)
    rest = _rest_heads(arm)
    out = []
    for f in frames:
        bpy.context.scene.frame_set(int(math.floor(f)), subframe=f - math.floor(f))
        pose = {"rot": {}, "hips": None}
        for name in CHAIN:
            pose["rot"][name] = arm.pose.bones[name].matrix.to_quaternion()
        pose["hips"] = arm.pose.bones["Hips"].matrix.translation - rest["Hips"]
        out.append(pose)
    return out


def _load(pack: str):
    """The model (mesh + T-pose bind armature) plus one world-rotation track per shipped clip."""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.scene.render.fps = FPS
    bpy.ops.import_scene.fbx(filepath=os.path.join(pack, "Model", "characterMedium.fbx"))
    arm, mesh = bpy.data.objects["Root"], bpy.data.objects["characterMedium"]

    tracks = {}
    for clip in ("idle", "run"):
        objects, actions = set(bpy.data.objects), set(bpy.data.actions)
        bpy.ops.import_scene.fbx(filepath=os.path.join(pack, "Animations", clip + ".fbx"))
        # match on what this import added: Blender recycles datablock names once the last armature is removed,
        # so "Root.001|Root|Idle" and the run file's action can end up sharing a prefix.
        src_arm = [o for o in bpy.data.objects if o not in objects and o.type == "ARMATURE"][0]
        action = [a for a in bpy.data.actions if a not in actions and "Targeting" not in a.name][0]
        first, last = (int(v) for v in action.frame_range)
        tracks[clip] = _sample(src_arm, action, range(first, last + 1))
        for ob in [o for o in bpy.data.objects if o not in objects]:
            bpy.data.objects.remove(ob, do_unlink=True)
        for a in [a for a in bpy.data.actions if a not in actions]:
            bpy.data.actions.remove(a)
    return arm, mesh, tracks


def _load_existing(glb: str):
    """Open the already-derived glb for a charm-only re-export when the source zip is not on this machine."""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.scene.render.fps = FPS
    bpy.ops.import_scene.gltf(filepath=glb)
    return bpy.data.objects["Root"], bpy.data.objects["characterMedium"]


# ----------------------------------------------------------------------------- world-space posing

def _write(arm, pose: dict, rest: dict) -> None:
    """Put a sampled world pose on the model armature, parents first."""
    for name in CHAIN:
        pb = arm.pose.bones[name]
        head = rest["Hips"] + pose["hips"] if name == "Hips" else pb.matrix.translation.copy()
        pb.rotation_mode = "QUATERNION"
        pb.matrix = Matrix.Translation(head) @ pose["rot"][name].to_matrix().to_4x4()
        bpy.context.view_layer.update()


def _turn(pose: dict, bone: str, axis: Vector, degrees: float) -> None:
    """Rotate `bone` and everything below it about a world axis — the authored-pose primitive."""
    rot = Quaternion(axis, math.radians(degrees))
    for name in ARM_CHAINS[bone]:
        pose["rot"][name] = rot @ pose["rot"][name]


def _copy(pose: dict) -> dict:
    return {"rot": {k: v.copy() for k, v in pose["rot"].items()}, "hips": pose["hips"].copy()}


def _blend(a: dict, b: dict, amount: float) -> dict:
    out = {"rot": {}, "hips": a["hips"].lerp(b["hips"], amount)}
    for name in CHAIN:
        qa, qb = a["rot"][name], b["rot"][name].copy()
        if qa.dot(qb) < 0.0:
            qb.negate()
        out["rot"][name] = Quaternion(qa).slerp(qb, amount)
    return out


def _bake(arm, name: str, poses: list, rest: dict):
    """One action from a list of world poses, keyed frame by frame."""
    action = bpy.data.actions.new(name)
    _bind(arm, action)
    for i, pose in enumerate(poses):
        _write(arm, pose, rest)
        for bone in CHAIN:
            pb = arm.pose.bones[bone]
            pb.keyframe_insert("location", frame=1 + i)
            pb.keyframe_insert("rotation_quaternion", frame=1 + i)
    for fc in action.fcurves:
        for kp in fc.keyframe_points:
            kp.interpolation = "LINEAR"
    return action


# ----------------------------------------------------------------------------- the four bank verbs

def _retimed(track: list, count: int) -> list:
    """Resample a cycle to `count` frames, wrapping (frame 0 repeats at the end for a clean loop)."""
    out = []
    n = len(track) - 1                    # the pack's cycles repeat their first frame at the end
    for i in range(count + 1):
        t = (i % count) / count * n
        lo = int(math.floor(t))
        out.append(_blend(track[lo], track[min(lo + 1, len(track) - 1)], t - lo))
    return out


def clip_walk(stance: dict, run: list) -> list:
    """Kenney's run, damped toward the idle stance and stretched: a walk that still lands its feet."""
    return [_blend(stance, pose, WALK_AMOUNT) for pose in _retimed(run, WALK_FRAMES)]


def clip_work(stance: dict) -> list:
    """Leaning over a counter, right hand stamping twice — WORKING for every desk role."""
    out = []
    for i in range(WORK_FRAMES + 1):
        t = (i % WORK_FRAMES) / WORK_FRAMES
        stamp = max(0.0, math.sin(t * math.tau * 2.0))
        pose = _copy(stance)
        _turn(pose, "Spine", X, 7.0)                      # in over the desk (upright bone → positive leans in)
        _turn(pose, "Neck", X, 9.0)                       # eyes on the paperwork
        for side, lead in (("Left", 0.8), ("Right", 1.0)):
            _turn(pose, side + "Arm", X, -52.0 * lead)    # hanging arms swing forward
            _turn(pose, side + "ForeArm", X, -28.0 * lead)
            _turn(pose, side + "Hand", X, -10.0 * lead)
        _turn(pose, "RightForeArm", X, -16.0 * stamp)     # the stamp
        _turn(pose, "RightHand", X, -10.0 * stamp)
        out.append(pose)
    return out


def clip_refuse(stance: dict) -> list:
    """A two-beat head shake with the right palm up — REFUSING (the kit ships no `emote-no`)."""
    out = []
    for i in range(REFUSE_FRAMES + 1):
        t = (i % REFUSE_FRAMES) / REFUSE_FRAMES
        shake = math.sin(t * math.tau * 2.0)
        raise_ = math.sin(t * math.pi) ** 0.6      # up through the shake, down at both ends
        pose = _copy(stance)
        _turn(pose, "Spine", X, -4.0)                     # a small lean away (upright bone → negative leans back)
        _turn(pose, "RightArm", X, -34.0 * raise_)        # palm up between the beats
        _turn(pose, "RightForeArm", X, -62.0 * raise_)
        _turn(pose, "RightHand", X, -14.0 * raise_)
        _turn(pose, "Neck", Z, 8.0 * shake)
        _turn(pose, "Head", Z, 19.0 * shake)              # the "no"
        out.append(pose)
    return out


def clip_greet(stance: dict) -> list:
    """A short, friendly one-shot: nod once and lift the right palm without leaving the desk footprint."""
    out = []
    for i in range(GREET_FRAMES + 1):
        t = (i % GREET_FRAMES) / GREET_FRAMES
        beat = math.sin(t * math.pi) ** 0.8
        nod = math.sin(t * math.pi * 2.0) * 7.0
        pose = _copy(stance)
        _turn(pose, "Neck", X, nod * 0.55)
        _turn(pose, "Head", X, nod)
        _turn(pose, "RightArm", X, -18.0 * beat)
        _turn(pose, "RightForeArm", X, -10.0 * beat)
        _turn(pose, "RightHand", Z, 8.0 * beat)
        out.append(pose)
    return out


# ----------------------------------------------------------------------------- export / probe

def _stack(arm, names) -> None:
    """One NLA track per clip: the glTF exporter then writes one animation per verb, named for the verb."""
    _bind(arm, None)
    for name in names:
        action = bpy.data.actions[name]
        track = arm.animation_data.nla_tracks.new()
        track.name = name
        track.strips.new(name, int(action.frame_range[0]), action).name = name


def _probe(arm, names) -> None:
    for name in names:
        action = bpy.data.actions[name]
        first, last = (int(v) for v in action.frame_range)
        _bind(arm, action)
        print("PROBE %-7s %d..%d f" % (name, first, last))
        for f in range(first, last + 1, max(1, (last - first) // 6)):
            bpy.context.scene.frame_set(f)
            def tip(b):
                pb = arm.pose.bones[b]
                return (pb.matrix @ Matrix.Translation(Vector((0, pb.length, 0)))).translation
            rh, lh, rt, lt, hd = (tip(b) for b in ("RightHand", "LeftHand", "RightToes", "LeftToes", "Head"))
            print("   f%-3d Rhand(%+.2f,%+.2f,%+.2f) Lhand(%+.2f,%+.2f,%+.2f) toes R(y%+.2f z%+.2f) L(y%+.2f z%+.2f) head(y%+.2f z%+.2f x%+.2f)"
                  % (f, rh.x, rh.y, rh.z, lh.x, lh.y, lh.z, rt.y, rt.z, lt.y, lt.z, hd.y, hd.z, hd.x))


BROAD = {"LeftShoulder", "RightShoulder", "LeftArm", "RightArm", "UpperChest", "Chest"}
HANDS = {"Left": [b for b in CHAIN if b.startswith("LeftHand")], "Right": [b for b in CHAIN if b.startswith("RightHand")]}
FEET = {"Left": ["LeftFoot", "LeftToes"], "Right": ["RightFoot", "RightToes"]}

BROAD_GAIN = 0.20      # shoulders / upper chest, on X only — the graphic "V" torso
HAND_GAIN = 0.26       # oversized mitts
FOOT_GAIN = 0.20       # heavy shoes
HEAD_GAIN = 0.35       # Head is the charm/readability knob: ~1.35× before the runtime height fit
NECK_GAIN = 0.18       # keep the enlarged head planted into a readable collar
BODY_TRIM = 0.05       # shorten weighted torso/legs to move the cast toward ~5.5 heads

# The glb stays one shared mesh. These values are exported as authoring metadata and mirrored by PropKit's
# pose-scale table so each runtime wearer gets a cheap silhouette cue without a second mesh or material.
ROLE_BONE_SCALES = {
    "greeter": {"Spine": (1.08, 1.02, 0.96), "Chest": (1.08, 1.02, 0.96), "Head": (1.06, 1.06, 1.06), "Neck": (1.03, 1.03, 1.0), "LeftUpLeg": (0.96, 0.96, 0.95), "RightUpLeg": (0.96, 0.96, 0.95)},
    "clerk": {"Spine": (0.94, 0.96, 0.96), "Chest": (0.94, 0.96, 0.96), "Head": (1.02, 1.02, 1.02), "Neck": (1.01, 1.01, 1.0), "LeftUpLeg": (1.03, 1.03, 1.04), "RightUpLeg": (1.03, 1.03, 1.04)},
    "teller": {"Spine": (1.02, 1.0, 0.98), "Chest": (1.02, 1.0, 0.98), "Head": (1.0, 1.0, 1.0), "LeftUpLeg": (0.99, 0.99, 0.98), "RightUpLeg": (0.99, 0.99, 0.98)},
    "vault_keeper": {"Spine": (1.07, 1.04, 0.96), "Chest": (1.07, 1.04, 0.96), "Head": (1.03, 1.03, 1.03), "Neck": (1.02, 1.02, 1.0), "LeftUpLeg": (0.95, 0.95, 0.94), "RightUpLeg": (0.95, 0.95, 0.94)},
    "manager": {"Spine": (1.10, 1.05, 0.95), "Chest": (1.10, 1.05, 0.95), "Head": (1.0, 1.0, 1.0), "Neck": (1.0, 1.0, 1.0), "LeftUpLeg": (0.94, 0.94, 0.93), "RightUpLeg": (0.94, 0.94, 0.93)},
    "registrar": {"Spine": (0.92, 0.95, 0.95), "Chest": (0.92, 0.95, 0.95), "Head": (0.98, 0.98, 0.98), "LeftUpLeg": (1.05, 1.05, 1.06), "RightUpLeg": (1.05, 1.05, 1.06)},
    "dealer": {"Spine": (0.96, 0.98, 0.98), "Chest": (0.96, 0.98, 0.98), "Head": (1.0, 1.0, 1.0), "LeftUpLeg": (1.07, 1.07, 1.08), "RightUpLeg": (1.07, 1.07, 1.08)},
    "player": {"Head": (1.02, 1.02, 1.02), "Neck": (1.01, 1.01, 1.0)},
}


def _exaggerate(arm, mesh, include_style: bool = True) -> None:
    """Push Kenney's stock proportions toward a comic silhouette: broader shoulders, bigger hands and shoes.

    This is the *silhouette* knob — an outline pass on unchanged proportions reads as a filter, not a style
    (GameDevOS `outlines-alone-are-not-a-style`). Every vertex is scaled by its own **skin weight** in the
    region, so the change eases out along the arm and ankle instead of stepping at a group boundary, and the
    mesh is still bound in the rest pose the bind matrices were built from.
    """
    groups = {g.index: g.name for g in mesh.vertex_groups}
    rest = {b.name: b.head_local.copy() for b in arm.data.bones}
    torso_bones = {"Spine", "Chest", "UpperChest", "Hips"}
    leg_bones = {"LeftUpLeg", "LeftLeg", "LeftFoot", "LeftToes", "RightUpLeg", "RightLeg", "RightFoot", "RightToes"}
    for v in mesh.data.vertices:
        weight = {}
        for g in v.groups:
            weight[groups[g.group]] = weight.get(groups[g.group], 0.0) + g.weight
        head = min(1.0, weight.get("Head", 0.0))
        neck = min(1.0, weight.get("Neck", 0.0))
        if head > 0.0:
            pivot = rest["Head"]
            v.co = pivot + (v.co - pivot) * (1.0 + HEAD_GAIN * head)
        if neck > 0.0:
            pivot = rest["Neck"]
            v.co = pivot + (v.co - pivot) * (1.0 + NECK_GAIN * neck)
        torso = min(1.0, sum(w for b, w in weight.items() if b in torso_bones))
        legs = min(1.0, sum(w for b, w in weight.items() if b in leg_bones))
        trim = max(0.0, 1.0 - BODY_TRIM * max(torso, legs))
        if trim < 1.0:
            pivot = rest["Hips"]
            v.co.z = pivot.z + (v.co.z - pivot.z) * trim
        if include_style:
            broad = sum(w for b, w in weight.items() if b in BROAD)
            v.co.x *= 1.0 + BROAD_GAIN * min(1.0, broad)
            for side in ("Left", "Right"):
                hand = min(1.0, sum(w for b, w in weight.items() if b in HANDS[side]))
                if hand > 0.0:
                    pivot = rest[side + "Hand"]
                    v.co = pivot + (v.co - pivot) * (1.0 + HAND_GAIN * hand)
                foot = min(1.0, sum(w for b, w in weight.items() if b in FEET[side]))
                if foot > 0.0:
                    pivot = rest[side + "Foot"]
                    v.co = pivot + (v.co - pivot) * (1.0 + FOOT_GAIN * foot)


def _slim(arm, mesh) -> None:
    """Drop what the game cannot use: the rig's 26 IK / Ctrl / _end helpers (no vertex weights hang off them,
    yet the glTF exporter bakes a track for every one) and Kenney's vertex colours (Godot would multiply them
    into the atlas albedo)."""
    while mesh.data.color_attributes:
        mesh.data.color_attributes.remove(mesh.data.color_attributes[0])
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode="EDIT")
    for bone in list(arm.data.edit_bones):
        if bone.name not in CHAIN:
            arm.data.edit_bones.remove(bone)
    bpy.ops.object.mode_set(mode="OBJECT")


def _clear_nla(arm) -> None:
    if arm.animation_data is None:
        return
    for track in list(arm.animation_data.nla_tracks):
        arm.animation_data.nla_tracks.remove(track)
    arm.animation_data.action = None


def main() -> None:
    argv = sys.argv[sys.argv.index("--") + 1:]
    existing = argv[0] == "--existing"
    if existing:
        source, out = argv[1], argv[2]
        arm, mesh = _load_existing(source)
        _exaggerate(arm, mesh, include_style=False)  # the existing glb already has the shoulder / hand / shoe pass
        _slim(arm, mesh)
        rest = _rest_heads(arm)
        stance = _sample(arm, bpy.data.actions["idle"], [1])[0]
        _clear_nla(arm)
        _bake(arm, "greet", clip_greet(stance), rest)
        names = ["idle", "walk", "sprint", "work", "refuse", "greet"]
    else:
        pack, out = argv[0], argv[1]
        arm, mesh, tracks = _load(pack)
        _exaggerate(arm, mesh)
        _slim(arm, mesh)
        rest = _rest_heads(arm)
        stance = tracks["idle"][0]

        _bake(arm, "idle", tracks["idle"], rest)
        _bake(arm, "walk", clip_walk(stance, tracks["run"]), rest)
        _bake(arm, "sprint", tracks["run"], rest)
        _bake(arm, "work", clip_work(stance), rest)
        _bake(arm, "refuse", clip_refuse(stance), rest)
        _bake(arm, "greet", clip_greet(stance), rest)
        names = ["idle", "walk", "sprint", "work", "refuse", "greet"]
    arm["branch_zero_role_bone_scales"] = repr(ROLE_BONE_SCALES)
    for name in names:
        a = bpy.data.actions[name]
        print("CLIP %-7s %d..%d f" % (name, a.frame_range[0], a.frame_range[1]))

    if "--probe" in argv:
        _probe(arm, names)
        return

    _stack(arm, names)
    bpy.ops.object.select_all(action="DESELECT")
    arm.select_set(True)
    mesh.select_set(True)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.export_scene.gltf(
        filepath=out,
        export_format="GLB",
        export_animation_mode="NLA_TRACKS",
        export_animations=True,
        export_frame_range=False,
        export_bake_animation=True,
        export_optimize_animation_size=False,
        export_apply=False,
        export_yup=True,
        export_materials="EXPORT",
        export_image_format="NONE",
        export_tangents=False,
        export_skins=True,
        export_def_bones=False,
        export_cameras=False,
        export_lights=False,
        use_selection=True,
    )
    print("WROTE", out, os.path.getsize(out), "B")


main()
