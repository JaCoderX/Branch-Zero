extends Node
class_name DemoWalk
## Demo walk autopilot — walks the desk circuit instead of F-key teleports, at a reading pace.
## Enable with: godot --path apps/game -- --demo=walk
##        or:   ?mock=account&demo=walk on the web shell (window.BranchZero.demoWalk — see wanted())
##        or:   BRANCH_ZERO_DEMO=walk
## MockChain only. Story: Mo → Dev files a 250 wire (over the limit) and escorts us → Bob refuses early
## (BeforeReleaseTime) → Okafor's Priority release → Petra at the Name Desk → back to the lobby board.
##
## Routing: every leg is a list of lobby-side waypoints that stays off the manager glass (z = -5, door x ∈ [-9, -7],
## east pane x = -1), the vault partition (opening x ∈ [6, 10]), the lobby plants (z = -3.2), the benches (z = 2.5)
## and the rope line (x = -8, z ∈ [-2.4, 1.6]). Desk spots are the ones tests/viz_shots.gd already frames.

## Pauses (seconds). READ_* scale with the on-screen text so the box can actually be read.
const BEAT := 1.0
const SETTLE := 1.6
const READ_MIN := 3.0
const READ_MAX := 7.5
const READ_PER_CHAR := 0.045
const FOLLOW_SPEED := 3.4            # a step slower than the escort (npc.gd _ESCORT_SPEED 3.2 + our head start)
const OFFICE_CAM := 1.7              # boom inside the 6 m glass office; 5 m would put the lens through the pane
const VAULT_CAM := 2.6               # boom inside the antechamber; the 3.8 m two-shot lens sat in the lobby with the jamb mid-frame
const DESK_CAM := 2.4                # boom at Petra's Counter 2 window; keeps the two-shot lens short of the rope line
const DEMO_TIMELOCK_SEC := 100       # mock cooling stretched so Okafor still has a cooling wire to release

# Desk spots (x, z) — viz_shots 02/04/07/06/08.
const SPOT_MO := Vector2(3.0, 6.0)
const SPOT_DEV := Vector2(-9.5, 3.0)
const SPOT_VAULT_WAIT := Vector2(8.0, -3.6)   # just outside the opening while Dev finishes the escort
const SPOT_BOB := Vector2(8.4, -7.2)         # a step inside the opening so the two-shot lens (~(6.1, -8.4)) stays in the room
const SPOT_VAULT_DOOR := Vector2(8.0, -6.5)   # main.gd F4 spot — the door, clock and cooling line read from here
const SPOT_OKAFOR := Vector2(-8.0, -7.15)
const SPOT_PETRA := Vector2(-9.5, -1.0)       # lobby side of Counter 2, Petra's teller bay since U7 polish (same offset as Dev's spot)
const SPOT_END := Vector2(3.0, 5.5)

const NPC_MO := Vector3(2.0, 0.0, 4.5)
const NPC_DEV := Vector3(-11.6, 0.0, 3.0)
const NPC_BOB := Vector3(10.0, 0.0, -7.5)
const NPC_OKAFOR := Vector3(-8.0, 0.0, -9.8)
const NPC_PETRA := Vector3(-11.6, 0.0, -1.0)
const DEV_VAULT_END := Vector3(8.0, 0.0, -6.8)
const DOOR_POS := Vector3(8.0, 0.0, -10.7)    # vault_door.gd node position
const DOOR_READ := 4.0                        # seconds on the door clock after Bob
const GO_TIMEOUT := 40.0                      # desktop: how long to wait for the recorder's go marker

# Legs. Each is the ordered waypoint list from the previous spot.
const ROUTE_TO_MO: Array[Vector2] = [Vector2(3.0, 6.0)]
const ROUTE_TO_DEV: Array[Vector2] = [Vector2(0.5, 4.2), Vector2(-6.0, 3.6), Vector2(-9.5, 3.0)]
# Parallel to Dev's escort line, one lane south of the plants, through the bench gap west of bench 0.
const ROUTE_TO_VAULT_WAIT: Array[Vector2] = [Vector2(-6.6, 3.4), Vector2(-6.6, 0.6), Vector2(-2.0, -0.6), Vector2(5.2, -2.0), Vector2(8.0, -3.6)]
const ROUTE_INTO_VAULT: Array[Vector2] = [Vector2(8.0, -6.3), Vector2(8.4, -7.2)]
# Out of the opening, along the z = -1.7 lane (plants at -3.2 clear by 1.1 m), to the office door, straight in.
const ROUTE_TO_OKAFOR: Array[Vector2] = [Vector2(8.2, -5.6), Vector2(8.0, -3.7), Vector2(4.4, -1.7), Vector2(-6.0, -1.7), Vector2(-8.0, -4.3), Vector2(-8.0, -6.2), Vector2(-8.0, -7.15)]
# Back out through the door, west along z ≈ -4 past the records annex (glass at -5, Counter 2 ends at -2.8), then
# south down the teller-side lane to Petra's window at Counter 2 (rope's north post is at (-8, -2.4)).
const ROUTE_TO_PETRA: Array[Vector2] = [Vector2(-8.0, -6.0), Vector2(-8.0, -4.3), Vector2(-9.3, -3.6), Vector2(-9.5, -1.0)]
# Back north up the teller lane, around the north end of the rope, across the lobby, through the bench gap x ∈ [2.4, 3.6], up to the board.
const ROUTE_TO_END: Array[Vector2] = [Vector2(-9.3, -3.6), Vector2(-8.6, -4.0), Vector2(-7.4, -3.6), Vector2(-6.2, -1.6), Vector2(0.0, -0.5), Vector2(3.0, 0.5), Vector2(3.0, 5.5)]

