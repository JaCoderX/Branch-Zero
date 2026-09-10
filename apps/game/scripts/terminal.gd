class_name BankTerminal
extends Node3D
## The bank's back-office computer — an interactable placed on an existing `computerScreen` prop
## (docs/TERMINAL-CONSOLE.md §3). Talking to it opens `dialogue/terminal.json`, exactly like an NPC:
## Dialogue → GameState.run_action → Chain. Nothing here touches the bridge.
##
## Why its zone is small. The two screens sit on desks their NPC also stands at (Okafor is 1 m from
## MgrScreen, Ines 1.7 m from AOScreen), so main.gd picks whichever of {nearest NPC, nearest terminal} is
## actually closer. A radius near the desk's own depth means "lean over the keyboard" reads as the terminal
## and "stand back" reads as the clerk.

signal player_near(terminal: BankTerminal, near: bool)

const ZONE_RADIUS := 1.9

@export var terminal_id: String = "terminal"
@export var display_name: String = "the branch terminal"

var _zone: Area3D


func _ready() -> void:
	add_to_group("terminal")
	name = "Terminal_" + terminal_id

	_zone = Area3D.new()
	_zone.name = "InteractZone"
	var shape := CollisionShape3D.new()
	var sphere := SphereShape3D.new()
	sphere.radius = ZONE_RADIUS
	shape.shape = sphere
	shape.position.y = 0.6
	_zone.add_child(shape)
	_zone.body_entered.connect(func(b: Node3D) -> void:
		if b.is_in_group("player"):
			player_near.emit(self, true))
	_zone.body_exited.connect(func(b: Node3D) -> void:
		if b.is_in_group("player"):
			player_near.emit(self, false))
	add_child(_zone)


## Mirrors `Npc.can_talk()` so main.gd can rank NPCs and terminals with one rule. A terminal is never busy
## on its own account: while a shell overlay (the Console, the iNPC panel) is up the player cannot reach the canvas.
func can_talk() -> bool:
	return not Dialogue.active and not GameState.busy and not GameState.overlay_open()


func interact() -> void:
	if can_talk():
		Dialogue.start("terminal")


## The HUD line offered while the player stands in reach. main.gd asks the prop rather than assuming every terminal
## is a bank computer — the iNPC (scripts/inpc.gd) ranks with the terminals for the [Space] prompt but says "wake".
func prompt_text() -> String:
	return Dialogue.interpolate(str(GameState.strings.get("prompt_terminal", "[Space] Use {terminal}")), {"terminal": display_name})