var _player: CharacterBody3D
var _main: Node3D
var _slip: Control
var _done := false
var _last_text_len := 0


static func wanted() -> bool:
	if OS.get_environment("BRANCH_ZERO_DEMO").strip_edges().to_lower() == "walk":
		return true
	for a in OS.get_cmdline_user_args():
		var s := str(a).strip_edges().to_lower()
		if s == "--demo=walk" or s == "demo=walk" or s.ends_with("demo=walk"):
			return true
	# Web: the shell sets window.BranchZero.demoWalk from ?demo=walk (no JavaScriptBridge.eval — GODOT.md).
	if OS.has_feature("web"):
		var bz = JavaScriptBridge.get_interface("BranchZero")
		if bz != null and bool(bz.demoWalk):
			return true
	return false


func _ready() -> void:
	name = "DemoWalk"
	_main = get_parent() as Node3D
	Dialogue.node_changed.connect(func(_speaker: String, _role: String, text: String, choices: Array) -> void:
		_last_text_len = text.length()
		for c in choices:
			_last_text_len += str(c).length() / 2)
	call_deferred("_boot")


func _boot() -> void:
	while not GameState.booted:
		await get_tree().process_frame
	_player = _main.get_node_or_null("Player") as CharacterBody3D
	_slip = _main.get_node_or_null("UI/PaymentSlip") as Control
	if _player == null:
		push_error("DemoWalk: no Player")
		return
	if not Chain.use_mock or Chain._mock == null:
		push_error("DemoWalk: MockChain only — refusing to drive the real bridge")
		return
	# Desktop MockChain starts empty; web ?mock=account already presets. The longer clock keeps the vault
	# beats in order at reading pace (Bob refuses early, Okafor still has a cooling wire).
	Chain._mock.timelock_sec = DEMO_TIMELOCK_SEC
	Chain._mock.preset_account()
	await GameState.refresh_all()
	print("DemoWalk: starting desk circuit (account=%s, mock clock %ds)" % [GameState.account(), DEMO_TIMELOCK_SEC])
	await _wait_for_go()
	await _run()
	_done = true
	print("DemoWalk: DONE")
	if not OS.has_feature("web"):
		var marker := OS.get_environment("BRANCH_ZERO_DEMO_MARKER").strip_edges()
		if marker.is_empty():
			marker = "user://demo_walk_done.txt"
		var f := FileAccess.open(marker, FileAccess.WRITE)
		if f:
			f.store_string("ok\n")
			f.close()


## Desktop: scripts/record-demo-walk.ps1 writes BRANCH_ZERO_DEMO_GO once ffmpeg is rolling, so the first steps
## toward Mo are on film. Without the variable (web, hand runs) the old 2 s idle applies.
func _wait_for_go() -> void:
	var go := ""
	if not OS.has_feature("web"):
		go = OS.get_environment("BRANCH_ZERO_DEMO_GO").strip_edges()
	if go.is_empty():
		await _pause(2.0)
		return
	var t := 0.0
	while t < GO_TIMEOUT and not FileAccess.file_exists(go):
		await _pause(0.2)
		t += 0.2
	print("DemoWalk: go marker %s after %.1f s" % ["seen" if FileAccess.file_exists(go) else "NOT seen", t])
	await _pause(1.0)


func _run() -> void:
	# 1. Lobby — Mo says hello.
	await _walk(ROUTE_TO_MO)
	await _face(NPC_MO)
	await _talk("greeter")
	await _read()
	await _pick(["What's the vault for?"])
	await _read()
	await _pick(["Thanks.", "Sure.", "OK.", "Got it."])
	await _closed()
	await _pause(SETTLE)

	# 2. Counter 1 — Dev: 250 is over the 100 limit, so the slip becomes a wire and he walks us to the vault.
	await _walk(ROUTE_TO_DEV)
	await _face(NPC_DEV)
	await _talk("teller")
	await _read()
	await _pick(["Make a payment"])
	await _wait_slip()
	await _pause(2.2)   # let the slip be seen before it is filled
	if _slip and _slip.has_method("demo_fill_and_submit"):
		_slip.call("demo_fill_and_submit", "250", "demo walk")
	await _settled(12.0)
	await _read()
	await _pick(["OK"])                       # files the wire; Dev says "Walk with me."
	await _settled(20.0)
	await _read()
	await _pick(["Thanks.", "OK."])
	await _closed()
	await _pause(BEAT)

	# 3. Follow Dev to the vault, let him finish at the opening, then step in to Bob.
	await _walk(ROUTE_TO_VAULT_WAIT, FOLLOW_SPEED)
	await _wait_escort_clear()
	_player.set_cam_dist(VAULT_CAM)           # eases in during the two steps through the opening
	await _walk(ROUTE_INTO_VAULT)
	await _face(NPC_BOB)
	await _talk("vault_keeper")               # two-shot stays on: Bob beside the shoulder, lens inside the room
	await _read()
	var early := Dialogue.find_choice("Try to release")
	if early >= 0:
		Dialogue.choose(early)                # BeforeReleaseTime — the clock is the contract's
		await _settled(15.0)
		await _read()
		await _pick(["Ask why"])
		await _read()
		await _pick(["OK.", "Thanks.", "I'll wait."])
	else:
		await _pick(["I'll wait.", "Thanks.", "OK."])
	await _closed()
	# Door read: step back to the F4 spot and face the vault door so the clock and the cooling line are on film.
	await _walk([SPOT_VAULT_DOOR])
	await _face(DOOR_POS)
	await _pause(DOOR_READ)
	_player.set_cam_dist(0.0)                 # wide again for the lobby crossing

	# 4. Manager's office — Priority release (mock hand scan, no Passkey). Short boom: the office is glass.
	await _walk(ROUTE_TO_OKAFOR)
	_player.set_cam_dist(OFFICE_CAM)
	await _face(NPC_OKAFOR)
	await _talk("manager")
	_player.set_talk_framing(false)           # the two-shot swing would put the lens in the pane
	await _read()
	var released := false
	if Dialogue.find_choice("Priority release") >= 0:
		await _pick(["Priority release"])
		await _settled(8.0)
		await _read()
		var pri := Dialogue.find_choice("Priority #")
		if pri >= 0:
			Dialogue.choose(pri)
			await _settled(25.0)
			await _read()
			released = true
			await _pick(["Ask why"])
			await _read()
	await _pick(["Thanks.", "OK.", "Back", "Nothing today."])
	await _closed()
	await _pause(BEAT)
	_player.set_cam_dist(0.0)

	# 5. Name Desk — Petra at the Counter 2 window (U7 polish); we stand on the lobby side like at Dev's counter.
	await _walk(ROUTE_TO_PETRA)
	_player.set_cam_dist(DESK_CAM)            # two-shot lens lands east of the rope line, clear of the benches
	await _face(NPC_PETRA)
	await _talk("registrar")
	await _read()
	await _pick(["Who's registered?"])
	await _read()
	await _pick(["Back", "Thanks.", "Just looking.", "OK."])
	if Dialogue.active:
		await _read()
		await _pick(["Thanks.", "Just looking.", "OK."])
	await _closed()
	await _pause(SETTLE)
	_player.set_cam_dist(0.0)

	# 6. If the manager path did not release, Bob will once the clock runs down — otherwise straight to the board.
	if not released:
		await _walk(ROUTE_TO_END.slice(0, 5))
		await _walk([Vector2(5.2, -2.0), Vector2(8.0, -3.6)])
		_player.set_cam_dist(VAULT_CAM)
		await _walk(ROUTE_INTO_VAULT)
		await _face(NPC_BOB)
		await _talk("vault_keeper")
		await _read()
		var rel := Dialogue.find_choice("Release #")
		if rel >= 0:
			Dialogue.choose(rel)
			await _settled(15.0)
			await _read()
		await _pick(["Thanks.", "OK.", "Not yet.", "I'll wait."])
		await _closed()
		_player.set_cam_dist(0.0)
		await _walk([Vector2(8.2, -5.6), Vector2(8.0, -3.6), Vector2(4.0, -1.0), Vector2(3.0, 0.5), Vector2(3.0, 5.5)])
	else:
		await _walk(ROUTE_TO_END)
	_player.turn_to(0.0)                      # the ledger board on the north partition
	await _pause(4.0)


# ---------------------------------------------------------------- movement

func _walk(route: Array, speed: float = 4.0) -> void:
	for wp in route:
		var p := Vector3(wp.x, 0.1, wp.y)
		var ok: bool = await _player.walk_to(p, 0.5, 30.0, speed)
		if not ok:
			push_warning("DemoWalk: timed out walking to %s — nudging" % str(wp))
			_player.global_position = p
			_player.clear_steer()


## Turn body and camera toward an NPC and give the ease a moment before talking.
func _face(target: Vector3) -> void:
	var d := target - _player.global_position
	_player.turn_to(atan2(-d.x, -d.z))
	await _pause(BEAT)


## Dev parks at the vault opening for npc.gd _VAULT_PAUSE, then walks home. Wait until he has left the
## spot we want (or give up after a while) so we never shove him.
func _wait_escort_clear() -> void:
	var dev := _find_npc("teller")
	if dev == null:
		return
	var t := 0.0
	# first, wait for him to arrive (if he is still on the way) — we do not want to walk past him either
	while t < 14.0 and dev.global_position.distance_to(DEV_VAULT_END) > 2.5 and not dev.can_talk():
		await get_tree().process_frame
		t += get_process_delta_time()
	t = 0.0
	while t < 12.0 and dev.global_position.distance_to(DEV_VAULT_END) < 2.0:
		await get_tree().process_frame
		t += get_process_delta_time()
	await _pause(0.8)


# ---------------------------------------------------------------- dialogue

func _talk(npc_id: String) -> void:
	var npc := _find_npc(npc_id)
	if npc == null:
		push_warning("DemoWalk: missing NPC %s" % npc_id)
		return
	_player.look_at_point(npc.global_position)
	var t := 0.0
	while t < 25.0 and not npc.can_talk():
		await get_tree().process_frame
		t += get_process_delta_time()
	npc.interact()
	var opened := 0.0
	while not Dialogue.active and opened < 5.0:
		await get_tree().process_frame
		opened += get_process_delta_time()


func _find_npc(npc_id: String) -> Node:
	var root := _main.get_node_or_null("NPCs")
	if root == null:
		return null
	for c in root.get_children():
		if c is Npc and c.npc_id == npc_id:
			return c
	return null


## Pause long enough to read what is on screen (text + half the choice labels).
func _read() -> void:
	await _wait_choices_ready(8.0)
	var sec := clampf(READ_MIN + READ_PER_CHAR * _last_text_len, READ_MIN, READ_MAX)
	await _pause(sec)


func _pick(needles: Array) -> void:
	await _wait_choices_ready(8.0)
	if not Dialogue.active or Dialogue.is_working:
		return
	for n in needles:
		var i := Dialogue.find_choice(str(n))
		if i >= 0:
			print("DemoWalk: choose [%d] ~ %s" % [i, n])
			Dialogue.choose(i)
			await _pause(BEAT)
			return
	var labels := Dialogue.choice_labels()
	if labels.is_empty():
		print("DemoWalk: close (no choices)")
		Dialogue.close()
		await _pause(BEAT)
		return
	var idx := labels.size() - 1
	print("DemoWalk: choose fallback [%d] %s" % [idx, labels[idx]])
	Dialogue.choose(idx)
	await _pause(BEAT)


func _wait_slip(timeout: float = 8.0) -> void:
	var t := 0.0
	while t < timeout:
		if _slip != null and _slip.visible:
			return
		await get_tree().process_frame
		t += get_process_delta_time()


func _wait_choices_ready(timeout: float) -> void:
	var t := 0.0
	var saw_active := false
	while t < timeout:
		if Dialogue.active and not Dialogue.is_working:
			saw_active = true
			if not Dialogue.choice_labels().is_empty() or t > 0.45:
				return
		elif saw_active and not Dialogue.active:
			return
		await get_tree().process_frame
		t += get_process_delta_time()


## Wait for a running action (stage text) to finish and the next node to show.
func _settled(timeout: float) -> void:
	var t := 0.0
	while t < timeout:
		if not Dialogue.active:
			return
		if not Dialogue.is_working and not Dialogue.choice_labels().is_empty():
			await _pause(0.4)
			return
		await get_tree().process_frame
		t += get_process_delta_time()


func _closed(timeout: float = 15.0) -> void:
	var t := 0.0
	while t < timeout and Dialogue.active:
		await get_tree().process_frame
		t += get_process_delta_time()
	await _pause(0.3)


func _pause(sec: float) -> void:
	await get_tree().create_timer(sec).timeout
